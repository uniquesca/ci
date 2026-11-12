import test from 'node:test';
import assert from 'node:assert/strict';
import { checkState, createAutoMerge, decide, normalisePolicy, onlyAllowedDependencyLines } from '../src/auto-merge.js';

const POLICY_FILE = '.github/merge-policy.json';
const policy = normalisePolicy({ allow: [{ rule: 'dependency-bump' }] });
const reviewReasons = (facts, which = policy) => decide(facts, which, POLICY_FILE).reasons;
const repoName = 'uniquesca/officio';
const bot = { login: 'uniques-service' };

function bump(overrides = {}) {
    return {
        pull: {
            number: 5,
            state: 'open',
            draft: false,
            title: 'Update: bump @uniquesca/sentry-config to 1.20.0',
            user: bot,
            base: { ref: 'develop', repo: { full_name: repoName } },
            head: { ref: 'deps/uniquesca-sentry-config-1.20.0', sha: 'abc', repo: { full_name: repoName } },
            ...overrides.pull,
        },
        files: overrides.files || [
            { filename: 'package.json', patch: '@@ -1 +1 @@\n-    "@uniquesca/sentry-config": "^1.19.0",\n+    "@uniquesca/sentry-config": "^1.20.0",' },
            { filename: 'yarn.lock' },
        ],
        commits: overrides.commits || [{ author: bot, committer: bot, commit: { author: { name: 'CI' } } }],
    };
}

test('a bump from the bump workflow needs no review', () => {
    assert.equal(decide(bump(), policy, POLICY_FILE).allowed, true);
});

test('a human commit on a bump branch needs a review', () => {
    const reasons = reviewReasons(bump({ commits: [...bump().commits, { author: { login: 'someone' }, committer: { login: 'someone' }, commit: { author: { name: 'x' } } }] }));
    assert.equal(reasons.length, 1);
    assert.match(reasons[0], /someone/);
});

test('a change outside manifests and lock files needs a review', () => {
    const reasons = reviewReasons(bump({ files: [...bump().files, { filename: 'src/index.php', patch: '+x' }] }));
    assert.match(reasons.join(), /src\/index\.php/);
});

test('a manifest change beyond allowed packages needs a review', () => {
    const files = [{ filename: 'composer.json', patch: '-    "uniquesca/php-stdlib": "^1.1",\n+    "uniquesca/php-stdlib": "^1.2",\n+    "evil/package": "^1.0",' }];
    assert.match(reviewReasons(bump({ files })).join(), /composer\.json/);
});

test('a pull request by someone else needs a review, and one into another branch never merges', () => {
    assert.match(reviewReasons(bump({ pull: { user: { login: 'someone' } } })).join(), /opened by @someone/);
    assert.match(reviewReasons(bump({ pull: { base: { ref: 'main', repo: { full_name: repoName } } } })).join(), /goes into `main`/);
});

test('installed paths may change when configured', () => {
    const files = [...bump().files, { filename: 'vendor/uniquesca/x/a.php' }];
    assert.equal(reviewReasons(bump({ files })).length, 1);
    const withVendor = normalisePolicy({ allow: [{ rule: 'dependency-bump', installedPaths: ['vendor'] }] });
    assert.equal(decide(bump({ files }), withVendor, POLICY_FILE).allowed, true);
});

test('onlyAllowedDependencyLines needs at least one changed line', () => {
    assert.equal(onlyAllowedDependencyLines('', ['uniquesca/']), false);
    assert.equal(onlyAllowedDependencyLines(undefined, ['uniquesca/']), false);
});

const run = (name, status, conclusion, started = '2026-01-01T00:00:00Z') => ({ name, status, conclusion, started_at: started });

test('checkState passes only when every required check passed', () => {
    const required = ['QA Checks result', 'E2E result'];
    assert.equal(checkState(required, [run('QA Checks result', 'completed', 'success'), run('E2E result', 'completed', 'skipped')]).state, 'passed');
    assert.equal(checkState(required, [run('QA Checks result', 'completed', 'success')]).state, 'pending');
    assert.equal(checkState(required, [run('QA Checks result', 'completed', 'failure'), run('E2E result', 'in_progress', null)]).state, 'failed');
    assert.equal(checkState([], []).state, 'failed');
});

test('checkState takes the latest run of a check', () => {
    const runs = [run('QA', 'completed', 'failure', '2026-01-01T00:00:00Z'), run('QA', 'completed', 'success', '2026-01-02T00:00:00Z')];
    assert.equal(checkState(['QA'], runs).state, 'passed');
});

function fakeApi({ data, required, checkRuns, policyJson = { allow: [{ rule: 'dependency-bump' }] } }) {
    const calls = [];
    const record = name => async params => { calls.push({ name, params }); return { data: {} }; };
    return {
        calls,
        paginate: async (method, params) => {
            if (method === 'GET /repos/{owner}/{repo}/rules/branches/{branch}') {
                return [{ type: 'required_status_checks', parameters: { required_status_checks: required.map(context => ({ context })) } }];
            }
            return method(params);
        },
        rest: {
            pulls: {
                get: async () => ({ data: data.pull }),
                listFiles: async () => data.files,
                listCommits: async () => data.commits,
                merge: record('merge'),
            },
            checks: { listForRef: async () => checkRuns },
            repos: {
                getContent: async () => {
                    if (policyJson === null) {
                        throw Object.assign(new Error('Not Found'), { status: 404 });
                    }
                    return { data: { content: Buffer.from(JSON.stringify(policyJson)).toString('base64') } };
                },
            },
            issues: { listComments: async () => [], createComment: record('createComment'), updateComment: record('updateComment') },
        },
    };
}

test('a green bump is merged at its head commit', async () => {
    const api = fakeApi({ data: bump(), required: ['QA'], checkRuns: [run('QA', 'completed', 'success')] });
    const result = await createAutoMerge({ api, merger: api, repo: { owner: 'uniquesca', repo: 'officio' } }).consider(5);
    assert.equal(result, 'merged');
    const merge = api.calls.find(call => call.name === 'merge').params;
    assert.equal(merge.sha, 'abc');
    assert.equal(merge.commit_title, 'Update: bump @uniquesca/sentry-config to 1.20.0 (#5)');
});

test('a bump with checks still running is left alone', async () => {
    const api = fakeApi({ data: bump(), required: ['QA'], checkRuns: [run('QA', 'in_progress', null)] });
    const result = await createAutoMerge({ api, merger: api, repo: { owner: 'uniquesca', repo: 'officio' } }).consider(5);
    assert.equal(result, 'pending');
    assert.equal(api.calls.length, 0);
});

test('a bump that needs a review is not merged and says why', async () => {
    const data = bump({ files: [{ filename: 'README.md', patch: '+x' }] });
    const api = fakeApi({ data, required: ['QA'], checkRuns: [run('QA', 'completed', 'success')] });
    const result = await createAutoMerge({ api, merger: api, repo: { owner: 'uniquesca', repo: 'officio' } }).consider(5);
    assert.equal(result, 'review');
    assert.ok(!api.calls.some(call => call.name === 'merge'));
    assert.match(api.calls.find(call => call.name === 'createComment').params.body, /README\.md/);
});

test('a pull request that changes the merge policy never merges automatically', () => {
    const files = [...bump().files, { filename: POLICY_FILE, patch: '+x' }];
    const decision = decide(bump({ files }), policy, POLICY_FILE);
    assert.equal(decision.allowed, false);
    assert.match(decision.reasons.join(), /merge policy/);
});

test('normalisePolicy refuses unknown rules and an empty allow list', () => {
    assert.throws(() => normalisePolicy({ allow: [] }), /at least one rule/);
    assert.throws(() => normalisePolicy({ allow: [{ rule: 'anything' }] }), /Unknown merge policy rule/);
});

test('a human pull request is not a bump and stays quiet', () => {
    const decision = decide(bump({ pull: { head: { ref: 'feature/x', sha: 'abc', repo: { full_name: repoName } }, user: { login: 'someone' } } }), policy, POLICY_FILE);
    assert.equal(decision.allowed, false);
    assert.equal(decision.applies, false);
});

test('the checks the policy lists are required on top of the ruleset ones', async () => {
    const api = fakeApi({
        data: bump(),
        required: ['QA'],
        checkRuns: [run('QA', 'completed', 'success')],
        policyJson: { allow: [{ rule: 'dependency-bump' }], checks: ['E2E result'] },
    });
    const result = await createAutoMerge({ api, merger: api, repo: { owner: 'uniquesca', repo: 'officio' } }).consider(5);
    assert.equal(result, 'pending');
});

test('without a policy file nothing merges', async () => {
    const api = fakeApi({ data: bump(), required: ['QA'], checkRuns: [run('QA', 'completed', 'success')], policyJson: null });
    const result = await createAutoMerge({ api, merger: api, repo: { owner: 'uniquesca', repo: 'officio' } }).consider(5);
    assert.equal(result, 'no-policy');
    assert.equal(api.calls.length, 0);
});
