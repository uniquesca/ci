// Stages the failed jobs of this run for ai-failure-summary: a trimmed log of each, and a verdict
// from the same job's earlier runs. Inputs come in as INPUT_* variables.
import fs from 'node:fs';
import path from 'node:path';
import { failedTests, trimLog, verdict } from '../src/ai-failure.js';

const env = process.env;
const api = `${env.GITHUB_API_URL}/repos/${env.GITHUB_REPOSITORY}`;
const dir = env.STAGE_DIR;
const headers = { Authorization: `Bearer ${env.INPUT_TOKEN}`, Accept: 'application/vnd.github+json' };

async function get(url, as = 'json') {
    const response = await fetch(url.startsWith('http') ? url : `${api}/${url}`, { headers });
    if (!response.ok) {
        throw new Error(`${response.status} from ${url}`);
    }
    return as === 'json' ? response.json() : response.text();
}

async function jobs(url) {
    const all = [];
    for (let page = 1; ; page++) {
        const { jobs: batch } = await get(`${url}${url.includes('?') ? '&' : '?'}per_page=100&page=${page}`);
        all.push(...batch);
        if (batch.length < 100) {
            return all;
        }
    }
}

const failedStep = job => job.steps?.find(step => step.conclusion === 'failure')?.name ?? null;

async function main() {
    const runId = Number(env.GITHUB_RUN_ID);
    const attempt = Number(env.GITHUB_RUN_ATTEMPT);
    const run = await get(`actions/runs/${runId}`);
    const now = await jobs(`actions/runs/${runId}/attempts/${attempt}/jobs`);

    // Inside a reusable workflow every job is named `<caller job> / <job>`, and only the jobs
    // sharing this one's prefix are the workflow's own. Another call in the same run summarises
    // its own.
    const self = now.find(job => job.status === 'in_progress' && job.runner_name === env.RUNNER_NAME);
    const prefix = self?.name.includes(' / ') ? self.name.slice(0, self.name.lastIndexOf(' / ') + 3) : '';
    const failed = now
        .filter(job => job.conclusion === 'failure' && job.name.startsWith(prefix))
        .slice(0, Number(env.INPUT_MAX_JOBS));
    if (!failed.length) {
        console.log('No failed job to summarise');
        return [];
    }

    const query = `status=completed&exclude_pull_requests=true&per_page=${env.INPUT_HISTORY}`;
    const [onBranch, anywhere] = await Promise.all([
        get(`actions/workflows/${run.workflow_id}/runs?${query}&branch=${encodeURIComponent(run.head_branch)}`),
        get(`actions/workflows/${run.workflow_id}/runs?${query}`),
    ]);
    const runs = new Map([run, ...onBranch.workflow_runs, ...anywhere.workflow_runs].map(r => [r.id, r]));
    const earlier = [];
    for (const r of runs.values()) {
        for (const job of await jobs(`actions/runs/${r.id}/jobs?filter=all`)) {
            if (r.id !== runId || job.run_attempt < attempt) {
                earlier.push({ job, run: r });
            }
        }
    }

    let logsLeft = Number(env.INPUT_MAX_HISTORY_LOGS);
    fs.mkdirSync(path.join(dir, 'logs'), { recursive: true });
    const staged = [];
    for (const [i, job] of failed.entries()) {
        const log = await get(`actions/jobs/${job.id}/logs`, 'text').catch(() => '');
        const current = { step: failedStep(job), tests: failedTests(log) };
        const history = [];
        for (const { job: old, run: r } of earlier.filter(e => e.job.name === job.name)) {
            const entry = {
                number: r.run_number, attempt: old.run_attempt, url: old.html_url, branch: r.head_branch,
                sha: old.head_sha, conclusion: old.conclusion, step: failedStep(old), tests: [],
                at: old.started_at ?? r.created_at,
            };
            if (old.conclusion === 'failure') {
                entry.tests = null;
                if (current.tests.length && entry.step === current.step && logsLeft > 0) {
                    logsLeft--;
                    // A log past retention is gone, and stays `null`: matched on the step alone
                    entry.tests = await get(`actions/jobs/${old.id}/logs`, 'text').then(failedTests).catch(() => null);
                }
            }
            history.push(entry);
        }
        history.sort((a, b) => b.at.localeCompare(a.at));

        const file = `logs/${i + 1}.log`;
        fs.writeFileSync(path.join(dir, file), trimLog(log, Number(env.INPUT_MAX_LOG_LINES)));
        staged.push({
            name: prefix ? job.name.slice(prefix.length) : job.name,
            url: job.html_url,
            ...current,
            verdict: verdict(current, history, { branch: run.head_branch, sha: run.head_sha }),
            log: file,
        });
    }
    return staged;
}

let staged = [];
try {
    staged = await main();
} catch (error) {
    console.log(`::warning title=No failure summary::Could not read this run's jobs: ${error.message}. The job needs \`actions: read\`.`);
}
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'jobs.json'), JSON.stringify(staged, null, 2));
fs.appendFileSync(env.GITHUB_OUTPUT, `count=${staged.length}\n`);
