import test from 'node:test';
import assert from 'node:assert/strict';
import { normaliseReport, renderReport, renderStatus, readStatus, replaceStatus, STATUS_START, STATUS_END } from '../src/ai-report.js';

const full = {
    headline: 'S1-S4 done, S5 left for a decision.',
    done: [{ what: 'Moved the retry loop into the client', refs: ['S3'] }],
    not_done: [{ what: 'Migration', why: 'Needs the schema change in U2 settled first.', refs: ['S5'] }],
    verification: [
        { command: 'composer test', result: 'pass', note: '212 tests' },
        { command: 'vendor/bin/psalm', result: 'fail', note: 'pre-existing | 3 errors' },
    ],
    decisions: [{ ask: 'Keep the old endpoint for one release?', refs: ['U2'] }],
};

test('every section renders in a fixed order', () => {
    const { report, problems } = normaliseReport(full);
    const body = renderReport(report);

    assert.deepEqual(problems, []);
    const order = ['**S1-S4', '**Done**', '**Not done**', '**Verified**', '**Needs a decision**'].map((s) => body.indexOf(s));
    assert.ok(order.every((pos) => pos >= 0));
    assert.deepEqual([...order].sort((a, b) => a - b), order);
    assert.match(body, /- Moved the retry loop into the client \(S3\)/);
    assert.match(body, /- Migration \(S5\) - Needs the schema change/);
    assert.match(body, /\| `vendor\/bin\/psalm` \| ❌ fail \| pre-existing \\\| 3 errors \|/);
});

test('empty sections are left out', () => {
    const { report } = normaliseReport({ headline: 'Nothing to change.', done: [] });

    assert.equal(renderReport(report), '**Nothing to change.**');
    assert.equal(renderReport(report, { underStatus: true }), '');
});

test('an unknown result is shown as not run and reported', () => {
    const { report, problems } = normaliseReport({ headline: 'h', verification: [{ command: 'npm test', result: 'ok' }] });

    assert.equal(report.verification[0].result, 'not_run');
    assert.equal(problems.length, 1);
});

test('malformed input never throws', () => {
    for (const raw of [null, [], 'text']) {
        assert.equal(normaliseReport(raw).report, null);
    }
    const { report, problems } = normaliseReport({ done: 'nope', decisions: [null, { ask: '' }] });
    assert.deepEqual(report.done, []);
    assert.deepEqual(report.decisions, []);
    assert.ok(problems.length >= 2);
});

test('the status block carries the report, and reads back', () => {
    const { report } = normaliseReport(full);
    const status = renderStatus(report, 'After round 2');

    assert.ok(status.startsWith(STATUS_START) && status.endsWith(STATUS_END));
    assert.match(status, /> \*\*After round 2:\*\* S1-S4 done/);
    assert.match(status, /> - Keep the old endpoint for one release\? \(U2\)/);
    assert.deepEqual(readStatus(`Intro\n\n${status}\n\nRest`), report);
});

test('the status block is replaced in place, or put at the top', () => {
    const { report } = normaliseReport(full);
    const first = renderStatus(report, 'After the first run');
    const second = renderStatus({ ...report, headline: 'All done.', decisions: [] }, 'After round 1');

    const body = replaceStatus('Implements #4.', first);
    assert.ok(body.startsWith(first));

    const updated = replaceStatus(`${body}\n\nMore`, second);
    assert.ok(updated.includes('All done.'));
    assert.ok(!updated.includes('S1-S4 done'));
    assert.equal(updated.split(STATUS_START).length, 2);
    assert.ok(updated.endsWith('Implements #4.\n\nMore'));
});

test('a body without a report reads back as null', () => {
    assert.equal(readStatus('Implements #4.'), null);
    assert.equal(readStatus('<!-- ai-report:!!! -->'), null);
});

test('under the status block, the headline and the decisions are left to it', () => {
    const { report } = normaliseReport(full);
    const body = renderReport(report, { underStatus: true });

    assert.ok(!body.includes('S1-S4 done'));
    assert.ok(!body.includes('Needs a decision'));
    assert.match(body, /\*\*Done\*\*/);
});

test('a value that is not text where text belongs reads as missing, and never throws', () => {
    const notText = { toString: null };
    const { report, problems } = normaliseReport({
        headline: notText,
        done: [{ what: notText }, { what: 'Kept', refs: ['S1'] }],
        verification: [{ command: 'npm test', result: notText }, { command: 'lint', result: 'toString' }],
    });

    assert.equal(report.headline, '');
    assert.deepEqual(report.done, [{ what: 'Kept', refs: ['S1'] }]);
    assert.deepEqual(report.verification.map((v) => v.result), ['not_run', 'not_run']);
    assert.deepEqual(problems, [
        'no headline',
        '`npm test` has result "", shown as not run',
        '`lint` has result "toString", shown as not run',
    ]);
});

test('a report too long for Github leaves out the check results first, and says so', () => {
    const items = (n, key, size) => Array.from({ length: n }, (_, i) => ({ [key]: `${i} ${'x'.repeat(size)}` }));
    const { report, problems } = normaliseReport({
        headline: 'Long.',
        done: items(40, 'what', 290),
        not_done: items(40, 'what', 290),
        verification: Array.from({ length: 40 }, (_, i) => ({ command: `c${i} ${'y'.repeat(140)}`, result: 'pass', note: 'z'.repeat(190) })),
        decisions: [{ ask: 'Keep the old API?' }],
    });

    assert.ok(JSON.stringify(report).length <= 20000);
    assert.equal(report.verification.length, 0);
    assert.deepEqual(report.decisions.map((d) => d.ask), ['Keep the old API?']);
    assert.ok(report.left_out > 40);
    assert.match(problems.at(-1), /item\(s\) were left out/);
    assert.match(renderReport(report), /more item\(s\) did not fit/);
});
