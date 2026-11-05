# Release flow

Releases a version from one button: starts `release/<version>` from `develop`, prepares it with
[`prepare-release.yml`](prepare-release.md), merges it into the main branch and `develop`, and tags
it. Publishing stays in the calling repository, as a job that runs after this one.

```yaml
name: Release

on:
  workflow_dispatch:
    inputs:
      version:
        description: 'Version, e.g. 1.2.0'
        required: true
        type: string

run-name: 'Release ${{ inputs.version }}'

concurrency:
  group: release
  cancel-in-progress: false

jobs:
  release:
    permissions:
      contents: write
      actions: read
    uses: uniquesca/ci/.github/workflows/release-flow.yml@v11
    secrets:
      RELEASE_APP_PRIVATE_KEY: ${{ secrets.RELEASE_APP_PRIVATE_KEY }}
      COMPOSER_ACCESS_TOKEN: ${{ secrets.SATIS_COMPOSER_ACCESS_TOKEN }}
    with:
      version: ${{ inputs.version }}
      release_app_id: ${{ vars.RELEASE_APP_ID }}
      generate_coverage_badge: true

  # The repository's own publish workflow, made callable with a `version` input
  publish:
    needs: [ release ]
    permissions:
      contents: write
    uses: ./.github/workflows/release.yml
    secrets: inherit
    with:
      version: ${{ inputs.version }}
```

## Secrets

| Secret | Required | Description |
|---|---|---|
| `RELEASE_APP_PRIVATE_KEY` | yes | Private key of the release GitHub App |
| `COMPOSER_ACCESS_TOKEN` | no | Access token for cloning Uniques private repositories, for the preparation |
| `NPM_ACCESS_TOKEN` | no | Access token for authentication with the NPM registry, for the preparation |

## Inputs

| Input | Type | Default | Description |
|---|---|---|---|
| `version` | string | | **Required.** Version to release, `x.y.z` |
| `release_app_id` | string | | **Required.** App ID or client ID of the release GitHub App |
| `main_branch` | string | `main` | Branch the release is merged into besides `develop` |
| `qa_workflow` | string | `qa-checks.yml` | QA workflow that has to have passed on the `develop` commit being released |
| `generate_changelog` | boolean | `true` | Passed to `prepare-release.yml` |
| `generate_coverage_badge` | boolean | `false` | Passed to `prepare-release.yml` |
| `generate_coverage_report` | boolean | `false` | Passed to `prepare-release.yml` |

## Outputs

None. The result is the release merged into the main branch and `develop`, and tagged.

## Dig deeper

### What happens on each run

1. **Checks, before anything is created.** The user is a maintainer or an admin, the release app can
   get a token, the version is `x.y.z` and above the latest tag, neither the tag nor the branch exists,
   and `qa_workflow` passed on the push of the current `develop` commit.
2. `release/<version>` is created from that commit, and `prepare-release.yml` commits the version,
   changelog and coverage files to it.
3. The branch is merged into `main_branch` as `Merge branch 'release/<version>'`, and that into
   `develop` as `Merge tag '<version>' into develop`. Both are pushed atomically.
4. An annotated tag is created on the main branch, and the release branch is deleted.

If any job fails or the run is cancelled after the branch was created, the branch is deleted, so a
new run starts clean from `develop`. When the merge pushed but tagging failed, the job summary says
how to finish by hand.

### What it needs from the caller

* **A GitHub App** installed on the repository with *Contents* and *Workflows* write access. *Workflows*
  is needed because a release that changes `.github/workflows` is otherwise rejected. Its ID goes in
  `release_app_id`, and the app must be allowed to bypass any ruleset on the main branch and `develop`.
* **`permissions: contents: write, actions: read`** on the calling job, and a `concurrency` group so
  two releases do not run at once.
* **QA on pushes to `develop`.** A repository whose `qa_workflow` runs only on pull requests never
  passes the first check.

### Why the caller's own release workflows do not run twice

The release branch and the tag are created with `GITHUB_TOKEN`, which starts no workflows. A
repository can keep its `prepare-release.yml` on `create` and its publish workflow on tags for
releases done by hand, and this workflow does not set them off. That is also why publishing has to
be called explicitly after it, and why a publish workflow that builds something should pass the tag
as `ref` to [`publish-npm.yml`](publish-npm.md): a call runs on `develop`, not on the tag.
