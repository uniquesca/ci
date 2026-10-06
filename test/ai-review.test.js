import test from 'node:test';
import assert from 'node:assert/strict';
import { renderReview } from '../src/ai-review.js';

const positions = new Set(['src/a.js:10', 'src/a.js:11']);

test('a review with nothing to raise is its headline alone', () => {
    const result = renderReview({ headline: 'Does what S1-S3 ask, nothing to raise.', findings: [] }, { positions });

    assert.equal(result.verdict, 'comment');
    assert.equal(result.body, '**Does what S1-S3 ask, nothing to raise.**');
    assert.deepEqual(result.comments, []);
});

test('a blocking finding requests changes, and the verdict comes from nothing else', () => {
    const result = renderReview({
        headline: 'The retry never backs off.',
        verdict: 'comment',
        findings: [{ severity: 'blocking', title: 'No backoff', body: 'Use the existing helper.', path: 'src/a.js', line: 10, refs: ['S3'] }],
    }, { positions });

    assert.equal(result.verdict, 'changes_requested');
    assert.deepEqual(result.comments, [{
        path: 'src/a.js',
        line: 10,
        side: 'RIGHT',
        body: '**Blocking:** No backoff (S3)\n\nUse the existing helper.',
    }]);
    assert.match(result.body, /\*\*Blocking\*\*\n\n- No backoff \(S3\) - `src\/a\.js:10`/);
});

test('findings are grouped in severity order, whatever order they were written in', () => {
    const result = renderReview({
        headline: 'h',
        findings: [
            { severity: 'nit', title: 'Typo' },
            { severity: 'blocking', title: 'Bug' },
            { severity: 'should', title: 'Missing test' },
        ],
    });

    const order = ['**Blocking**', '**Should fix**', '**Nit**'].map((label) => result.body.indexOf(label));
    assert.deepEqual([...order].sort((a, b) => a - b), order);
});

test('a finding that cannot sit on a diff line keeps its body in the review body', () => {
    const result = renderReview({
        headline: 'h',
        findings: [{ severity: 'should', title: 'Off the diff', body: 'Line one.\nLine two.', path: 'src/a.js', line: 99 }],
    }, { positions });

    assert.deepEqual(result.comments, []);
    assert.equal(result.unplaced, 1);
    assert.match(result.body, /- Off the diff - `src\/a\.js:99`\n\n {2}Line one\.\n {2}Line two\./);
});

test('an unknown severity is treated as "should" and reported', () => {
    const result = renderReview({ headline: 'h', findings: [{ severity: 'major', title: 'Thing' }] });

    assert.equal(result.verdict, 'comment');
    assert.match(result.body, /\*\*Should fix\*\*/);
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
        '"Kept" has severity "", treated as "should"',
    ]);
    assert.match(result.body, /- Kept$/m);
});

test('findings that are not a list are reported, not silently dropped', () => {
    const result = renderReview({ headline: 'Fine.', findings: { title: 'Lost' } });

    assert.deepEqual(result.problems, ['findings is not a list, so none were read']);
});

test('QA focus becomes one line', () => {
    const result = renderReview({ headline: 'h', findings: [], qa_focus: ['QA2', 'QA4'] });

    assert.match(result.body, /For a tester to check first: QA2, QA4\.$/);
});

test('inline comments stop at the cap, and the rest stay in the body', () => {
    const result = renderReview({
        headline: 'h',
        findings: [
            { severity: 'nit', title: 'One', path: 'src/a.js', line: 10 },
            { severity: 'nit', title: 'Two', path: 'src/a.js', line: 11 },
        ],
    }, { positions, maxComments: 1 });

    assert.equal(result.comments.length, 1);
    assert.equal(result.unplaced, 1);
});

test('long text is clipped', () => {
    const result = renderReview({
        headline: 'x'.repeat(500),
        findings: [{ severity: 'should', title: 'y'.repeat(500), body: 'z'.repeat(5000), path: 'src/a.js', line: 10 }],
    }, { positions, maxLength: 100 });

    assert.ok(result.body.split('\n')[0].length <= 304);
    assert.ok(result.comments[0].body.length < 300);
});

test('a review too long for Github loses the text of its least severe findings first, then the findings', () => {
    const finding = (severity, title) => ({ severity, title, body: 'x'.repeat(200), path: 'src/b.js' });
    const raw = { headline: 'H.', findings: [finding('blocking', 'B'), finding('should', 'S'), finding('nit', 'N')] };

    const shortened = renderReview(raw, { maxBody: 600 });
    assert.ok(shortened.body.length <= 600);
    assert.match(shortened.body, /- B - `src\/b\.js`\n\n  x{200}/);
    assert.match(shortened.body, /- N - `src\/b\.js`$/m);
    assert.deepEqual(shortened.problems, ['the review was over 600 characters, so some findings were cut short or left out']);

    const dropped = renderReview(raw, { maxBody: 80 });
    assert.doesNotMatch(dropped.body, /^- /m);
    assert.match(dropped.body, /did not fit/);
    assert.equal(dropped.verdict, 'changes_requested');
});

test('references and QA focus are short ids, so a giant one cannot push a review past Github', () => {
    const huge = 'S'.repeat(70000);
    const result = renderReview({
        headline: 'H.',
        findings: [{ severity: 'should', title: 'T', path: 'src/a.js', line: 10, refs: ['S1', huge, ...Array(20).fill('S2')] }],
        qa_focus: [huge, 'QA1'],
    }, { positions });

    assert.equal(result.comments[0].body, '**Should fix:** T (S1, S2, S2, S2, S2, S2, S2, S2, S2, S2)');
    assert.match(result.body, /For a tester to check first: QA1\./);
    assert.ok(result.body.length < 1000);
    assert.equal(result.problems.length, 2);
});
