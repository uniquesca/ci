// Renders .ai-review/report.json for ai-render-report. Inputs come in as INPUT_* variables,
// outputs go to GITHUB_OUTPUT. Never fails: a report it cannot use falls back to the final
// message the agent ended on.
import fs from 'node:fs';
import path from 'node:path';
import { normaliseReport, renderReport, renderStatus, replaceStatus } from '../src/ai-report.js';

const env = process.env;
const out = path.join(env.RUNNER_TEMP, 'ai-render-report');
fs.mkdirSync(out, { recursive: true });

const outputs = { rendered: 'false', body_file: '', status_file: '', headline: '' };

function warn(message) {
    console.log(`::warning title=Report problem::${message}`);
}

let raw = null;
if (fs.existsSync(env.INPUT_REPORT_FILE)) {
    try {
        raw = JSON.parse(fs.readFileSync(env.INPUT_REPORT_FILE, 'utf8'));
    } catch {
        warn(`${env.INPUT_REPORT_FILE} is not valid JSON`);
    }
} else {
    warn(`The agent wrote no ${env.INPUT_REPORT_FILE}`);
}

const { report, problems } = raw ? normaliseReport(raw) : { report: null, problems: [] };
problems.forEach(warn);

if (report) {
    const body = path.join(out, 'body.md');
    fs.writeFileSync(body, renderReport(report, { underStatus: env.INPUT_UNDER_STATUS === 'true' }) + '\n');

    const status = path.join(out, 'status.md');
    fs.writeFileSync(status, renderStatus(report, env.INPUT_LABEL) + '\n');

    Object.assign(outputs, { rendered: 'true', body_file: body, status_file: status, headline: report.headline });
} else if (env.INPUT_FALLBACK_FILE && fs.existsSync(env.INPUT_FALLBACK_FILE)) {
    // A copy, because the caller may append to what it is handed
    const body = path.join(out, 'body.md');
    fs.copyFileSync(env.INPUT_FALLBACK_FILE, body);
    outputs.body_file = body;
    warn('Posting the final message the agent ended on instead');
}

if (report && env.INPUT_PULL_REQUEST) {
    const api = `${env.GITHUB_API_URL}/repos/${env.GITHUB_REPOSITORY}/pulls/${env.INPUT_PULL_REQUEST}`;
    const headers = { Authorization: `Bearer ${env.INPUT_TOKEN}`, Accept: 'application/vnd.github+json' };
    try {
        const pull = await (await fetch(api, { headers })).json();
        const body = replaceStatus(pull.body, renderStatus(report, env.INPUT_LABEL));
        const response = await fetch(api, { method: 'PATCH', headers, body: JSON.stringify({ body }) });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        console.log(`Updated the status block on #${env.INPUT_PULL_REQUEST}`);
    } catch (error) {
        warn(`Could not update the status block on #${env.INPUT_PULL_REQUEST}: ${error.message}`);
    }
}

fs.appendFileSync(env.GITHUB_OUTPUT, Object.entries(outputs)
    .map(([key, value]) => `${key}=${String(value).replace(/\n/g, ' ')}\n`).join(''));
