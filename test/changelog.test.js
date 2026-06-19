import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { updateChangelogFromGitLog } from '../src/changelog.js';

function createTempChangelogDir() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-changelog-test-'));

    fs.writeFileSync(
        path.join(dir, 'CHANGELOG.md'),
        '# Test Changelog\n',
        'utf8'
    );

    return dir;
}

function fakeGitLogRecord(message, hash = 'abc1234', author = 'Test User') {
    return message + '||' + hash + '||' + author + '||EOR';
}

test('updateChangelogFromGitLog creates main and tag-specific changelogs', () => {
    const dir = createTempChangelogDir();

    const gitLog = [
        fakeGitLogRecord('Fix: [api] fixed API issue', '1111111'),
        fakeGitLogRecord('New: [frontend] added UI feature', '2222222'),
        fakeGitLogRecord('Update: [api] [frontend] shared update', '3333333'),
        fakeGitLogRecord('Docs: [api] documentation only', '4444444'),
        fakeGitLogRecord('Fix: [skip-ci] infrastructure fix', '5555555')
    ].join('');

    updateChangelogFromGitLog(dir, 'CHANGELOG.md', '1.1.0', gitLog, true);

    const mainChangelog = fs.readFileSync(path.join(dir, 'CHANGELOG.md'), 'utf8');
    const apiChangelog = fs.readFileSync(path.join(dir, 'CHANGELOG.api.md'), 'utf8');
    const frontendChangelog = fs.readFileSync(path.join(dir, 'CHANGELOG.frontend.md'), 'utf8');

    assert.match(mainChangelog, /## v1\.1\.0/);
    assert.match(mainChangelog, /\* Fix: fixed API issue \(1111111 by Test User\)/);
    assert.match(mainChangelog, /\* New: added UI feature \(2222222 by Test User\)/);
    assert.match(mainChangelog, /\* Update: shared update \(3333333 by Test User\)/);
    assert.match(mainChangelog, /\* Fix: infrastructure fix \(5555555 by Test User\)/);

    assert.doesNotMatch(mainChangelog, /\[api]/);
    assert.doesNotMatch(mainChangelog, /\[frontend]/);
    assert.doesNotMatch(mainChangelog, /\[skip-ci]/);
    assert.doesNotMatch(mainChangelog, /documentation only/);

    assert.match(apiChangelog, /\* Fix: fixed API issue \(1111111 by Test User\)/);
    assert.match(apiChangelog, /\* Update: shared update \(3333333 by Test User\)/);
    assert.doesNotMatch(apiChangelog, /added UI feature/);
    assert.doesNotMatch(apiChangelog, /documentation only/);
    assert.doesNotMatch(apiChangelog, /\[api]/);

    assert.match(frontendChangelog, /\* New: added UI feature \(2222222 by Test User\)/);
    assert.match(frontendChangelog, /\* Update: shared update \(3333333 by Test User\)/);
    assert.doesNotMatch(frontendChangelog, /fixed API issue/);
    assert.doesNotMatch(frontendChangelog, /\[frontend]/);

    assert.equal(
        fs.existsSync(path.join(dir, 'CHANGELOG.skip-ci.md')),
        false
    );
});

test('updateChangelogFromGitLog does not create tag-specific changelogs when useTags is false', () => {
    const dir = createTempChangelogDir();

    const gitLog = fakeGitLogRecord('Fix: [api] fixed API issue', '1111111');

    updateChangelogFromGitLog(dir, 'CHANGELOG.md', '1.1.0', gitLog, false);

    const mainChangelog = fs.readFileSync(path.join(dir, 'CHANGELOG.md'), 'utf8');

    assert.match(mainChangelog, /## v1\.1\.0/);
    assert.match(mainChangelog, /\* Fix: fixed API issue \(1111111 by Test User\)/);
    assert.doesNotMatch(mainChangelog, /\[api]/);

    assert.equal(
        fs.existsSync(path.join(dir, 'CHANGELOG.api.md')),
        false
    );
});

test('updateChangelogFromGitLog rewrites existing target version section', () => {
    const dir = createTempChangelogDir();

    fs.writeFileSync(
        path.join(dir, 'CHANGELOG.md'),
        '# Test Changelog\n\n## v1.1.0\n\n* Fix: old generated record\n',
        'utf8'
    );

    const gitLog = fakeGitLogRecord('Fix: [api] new generated record', '1111111');

    updateChangelogFromGitLog(dir, 'CHANGELOG.md', '1.1.0', gitLog, true);

    const mainChangelog = fs.readFileSync(path.join(dir, 'CHANGELOG.md'), 'utf8');

    assert.match(mainChangelog, /\* Fix: new generated record \(1111111 by Test User\)/);
    assert.doesNotMatch(mainChangelog, /old generated record/);
});