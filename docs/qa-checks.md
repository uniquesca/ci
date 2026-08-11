# QA Checks

Reusable workflows that run quality assurance checks against a repository - unit tests,
code style and static analysis.

There are two of them, one per ecosystem:

1. [PHP QA Checks workflow](#php-qa-checks-workflow) - PHPUnit, PHP_CodeSniffer and Psalm
   across the repository's PHP version matrix, with an optional MySQL database
2. [NPM QA Checks workflow](#npm-qa-checks-workflow) - the `lint` and `test` scripts from
   `package.json`, run by NPM or Yarn

They are independent. A repository calls the one that matches it, or
[both](#repositories-with-php-and-javascript) when it has PHP and JavaScript worth checking
separately.

Every check in both workflows is **conditional on its configuration file being present**. A
repository without `psalm.xml` is not failed for missing Psalm - the step says so and moves
on. This means both workflows can be added to a repository before all of its tooling is.

The one exception is `package.json`: it is what `npm-qa-checks` exists to check, so a
repository without it fails rather than passing vacuously.

A code style problem a tool can fix is not worth a developer's time, so on a pull request the
PHP checks fix it and commit the fix instead of reporting it - see
[Automatic code style fixes](#automatic-code-style-fixes).

> The older combined [`qa-checks.yml`](#removed-qa-checks) workflow **has been removed**. Call
> [PHP QA Checks](#php-qa-checks-workflow), [NPM QA Checks](#npm-qa-checks-workflow) or
> [both](#repositories-with-php-and-javascript) instead - see
> [Migrating from qa-checks](#migrating-from-qa-checks).

## PHP QA Checks workflow

What happens on each run:

1. The job matrix is read from `_ci_environment.json` by
   [`qa-ci-matrix`](actions/qa-ci-matrix.md). Every entry gets its own parallel job, with
   its own OS and PHP version, and `xdebug` is added to the extensions so coverage works.
   A repository without that file gets one job on PHP 8.2.
2. PHP is set up for that matrix entry, the repository is checked out, and `setup_cmd` runs
   if given.
3. Environment variables are prepared. Whatever is passed in `env_variables` is merged over
   defaults pointing at a `phpunit` database on `127.0.0.1:3306` with the `root`/`root`
   credentials - so unit tests find the database this workflow creates without configuring
   anything.
4. Composer dependencies are installed. `composer install` is used for a locked matrix
   entry. For an unlocked one, an alternative `composer.<php-version>.lock` is used if the
   repository has one, and `composer update` otherwise. **NPM and Yarn are deliberately not
   touched** - that is what the NPM workflow is for.
5. PHP_CodeSniffer runs in fixing mode, and whatever it fixed is committed back to the pull
   request branch. This happens before the tests, so a failing test cannot stop a fix that is
   ready from landing. [Details, and what it needs](#automatic-code-style-fixes).
6. If `use_db` is set and the repository has PHPUnit, MySQL is started, the `phpunit`
   database is created, `db_dump_path` is imported, and `db_migration_cmd` runs.
7. PHPUnit runs, then PHP_CodeSniffer, then Psalm. `fail-fast` is off, so one PHP version
   failing does not cancel the others.

The MySQL steps are skipped entirely when the repository has no PHPUnit configuration -
there would be nothing to use the database.

### Setting it up

```yaml
name: QA

on:
  pull_request:
  push:
    branches: [ develop ]

jobs:
  php-qa:
    uses: uniquesca/ci/.github/workflows/php-qa-checks.yml@main
    secrets:
      COMPOSER_ACCESS_TOKEN: ${{ secrets.COMPOSER_ACCESS_TOKEN }}
      # What lets the code style fixes be committed, and their checks run - see below
      AUTOFIX_ACCESS_TOKEN: ${{ secrets.AUTOFIX_ACCESS_TOKEN }}
```

With a database and a migration:

```yaml
jobs:
  php-qa:
    uses: uniquesca/ci/.github/workflows/php-qa-checks.yml@main
    with:
      use_db: true
      db_dump_path: 'db/dump.sql'
      db_migration_cmd: './vendor/bin/phinx migrate'
    secrets:
      COMPOSER_ACCESS_TOKEN: ${{ secrets.COMPOSER_ACCESS_TOKEN }}
```

### Secrets

| Secret | Required | Description |
|---|---|---|
| `COMPOSER_ACCESS_TOKEN` | yes | Access token for cloning Uniques private repositories |
| `AUTOFIX_ACCESS_TOKEN` | no | Access token the [automatic code style fixes](#automatic-code-style-fixes) are pushed with. Without it they are pushed with the run's own `GITHUB_TOKEN`, which needs `contents: write` on the calling job and leaves the fix commit's run waiting on *Approve workflows to run* |

### Inputs

| Input | Type | Default | Description |
|---|---|---|---|
| `auto_fix` | boolean | `true` | Whether to [fix the code style and commit it](#automatic-code-style-fixes) before the checks run |
| `setup_cmd` | string | `''` | Command to run before the checks execute |
| `use_db` | boolean | `false` | Whether a database is needed, for example for unit tests |
| `mysql_version` | string | `8.0` | Version of MySQL to set up |
| `mysql_config` | string | `''` | MySQL config to apply, `my.cnf` syntax |
| `db_dump_path` | string | | Path to the DB dump. Ignored unless `use_db` is `true` |
| `db_migration_cmd` | string | `''` | Migration command, runs before the unit tests |
| `env_variables` | string | `'{}'` | JSON object of environment variables |

## NPM QA Checks workflow

What happens on each run:

1. Node is set up, the repository is checked out, and `setup_cmd` runs if given.
2. The package manager is detected in `working_directory`. A `.yarnrc` file selects Yarn, and
   its absence selects NPM - the same rule
   [`install-packages`](actions/install-packages.md) uses, so the tool that installed the
   dependencies is the tool that runs the scripts. **A missing `package.json` fails the run
   here**, since there is nothing for this workflow to check; point it at the right
   `working_directory`, or don't call it for that repository.
3. Environment variables from `env_variables` are prepared.
4. Dependencies are installed, with caching. **Composer is deliberately not touched.**
5. The `lint` script runs, then `test` - each only if `package.json` actually defines it.

This workflow runs on a single `ubuntu-latest` runner. There is no version matrix: the CI
environment file describes PHP jobs only, so the Node version comes from the `node_version`
input.

### Setting it up

```yaml
name: QA

on:
  pull_request:
  push:
    branches: [ develop ]

jobs:
  npm-qa:
    uses: uniquesca/ci/.github/workflows/npm-qa-checks.yml@main
    secrets:
      NPM_ACCESS_TOKEN: ${{ secrets.NPM_ACCESS_TOKEN }}
```

`NPM_ACCESS_TOKEN` is optional, and only needed for `@uniquesca` packages from the GitHub
registry. A repository depending only on public packages can leave the `secrets` block out.

### Secrets

| Secret | Required | Description |
|---|---|---|
| `NPM_ACCESS_TOKEN` | no | Access token for authentication with the NPM registry |

### Inputs

| Input | Type | Default | Description |
|---|---|---|---|
| `node_version` | number | `20` | Node version to use for the checks |
| `working_directory` | string | `'.'` | Directory the package lives in |
| `setup_cmd` | string | `''` | Command to run before the checks execute |
| `env_variables` | string | `'{}'` | JSON object of environment variables |

## Repositories with PHP and JavaScript

Call both. They are separate jobs, so they run in parallel and report separately - a failing
linter is immediately distinguishable from a failing PHP test:

```yaml
jobs:
  php-qa:
    uses: uniquesca/ci/.github/workflows/php-qa-checks.yml@main
    secrets:
      COMPOSER_ACCESS_TOKEN: ${{ secrets.COMPOSER_ACCESS_TOKEN }}

  npm-qa:
    uses: uniquesca/ci/.github/workflows/npm-qa-checks.yml@main
    secrets:
      NPM_ACCESS_TOKEN: ${{ secrets.NPM_ACCESS_TOKEN }}
```

If the PHP tests need built JavaScript assets, they are not two independent things and this
does not apply - build the assets in the PHP workflow's `setup_cmd` instead.

## Automatic code style fixes

On a pull request, PHP_CodeSniffer runs as `phpcbf` before anything else, and whatever it fixed
is committed back to the branch as `CI: automatic code style fixes`. Only what no tool can fix
reaches the code style check afterwards, and therefore a person.

This is [`cs-fix`](actions/cs-fix.md), used by both QA entry points - `php-qa-checks` and the
[`docker-qa-checks`](#docker-qa-checks) action.

### Setting it up

The fix commit becomes the new head of the pull request, so the checks the pull request ends up
showing are the ones that start on that commit - and whether they start at all comes down to which
token pushed it. That is the whole of the setup, and it is worth getting right: a fix nobody's
checks run against still needs a person.

**Supply `AUTOFIX_ACCESS_TOKEN`, and it is done without anybody:**

```yaml
jobs:
  php-qa:
    uses: uniquesca/ci/.github/workflows/php-qa-checks.yml@main
    secrets:
      COMPOSER_ACCESS_TOKEN: ${{ secrets.COMPOSER_ACCESS_TOKEN }}
      AUTOFIX_ACCESS_TOKEN: ${{ secrets.AUTOFIX_ACCESS_TOKEN }}
```

Any token that can push to the branch - a personal access token, or a Github App installation
token - pushing as its own identity. The fix commit starts a full run of its own, that run finds
nothing left to fix, and the pull request goes green on its own. No `contents: write` is needed
for the push, because the push does not use the run's token.

**Without it, the fixes still land, but the run for them waits on a person:**

```yaml
jobs:
  php-qa:
    permissions:
      contents: write
    uses: uniquesca/ci/.github/workflows/php-qa-checks.yml@main
    secrets:
      COMPOSER_ACCESS_TOKEN: ${{ secrets.COMPOSER_ACCESS_TOKEN }}
```

The fallback is the run's own `GITHUB_TOKEN`, which needs the `contents: write` above. Github holds
any `pull_request` run that `GITHUB_TOKEN` triggered in an approval-required state, deliberately, so
that a workflow cannot start itself in a loop; somebody with write access releases it with *Approve
workflows to run*. The checks are pending rather than missing, so the pull request is not mergeable
until then - one click instead of a developer fixing whitespace by hand, but still a click. The run
says which of the two happened as a notice when it pushes.

Worth knowing: the [AI implementing workflow](ai/ai-implement.md) is started by your QA workflows
finishing, so on the fallback it waits on that approval as well.

### When it does nothing

| Situation | What happens |
|---|---|
| No `AUTOFIX_ACCESS_TOKEN` and no `contents: write` on the calling job | The push is refused, so after one attempt per matrix leg the fixes are taken back out and the code style check reports them as it used to |
| A `push` run, for example to `develop` | Nothing is fixed - there is no pull request branch to iterate on, and CI does not write to your default branch. Style problems on `develop` are reported as they always were |
| A pull request from a fork | Nothing is fixed - the branch is not ours to push to, and the token a fork's run gets is read-only |
| No `phpcs.xml` or `phpcs.xml.dist` | The step does not run, same as the check itself |
| `phpcbf` is not installed | Warning, nothing is fixed |
| The branch moved on mid-run, or the push is refused | The fixer runs again against the branch as it now is, and that is what lands - see [below](#every-php-version-fixes-its-own). Only after one attempt per matrix leg does it warn, take the fixes back out of the working tree and let the code style check report them the way it used to |
| `auto_fix: false` | The step does not run |

One rule runs through all of them, and it is the invariant worth remembering: **a job is green
only if the fixes it made are on the branch.** A fix that cannot land is undone locally first, so
a check never passes on the strength of a fix nobody else can see.

### Every PHP version fixes its own

A matrix does not necessarily produce one fix. A sniff that only fires on newer syntax, or an
unlocked leg that resolved a newer coding standard, means 8.2 can fix strictly more than 8.1.

Every leg fixes and tries to push, and a ref update is atomic, so one of them wins. What the
losers do is the whole design: **a loser goes back to the tip the winner just pushed, runs its own
fixer again over the code as it now stands, and tries again.**

- If its version had nothing the winner did not already fix - the usual case - the second run of
  the fixer finds nothing, and the job is done and green.
- If its version fixes more, that difference is what it pushes on top. It is derived against the
  exact commit it will be pushed onto, so there is never a patch to merge and nothing to conflict.
- The same thing happens when the branch moved for any other reason, a person pushing to it for
  instance: the stale fixes are dropped, the fixer runs against what is there now, and that is
  what lands.

It tries this **once per leg of the matrix** (`attempts: ${{ strategy.job-total }}` in
`php-qa-checks`), because that is how many jobs can be racing to land a fix of their own. Only after
running out of attempts does a leg revert and let its code style check go red.

So a matrix settles within one run, and every version's fixes end up on the branch whichever one
got there first.

**It gives up rather than loop.** After five consecutive automatic fix commits on a branch, no
sixth is pushed: past that the fixer is not settling, and it needs a person. That counts commits
on the branch across runs, separately from the attempts within one run.

Also, the commit carries the fixer's files and nothing else. A `setup_cmd` is free to write into
the working tree; a commit about code style is not where that should turn up.

### docker-qa-checks

[`docker-qa-checks`](actions/docker-qa-checks.md) runs `./task.sh cs-fix`, skipped when `task.sh`
does not support it. It is an action rather than a workflow, so the token is an input rather than a
secret:

```yaml
    steps:
      - uses: uniquesca/ci/docker-qa-checks@main
        with:
          autofix_token: ${{ secrets.AUTOFIX_ACCESS_TOKEN }}
```

Leave `autofix_token` out and the job needs `permissions: contents: write` instead, with the same
approval click as above.

| Input | Default | Description |
|---|---|---|
| `auto_fix` | `'true'` | Whether to run `cs-fix` and commit what it fixed |
| `autofix_token` | `''` | Token the fixes are pushed with. Empty falls back to the run's own `GITHUB_TOKEN` |

Everything else on this page applies unchanged.

## Removed: qa-checks

`qa-checks.yml` did all of the above in one job. **It no longer exists.** It was deprecated, and then
removed in v10, so a repository still calling it fails before it runs a single check:

```
error parsing called workflow
"uniquesca/ci/.github/workflows/qa-checks.yml@main": workflow was not found.
```

**Use these instead:**

| Instead of `qa-checks` | Call |
|---|---|
| A PHP repository | [PHP QA Checks](#php-qa-checks-workflow) - `.github/workflows/php-qa-checks.yml` |
| A JavaScript repository | [NPM QA Checks](#npm-qa-checks-workflow) - `.github/workflows/npm-qa-checks.yml` |
| A repository with both | [Both, as two jobs](#repositories-with-php-and-javascript) |

They run the same checks, and [Migrating from qa-checks](#migrating-from-qa-checks) below is a
per-input mapping - most repositories change three lines. Pinning to a tag from before v10 keeps the
old workflow working in the meantime, but nothing further goes into it.

Why it was split: every consumer had to supply the union of both ecosystems' secrets and inputs, and
a pure-JavaScript repository paid for a PHP version matrix it never used.

### Migrating from qa-checks

Replace the single job with whichever of the two applies:

| `qa-checks` had | Now |
|---|---|
| `COMPOSER_ACCESS_TOKEN` secret | `php-qa-checks`, unchanged |
| `NPM_ACCESS_TOKEN` secret | `npm-qa-checks`, unchanged |
| `setup_cmd` input | Both, unchanged - set it on whichever you call |
| `env_variables` input | Both, unchanged |
| `use_db`, `mysql_version`, `mysql_config`, `db_dump_path`, `db_migration_cmd` | `php-qa-checks`, unchanged |
| PHPUnit / PHP_CodeSniffer / Psalm steps | `php-qa-checks` |
| NPM lint / test steps | `npm-qa-checks` |
| Coverage badge step | Dropped. It never ran - its inputs were not declared in `workflow_call` - and `prepare-release.yml` already generates the badge |

Four things behave differently on purpose:

- **`php-qa-checks` does not install NPM or Yarn packages.** `qa-checks` installed them as a
  side effect of one shared `install-packages` step. A repository whose PHP tests need built
  assets should build them in `setup_cmd`; a repository that just wants its JS checked should
  call `npm-qa-checks` as well.
- **The linter is actually invoked.** `qa-checks` ran `npm lint`, which is not a command.
  `npm-qa-checks` runs `npm run lint`, so a repository with a `lint` script that was silently
  never enforced may now report real failures.
- **Yarn is detected by `.yarnrc`, not `yarn.lock`.** This matches `install-packages`.
  `qa-checks` could install with NPM and then try to run scripts with Yarn.
- **A missing `package.json` fails `npm-qa-checks`.** `qa-checks` skipped its Node steps and
  passed, which meant a wrong path or a moved package looked identical to a clean run.
