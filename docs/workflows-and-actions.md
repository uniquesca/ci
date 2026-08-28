# Reusable workflows and actions

Everything this repository offers comes in one of two shapes, and the shape decides how you call it.

A **reusable workflow** is a whole pipeline stage - run the QA checks, cut the release, deploy. You
call it at *job* level with `uses:`, it brings its own runners, jobs and matrix, and it takes
`secrets:` from you:

```yaml
jobs:
  php-qa:
    uses: uniquesca/ci/.github/workflows/php-qa-checks.yml@main
    secrets:
      COMPOSER_ACCESS_TOKEN: ${{ secrets.COMPOSER_ACCESS_TOKEN }}
```

An **action** is one step. You call it at *step* level inside a job you already own, it runs on your
runner alongside your other steps, and it takes tokens as ordinary inputs:

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: uniquesca/ci/install-packages@main
        with:
          composer_access_token: ${{ secrets.COMPOSER_ACCESS_TOKEN }}
```

Two consequences worth knowing before you pick:

* **A `permissions:` block belongs on the calling job either way**, and a reusable workflow can only
  narrow the token it is given, never widen it.
* **A workflow cannot be dropped into a job you already have.** If your job needs one more step, you
  want an action; if you want the whole stage to be somebody else's problem, you want a workflow.

Reach for the workflows first - they are the supported path, and each one is built out of the actions
below. Reach for an action when your pipeline does something the workflows do not cover.

## Reusable workflows

### AI assisted development

How the three fit together, and the setup they share: [AI assisted development](ai.md).

| Workflow | What it does |
|---|---|
| [`ai-plan.yml`](ai/ai-plan.md) | Turns an issue into an implementation plan, on `/ai-plan` |
| [`ai-implement.yml`](ai/ai-implement.md) | Implements the plan on a branch, opens a pull request, and runs another round for every review or red check |
| [`ai-review.yml`](ai/ai-review.md) | Reviews a pull request as a real Github review, on `/ai-review` or on what an implementing round pushed |

### QA

| Workflow | What it does |
|---|---|
| [`php-qa-checks.yml`](qa-checks.md#php-qa-checks-workflow) | PHPUnit, PHP_CodeSniffer and Psalm across the repository's PHP version matrix, with an optional MySQL. Fixes the code style and commits it |
| [`npm-qa-checks.yml`](qa-checks.md#npm-qa-checks-workflow) | The `lint` and `test` scripts from `package.json`, run by NPM or Yarn |

### Release

| Workflow | What it does |
|---|---|
| [`get-version.yml`](workflows/get-version.md) | Works out the version from a `release/**` or `hotfix/**` branch, or a tag |
| [`prepare-release.yml`](workflows/prepare-release.md) | Writes the version and changelog, optionally migrates the DB dump and builds a coverage badge, and commits it all |
| [`publish-npm.yml`](workflows/publish-npm.md) | Builds and publishes the package to the Github registry, and publishes a Github release |

### Deployment

| Workflow | What it does |
|---|---|
| [`deploy.yml`](workflows/deploy.md) | Deploys over SSH to a server that runs the application directly |
| [`docker-deploy.yml`](workflows/docker-deploy.md) | Deploys over SSH to a Docker host, through `task.sh` |

## Actions

### Environment and config

| Action | What it does |
|---|---|
| [`prepare-environment`](actions/prepare-environment.md) | Renders every config template `_ci_environment.json` declares, with token fallbacks and references |
| [`prepare-config`](actions/prepare-config.md) | Renders one template with the variables you pass it |
| [`merge-environment-variables`](actions/merge-environment-variables.md) | Merges two variable objects, so a workflow can lay defaults under a caller's values |

### CI matrix

| Action | What it does |
|---|---|
| [`qa-ci-matrix`](actions/qa-ci-matrix.md) | The whole job matrix from `_ci_environment.json`, for a `strategy.matrix` |
| [`get-default-ci-environment`](actions/get-default-ci-environment.md) | The one matrix entry a job that should run once ought to run on |
| [`ci-matrix-from-file`](actions/ci-matrix-from-file.md) | The contents of any JSON file, as a matrix |

### Dependencies

| Action | What it does |
|---|---|
| [`install-packages`](actions/install-packages.md) | Installs Composer, NPM and Yarn dependencies with caching, against the Uniques private registries |

### Database

| Action | What it does |
|---|---|
| [`mysql-import`](actions/mysql-import.md) | Imports a dump into an existing database |
| [`mysql-export`](actions/mysql-export.md) | Dumps a database in a form stable enough to commit |
| [`migrate-db-dump`](actions/migrate-db-dump.md) | Runs the migrations against a committed dump and writes it back |

### Release

| Action | What it does |
|---|---|
| [`update-changelog`](actions/update-changelog.md) | Generates a changelog section for a version out of the git log |
| [`github-release`](actions/github-release.md) | Publishes a Github release with the changelog as its body |
| [`docker-prepare-release`](actions/docker-prepare-release.md) | The release bookkeeping for a Docker-based repository, committed |

### QA

| Action | What it does |
|---|---|
| [`cs-fix`](actions/cs-fix.md) | Runs a code style fixer and commits what it fixed to the pull request branch |
| [`docker-qa-checks`](actions/docker-qa-checks.md) | Tests, code style and Psalm through `task.sh`, with the output uploaded as an artifact |

### Docker

| Action | What it does |
|---|---|
| [`docker-spin-up`](actions/docker-spin-up.md) | Brings the application up in Docker on the runner and waits for MySQL |

### AI

These are the pieces the AI workflows are built from. A workflow talks to an agent through files in
the checkout, so most of them either write something in for it to read or post what it wrote back
out.

| Action | What it does |
|---|---|
| [`ai-stage-issue`](actions/ai-stage-issue.md) | Writes an issue, its comments and its latest plan into the checkout |
| [`ai-stage-pull-request`](actions/ai-stage-pull-request.md) | Writes a pull request into the checkout: what is asking for changes on it, and what is already settled |
| [`ai-post-review`](actions/ai-post-review.md) | Submits the review an agent wrote, with its inline comments validated against the diff |
| [`ai-post-review-replies`](actions/ai-post-review-replies.md) | Posts an agent's answer to each review thread it was given |
| [`ai-qa-criteria`](actions/ai-qa-criteria.md) | Copies the plan's QA acceptance criteria into the pull request body, and keeps them in step with the plan |
| [`ai-run-report`](actions/ai-run-report.md) | Reads an agent execution log - the final message, the cost, and why the run stopped |

## Pinning a version

Every example here uses `@main`. Tags exist for each release, and pinning to one -
`uniquesca/ci/install-packages@10.3.1` - is what keeps a change here from reaching your pipeline
before you are ready for it. `@main` is fine for a repository whose CI you are actively working on.

## Not on this page

`.github/workflows` also holds this repository's own CI - `self-tests.yml`,
`self-prepare-release.yml`, `self-github-release.yml`, `build-docker-images.yml` and
`update-current-version.yml`. None of them declares `on: workflow_call`, so **none of them can be
called from another repository.** They are here to test and release the framework itself.

The base Docker images are documented separately, in [Docker Images](docker-images.md).
