// Runs auto-merge on one pull request or on the open pull requests of a branch; see action.yml.
import core from '@actions/core';
import github from '@actions/github';
import { createAutoMerge } from '../src/auto-merge.js';

const input = name => core.getInput(name);

async function main() {
    const { context } = github;
    const autoMerge = createAutoMerge({
        api: github.getOctokit(input('github_token')),
        merger: github.getOctokit(input('merge_token')),
        repo: context.repo,
        policyFile: input('policy_file'),
        log: message => core.info(message),
    });

    const numbers = input('pull_number')
        ? [Number(input('pull_number'))]
        : input('branch') ? await autoMerge.pullsForBranch(input('branch')) : [];
    const results = [];
    for (const number of numbers) {
        results.push(`#${number} ${await autoMerge.consider(number)}`);
    }
    core.setOutput('result', results.join(', '));
}

main().catch(error => core.setFailed(error.message));
