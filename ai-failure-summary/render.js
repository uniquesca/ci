// Writes the run summary for ai-failure-summary, from the staged jobs and whatever the agent wrote.
// Without the agent's answer it still shows the verdict and the log.
import fs from 'node:fs';
import path from 'node:path';

const dir = process.env.STAGE_DIR;
const jobs = JSON.parse(fs.readFileSync(path.join(dir, 'jobs.json'), 'utf8'));
let answers = [];
try {
    answers = JSON.parse(fs.readFileSync(path.join(dir, 'result.json'), 'utf8')).jobs ?? [];
} catch {
    console.log('::warning title=No AI explanation::The agent wrote no answer, so the summary has the verdicts and logs only');
}

const LABEL = { flaky: 'Flaky', broken: 'Broken', new: 'New failure', unknown: 'Unknown' };
const CONFIDENCE = ['certain', 'highly likely', 'likely', 'probably', 'maybe'];
// What to do without the agent's answer, from the verdict alone
const NEXT = {
    flaky: 'Re-run the job. If it keeps happening, fix the test.',
    broken: 'Fix the failure: re-running will not help.',
    new: 'Look at the latest change on this branch.',
    unknown: 'Read the log below.',
};
const fence = text => {
    const ticks = '`'.repeat(Math.max(3, ...[...text.matchAll(/`+/g)].map(m => m[0].length + 1)));
    return `${ticks}text\n${text}\n${ticks}`;
};
const oneLine = text => String(text ?? '').replace(/\s+/g, ' ').trim();

const out = ['## Why this run failed', ''];
for (const [i, job] of jobs.entries()) {
    const answer = answers.find(a => a.job === job.name) ?? answers[i] ?? {};
    const tests = job.tests.length ? ` Tests: ${job.tests.slice(0, 10).map(t => `\`${t.replaceAll('`', "'")}\``).join(', ')}.` : '';
    const what = oneLine(answer.what) || (job.step ? `The \`${job.step}\` step.` : 'The job.') + tests;
    const confidence = CONFIDENCE.includes(answer.confidence) ? ` (${answer.confidence})` : '';
    const why = oneLine(answer.why);
    const verdict = `**${LABEL[job.verdict.kind]}:** ${job.verdict.reason}`;

    out.push(`### [${job.name}](${job.url})`, '');
    out.push(`- **What failed:** ${what}`);
    out.push(`- **Why${confidence}:** ${why ? `${why} ` : ''}${verdict}`);
    out.push(`- **Next:** ${oneLine(answer.next) || NEXT[job.verdict.kind]}`, '');
    const lines = String(answer.lines ?? '').trim() || fs.readFileSync(path.join(dir, job.log), 'utf8').split('\n').slice(-30).join('\n');
    out.push('<details><summary>Log</summary>', '', fence(lines), '', '</details>', '');
}

const summary = out.join('\n');
console.log(summary);
fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
