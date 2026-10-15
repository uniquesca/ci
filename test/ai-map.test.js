import test from 'node:test';
import assert from 'node:assert/strict';
import { folderMap } from '../src/ai-map.js';

test('folders are listed with the files under each, and top-level files are left out', () => {
    const map = folderMap(['README.md', 'src/a.js', 'src/lib/b.js', 'src/lib/c.js', 'test/a.test.js']);

    assert.equal(map, ['src/ (3)', '  lib/ (2)', 'test/ (1)'].join('\n'));
    assert.equal(folderMap(['README.md']), '');
});

test('dependencies and build output are never opened', () => {
    const map = folderMap(['vendor/acme/lib/a.php', 'node_modules/x/index.js', 'src/a.php']);

    assert.equal(map, ['node_modules/ (1)', 'src/ (1)', 'vendor/ (1)'].join('\n'));
});

test('only the biggest folders are named, and the rest are counted', () => {
    const paths = ['a/1', 'a/2', 'a/3', 'b/1', 'b/2', 'c/1'];

    assert.equal(folderMap(paths, { maxChildren: 2 }), ['a/ (3)', 'b/ (2)', '... 1 more folders'].join('\n'));
});

test('a map too long for the limit loses depth before it loses folders', () => {
    const paths = ['a/x/1', 'a/y/1', 'b/x/1', 'b/y/1'];

    assert.equal(folderMap(paths, { maxLines: 6 }).split('\n').length, 6);
    assert.equal(folderMap(paths, { maxLines: 5 }), ['a/ (2)', 'b/ (2)'].join('\n'));
    assert.equal(folderMap(paths, { maxLines: 1 }), ['a/ (2)', 'b/ (2)'].join('\n'));
});
