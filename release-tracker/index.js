// Runs one release-tracker command; see action.yml for the inputs.
import fs from 'node:fs';
import path from 'node:path';
import core from '@actions/core';
import github from '@actions/github';
import { createTracker, normaliseConfig } from '../src/release-tracker.js';

const input = name => core.getInput(name);

async function readConfig(api, repo) {
    const { data } = await api.rest.repos.getContent({ ...repo, path: input('config_file') });
    return normaliseConfig(JSON.parse(Buffer.from(data.content, 'base64').toString('utf8')));
}

async function main() {
    const { context } = github;
    const api = github.getOctokit(input('github_token'));
    const refs = input('release_token') ? github.getOctokit(input('release_token')) : api;
    const config = await readConfig(api, context.repo);
    const log = message => {
        core.info(message);
        core.summary.addRaw(`${message}\n\n`);
    };
    const tracker = createTracker({ api, refs, repo: context.repo, config, core, log });

    switch (input('command')) {
        case 'start':
            await tracker.start({ type: input('type'), version: input('version'), actor: context.actor });
            break;
        case 'refresh':
            await tracker.refresh(input('branch'));
            break;
        case 'command':
            await tracker.command({
                issue: context.payload.issue,
                commentBody: context.payload.comment.body,
                login: context.payload.comment.user.login,
            });
            break;
        case 'report-sync':
            await tracker.reportSync({
                issueNumber: context.issue.number,
                branch: input('branch'),
                result: input('result'),
                detail: input('detail'),
            });
            break;
        case 'post-released':
            await tracker.postReleased({
                issueNumber: context.issue.number,
                shas: { main_sha: input('main_sha'), develop_sha: input('develop_sha') },
            });
            break;
        case 'notes': {
            const dir = input('notes_dir');
            const read = file => fs.readFileSync(path.join(dir, file), 'utf8');
            const overview = fs.existsSync(path.join(dir, 'overview.md')) ? read('overview.md') : '';
            await tracker.postNotes({
                branch: input('branch'),
                notes: { ...JSON.parse(read('meta.json')), changelog: read('changelog.md'), overview },
            });
            break;
        }
        default:
            throw new Error(`Unknown command '${input('command')}'`);
    }
    await core.summary.write();
}

main().catch(error => core.setFailed(error.message));
