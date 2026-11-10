// Release tracker: one issue per release/hotfix branch, with a status comment per phase, and the
// commands posted on it. Driven by the release-tracker action; the caller's settings are in
// `.github/release-tracker.json`, described in docs/workflows/release-tracker.md.

// Where the changelog and the overview go in the issue body. Everything between them is replaced
// each time the notes are posted.
export const NOTES_START = '<!-- release-tracker:notes-start -->';
export const NOTES_END = '<!-- release-tracker:notes-end -->';

export const COMMANDS = ['release', 'sync', 'abandon', 'version', 'status'];

// The label every release issue carries; the workflows filter comments on it
export const LABEL = 'release';

export function normaliseConfig(raw) {
    const config = {
        mainBranch: 'main',
        checklist: null,
        versionCommand: false,
        releaseNotes: false,
        ...raw,
    };
    const ids = (config.phases || []).map(phase => phase.id);
    for (const id of ['release', 'post-release']) {
        if (!ids.includes(id)) {
            throw new Error(`release-tracker.json needs a phase with the id '${id}'`);
        }
    }
    for (const phase of config.phases) {
        for (const check of phase.checks || []) {
            if (!check.name || !(check.workflow || check.githubRelease || check.npmPackage)) {
                throw new Error(`Check ${JSON.stringify(check)} in phase '${phase.id}' needs a name and one of workflow, githubRelease or npmPackage`);
            }
        }
    }
    return config;
}

// Hidden markers are how the tracker finds its own issue and comments again
export const issueMarker = meta => `<!-- release-tracker ${JSON.stringify(meta)} -->`;
export const commentMarker = (phaseId, meta) => `<!-- release-tracker:${phaseId} ${JSON.stringify(meta)} -->`;

export function parseIssueMeta(body) {
    const match = /<!-- release-tracker (\{.*?\}) -->/.exec(body || '');
    return match ? JSON.parse(match[1]) : null;
}

export function parseCommentMeta(body) {
    const match = /<!-- release-tracker:([\w-]+) (\{.*?\}) -->/.exec(body || '');
    return match ? { phaseId: match[1], meta: JSON.parse(match[2]) } : null;
}

export const fill = (template, vars) => template.replace(/\{(\w+)\}/g, (match, key) => vars[key] ?? match);

export const isReleaseBranch = branch => /^(release|hotfix)\/\d+\.\d+\.\d+$/.test(branch || '');

export function branchInfo(branch) {
    const [prefix, version] = branch.split('/');
    return { type: prefix === 'hotfix' ? 'hotfix' : 'release', version, branch };
}

export const titleFor = meta => `${meta.type === 'hotfix' ? 'Hotfix' : 'Release'} ${meta.version}`;

export const isVersion = version => /^\d+\.\d+\.\d+$/.test(version || '');

export function compareVersions(a, b) {
    const left = a.split('.').map(Number);
    const right = b.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
        if (left[i] !== right[i]) {
            return left[i] - right[i];
        }
    }
    return 0;
}

// The command on the comment's first line, e.g. { name: 'version', argument: '8.17.0' }
export function parseCommand(body) {
    const match = /^\/(\w+)(?:[ \t]+(\S+))?[ \t]*$/.exec((body || '').split('\n')[0].trim());
    return match && COMMANDS.includes(match[1]) ? { name: match[1], argument: match[2] || '' } : null;
}

// Unticked items of the checklist. Only above the release notes: a commit message or the overview
// can hold a `- [ ]` line too. Null when the issue has no checklist at all.
export function uncheckedItems(body) {
    const checklist = (body || '').split(NOTES_START)[0];
    const checkboxes = checklist.match(/^\s*[-*] \[[ xX]\].*$/gm) || [];
    if (checkboxes.length === 0) {
        return null;
    }
    return checkboxes.filter(line => /\[ \]/.test(line)).map(line => line.replace(/^\s*[-*] \[ \]\s*/, ''));
}

export function issueBody(meta, config) {
    const base = meta.type === 'hotfix' ? config.mainBranch : 'develop';
    const needs = ['the latest run of every release check on the branch passed'];
    if (config.checklist) {
        needs.unshift('every checklist item ticked');
    }
    const lines = [
        issueMarker(meta),
        `Branch: \`${meta.branch}\`, from \`${base}\``,
        '',
        '> [!NOTE]',
        '> **Commands** - comment one on this issue. All but `/status` are for repository maintainers and admins only.',
        `> - \`/release\` - merge into \`${config.mainBranch}\` and \`develop\` and tag the version. Needs ${needs.join(' and ')}.`,
        '> - `/sync` - merge `develop` into the branch. The release checks run again.',
    ];
    if (config.versionCommand) {
        lines.push('> - `/version 1.2.3` - change the version. Renames the branch and this issue; the release checks run again.');
    }
    lines.push(
        `> - \`/abandon\` - drop the ${meta.type} without releasing it. Deletes the branch and closes this issue.`,
        '> - `/status` - refresh the status comments.',
        ''
    );

    if (config.checklist) {
        const owner = config.checklist.owner ? ` (@${config.checklist.owner})` : '';
        lines.push(`### ${config.checklist.title || 'Release checklist'}${owner}`);
        lines.push(...config.checklist.items.map(item => `- [ ] ${item}`), '');
    }
    if (config.releaseNotes) {
        lines.push(NOTES_START, NOTES_END, '');
    }

    const steps = [];
    if (config.checklist) {
        steps.push('Tick every item of the checklist above.');
    }
    steps.push(
        'When the release checks below have passed, a maintainer posts `/release`.',
        'Follow the publication in the status comment that follows. This issue closes by itself when everything there has passed. If anything failed, fix it and close the issue by hand.'
    );
    lines.push("### What's next", ...steps.map((step, i) => `${i + 1}. ${step}`), '');

    return lines.join('\n');
}

const conclusionText = {
    success: '✅ Passed',
    failure: '❌ Failed',
    cancelled: '⚪ Cancelled',
    skipped: '⏭️ Skipped',
    timed_out: '❌ Timed out',
};

// A check's result: state is passed, pending or failed
const result = (check, state, text, link = '') => ({ name: check.name, state, text, link });

// A commit the workflows skip, like the one a preparation pushes
export const skipsCi = message => /\[(skip ci|ci skip)\]/i.test(message || '');

export function runResult(check, run) {
    if (!run) {
        return result(check, 'pending', '⏸️ Not started');
    }
    const link = `[#${run.run_number}](${run.html_url})`;
    if (run.status !== 'completed') {
        return result(check, 'pending', `⏳ ${run.status.replace('_', ' ')}`, link);
    }
    if (run.conclusion === 'success') {
        return result(check, 'passed', conclusionText.success, link);
    }
    return result(check, 'failed', conclusionText[run.conclusion] || `⚠️ ${run.conclusion}`, link);
}

export function statusTable(results) {
    const rows = results.map(item => `| ${item.name} | ${item.text} | ${item.link} |`);
    return ['| Check | Status | Link |', '|---|---|---|', ...rows].join('\n');
}

export const phaseBody = (phase, meta, results) =>
    `${commentMarker(phase.id, meta)}\n### ${phase.title}\n\n${statusTable(results)}\n`;

const errorText = error => `${error.status || ''} ${error.message}`.trim();

// `api` reads and writes issues and reads runs, releases and packages. `refs` creates and deletes
// branches: it has to be a token whose pushes start workflows, unlike GITHUB_TOKEN.
export function createTracker({ api, refs = api, repo, config, core, log = () => {} }) {
    const phase = id => config.phases.find(candidate => candidate.id === id);

    async function trackedIssues(state = 'open') {
        const issues = await api.paginate(api.rest.issues.listForRepo, {
            ...repo,
            labels: LABEL,
            state,
            per_page: 100,
        });
        return issues
            .filter(issue => !issue.pull_request)
            .map(issue => ({ issue, meta: parseIssueMeta(issue.body) }))
            .filter(({ meta }) => meta !== null);
    }

    async function phaseComments(issueNumber) {
        const comments = await api.paginate(api.rest.issues.listComments, {
            ...repo,
            issue_number: issueNumber,
            per_page: 100,
        });
        const byPhase = {};
        for (const comment of comments) {
            const parsed = parseCommentMeta(comment.body);
            if (parsed && !byPhase[parsed.phaseId]) {
                byPhase[parsed.phaseId] = { comment, meta: parsed.meta };
            }
        }
        return byPhase;
    }

    const comment = (issueNumber, body) => api.rest.issues.createComment({ ...repo, issue_number: issueNumber, body });

    // The commits a check on the branch has to have run on: its head and, while the head is a commit
    // the workflows skip, the one under it. Null once the branch is gone.
    async function checkedCommits(branch) {
        let sha;
        try {
            ({ data: { commit: { sha } } } = await api.rest.repos.getBranch({ ...repo, branch }));
        } catch (error) {
            if (error.status === 404) {
                return null;
            }
            throw error;
        }
        const commits = new Set([sha]);
        for (let depth = 0; depth < 10; depth++) {
            const { data } = await api.rest.git.getCommit({ ...repo, commit_sha: sha });
            if (!skipsCi(data.message) || data.parents.length !== 1) {
                break;
            }
            sha = data.parents[0].sha;
            commits.add(sha);
        }
        return commits;
    }

    // `commits`, when given, are the only commits a run on the branch counts for
    async function workflowCheck(check, vars, commits = null) {
        const [owner, name] = (check.repo || `${repo.owner}/${repo.repo}`).split('/');
        const onBranch = commits !== null && check.branch && !check.repo;
        const query = { owner, repo: name, workflow_id: check.workflow, per_page: check.title || onBranch ? 100 : 1 };
        if (check.branch) {
            query.branch = fill(check.branch, vars);
        }
        if (check.sha) {
            query.head_sha = fill(check.sha, vars);
            if (query.head_sha.startsWith('{')) {
                return runResult(check, null);
            }
        }
        try {
            const { data } = await api.rest.actions.listWorkflowRuns(query);
            const runs = check.title
                ? data.workflow_runs.filter(run => run.display_title === fill(check.title, vars))
                : data.workflow_runs;
            if (onBranch) {
                const current = runs.find(run => commits.has(run.head_sha));
                if (!current && runs[0]) {
                    const link = `[#${runs[0].run_number}](${runs[0].html_url})`;
                    return result(check, 'pending', '⏸️ Not run on the latest commit', link);
                }
                return runResult(check, current);
            }
            return runResult(check, runs[0]);
        } catch (error) {
            return result(check, 'failed', `⚠️ Cannot read the runs (${errorText(error)})`);
        }
    }

    async function githubReleaseCheck(check, vars) {
        try {
            const { data } = await api.rest.repos.getReleaseByTag({ ...repo, tag: vars.version });
            const link = `[${vars.version}](${data.html_url})`;
            return data.draft ? result(check, 'pending', '📝 Draft', link) : result(check, 'passed', '✅ Published', link);
        } catch (error) {
            if (error.status === 404) {
                return result(check, 'pending', '⏸️ Not published');
            }
            return result(check, 'failed', `⚠️ Cannot read the release (${errorText(error)})`);
        }
    }

    // `npmPackage` is `@scope/name`, published to GitHub Packages under the organisation `scope`
    async function npmPackageCheck(check, vars) {
        const [scope, packageName] = check.npmPackage.replace(/^@/, '').split('/');
        try {
            const versions = await api.paginate(api.rest.packages.getAllPackageVersionsForPackageOwnedByOrg, {
                org: scope,
                package_type: 'npm',
                package_name: packageName,
                per_page: 100,
            });
            const published = versions.find(candidate => candidate.name === vars.version);
            return published
                ? result(check, 'passed', '✅ Published', `[${vars.version}](${published.html_url})`)
                : result(check, 'pending', '⏸️ Not published');
        } catch (error) {
            return result(check, 'failed', `⚠️ Cannot read the package (${errorText(error)})`);
        }
    }

    // The release checks count only for the commit the branch is at, until it is released
    async function phaseStatus(target, vars, released = false, commits = undefined) {
        if (commits === undefined) {
            commits = target.id === 'release' && !released ? await checkedCommits(vars.branch) : null;
        }
        const results = [];
        for (const check of target.checks) {
            if (check.workflow) {
                results.push(await workflowCheck(check, vars, commits));
            } else if (check.githubRelease) {
                results.push(await githubReleaseCheck(check, vars));
            } else {
                results.push(await npmPackageCheck(check, vars));
            }
        }
        return {
            results,
            passed: results.every(item => item.state === 'passed'),
            started: results.some(item => item.state !== 'pending' || item.link !== ''),
        };
    }

    async function openIssue(branch) {
        const meta = branchInfo(branch);
        const existing = await trackedIssues('all');
        const found = existing.find(tracked => tracked.meta.branch === branch && !isAbandoned(tracked.issue));
        if (found) {
            return found.issue.number;
        }

        const { data: issue } = await api.rest.issues.create({
            ...repo,
            title: titleFor(meta),
            body: issueBody(meta, config),
            labels: [LABEL],
        });
        const release = phase('release');
        const status = await phaseStatus(release, meta);
        await comment(issue.number, phaseBody(release, {}, status.results));
        log(`Opened #${issue.number} for ${branch}`);
        return issue.number;
    }

    async function refreshIssue(issue, meta) {
        const comments = await phaseComments(issue.number);
        const released = Boolean(comments['post-release']);
        const vars = { ...meta, ...(comments['post-release']?.meta || {}) };
        let allPassed = true;

        for (const target of config.phases) {
            if (target.id !== 'release' && !released) {
                continue;
            }
            const existing = comments[target.id];
            const status = await phaseStatus(target, vars, released);
            allPassed = allPassed && status.passed;
            if (!existing && !status.started) {
                continue;
            }
            const body = phaseBody(target, existing?.meta || {}, status.results);
            if (!existing) {
                await comment(issue.number, body);
            } else if (existing.comment.body !== body) {
                await api.rest.issues.updateComment({ ...repo, comment_id: existing.comment.id, body });
            }
        }

        if (released && allPassed) {
            await comment(issue.number, `Every check of ${titleFor(meta)} has passed. Closing.`);
            await api.rest.issues.update({ ...repo, issue_number: issue.number, state: 'closed' });
        }
    }

    // A release branch made by hand gets its issue when its first workflow completes
    async function refresh(branch = '') {
        if (isReleaseBranch(branch)) {
            await openIssue(branch);
        }
        for (const { issue, meta } of await trackedIssues()) {
            await refreshIssue(issue, meta);
        }
    }

    async function refreshOne(issueNumber) {
        const { data: issue } = await api.rest.issues.get({ ...repo, issue_number: issueNumber });
        const meta = parseIssueMeta(issue.body);
        if (meta !== null) {
            await refreshIssue(issue, meta);
        }
    }

    async function canRelease(login) {
        const { data } = await api.rest.repos.getCollaboratorPermissionLevel({ ...repo, username: login });
        // `role_name`, not `permission`: the latter reports a maintainer as "write"
        return ['admin', 'maintain'].includes(data.role_name);
    }

    async function refExists(ref) {
        try {
            await api.rest.git.getRef({ ...repo, ref });
            return true;
        } catch (error) {
            if (error.status === 404) {
                return false;
            }
            throw error;
        }
    }

    async function deleteBranch(branch) {
        try {
            await refs.rest.git.deleteRef({ ...repo, ref: `heads/${branch}` });
        } catch (error) {
            // Already gone is what was wanted
            if (error.status !== 422 && error.status !== 404) {
                throw error;
            }
        }
    }

    async function latestTag() {
        const tags = await api.paginate(api.rest.repos.listTags, { ...repo, per_page: 100 });
        return tags.map(tag => tag.name).filter(isVersion).sort(compareVersions).pop() || null;
    }

    // Problems that stop `version` from being used for a new or renamed branch
    async function versionProblems(version, ownIssue = null) {
        if (!isVersion(version)) {
            return [`The version must look like 1.2.3, got \`${version || 'nothing'}\`.`];
        }
        const problems = [];
        if (await refExists(`tags/${version}`)) {
            problems.push(`Tag \`${version}\` already exists.`);
        }
        for (const branch of [`release/${version}`, `hotfix/${version}`]) {
            if (await refExists(`heads/${branch}`)) {
                problems.push(`Branch \`${branch}\` already exists.`);
            }
        }
        const latest = await latestTag();
        if (latest && compareVersions(version, latest) <= 0) {
            problems.push(`${version} is not above the latest release, ${latest}.`);
        }
        const taken = (await trackedIssues('all')).find(
            tracked => tracked.meta.version === version && !isAbandoned(tracked.issue) && tracked.issue.number !== ownIssue
        );
        if (taken) {
            problems.push(`#${taken.issue.number} already tracks version ${version}.`);
        }
        return problems;
    }

    // Starts a release or hotfix branch and opens its issue. Returns the branch, or null after
    // failing the step with the reason.
    async function start({ type, version, actor }) {
        const problems = [];
        if (!['release', 'hotfix'].includes(type)) {
            problems.push(`The type must be release or hotfix, got '${type}'.`);
        }
        if (!(await canRelease(actor))) {
            problems.push(`Only repository maintainers and admins can start a release, and ${actor} is not one.`);
        }
        problems.push(...(await versionProblems(version)));
        if (problems.length > 0) {
            core.setFailed(problems.join(' '));
            return null;
        }

        const base = type === 'hotfix' ? config.mainBranch : 'develop';
        const branch = `${type}/${version}`;
        const { data } = await api.rest.git.getRef({ ...repo, ref: `heads/${base}` });
        await refs.rest.git.createRef({ ...repo, ref: `refs/heads/${branch}`, sha: data.object.sha });
        log(`Created \`${branch}\` from \`${base}\` at \`${data.object.sha.slice(0, 7)}\``);
        const issueNumber = await openIssue(branch);
        core.setOutput('branch', branch);
        core.setOutput('issue', String(issueNumber));
        return branch;
    }

    async function refuse(issueNumber, command, problems) {
        await comment(issueNumber, `Cannot run \`/${command}\`:\n\n${problems.map(problem => `- ${problem}`).join('\n')}`);
        core.setOutput('refused', 'true');
        core.setFailed(problems.join(' '));
    }

    async function abandon(issueNumber, meta, login) {
        await deleteBranch(meta.branch);
        await comment(issueNumber, `@${login} abandoned ${titleFor(meta)}. \`${meta.branch}\` is deleted and nothing was released.`);
        await api.rest.issues.update({ ...repo, issue_number: issueNumber, state: 'closed', state_reason: 'not_planned' });
    }

    async function changeVersion(issue, meta, version) {
        const problems = version === meta.version
            ? [`${titleFor(meta)} already has that version.`]
            : await versionProblems(version, issue.number);
        if (problems.length > 0) {
            return problems;
        }

        const { data } = await api.rest.repos.getBranch({ ...repo, branch: meta.branch });
        const branch = `${meta.type}/${version}`;
        const renamed = { ...meta, version, branch };

        // The issue moves first: a workflow that completes on the new branch must find it, or the
        // tracker would open a second issue for that branch
        await api.rest.issues.update({
            ...repo,
            issue_number: issue.number,
            title: titleFor(renamed),
            body: issue.body
                .replace(issueMarker(meta), issueMarker(renamed))
                .replace(`Branch: \`${meta.branch}\``, `Branch: \`${branch}\``),
        });
        try {
            await refs.rest.git.createRef({ ...repo, ref: `refs/heads/${branch}`, sha: data.commit.sha });
        } catch (error) {
            await api.rest.issues.update({ ...repo, issue_number: issue.number, title: titleFor(meta), body: issue.body });
            throw error;
        }
        await deleteBranch(meta.branch);

        await comment(issue.number, `Version changed from ${meta.version} to ${version}: \`${meta.branch}\` is now \`${branch}\`, at the same commit. The release checks run again.`);
        await refreshOne(issue.number);
        return [];
    }

    // Runs a command posted on a release issue. `/release` and `/sync` only get checked here; the
    // workflow merges and pushes. Sets the `command`, `branch`, `version` and `type` outputs, and
    // `refused` when it said in the issue why the command cannot run.
    async function command({ issue, commentBody, login }) {
        const parsed = parseCommand(commentBody);
        const meta = parseIssueMeta(issue.body);
        if (parsed === null || meta === null) {
            return;
        }
        core.setOutput('command', parsed.name);
        if (parsed.name === 'status') {
            await refreshOne(issue.number);
            return;
        }
        if (parsed.name === 'version' && !config.versionCommand) {
            await refuse(issue.number, parsed.name, ['This repository does not use `/version`.']);
            return;
        }

        const problems = [];
        if (!(await canRelease(login))) {
            problems.push(`@${login} is not a maintainer or an admin of this repository.`);
        }
        if ((await phaseComments(issue.number))['post-release']) {
            problems.push(`${titleFor(meta)} has already been released.`);
        }

        if (problems.length === 0 && parsed.name === 'release') {
            if (config.checklist) {
                const unchecked = uncheckedItems(issue.body);
                if (unchecked === null) {
                    problems.push('The checklist is missing from the issue.');
                }
                for (const item of unchecked || []) {
                    problems.push(`Checklist item not ticked: ${item}`);
                }
            }
            // Each check has to have passed on the commit /release merges, or on the one under a
            // [skip ci] commit a preparation pushed: a push that has not started its runs yet must
            // not ride on the runs of the commit before it
            const commits = await checkedCommits(meta.branch);
            if (commits === null) {
                problems.push(`Branch \`${meta.branch}\` does not exist.`);
            } else {
                // The workflow merges this commit, and stops if the branch has moved on since
                core.setOutput('sha', [...commits][0]);
            }
            const status = await phaseStatus(phase('release'), meta, false, commits);
            for (const item of status.results.filter(entry => entry.state !== 'passed')) {
                problems.push(`${item.name}: ${item.text}`);
            }
        }

        if (problems.length === 0 && parsed.name === 'version') {
            problems.push(...(await changeVersion(issue, meta, parsed.argument)));
            if (problems.length === 0) {
                return;
            }
        }

        if (problems.length > 0) {
            await refuse(issue.number, parsed.name, problems);
            return;
        }

        if (parsed.name === 'abandon') {
            await abandon(issue.number, meta, login);
            return;
        }

        core.setOutput('branch', meta.branch);
        core.setOutput('version', meta.version);
        core.setOutput('type', meta.type);
    }

    async function reportSync({ issueNumber, branch, result: outcome, detail }) {
        const files = detail.split(' ').filter(Boolean).map(file => `- \`${file}\``).join('\n');
        const body = {
            merged: `Merged \`develop\` into \`${branch}\` as \`${detail.slice(0, 7)}\`. The release checks run again.`,
            'up-to-date': `\`${branch}\` already has everything in \`develop\`. Nothing to merge.`,
            conflict: `Merging \`develop\` into \`${branch}\` conflicts, so nothing was pushed. Merge it by hand and push the branch. Conflicting files:\n\n${files}`,
        }[outcome];
        await comment(issueNumber, body);
    }

    // `shas` are the commits the release was merged as, `{ main_sha, develop_sha }`, for the
    // post-release checks that run on them
    async function postReleased({ issueNumber, shas }) {
        const { data: issue } = await api.rest.issues.get({ ...repo, issue_number: issueNumber });
        const meta = parseIssueMeta(issue.body);
        const target = phase('post-release');
        const status = await phaseStatus(target, { ...meta, ...shas });
        await comment(issueNumber, phaseBody(target, shas, status.results));
    }

    // Puts release notes into the issue body, between the notes markers, leaving the rest of the
    // body as it is. `notes` has `previousTag`, `head`, `commits`, `changelog` and `overview`.
    async function postNotes({ branch, notes }) {
        const find = async () => (await trackedIssues()).find(tracked => tracked.meta.branch === branch);
        // The notes can be ready before the issue is, for a branch made by hand
        let tracked = await find();
        if (!tracked) {
            await openIssue(branch);
            tracked = await find();
        }

        const section = (summary, content) => `<details>\n<summary>${summary}</summary>\n\n${content}\n\n</details>`;
        const intro = `### Release notes\n\n${notes.commits} commit(s) since \`${notes.previousTag}\`, up to ${notes.head.slice(0, 7)}.`;
        const overview = notes.overview ? section('Release overview (written by AI)', notes.overview) : '';

        // Read just before writing, so that a checklist item ticked meanwhile is kept
        const { data: issue } = await api.rest.issues.get({ ...repo, issue_number: tracked.issue.number });
        const start = issue.body.indexOf(NOTES_START);
        const end = issue.body.indexOf(NOTES_END);
        const found = start >= 0 && end > start;
        const before = found ? issue.body.slice(0, start) : issue.body;
        const after = found ? issue.body.slice(end + NOTES_END.length) : '';

        // An issue body holds at most 65536 characters, and the changelog is what gives way
        let changelog = notes.changelog;
        const room = 65000 - before.length - after.length - intro.length - overview.length - 300;
        if (changelog.length > room) {
            const lastWholeCommit = changelog.lastIndexOf('\n- ', room);
            changelog = `${changelog.slice(0, lastWholeCommit > 0 ? lastWholeCommit : room)}\n\n_Cut short: see \`git log --no-merges ${notes.previousTag}..${notes.head.slice(0, 7)}\` for the rest._`;
        }
        const block = [NOTES_START, intro, section('Changelog', changelog), overview, NOTES_END].filter(Boolean).join('\n\n');

        await api.rest.issues.update({
            ...repo,
            issue_number: tracked.issue.number,
            body: found ? `${before}${block}${after}` : `${issue.body.trimEnd()}\n\n${block}\n`,
        });
    }

    return { openIssue, refresh, refreshOne, start, command, reportSync, postReleased, postNotes };
}

const isAbandoned = issue => issue.state === 'closed' && issue.state_reason === 'not_planned';
