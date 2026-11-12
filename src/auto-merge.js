// Auto-merge: merges a pull request without a review when one of the repository's merge policy
// rules allows it and the required checks have passed on its head commit. The policy is
// `.github/merge-policy.json`, read from the base branch; see docs/workflows/auto-merge.md.

const MANIFESTS = /(^|\/)(composer\.json|package\.json)$/;
const LOCK_FILES = /(^|\/)(composer\.lock|yarn\.lock|package-lock\.json)$/;

// Marks the one comment auto-merge keeps on a pull request, so it is edited rather than repeated
const MARKER = '<!-- auto-merge -->';

// Check-run conclusions a ruleset counts as passed
const PASSED = ['success', 'skipped', 'neutral'];

const words = value => (Array.isArray(value) ? value : String(value || '').split(/\s+/)).filter(Boolean);

// Each rule type has defaults, `applies` (whether the pull request is the kind the rule is about,
// which decides whether auto-merge explains itself on it) and `reasons` (why it still needs a
// review; none means the rule allows it).
export const RULES = {
    'dependency-bump': {
        defaults: {
            branchPrefix: 'deps/',
            author: 'uniques-service',
            packagePrefixes: ['uniquesca/', '@uniquesca/'],
            installedPaths: [],
        },
        applies: ({ pull }, rule) => pull.head.ref.startsWith(rule.branchPrefix),
        reasons: ({ pull, files, commits }, rule) => {
            const reasons = [];
            if (!pull.head.ref.startsWith(rule.branchPrefix)) {
                reasons.push(`its branch does not start with \`${rule.branchPrefix}\``);
            }
            if (pull.user.login !== rule.author) {
                reasons.push(`it was opened by @${pull.user.login}, not by the bump workflow`);
            }
            const others = [...new Set(commits
                .filter(commit => commit.author?.login !== rule.author || commit.committer?.login !== rule.author)
                .map(commit => commit.author?.login || commit.commit.author.name))];
            if (others.length > 0) {
                reasons.push(`it has commits by ${others.map(name => `\`${name}\``).join(', ')}`);
            }
            for (const file of files) {
                if (rule.installedPaths.some(path => file.filename.startsWith(path)) || LOCK_FILES.test(file.filename)) {
                    continue;
                }
                if (!MANIFESTS.test(file.filename)) {
                    reasons.push(`it changes \`${file.filename}\`, which is not a manifest or a lock file`);
                } else if (!onlyAllowedDependencyLines(file.patch, rule.packagePrefixes)) {
                    reasons.push(`\`${file.filename}\` changes more than the versions of ${rule.packagePrefixes.map(prefix => `\`${prefix}\``).join(' / ')} packages`);
                }
            }
            if (files.length === 0) {
                reasons.push('it changes no files');
            }
            return reasons;
        },
    },
};

export function normalisePolicy(raw) {
    const policy = {
        baseBranch: raw.baseBranch || 'develop',
        mergeMethod: raw.mergeMethod || 'squash',
        checks: words(raw.checks),
        allow: [],
    };
    if (!Array.isArray(raw.allow) || raw.allow.length === 0) {
        throw new Error('merge-policy.json needs at least one rule in `allow`');
    }
    for (const entry of raw.allow) {
        const type = RULES[entry.rule];
        if (!type) {
            throw new Error(`Unknown merge policy rule '${entry.rule}'. Known: ${Object.keys(RULES).join(', ')}`);
        }
        const rule = { ...type.defaults, ...entry };
        if ('packagePrefixes' in type.defaults) {
            rule.packagePrefixes = words(rule.packagePrefixes);
        }
        if ('installedPaths' in type.defaults) {
            rule.installedPaths = words(rule.installedPaths).map(path => path.replace(/\/*$/, '/'));
        }
        policy.allow.push(rule);
    }
    return policy;
}

// Whether a manifest's diff only touches dependency lines of allowed packages
export function onlyAllowedDependencyLines(patch, packagePrefixes) {
    const changed = (patch || '')
        .split('\n')
        .filter(line => /^[+-]/.test(line) && !/^(\+\+\+|---)/.test(line))
        .map(line => line.slice(1).trim())
        .filter(Boolean);
    return changed.length > 0
        && changed.every(line => packagePrefixes.some(prefix => line.startsWith(`"${prefix}`)));
}

// Decides whether the policy lets a pull request merge without a review. `facts` are `pull`,
// `files` and `commits` from the pull request API.
export function decide(facts, policy, policyFile) {
    const { pull, files } = facts;
    const applies = policy.allow.some(rule => RULES[rule.rule].applies(facts, rule));
    const blockers = [];
    if (pull.base.ref !== policy.baseBranch) {
        blockers.push(`it goes into \`${pull.base.ref}\`, not \`${policy.baseBranch}\``);
    }
    if (pull.head.repo?.full_name !== pull.base.repo.full_name) {
        blockers.push('it comes from a fork');
    }
    // Whatever the rules say: a change to the rules is never approved by the rules
    if (files.some(file => file.filename === policyFile || file.previous_filename === policyFile)) {
        blockers.push(`it changes the merge policy, \`${policyFile}\``);
    }
    if (blockers.length > 0) {
        return { allowed: false, applies, reasons: blockers };
    }

    const reasons = [];
    for (const rule of policy.allow) {
        const ruleReasons = RULES[rule.rule].reasons(facts, rule);
        if (ruleReasons.length === 0) {
            return { allowed: true, applies: true, rule: rule.rule, reasons: [] };
        }
        if (RULES[rule.rule].applies(facts, rule)) {
            reasons.push(...ruleReasons);
        }
    }
    return { allowed: false, applies, reasons };
}

// Where the required checks stand on a commit: `passed`, `pending` or `failed`, with the names
// behind it. Only the latest run of each check counts.
export function checkState(required, checkRuns) {
    if (required.length === 0) {
        return { state: 'failed', names: [], why: 'no checks are required' };
    }
    const latest = new Map();
    for (const run of checkRuns) {
        const seen = latest.get(run.name);
        if (!seen || new Date(run.started_at) > new Date(seen.started_at)) {
            latest.set(run.name, run);
        }
    }
    const failed = required.filter(name => latest.get(name)?.status === 'completed' && !PASSED.includes(latest.get(name).conclusion));
    if (failed.length > 0) {
        return { state: 'failed', names: failed, why: 'a required check failed' };
    }
    const pending = required.filter(name => latest.get(name)?.status !== 'completed');
    if (pending.length > 0) {
        return { state: 'pending', names: pending, why: 'required checks have not finished' };
    }
    return { state: 'passed', names: required, why: '' };
}

// `api` reads the pull request, its checks and the policy, and writes the comment. `merger`
// merges: the token of an app that may skip the review rule but not the checks rule.
export function createAutoMerge({ api, merger, repo, policyFile = '.github/merge-policy.json', log = () => {} }) {
    // The policy as the base branch has it, so a pull request cannot bring its own. Null when the
    // repository has none: then nothing merges automatically.
    async function readPolicy(branch) {
        try {
            const { data } = await api.rest.repos.getContent({ ...repo, path: policyFile, ref: branch });
            return normalisePolicy(JSON.parse(Buffer.from(data.content, 'base64').toString('utf8')));
        } catch (error) {
            if (error.status === 404) {
                return null;
            }
            throw error;
        }
    }

    async function requiredChecks(branch, policy) {
        // A route, not `rest.repos.getBranchRules`: the bundled Octokit predates it
        const rules = await api.paginate('GET /repos/{owner}/{repo}/rules/branches/{branch}', {
            ...repo,
            branch,
            per_page: 100,
        });
        const fromRulesets = rules
            .filter(rule => rule.type === 'required_status_checks')
            .flatMap(rule => rule.parameters.required_status_checks.map(check => check.context));
        return [...new Set([...fromRulesets, ...policy.checks])];
    }

    async function note(number, body) {
        const comments = await api.paginate(api.rest.issues.listComments, { ...repo, issue_number: number, per_page: 100 });
        const mine = comments.find(comment => comment.body?.startsWith(MARKER));
        const text = `${MARKER}\n${body}`;
        if (!mine) {
            await api.rest.issues.createComment({ ...repo, issue_number: number, body: text });
        } else if (mine.body !== text) {
            await api.rest.issues.updateComment({ ...repo, comment_id: mine.id, body: text });
        }
    }

    // Decides on one open pull request and merges it if it may. Returns what was decided.
    async function consider(number) {
        const { data: pull } = await api.rest.pulls.get({ ...repo, pull_number: number });
        if (pull.state !== 'open' || pull.draft) {
            return 'skipped';
        }
        const policy = await readPolicy(pull.base.ref);
        if (policy === null) {
            log(`#${number}: no ${policyFile} on ${pull.base.ref}`);
            return 'no-policy';
        }
        const files = await api.paginate(api.rest.pulls.listFiles, { ...repo, pull_number: number, per_page: 100 });
        const commits = await api.paginate(api.rest.pulls.listCommits, { ...repo, pull_number: number, per_page: 100 });

        const decision = decide({ pull, files, commits }, policy, policyFile);
        if (!decision.allowed) {
            // Only a pull request a rule is about hears why; everybody else's stay quiet
            if (decision.applies) {
                await note(number, `This needs a review before it merges, because ${decision.reasons.join('; ')}.`);
            }
            log(`#${number} needs a review: ${decision.reasons.join('; ')}`);
            return 'review';
        }

        const required = await requiredChecks(pull.base.ref, policy);
        const checkRuns = await api.paginate(api.rest.checks.listForRef, {
            ...repo,
            ref: pull.head.sha,
            filter: 'latest',
            per_page: 100,
        });
        const checks = checkState(required, checkRuns);
        if (checks.state !== 'passed') {
            if (checks.state === 'failed') {
                await note(number, `Not merged automatically: ${checks.why}${checks.names.length ? ` (${checks.names.join(', ')})` : ''}.`);
            }
            log(`#${number} waits: ${checks.why} ${checks.names.join(', ')}`);
            return checks.state;
        }

        // `sha` makes GitHub refuse the merge if a commit landed since the checks were read
        await merger.rest.pulls.merge({
            ...repo,
            pull_number: number,
            sha: pull.head.sha,
            merge_method: policy.mergeMethod,
            commit_title: `${pull.title} (#${number})`,
        });
        await note(number, `Merged automatically under the \`${decision.rule}\` rule of \`${policyFile}\`, after ${required.join(', ')} passed.`);
        log(`#${number} merged`);
        return 'merged';
    }

    // The open pull requests a finished run was for: the ones with its head branch
    async function pullsForBranch(branch) {
        const pulls = await api.paginate(api.rest.pulls.list, {
            ...repo,
            state: 'open',
            head: `${repo.owner}:${branch}`,
            per_page: 100,
        });
        return pulls.map(pull => pull.number);
    }

    return { consider, pullsForBranch };
}
