import core from "@actions/core";
import cp from "child_process";

export function getLastGitTag(gitPath) {
    const lastTagCommand = "cd " + gitPath + " && git describe --abbrev=0 --tags";
    core.debug('Getting last git tag:');
    core.debug(lastTagCommand);
    return cp.execSync(lastTagCommand).toString().trim();
}

export function getGitTag(gitPath, offset) {
    const getTagCommand = "cd " + gitPath + " && git tag --sort=-creatordate | head -" + offset + " | tail -1";
    core.debug('Getting git tag:');
    core.debug(getTagCommand);
    const result = cp.spawnSync('sh', ['-c', getTagCommand]);
    return result.stdout.toString().trim();
}