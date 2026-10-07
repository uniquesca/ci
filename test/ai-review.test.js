import test from 'node:test';
import assert from 'node:assert/strict';
import { renderReview } from '../src/ai-review.js';

const positions = new Set(['src/a.js:10', 'src/a.js:11']);

test('a review with nothing to raise is a green verdict and its headline', () => {
    const result = renderReview({ headline: 'Does what S1-S3 ask, nothing to raise.', findings: [] }, { positions });

    assert.equal(result.verdict, 'comment');
    assert.equal(result.body, '### 🟢 Looks good\n\nDoes what S1-S3 ask, nothing to raise.');
    assert.deepEqual(result.comments, []);
});

test('a high finding requests changes, and the verdict comes from nothing else', () => {
    const result = renderReview({
        headline: 'The retry never backs off.',
        verdict: 'comment',
        findings: [{ severity: 'high', title: 'No backoff', body: 'Use the existing helper.', path: 'src/a.js', line: 10, refs: ['S3'] }],
    }, { positions });

    assert.equal(result.verdict, 'changes_requested');
    assert.deepEqual(result.comments, [{
        path: 'src/a.js',
        line: 10,
        side: 'RIGHT',
        body: '**🔴 High:** No backoff (S3)\n\nUse the existing helper.',
    }]);
    assert.equal(result.body, [
        '### 🔴 Changes requested',
        'The retry never backs off.',
        '**Findings:** 🔴 1 high',
        '1. **🔴 High** No backoff (S3) - `src/a.js:10`',
    ].join('\n\n'));
});

test('findings are counted and listed high to low, whatever order they were written in', () => {
    const result = renderReview({
        headline: 'h',
        findings: [
            { severity: 'low', title: 'Typo' },
            { severity: 'high', title: 'Bug' },
            { severity: 'medium', title: 'Missing test' },
            { severity: 'low', title: 'Wording' },
        ],
    });

    assert.match(result.body, /\*\*Findings:\*\* 🔴 1 high · 🟠 1 medium · 🟡 2 low/);
    const order = ['1. **🔴 High** Bug', '2. **🟠 Medium** Missing test', '3. **🟡 Low** Typo', '4. **🟡 Low** Wording']
        .map((line) => result.body.indexOf(line));
    assert.ok(order.every((pos) => pos >= 0));
    assert.deepEqual([...order].sort((a, b) => a - b), order);
});

test('without a high finding the verdict suggests changes', () => {
    const result = renderReview({ headline: 'h', findings: [{ severity: 'medium', title: 'T' }] });

    assert.equal(result.verdict, 'comment');
    assert.ok(result.body.startsWith('### 🟡 Changes suggested'));
});

test('a finding placed inline is listed by its title and linked once the review is posted', () => {
    const raw = {
        headline: 'h',
        findings: [
            { severity: 'low', title: 'Inline [low]', body: 'Said inline.', path: 'src/a.js', line: 11 },
            { severity: 'medium', title: 'Inline medium', body: 'Said inline too.', path: 'src/a.js', line: 10 },
        ],
    };

    const before = renderReview(raw, { positions });
    assert.match(before.body, /1\. \*\*🟠 Medium\*\* Inline medium - `src\/a\.js:10`\n2\. \*\*🟡 Low\*\* Inline \[low\] - `src\/a\.js:11`$/);
    assert.doesNotMatch(before.body, /Said inline/);

    const after = renderReview(raw, { positions, links: ['https://x/1', 'https://x/2'] });
    assert.match(after.body, /1\. \*\*🟠 Medium\*\* \[Inline medium\]\(https:\/\/x\/1\) - `src\/a\.js:10`/);
    assert.match(after.body, /2\. \*\*🟡 Low\*\* \[Inline \\\[low\\\]\]\(https:\/\/x\/2\)/);
});

test('a finding that cannot sit on a diff line keeps its body in the list', () => {
    const result = renderReview({
        headline: 'h',
        findings: [{ severity: 'medium', title: 'Off the diff', body: 'Line one.\nLine two.', path: 'src/a.js', line: 99 }],
    }, { positions });

    assert.deepEqual(result.comments, []);
    assert.equal(result.unplaced, 1);
    assert.match(result.body, /1\. \*\*🟠 Medium\*\* Off the diff - `src\/a\.js:99`\n\n {3}Line one\.\n {3}Line two\./);
});

test('the severities a review used to have still read', () => {
    const result = renderReview({
        headline: 'h',
        findings: [{ severity: 'blocking', title: 'A' }, { severity: 'should', title: 'B' }, { severity: 'nit', title: 'C' }],
    });

    assert.equal(result.verdict, 'changes_requested');
    assert.match(result.body, /🔴 1 high · 🟠 1 medium · 🟡 1 low/);
    assert.deepEqual(result.problems, []);
});

test('an unknown severity is treated as medium and reported', () => {
    const result = renderReview({ headline: 'h', findings: [{ severity: 'major', title: 'Thing' }] });

    assert.equal(result.verdict, 'comment');
    assert.match(result.body, /\*\*🟠 Medium\*\* Thing/);
    assert.equal(result.problems.length, 1);
});

test('malformed input never throws', () => {
    for (const raw of [null, [], 'text', { findings: 'nope' }, { findings: [null, {}, { title: 5 }] }]) {
        const result = renderReview(raw);
        assert.equal(result.verdict, 'comment');
        assert.ok(result.problems.length > 0);
    }
});

test('a value that is not text where text belongs reads as missing, and never throws', () => {
    const notText = { toString: null };
    const result = renderReview({
        headline: notText,
        findings: [{ title: notText }, { title: 'Kept', severity: notText, body: notText }],
    });

    assert.deepEqual(result.problems, [
        'no headline',
        'a finding without a title was dropped',
        '"Kept" has severity "", treated as "medium"',
    ]);
    assert.match(result.body, /1\. \*\*🟠 Medium\*\* Kept$/m);
});

test('findings that are not a list are reported, not silently dropped', () => {
    const result = renderReview({ headline: 'Fine.', findings: { title: 'Lost' } });

    assert.deepEqual(result.problems, ['findings is not a list, so none were read']);
});

test('QA focus becomes one line', () => {
    const result = renderReview({ headline: 'h', findings: [], qa_focus: ['QA2', 'QA4'] });

    assert.match(result.body, /For a tester to check first: QA2, QA4\.$/);
});

test('inline comments stop at the cap, and the rest keep their text in the list', () => {
    const result = renderReview({
        headline: 'h',
        findings: [
            { severity: 'low', title: 'One', path: 'src/a.js', line: 10 },
            { severity: 'low', title: 'Two', body: 'Why.', path: 'src/a.js', line: 11 },
        ],
    }, { positions, maxComments: 1 });

    assert.equal(result.comments.length, 1);
    assert.equal(result.unplaced, 1);
    assert.match(result.body, /2\. \*\*🟡 Low\*\* Two - `src\/a\.js:11`\n\n {3}Why\./);
});

test('long text is clipped', () => {
    const result = renderReview({
        headline: 'x'.repeat(500),
        findings: [{ severity: 'medium', title: 'y'.repeat(500), body: 'z'.repeat(5000), path: 'src/a.js', line: 10 }],
    }, { positions, maxLength: 100 });

    assert.ok(result.body.split('\n\n')[1].length <= 300);
    assert.ok(result.comments[0].body.length < 300);
});

test('a review too long for Github loses the text of its least severe findings first, then the findings', () => {
    const finding = (severity, title) => ({ severity, title, body: 'x'.repeat(200), path: 'src/b.js' });
    const raw = { headline: 'H.', findings: [finding('high', 'B'), finding('medium', 'S'), finding('low', 'N')] };

    const shortened = renderReview(raw, { maxBody: 600 });
    assert.ok(shortened.body.length <= 600);
    assert.match(shortened.body, /1\. \*\*🔴 High\*\* B - `src\/b\.js`\n\n {3}x{200}/);
    assert.match(shortened.body, /3\. \*\*🟡 Low\*\* N - `src\/b\.js`$/m);
    assert.deepEqual(shortened.problems, ['the review was over 600 characters, so some findings were cut short or left out']);

    const dropped = renderReview(raw, { maxBody: 80 });
    assert.doesNotMatch(dropped.body, /^\d+\. /m);
    assert.match(dropped.body, /did not fit/);
    assert.equal(dropped.verdict, 'changes_requested');
});

test('references and QA focus are short ids, so a giant one cannot push a review past Github', () => {
    const huge = 'S'.repeat(70000);
    const result = renderReview({
        headline: 'H.',
        findings: [{ severity: 'medium', title: 'T', path: 'src/a.js', line: 10, refs: ['S1', huge, ...Array(20).fill('S2')] }],
        qa_focus: [huge, 'QA1'],
    }, { positions });

    assert.equal(result.comments[0].body, '**🟠 Medium:** T (S1, S2, S2, S2, S2, S2, S2, S2, S2, S2)');
    assert.match(result.body, /For a tester to check first: QA1\./);
    assert.ok(result.body.length < 1000);
    assert.equal(result.problems.length, 2);
});

test('with the plan, references and QA focus on ids it does not have are dropped', () => {
    const plan = { steps: [{ id: 'S1' }], qa: [{ id: 'QA1' }] };
    const { body, problems } = renderReview({
        headline: 'One fix needed.',
        findings: [{ severity: 'medium', title: 'Off by one', refs: ['S1', 'S7'] }],
        qa_focus: ['QA1', 'QA4'],
    }, { plan });

    assert.match(body, /Off by one \(S1\)/);
    assert.match(body, /For a tester to check first: QA1\./);
    assert.deepEqual(problems, ['"Off by one" cites S7, not in the plan - dropped', 'qa_focus cites QA4, not in the plan - dropped']);
});
