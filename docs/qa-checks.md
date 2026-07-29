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

> The older combined [`qa-checks.yml`](#deprecated-qa-checks) workflow is deprecated. See
> [Migrating from qa-checks](#migrating-from-qa-checks).

## PHP QA Checks workflow

What happens on each run:

1. The job matrix is read from `_ci_environment.json` by
   [`qa-ci-matrix`](../qa-ci-matrix/action.yml). Every entry gets its own parallel job, with
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
5. If `use_db` is set and the repository has PHPUnit, MySQL is started, the `phpunit`
   database is created, `db_dump_path` is imported, and `db_migration_cmd` runs.
6. PHPUnit runs, then PHP_CodeSniffer, then Psalm. `fail-fast` is off, so one PHP version
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

### Inputs

| Input | Type | Default | Description |
|---|---|---|---|
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
   [`install-packages`](../install-packages/action.yml) uses, so the tool that installed the
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

## Deprecated: qa-checks

`qa-checks.yml` did all of the above in one job. It still works and still runs the same
checks, but it emits a deprecation warning and will not receive fixes. Every consumer had to
supply the union of both ecosystems' secrets and inputs, and a pure-JavaScript repository
paid for a PHP version matrix it never used.

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
