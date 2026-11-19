import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expandPackageFolders, readNpmPackages, setPackageVersions } from '../src/package-versions.js';

function repo(files) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-package-versions-test-'));
    for (const [file, content] of Object.entries(files)) {
        fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
        fs.writeFileSync(path.join(dir, file), typeof content === 'string' ? content : JSON.stringify(content, null, 2) + '\n');
    }
    return dir;
}

const read = (dir, file) => JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));

test('sets the version in the root package.json with nothing listed', () => {
    const dir = repo({ 'package.json': { name: 'app', version: '1.0.0' } });

    assert.deepEqual(setPackageVersions(dir, '2.0.1'), ['package.json']);
    assert.equal(read(dir, 'package.json').version, '2.0.1');
});

test('does nothing without any package.json', () => {
    assert.deepEqual(setPackageVersions(repo({ 'composer.json': '{}' }), '2.0.1'), []);
});

test('sets the version in listed packages and pins dependencies between them', () => {
    const dir = repo({
        'ng-src/libs/lib/package.json': { name: '@u/lib', version: '0.0.0' },
        'ng-src/libs/field/package.json': {
            name: '@u/field',
            version: '0.0.0',
            peerDependencies: { '@u/lib': '^1.6.0', '@angular/core': '^20.0.0' },
            devDependencies: { '@u/lib': '*' },
        },
    });

    const written = setPackageVersions(dir, '2.0.1', ['ng-src/libs/lib', 'ng-src/libs/field']);

    assert.deepEqual(written.sort(), ['ng-src/libs/field/package.json', 'ng-src/libs/lib/package.json']);
    const field = read(dir, 'ng-src/libs/field/package.json');
    assert.equal(field.version, '2.0.1');
    assert.deepEqual(field.peerDependencies, { '@u/lib': '2.0.1', '@angular/core': '^20.0.0' });
    assert.deepEqual(field.devDependencies, { '@u/lib': '2.0.1' });
});

test('expands * and skips folders without a package.json and node_modules', () => {
    const dir = repo({
        'apps/a/package.json': { name: 'a' },
        'apps/b/package.json': { name: 'b' },
        'apps/docs/readme.md': '',
        'apps/node_modules/package.json': { name: 'x' },
    });

    assert.deepEqual(expandPackageFolders(dir, ['apps/*', 'apps/a']), ['apps/a', 'apps/b']);
});

test('fails on an entry that matches nothing', () => {
    assert.throws(() => expandPackageFolders(repo({}), ['libs/missing']), /matches no folder/);
});

test('keeps indentation and leaves an unchanged file alone', () => {
    const text = '{\n    "name": "a",\n    "version": "2.0.1"\n}\n';
    const dir = repo({ 'package.json': text });

    assert.deepEqual(setPackageVersions(dir, '2.0.1'), []);
    fs.writeFileSync(path.join(dir, 'package.json'), text.replace('2.0.1', '1.0.0'));
    setPackageVersions(dir, '2.0.1');
    assert.equal(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'), text);
});

test('reads release.npm_packages from _ci_environment.json', () => {
    assert.deepEqual(readNpmPackages(repo({})), []);
    assert.deepEqual(readNpmPackages(repo({ '_ci_environment.json': { job_matrix: [] } })), []);
    assert.deepEqual(readNpmPackages(repo({ '_ci_environment.json': { release: { npm_packages: ['apps/*'] } } })), ['apps/*']);
    assert.throws(() => readNpmPackages(repo({ '_ci_environment.json': { release: { npm_packages: 'apps/*' } } })));
});
