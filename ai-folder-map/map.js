// Writes the folder map for ai-folder-map. Inputs come in as INPUT_* variables, the output goes
// to GITHUB_OUTPUT.
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import { folderMap } from '../src/ai-map.js';

const env = process.env;

let paths = [];
try {
    paths = execFileSync('git', ['ls-files', '-z'], { maxBuffer: 1 << 30 }).toString().split('\0').filter(Boolean);
} catch {
    console.log('::warning title=No folder map::git could not list the files here, so the agent gets no map');
}

const map = folderMap(paths, { depth: Number(env.INPUT_DEPTH), maxLines: Number(env.INPUT_MAX_LINES) });
const text = map && [
    'The folders in this repository, with how many files are under each. Start from it instead of',
    'listing directories:',
    '',
    '```',
    map,
    '```',
].join('\n');

console.log(map ? `The agent gets a map of ${map.split('\n').length} lines:\n${map}` : 'Git tracks no folders here, so there is no map');

// A folder can be called anything, so the delimiter is one no folder name holds
const delimiter = `MAP_${randomUUID()}`;
fs.appendFileSync(env.GITHUB_OUTPUT, `text<<${delimiter}\n${text}\n${delimiter}\n`);
