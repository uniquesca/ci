import test from 'node:test';
import assert from 'node:assert/strict';
import { normaliseReport, renderReport, renderStatus, readStatus, replaceStatus, STATUS_START, STATUS_END } from '../src/ai-report.js';

const full = {
    headline: 'S1-S4 done, S5 left for a decision.',
    summary: 'Retries now back off in the client. The migration waits for a decision.',
    done: [{ what: 'Moved the retry loop into the client', refs: ['S3'] }],
    notes: [{ note: 'The fixer and the hand edits are in one commit', refs: ['S4'] }],
    not_done: [{ what: 'Migration', why: 'Needs the schema change in U2 settled first.', refs: ['S5'] }],
    verification: [
        { command: 'composer test', result: 'pass', note: '212 tests' },
        { command: 'vendor/bin/psalm', result: 'fail', note: 'pre-existing | 3 errors' },
    ],
    decisions: [{ ask: 'Keep the old endpoint for one release?', refs: ['U2'] }],
};

test('what a reviewer reads first comes in a fixed order, and what changed and the checks are folded', () => {
    const { report, problems } = normaliseReport(full);
    const { body, details } = renderReport(report);

    assert.deepEqual(problems, []);
    const order = ['**S1-S4', 'Retries now back off', '## For the reviewer', '## Not done', '## Needs a decision'].map((s) => body.indexOf(s));
    assert.ok(order.every((pos) => pos >= 0));
    assert.deepEqual([...order].sort((a, b) => a - b), order);
    assert.match(body, /- The fixer and the hand edits are in one commit \(S4\)/);
    assert.match(body, /- Migration \(S5\) - Needs the schema change/);
    assert.doesNotMatch(body, /retry loop|psalm/);

    assert.match(details, /^<details>\n<summary>What changed \(1\)<\/summary>\n\n- Moved the retry loop into the client \(S3\)\n\n<\/details>/);
    assert.match(details, /<summary>Checks: 1 ✅ pass, 1 ❌ fail<\/summary>/);
    assert.match(details, /\| `vendor\/bin\/psalm` \| ❌ fail \| pre-existing \\\| 3 errors \|/);
});

test('empty sections are left out', () => {
    const { report } = normaliseReport({ headline: 'Nothing to change.', done: [] });

    assert.deepEqual(renderReport(report), { body: '**Nothing to change.**', details: '' });
    assert.deepEqual(renderReport(report, { underStatus: true }), { body: '', details: '' });
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
    const { body } = renderReport(report, { underStatus: true });

    assert.ok(!body.includes('S1-S4 done'));
    assert.ok(!body.includes('Needs a decision'));
    assert.ok(body.startsWith('Retries now back off in the client.'));
    assert.match(body, /## For the reviewer/);
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

    assert.ok(Buffer.byteLength(JSON.stringify(report)) <= 12000);
    assert.equal(report.verification.length, 0);
    assert.deepEqual(report.decisions.map((d) => d.ask), ['Keep the old API?']);
    assert.ok(report.left_out > 40);
    assert.match(problems.at(-1), /item\(s\) were left out/);
    assert.match(renderReport(report).details, /more item\(s\) did not fit/);
});

test('the agent cannot fold or unfold a section with its own tags', () => {
    const { report } = normaliseReport({
        headline: 'H.',
        notes: [{ note: 'Look <details><summary>here' }],
        done: [{ what: 'Moved it </details> **Not folded**' }],
    });
    const { body, details } = renderReport(report);

    assert.match(body, /Look &lt;details>&lt;summary>here/);
    assert.equal(details.split('</details>').length - 1, 1);
});

test('references are short ids, so a giant one is left out', () => {
    const { report } = normaliseReport({
        headline: 'H.',
        done: [{ what: 'W', refs: ['S1', 'S'.repeat(70000), ...Array(20).fill('S2')] }],
    });

    assert.deepEqual(report.done[0].refs, ['S1', ...Array(9).fill('S2')]);
});

test('items over the 40 a list shows are counted as left out, so the report says so', () => {
    const { report } = normaliseReport({ headline: 'H.', done: Array.from({ length: 41 }, (_, i) => ({ what: `W${i}` })) });

    assert.equal(report.done.length, 40);
    assert.equal(report.left_out, 1);
    assert.match(renderReport(report).details, /1 more item\(s\) did not fit/);
});

test('the agent cannot open a hidden comment or end the status block early', () => {
    const { report } = normaliseReport({
        headline: `Done ${STATUS_END} <!-- ai-report:AAAA -->`,
        decisions: [{ ask: `Keep? ${STATUS_END}`, refs: [STATUS_END, 'S1'] }],
    });
    const body = replaceStatus(replaceStatus('Intro', renderStatus(report, 'Round 1')), renderStatus(report, 'Round 2'));

    assert.equal(body.split(STATUS_START).length - 1, 1);
    assert.equal(body.split(STATUS_END).length - 1, 1);
    assert.deepEqual(report.decisions[0].refs, ['S1']);
    assert.match(body, /Round 2/);
    assert.doesNotMatch(body, /Round 1/);
});

test('the largest report leaves room in the description for 20,000 characters of held-back changes', () => {
    const wide = (n) => '漢'.repeat(n);
    const many = (make) => Array.from({ length: 40 }, (_, i) => make(i));
    const { report } = normaliseReport({
        headline: wide(300),
        done: many(() => ({ what: wide(300), refs: ['S1'] })),
        notes: many(() => ({ note: wide(400), refs: ['S1'] })),
        not_done: many(() => ({ what: wide(300), why: wide(400) })),
        verification: many(() => ({ command: wide(150), result: 'pass', note: wide(200) })),
        decisions: many(() => ({ ask: wide(400), refs: ['S1'] })),
    });
    const { body, details } = renderReport(report);
    const description = [renderStatus(report, 'After the first run'), body, details].join('\n\n');

    assert.ok(description.length + 20000 + 2000 <= 65536, `${description.length} characters`);
});

test('with the plan, a reference to an id it does not have is dropped', () => {
    const plan = { steps: [{ id: 'S3' }, { id: 'S4' }, { id: 'S5' }], risks: [{ id: 'U2' }] };
    const { report, problems } = normaliseReport({ ...full, notes: [{ note: 'See the old step', refs: ['S4', 'S9'] }] }, { plan });

    assert.deepEqual(report.notes[0].refs, ['S4']);
    assert.deepEqual(problems, ['"See the old step" cites S9, not in the plan - dropped']);
});

test('a phrase the style guide rules out is reported', () => {
    const { problems } = normaliseReport({ headline: 'Let me summarise: done.' });

    assert.deepEqual(problems, ['uses "Let me", which the style guide rules out']);
});
