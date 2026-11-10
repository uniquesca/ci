# Release tracker

A release that stays open while it is tested: a maintainer starts the branch, an issue tracks its
checks, and a `/release` comment on the issue merges and tags it once they pass. The issue then
follows the publication and closes itself when everything is out. For a release from one button,
with nothing to wait for, use [`release-flow.yml`](release-flow.md).

Three reusable workflows, all thin wrappers around the [`release-tracker`](../actions/release-tracker.md)
action:

| Workflow | Called on | What it does |
|---|---|---|
| `release-start.yml` | `workflow_dispatch` | Creates `release/<version>` from `develop` or `hotfix/<version>` from the main branch, and opens the issue |
| `release-commands.yml` | `issue_comment` | Runs `/release`, `/sync`, `/abandon`, `/version` and `/status` |
| `release-refresh.yml` | `workflow_run` of every tracked workflow | Updates the status comments, and opens the issue of a release branch made by hand |

## Commands

Comment one on the release issue. All but `/status` are for maintainers and admins only.

- `/release` - merges the branch into the main branch and `develop`, tags the version and deletes the
  branch. Needs the latest run of every check in the `release` phase passed, and the checklist
  ticked if there is one. The tag is pushed with the release token, so it starts the repository's
  publishing workflow.
- `/sync` - merges `develop` into the branch.
- `/abandon` - deletes the branch and closes the issue as not planned.
- `/version 1.2.3` - renames the branch and the issue. Only with `versionCommand`.
- `/status` - refreshes the status comments.

## Settings

`.github/release-tracker.json`, read from the default branch:

```json
{
    "mainBranch": "main",
    "versionCommand": false,
    "releaseNotes": false,
    "checklist": { "title": "Release checklist", "owner": "github-login", "items": ["Tested"] },
    "phases": [
        {
            "id": "release",
            "title": "Release checks",
            "checks": [
                { "name": "QA Checks", "workflow": "qa-checks.yml", "branch": "{branch}" }
            ]
        },
        {
            "id": "post-release",
            "title": "Publication",
            "checks": [
                { "name": "Publish", "workflow": "publish-npm.yml", "branch": "{version}" },
                { "name": "QA Checks on develop", "workflow": "qa-checks.yml", "sha": "{develop_sha}" },
                { "name": "GitHub release", "githubRelease": true },
                { "name": "npm package", "npmPackage": "@uniquesca/some-package" }
            ]
        }
    ]
}
```

All but `phases` are optional; the defaults are shown. `checklist` is left out when there is none.

- **Phases.** `release` is what `/release` waits for. `post-release` appears on `/release`. Any
  other phase appears with it, and the issue closes when every check of every phase has passed.
- **Checks.** Each has a `name` and one of:
  - `workflow` - the latest run of a workflow file, filtered by `branch` or `sha`. `repo` reads
    another repository, and `title` keeps only runs with that display title.
  - `githubRelease: true` - the GitHub release for the version's tag.
  - `npmPackage` - the version in the package on GitHub Packages, `@<organisation>/<name>`.
- **Placeholders** in `branch`, `sha` and `title`: `{branch}`, `{version}`, `{type}`, and after
  `/release`, `{main_sha}` and `{develop_sha}`.
- **`releaseNotes`** leaves room in the issue for notes the repository writes itself, through the
  action's `notes` command.

## Tokens

- **Release token**: the release GitHub App (`release_app_id` and `RELEASE_APP_PRIVATE_KEY`) or a
  `RELEASE_TOKEN`. It creates, deletes and pushes branches and the tag, so it has to be allowed to
  push to the main branch and `develop`. Not GITHUB_TOKEN: what that pushes starts no workflows.
- **`GITHUB_API_TOKEN`** (optional): writes the issue and reads the checks. GITHUB_TOKEN does
  unless a check reads another repository or a package this one cannot see.

## Calling it

```yaml
# .github/workflows/start-release.yml
name: Start a release

on:
  workflow_dispatch:
    inputs:
      type:
        description: 'A release branches from develop, a hotfix from the main branch'
        required: true
        type: choice
        options: [ release, hotfix ]
      version:
        description: 'Version, e.g. 1.2.0'
        required: true
        type: string

jobs:
  start:
    permissions:
      contents: read
      issues: write
      actions: read
      packages: read
    uses: uniquesca/ci/.github/workflows/release-start.yml@v11
    secrets:
      RELEASE_APP_PRIVATE_KEY: ${{ secrets.RELEASE_APP_PRIVATE_KEY }}
    with:
      type: ${{ inputs.type }}
      version: ${{ inputs.version }}
      release_app_id: ${{ vars.RELEASE_APP_ID }}
```

```yaml
# .github/workflows/release-commands.yml
name: Release commands

on:
  issue_comment:
    types: [ created ]

jobs:
  command:
    permissions:
      contents: read
      issues: write
      actions: read
      packages: read
    uses: uniquesca/ci/.github/workflows/release-commands.yml@v11
    secrets:
      RELEASE_APP_PRIVATE_KEY: ${{ secrets.RELEASE_APP_PRIVATE_KEY }}
    with:
      release_app_id: ${{ vars.RELEASE_APP_ID }}
```

```yaml
# .github/workflows/release-tracker.yml
name: Release tracker

on:
  workflow_run:
    # Every workflow a check in release-tracker.json names
    workflows: [ Prepare release, QA Checks, Publish NPM package ]
    types: [ completed ]

jobs:
  refresh:
    permissions:
      contents: read
      issues: write
      actions: read
      packages: read
    uses: uniquesca/ci/.github/workflows/release-refresh.yml@v11
```

A workflow that is not in the `workflow_run` list still shows up, but only at the next refresh.
For runs in other repositories, have them send a `repository_dispatch` and add it to the triggers.
