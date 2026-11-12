# Auto-merge

Merges a pull request without waiting for a review, when a rule of the repository's merge policy
allows it and the required checks have passed. Every other pull request goes through review as
usual. A repository without a policy file never merges anything automatically.

## The merge policy

`.github/merge-policy.json`, always read from the pull request's **base branch**, so a pull request
cannot bring its own rules:

```json
{
    "baseBranch": "develop",
    "mergeMethod": "squash",
    "checks": ["E2E result"],
    "allow": [
        { "rule": "dependency-bump" }
    ]
}
```

- `allow` - the rules; a pull request merges if any one of them allows it. Needs at least one.
- `checks` - checks that must pass before an automatic merge, on top of the ones the base
  branch's rulesets require. Optional.
- `baseBranch` (`develop`) - the only branch it merges into.
- `mergeMethod` (`squash`) - `merge`, `squash` or `rebase`. The commit title is the pull request
  title, so it stays a changelog entry.

A pull request that changes the policy file is never merged automatically, whatever the rules say.
Nothing merges when no checks are required at all.

It merges at the head commit it checked, so a push in between stops it. On a pull request a rule is
about, it keeps one comment saying what it decided and why; on the rest it stays quiet.

## Rules

### `dependency-bump`

A bump opened by [`bump-dependencies.yml`](bump-dependencies.md). All of these have to hold:

- It comes from a branch starting with `branchPrefix` (`deps/`) in the same repository.
- `author` (`uniques-service`, the account behind the bump workflow's `PR_TOKEN`) opened it and made
  every commit on it. A commit by anybody else means a review.
- It changes only `composer.json`, `package.json` and lock files, plus `installedPaths` if set (for
  repositories that commit `vendor/` or `node_modules`). In the manifests, only the lines of packages
  starting with `packagePrefixes` (`uniquesca/`, `@uniquesca/`) change.

```json
{ "rule": "dependency-bump", "installedPaths": ["vendor"] }
```

## What it needs

- **A merge GitHub App** with *Contents* and *Pull requests* write and *Checks* read, installed on
  the repository. Its ID goes in `merge_app_id`, its key in `MERGE_APP_PRIVATE_KEY`.
- **Rulesets on the base branch** where the app bypasses the review rule and nothing else. Keep the
  required checks in a ruleset the app is not on, so GitHub itself refuses a red merge. Do not use
  the release app here: it bypasses the checks.
- **A policy file** on the base branch, and for `dependency-bump`, `bump-dependencies.yml` opening
  the bumps with a token of the rule's `author`, not GITHUB_TOKEN, so the checks run on them.

## Calling it

List every workflow behind a required check, and behind the policy's `checks`, under
`workflow_run`: a decision is made each time one finishes. The `if` is the switch: set the repository variable `AUTO_MERGE` to `off` to stop it.

```yaml
name: Auto-merge

on:
  pull_request:
    types: [ opened, synchronize, reopened, ready_for_review ]
  workflow_run:
    workflows: [ QA Checks, REST API Tests, E2E Tests ]
    types: [ completed ]

jobs:
  auto-merge:
    if: vars.AUTO_MERGE != 'off'
    permissions:
      contents: read
      checks: read
      issues: write
      pull-requests: write
    uses: uniquesca/ci/.github/workflows/auto-merge.yml@v11
    secrets:
      MERGE_APP_PRIVATE_KEY: ${{ secrets.MERGER_APP_PRIVATE_KEY }}
    with:
      merge_app_id: ${{ vars.MERGER_APP_CLIENT_ID }}
```

## Inputs

| Input | Default | Description |
|---|---|---|
| `merge_app_id` | | **Required.** App ID or client ID of the merge app |
| `policy_file` | `.github/merge-policy.json` | Path of the merge policy |
