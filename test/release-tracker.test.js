import test from 'node:test';
import assert from 'node:assert/strict';
import {
    NOTES_END,
    NOTES_START,
    compareVersions,
    createTracker,
    issueBody,
    normaliseConfig,
    parseCommand,
    parseIssueMeta,
    runResult,
    uncheckedItems,
} from '../src/release-tracker.js';

const phases = [
    { id: 'release', title: 'Release checks', checks: [{ name: 'QA', workflow: 'qa.yml', branch: '{branch}' }] },
    { id: 'post-release', title: 'Publication', checks: [{ name: 'GitHub release', githubRelease: true }] },
];
const meta = { type: 'release', version: '1.2.0', branch: 'release/1.2.0' };

test('normaliseConfig fills the defaults and needs both phases', () => {
    const config = normaliseConfig({ phases });
    assert.equal(config.mainBranch, 'main');
    assert.equal(config.versionCommand, false);
    assert.throws(() => normaliseConfig({ phases: [phases[0]] }), /post-release/);
    assert.throws(() => normaliseConfig({ phases: [{ ...phases[0], checks: [{ name: 'x' }] }, phases[1]] }), /needs a name/);
});

test('parseCommand reads the first line only, and only known commands', () => {
    assert.deepEqual(parseCommand('/release'), { name: 'release', argument: '' });
    assert.deepEqual(parseCommand('/version 2.0.0\nbecause'), { name: 'version', argument: '2.0.0' });
    assert.equal(parseCommand('/ai-do'), null);
    assert.equal(parseCommand('please /release'), null);
    assert.equal(parseCommand('/release now please'), null);
});

test('compareVersions compares numerically', () => {
    assert.ok(compareVersions('1.10.0', '1.9.9') > 0);
    assert.equal(compareVersions('1.2.3', '1.2.3'), 0);
});

test('issueBody holds the marker, and the checklist and notes only when configured', () => {
    const plain = issueBody(meta, normaliseConfig({ phases }));
    assert.deepEqual(parseIssueMeta(plain), meta);
    assert.ok(!plain.includes('/version'));
    assert.ok(!plain.includes(NOTES_START));
    assert.equal(uncheckedItems(plain), null);

    const full = issueBody(meta, normaliseConfig({
        phases,
        mainBranch: 'master',
        versionCommand: true,
        releaseNotes: true,
        checklist: { owner: 'qa-person', items: ['Tested', 'Announced'] },
    }));
    assert.ok(full.includes('`/version 1.2.3`'));
    assert.ok(full.includes('(@qa-person)'));
    assert.ok(full.includes('`master`'));
    assert.deepEqual(uncheckedItems(full), ['Tested', 'Announced']);
});

test('uncheckedItems ignores boxes in the release notes', () => {
    const body = `- [x] Done\n- [ ] Open\n${NOTES_START}\n- [ ] from a commit\n${NOTES_END}`;
    assert.deepEqual(uncheckedItems(body), ['Open']);
});

test('runResult maps a run to a state', () => {
    const check = { name: 'QA' };
    assert.equal(runResult(check, null).state, 'pending');
    assert.equal(runResult(check, { status: 'in_progress', run_number: 1, html_url: 'u' }).state, 'pending');
    assert.equal(runResult(check, { status: 'completed', conclusion: 'success', run_number: 1, html_url: 'u' }).state, 'passed');
    assert.equal(runResult(check, { status: 'completed', conclusion: 'failure', run_number: 1, html_url: 'u' }).text, '❌ Failed');
});

// A fake Octokit holding just what the command needs
function fakeApi({ role = 'admin', runs = [], comments = [] }) {
    const calls = [];
    const record = name => async params => {
        calls.push({ name, params });
        return { data: {} };
    };
    return {
        calls,
        paginate: async (method, params) => method(params),
        rest: {
            issues: {
                listComments: async () => comments,
                createComment: record('createComment'),
                update: record('update'),
            },
            repos: { getCollaboratorPermissionLevel: async () => ({ data: { role_name: role } }) },
            actions: { listWorkflowRuns: async () => ({ data: { workflow_runs: runs } }) },
            git: { deleteRef: record('deleteRef') },
        },
    };
}

function fakeCore() {
    const outputs = {};
    return { outputs, failed: null, setOutput: (key, value) => { outputs[key] = value; }, setFailed(message) { this.failed = message; } };
}

const issue = { number: 7, body: issueBody(meta, normaliseConfig({ phases })) };

test('/release is refused while a check has not passed', async () => {
    const api = fakeApi({ runs: [{ status: 'completed', conclusion: 'failure', run_number: 3, html_url: 'u' }] });
    const core = fakeCore();
    const tracker = createTracker({ api, repo: { owner: 'o', repo: 'r' }, config: normaliseConfig({ phases }), core });
    await tracker.command({ issue, commentBody: '/release', login: 'someone' });
    assert.equal(core.outputs.refused, 'true');
    assert.equal(core.outputs.branch, undefined);
    assert.match(api.calls.find(call => call.name === 'createComment').params.body, /QA: ❌ Failed/);
});

test('/release goes ahead for a maintainer when every check passed', async () => {
    const api = fakeApi({ role: 'maintain', runs: [{ status: 'completed', conclusion: 'success', run_number: 3, html_url: 'u' }] });
    const core = fakeCore();
    const tracker = createTracker({ api, repo: { owner: 'o', repo: 'r' }, config: normaliseConfig({ phases }), core });
    await tracker.command({ issue, commentBody: '/release', login: 'someone' });
    assert.equal(core.failed, null);
    assert.equal(core.outputs.branch, 'release/1.2.0');
    assert.equal(core.outputs.version, '1.2.0');
});

test('a writer cannot run /abandon', async () => {
    const api = fakeApi({ role: 'write' });
    const core = fakeCore();
    const tracker = createTracker({ api, repo: { owner: 'o', repo: 'r' }, config: normaliseConfig({ phases }), core });
    await tracker.command({ issue, commentBody: '/abandon', login: 'someone' });
    assert.equal(core.outputs.refused, 'true');
    assert.ok(!api.calls.some(call => call.name === 'deleteRef'));
});

test('/abandon deletes the branch and closes the issue as not planned', async () => {
    const api = fakeApi({});
    const core = fakeCore();
    const tracker = createTracker({ api, repo: { owner: 'o', repo: 'r' }, config: normaliseConfig({ phases }), core });
    await tracker.command({ issue, commentBody: '/abandon', login: 'someone' });
    assert.deepEqual(api.calls.find(call => call.name === 'deleteRef').params.ref, 'heads/release/1.2.0');
    assert.equal(api.calls.find(call => call.name === 'update').params.state_reason, 'not_planned');
});

test('nothing runs on a released issue', async () => {
    const api = fakeApi({ comments: [{ body: `<!-- release-tracker:post-release {} -->` }] });
    const core = fakeCore();
    const tracker = createTracker({ api, repo: { owner: 'o', repo: 'r' }, config: normaliseConfig({ phases }), core });
    await tracker.command({ issue, commentBody: '/sync', login: 'someone' });
    assert.equal(core.outputs.refused, 'true');
});
