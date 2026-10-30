// What failure-history works out from a failed job: the part of its log worth reading, the tests
// that failed in it, and whether the failure is flaky or broken going by earlier runs.

const TIMESTAMP = /^\d{4}-\d\d-\d\dT[\d:.]+Z ?/;

// The lines before the first error, where the failure is printed, and the errors themselves
export function trimLog(log, maxLines = 150) {
    const lines = log.split('\n')
        .map(line => line.replace(TIMESTAMP, '').trimEnd())
        .filter(line => !/^##\[(end)?group\]/.test(line));
    const first = lines.findIndex(line => line.startsWith('##[error]'));
    const end = first === -1 ? lines.length : first;
    const errors = first === -1 ? [] : lines.slice(first).filter(line => line.startsWith('##[error]'));
    return [...lines.slice(Math.max(0, end - maxLines), end), ...errors].join('\n');
}

// PHPUnit `1) Foo\BarTest::testBaz`, Playwright `1) [chromium] › a.spec.ts:3:5 › name`, Jest
// `● Suite › name` and Vitest `FAIL  a.test.ts > suite > name`. Line numbers are dropped, so the
// same test matches across branches that moved it.
export function failedTests(log) {
    const tests = new Set();
    for (const raw of log.split('\n')) {
        const line = raw.replace(TIMESTAMP, '').trim();
        let match = line.match(/^\d+\) (\S+::\S+)/) ?? line.match(/^\d+\) (\[[^\]]+\] › .+)$/)
            ?? line.match(/^● (.+ › .+)$/) ?? line.match(/^FAIL\s+(.+ > .+)$/);
        if (match) {
            tests.add(match[1].replace(/:\d+(:\d+)?/g, '').replace(/\s*[─-]+$/, '').trim());
        }
    }
    return [...tests].slice(0, 20);
}

function link(entry) {
    return `[#${entry.number}${entry.attempt > 1 ? ` attempt ${entry.attempt}` : ''}](${entry.url})`;
}

// `failed` is this job now: its failing step and tests. `history` is the same job in earlier runs
// and attempts, newest first, each with its run, branch, commit, conclusion, failing step and
// failed tests (`null` when its log was not read).
//
// Flaky means it went both ways without a reason to: passed on the same commit, or fails now and
// then on other branches. Failing every time is broken, never flaky: `broken-elsewhere` when most
// other branches fail the same way, so the cause is outside this branch, `broken-here` otherwise.
export function verdict(failed, history, { branch, sha }) {
    const same = entry => entry.conclusion === 'failure' && entry.step === failed.step
        && (!failed.tests.length || entry.tests === null || entry.tests.some(t => failed.tests.includes(t)));
    const here = history.filter(entry => entry.branch === branch);
    const elsewhere = history.filter(entry => entry.branch !== branch);

    const passedOnCommit = history.find(entry => entry.sha === sha && entry.conclusion === 'success');
    if (passedOnCommit) {
        return { kind: 'flaky', reason: `Passed on the same commit in run ${link(passedOnCommit)}.` };
    }

    const streak = [];
    for (const entry of here) {
        if (!same(entry)) {
            break;
        }
        streak.push(entry);
    }
    const sinceText = () => {
        const oldest = streak.at(-1);
        const passed = here[streak.length];
        return passed?.conclusion === 'success'
            ? `Failed the same way in every run on this branch since run ${link(oldest)}, and passed in ${link(passed)} before it.`
            : `Failed the same way in every run on this branch, back to run ${link(oldest)}.`;
    };
    if (streak.length >= 2) {
        return { kind: 'broken-here', reason: sinceText() };
    }

    const failedElsewhere = elsewhere.filter(same);
    const branchesFailed = new Set(failedElsewhere.map(entry => entry.branch));
    const latest = new Map();
    for (const entry of elsewhere) {
        if (!latest.has(entry.branch)) {
            latest.set(entry.branch, entry);
        }
    }
    const stillFailing = [...latest.values()].filter(same);
    if (latest.size >= 2 && stillFailing.length * 2 > latest.size) {
        return {
            kind: 'broken-elsewhere',
            reason: `Fails the same way in the latest run on ${stillFailing.length} of ${latest.size} other branches too, so it is not this branch's change.`,
        };
    }
    if (branchesFailed.size >= 2) {
        return {
            kind: 'flaky',
            reason: `Failed the same way on ${branchesFailed.size} other branches too, for example in run ${link(failedElsewhere[0])}, though most of their latest runs pass.`,
        };
    }

    if (streak.length === 1) {
        return { kind: 'broken-here', reason: sinceText() };
    }
    if (here[0]?.conclusion === 'success') {
        return { kind: 'new', reason: `Passed in the previous run on this branch, ${link(here[0])}.` };
    }
    if (here.length) {
        const previous = here[0].conclusion === 'failure' ? 'failed another way' : `was ${here[0].conclusion}`;
        return { kind: 'unknown', reason: `The previous run on this branch, ${link(here[0])}, ${previous}.` };
    }
    // A first push often carries the whole change, so passing elsewhere points at it
    const passing = [...latest.values()].filter(entry => entry.conclusion === 'success');
    if (latest.size >= 2 && passing.length * 2 > latest.size) {
        return {
            kind: 'broken-here',
            reason: `First run on this branch, and the latest run on ${passing.length} of ${latest.size} other branches passes.`,
        };
    }
    return {
        kind: 'unknown',
        reason: latest.size >= 2
            ? 'First run on this branch, and the other branches do not agree.'
            : 'First run on this branch, and too few other branches to compare with.',
    };
}
