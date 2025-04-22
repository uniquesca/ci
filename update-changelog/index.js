import core from "@actions/core";
import fs from "fs";
import { updateChangelog, generateChangelog } from "../src/changelog.js";
import { getLastGitTag, getGitTag } from "../src/git.js";
import process from "process";

let gitPath = '.';
const changelogPath = core.getInput('changelog_path') || process.argv[2];
const targetVersion = core.getInput('target_version') || process.argv[3];
let mode = core.getInput('mode') || process.argv[4] || 'normal';
let offset = core.getInput('offset') || process.argv[5];
if (!changelogPath || !targetVersion) {
    console.error('Usage: node changelog.js CHANGELOG_PATH TARGET_VERSION ["normal"|"raw"] [OFFSET]');
    process.exit(1);
}

let startTag, endTag;
if (!offset) {
    offset = 0;
    startTag = getLastGitTag(gitPath);
    endTag = 'HEAD';
}
else {
    startTag = getGitTag(gitPath, Number(offset) + 1);
    endTag = getGitTag(gitPath, offset)
}

if (mode == 'raw') {
    core.info('Generating raw changelog...')
    const changelog = generateChangelog(gitPath, startTag, endTag);
    fs.writeFileSync(changelogPath, changelog);
} else {
    core.info('Updating changelog in normal (non-raw) mode...')
    updateChangelog(gitPath, changelogPath, targetVersion, startTag, endTag);
}
