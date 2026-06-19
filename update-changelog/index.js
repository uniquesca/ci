import core from "@actions/core";
import fs from "fs";
import path from "path";
import { updateChangelog, generateChangelog } from "../src/changelog.js";
import { getLastGitTag, getGitTag } from "../src/git.js";
import process from "process";

let gitPath = '.';
const workingDirectory = core.getInput('working_directory') || process.argv[2] || '.';
const changelogPath = path.join(workingDirectory, 'CHANGELOG.md');
const targetVersion = core.getInput('target_version') || process.argv[3];
let mode = core.getInput('mode') || process.argv[4] || 'normal';
let offset = core.getInput('offset') || process.argv[5];
const useTags = (core.getInput('use_tags') || 'true') === 'true';

if (!targetVersion) {
    console.error('Usage: node changelog.js [WORKING_DIRECTORY] TARGET_VERSION ["normal"|"raw"] [OFFSET]');
    process.exit(1);
}

let startTag, endTag;
if (!offset) {
    offset = 0;
    startTag = getLastGitTag(gitPath);
    endTag = 'HEAD';
} else {
    startTag = getGitTag(gitPath, Number(offset) + 1);
    endTag = getGitTag(gitPath, offset)
}

if (mode == 'raw') {
    core.info('Generating raw changelog: ' + startTag + '..' + endTag)
    const changelog = generateChangelog(gitPath, startTag, endTag);
    fs.writeFileSync(changelogPath, changelog);
} else {
    core.info('Updating changelog in normal (non-raw) mode: ' + startTag + '..' + endTag)
    updateChangelog(gitPath, changelogPath, targetVersion, startTag, endTag, useTags);
}
