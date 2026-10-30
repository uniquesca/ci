import test from 'node:test';
import assert from 'node:assert/strict';
import { failedTests, trimLog, verdict } from '../src/failure-history.js';

const job = { step: 'Run PHPUnit', tests: ['FooTest::testBar'] };
const at = { branch: 'feature/a', sha: 'new' };
let n = 0;
const run = (branch, conclusion, extra = {}) => ({
    number: ++n, attempt: 1, url: `u${n}`, branch, sha: `s${n}`, conclusion,
    step: conclusion === 'failure' ? 'Run PHPUnit' : null, tests: conclusion === 'failure' ? ['FooTest::testBar'] : [],
    ...extra,
});

test('the log is cut to the lines before the first error, with every error kept', () => {
    const log = [
        '2026-10-26T10:00:00.0000000Z ##[group]Run phpunit',
        '2026-10-26T10:00:01.0000000Z one',
        '2026-10-26T10:00:02.0000000Z two',
        '2026-10-26T10:00:03.0000000Z ##[error]Process completed with exit code 1.',
        '2026-10-26T10:00:04.0000000Z cleanup',
        '2026-10-26T10:00:05.0000000Z ##[error]second',
    ].join('\n');

    assert.equal(trimLog(log, 1), ['two', '##[error]Process completed with exit code 1.', '##[error]second'].join('\n'));
});

test('failed tests are read from PHPUnit, Playwright, Jest and Vitest output, without line numbers', () => {
    const log = [
        '1) Tests\\Unit\\FooTest::testBar with data set #0',
        '  2) [chromium] › e2e/login.spec.ts:12:5 › login › works ──────',
        '● Cart › adds an item',
        ' FAIL  src/a.test.ts > sum > adds',
        '1) not a test',
    ].join('\n');

    assert.deepEqual(failedTests(log), [
        'Tests\\Unit\\FooTest::testBar',
        '[chromium] › e2e/login.spec.ts › login › works',
        'Cart › adds an item',
        'src/a.test.ts > sum > adds',
    ]);
});

test('passing on the same commit is flaky', () => {
    const history = [run('feature/a', 'success', { sha: 'new' })];

    assert.equal(verdict(job, history, at).kind, 'flaky');
});

test('failing the same way every run on the branch is broken, even when it is flaky elsewhere', () => {
    const history = [
        run('feature/a', 'failure'), run('feature/a', 'failure'), run('feature/a', 'success'),
        run('feature/b', 'failure'), run('feature/b', 'success'), run('feature/c', 'success'), run('feature/c', 'failure'),
    ];

    const result = verdict(job, history, at);
    assert.equal(result.kind, 'broken-here');
    assert.match(result.reason, /since run \[#\d+\].+, and passed in /);
});

test('failing now and then on other branches is flaky', () => {
    const history = [
        run('feature/a', 'success'),
        run('feature/b', 'success'), run('feature/b', 'failure'),
        run('feature/c', 'failure', { tests: null }), run('feature/c', 'success'),
        run('feature/d', 'success'),
    ];

    assert.equal(verdict(job, history, at).kind, 'flaky');
});

test('a different test failing elsewhere does not count', () => {
    const other = { tests: ['OtherTest::testX'] };
    const history = [
        run('feature/a', 'success'),
        run('feature/b', 'success'), run('feature/b', 'failure', other),
        run('feature/c', 'success'), run('feature/c', 'failure', other),
    ];

    assert.equal(verdict(job, history, at).kind, 'new');
});

test('failing in the latest run on most other branches is broken, not this branch', () => {
    const history = [
        run('feature/a', 'success'),
        run('feature/b', 'failure'), run('feature/c', 'failure'), run('feature/d', 'success'),
    ];

    const result = verdict(job, history, at);
    assert.equal(result.kind, 'broken-elsewhere');
    assert.match(result.reason, /2 of 3 other branches/);
});

test('failing once before on this branch is broken here', () => {
    const history = [run('feature/a', 'failure'), run('feature/a', 'success')];

    assert.equal(verdict(job, history, at).kind, 'broken-here');
});

test('failing on the first run of a branch while other branches pass is broken here', () => {
    const history = [run('feature/b', 'success'), run('feature/c', 'success'), run('feature/d', 'cancelled')];

    const result = verdict(job, history, at);
    assert.equal(result.kind, 'broken-here');
    assert.match(result.reason, /First run on this branch.*2 of 3 other branches/);
});

test('a first run with one other branch to compare with cannot tell', () => {
    const result = verdict(job, [run('feature/b', 'success')], at);
    assert.equal(result.kind, 'unknown');
    assert.match(result.reason, /too few other branches/);
});

test('a previous run on the branch that failed another way cannot tell', () => {
    const history = [run('feature/a', 'failure', { step: 'Build' }), run('feature/b', 'success'), run('feature/c', 'success')];

    const result = verdict(job, history, at);
    assert.equal(result.kind, 'unknown');
    assert.match(result.reason, /previous run on this branch.*failed another way/);
});

test('without earlier runs it cannot tell', () => {
    assert.equal(verdict(job, [], at).kind, 'unknown');
});
