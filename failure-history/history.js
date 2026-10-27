// Writes failure-history's result: each failed job of this run with a verdict from the same job's
// earlier runs, and a trimmed log of each. Inputs come in as INPUT_* variables.
import fs from 'node:fs';
import path from 'node:path';
import { failedTests, trimLog, verdict } from '../src/failure-history.js';

const env = process.env;
const api = `${env.GITHUB_API_URL}/repos/${env.GITHUB_REPOSITORY}`;
const dir = env.STAGE_DIR;
const headers = { Authorization: `Bearer ${env.INPUT_TOKEN}`, Accept: 'application/vnd.github+json' };

async function get(url, as = 'json') {
    // GitHub answers the odd request with a 5xx that goes away on a retry
    for (let tries = 1; ; tries++) {
        const response = await fetch(url.startsWith('http') ? url : `${api}/${url}`, { headers });
        if (response.ok) {
            return as === 'json' ? response.json() : response.text();
        }
        if (response.status < 500 || tries === 3) {
            const error = new Error(`${response.status} from ${url}`);
            error.status = response.status;
            throw error;
        }
        await new Promise(resolve => setTimeout(resolve, tries * 2000));
    }
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
    // A failed earlier call of the same job, in a re-run, is not something to check
    const failed = now
        .filter(job => job.conclusion === 'failure' && job.name.startsWith(prefix) && job.name !== self?.name)
        .slice(0, Number(env.INPUT_MAX_JOBS));
    const result = {
        v: 1,
        run: {
            id: runId, attempt, name: run.name, url: run.html_url, event: run.event,
            branch: run.head_branch, sha: run.head_sha,
        },
        jobs: [],
    };
    if (!failed.length) {
        console.log('No failed job to check');
        return { result, self };
    }

    const query = `status=completed&exclude_pull_requests=true&per_page=${env.INPUT_HISTORY}`;
    const [onBranch, anywhere] = await Promise.all([
        get(`actions/workflows/${run.workflow_id}/runs?${query}&branch=${encodeURIComponent(run.head_branch)}`),
        get(`actions/workflows/${run.workflow_id}/runs?${query}`),
    ]);
    const runs = new Map([run, ...onBranch.workflow_runs, ...anywhere.workflow_runs].map(r => [r.id, r]));
    const earlier = [];
    for (const r of runs.values()) {
        // An earlier run only adds history, so one that cannot be read is left out
        const runJobs = await jobs(`actions/runs/${r.id}/jobs?filter=all`).catch(error => {
            console.log(`::warning::Left run ${r.id} out of the history: ${error.message}`);
            return [];
        });
        for (const job of runJobs) {
            if (r.id !== runId || job.run_attempt < attempt) {
                earlier.push({ job, run: r });
            }
        }
    }

    let logsLeft = Number(env.INPUT_MAX_HISTORY_LOGS);
    fs.mkdirSync(path.join(dir, 'logs'), { recursive: true });
    for (const [i, job] of failed.entries()) {
        const log = await get(`actions/jobs/${job.id}/logs`, 'text').catch(() => '');
        const current = { step: failedStep(job), tests: failedTests(log) };
        const history = [];
        // Only what ran before this job: a newer run on the branch says nothing about why this failed
        const before = earlier.filter(e => e.job.name === job.name && (e.job.started_at ?? e.run.created_at) < job.started_at);
        for (const { job: old, run: r } of before) {
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
        const { kind, reason } = verdict(current, history, { branch: run.head_branch, sha: run.head_sha });
        result.jobs.push({
            name: prefix ? job.name.slice(prefix.length) : job.name,
            url: job.html_url,
            ...current,
            verdict: kind,
            reason,
            log: file,
        });
    }
    return { result, self };
}

let result = { v: 1, run: null, jobs: [] };
let self = null;
try {
    ({ result, self } = await main());
} catch (error) {
    const hint = [401, 403, 404].includes(error.status) ? ' The job needs `actions: read`.' : '';
    console.log(`::warning title=No failure history::Could not read this run's jobs: ${error.message}.${hint}`);
}
fs.mkdirSync(dir, { recursive: true });
const file = path.join(dir, 'result.json');
fs.writeFileSync(file, JSON.stringify(result, null, 2));
for (const job of result.jobs) {
    console.log(`${job.name}: ${job.verdict}. ${job.reason}`);
}
// Each call in a run uploads its own artifact, and their names have to differ
fs.appendFileSync(env.GITHUB_OUTPUT, [
    `count=${result.jobs.length}`,
    `file=${file}`,
    `result=${JSON.stringify(result)}`,
    `artifact=failure-history-${env.GITHUB_RUN_ATTEMPT}-${self?.id ?? Date.now()}`,
    '',
].join('\n'));
