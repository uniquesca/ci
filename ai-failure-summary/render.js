// Writes the run summary for ai-failure-summary, from failure-history's result and whatever the
// agent wrote. Without the agent's answer it still shows the verdict and the log.
import fs from 'node:fs';
import path from 'node:path';

const dir = path.dirname(process.env.RESULT);
const { jobs } = JSON.parse(fs.readFileSync(process.env.RESULT, 'utf8'));
let answers = [];
try {
    answers = JSON.parse(fs.readFileSync(path.join(dir, 'answer.json'), 'utf8')).jobs ?? [];
} catch {
    console.log('No AI explanation, so the summary has the verdicts and logs only');
}

const LABEL = {
    flaky: 'Flaky',
    'broken-here': 'Broken on this branch',
    'broken-elsewhere': 'Broken on other branches too',
    new: 'New failure',
    unknown: 'Unknown',
};
const CONFIDENCE = ['certain', 'highly likely', 'likely', 'probably', 'maybe'];
// What to do without the agent's answer, from the verdict alone
const NEXT = {
    flaky: 'Re-run the job. If it keeps happening, fix the test.',
    'broken-here': 'Fix the failure: re-running will not help.',
    'broken-elsewhere': 'The cause is outside this branch. Check whether the base branch is broken.',
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
    const verdict = `**${LABEL[job.verdict]}:** ${job.reason}`;

    out.push(`### [${job.name}](${job.url})`, '');
    out.push(`- **What failed:** ${what}`);
    out.push(`- **Why${confidence}:** ${why ? `${why} ` : ''}${verdict}`);
    out.push(`- **Next:** ${oneLine(answer.next) || NEXT[job.verdict]}`, '');
    const lines = String(answer.lines ?? '').trim() || fs.readFileSync(path.join(dir, job.log), 'utf8').split('\n').slice(-30).join('\n');
    out.push('<details><summary>Log</summary>', '', fence(lines), '', '</details>', '');
}

const summary = out.join('\n');
console.log(summary);
fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
