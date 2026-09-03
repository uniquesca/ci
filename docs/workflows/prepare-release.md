# Prepare release

Does everything a release branch needs before it is tagged, and commits it: version fields in
`composer.json` and `package.json`, the changelog section for the version, optionally a migrated
database dump, a test coverage badge and a coverage report.

```yaml
name: Prepare release

on:
  create:

jobs:
  version:
    if: startsWith(github.ref, 'refs/heads/release/') || startsWith(github.ref, 'refs/heads/hotfix/')
    uses: uniquesca/ci/.github/workflows/get-version.yml@main
    with:
      ref: ${{ github.ref }}

  prepare-release:
    needs: [ version ]
    permissions:
      contents: write
    uses: uniquesca/ci/.github/workflows/prepare-release.yml@main
    with:
      version: ${{ needs.version.outputs.version }}
    secrets:
      COMPOSER_ACCESS_TOKEN: ${{ secrets.COMPOSER_ACCESS_TOKEN }}
```

## Secrets

| Secret | Required | Description |
|---|---|---|
| `COMPOSER_ACCESS_TOKEN` | no | Access token for cloning Uniques private repositories |
| `NPM_ACCESS_TOKEN` | no | Access token for authentication with the NPM registry |

## Inputs

| Input | Type | Default | Description |
|---|---|---|---|
| `version` | string | | **Required.** Version being prepared, `x.y.z` |
| `generate_changelog` | boolean | `true` | Write the changelog section for this version |
| `changelog_dir` | string | `.` | Directory holding `CHANGELOG.md`. Ignored unless `generate_changelog` |
| `use_db` | boolean | `false` | Set up MySQL, import the dump and migrate it |
| `update_db` | boolean | `false` | Everything `use_db` does, and export the result back over the dump |
| `db_dump_path` | string | | Path to the DB dump. Required when either DB input is set |
| `migration_command` | string | `./vendor/bin/phinx migrate` | Migration command |
| `sql_command` | string | | SQL to run before exporting the dump, usually cleanup |
| `mysql_version` | string | `8.0` | Version of MySQL to set up |
| `mysql_config` | string | `''` | MySQL config to apply, `my.cnf` syntax. Appended to the CI durability defaults (`innodb_flush_log_at_trx_commit=0`, `innodb_doublewrite=0`, `sync_binlog=0`), so it overrides them |
| `env_variables` | string | `'{}'` | JSON object of environment variables for the config templates |
| `node_version` | number | `20` | Node version to use |
| `pre_cmd` | string | `''` | Command to run before anything else |
| `post_cmd` | string | `''` | Command to run after everything else, before the commit |
| `generate_coverage_badge` | boolean | `false` | Generate and commit a coverage badge |
| `coverage_badge_file` | string | `coverage.svg` | Badge path. Ignored unless `generate_coverage_badge` |
| `generate_coverage_report` | boolean | `false` | Generate and commit an HTML coverage report |
| `coverage_report_dir` | string | `coverage-report` | Report directory. Ignored unless `generate_coverage_report` |

## Outputs

None. The result is a commit on the branch the run is on.

## Dig deeper

### What happens on each run

1. The job's PHP version and runner come from `_ci_environment.json` via
   [`get-default-ci-environment`](../actions/get-default-ci-environment.md) - one job, not a matrix.
2. Checkout with `fetch-depth: 0`, Node is set up, and `pre_cmd` runs.
3. If the repository has PHPUnit or either DB input is set, the database credentials for a
   `prepare_release` database are merged over `env_variables` and the config templates are rendered
   ([`merge-environment-variables`](../actions/merge-environment-variables.md),
   [`prepare-environment`](../actions/prepare-environment.md)).
4. PHP is set up when the repository has a `composer.json` or PHPUnit, then Composer, NPM and Yarn
   dependencies are installed ([`install-packages`](../actions/install-packages.md)).
5. With a DB input: MySQL is started, `prepare_release` is created, `db_dump_path` is imported,
   `migration_command` runs, and `sql_command` runs when `update_db` is set. With `update_db` the
   dump is then exported back over `db_dump_path`
   ([`mysql-export`](../actions/mysql-export.md) strips the timestamp and `DEFINER` clauses, so an
   unchanged database produces no diff).
6. `version` is written into `composer.json`, adding the field if it is missing.
7. The changelog section is written with
   [`update-changelog`](../actions/update-changelog.md).
8. PHPUnit runs if the repository has a configuration, and the coverage badge and the report are
   generated when asked for.
9. `version` is written into `package.json` with `npm pkg set`, `post_cmd` runs, and everything the
   above touched is committed as `CI: automatic commit for the new release: #<sha> [skip ci]` and
   pushed. Nothing is committed when nothing changed.

Every PHP and database step is conditional, so a JavaScript-only repository can call this with
nothing but `version`.

### What it needs from the caller

* **`permissions: contents: write`** - the commit is pushed with the run's own token.
* A branch to push to. This is written for a `release/**` or `hotfix/**` branch created by hand,
  which is also what [`get-version`](get-version.md) reads the version from.
* `db_dump_path` whenever `use_db` or `update_db` is set. **Neither input has a usable default**, and
  the import step fails rather than skipping if the path is empty.

`[skip ci]` in the commit message is what stops the push starting another run of your own workflows.

### `use_db` versus `update_db`

| | Sets up MySQL and migrates | Commits the migrated dump |
|---|---|---|
| `use_db: true` | yes | no |
| `update_db: true` | yes | yes |

`use_db` on its own is for a repository whose unit tests need the database - the migration has to
run for the tests to pass, but the dump in git is left alone. `update_db` is for keeping the
committed dump current with the migrations, which is the more common reason to reach for either.

### Coverage badge and report

Generated by `timkrase/phpunit-coverage-badge` from the PHPUnit run, and **only when the repository
has a PHPUnit configuration** - `generate_coverage_badge` on its own does nothing without one. It is
committed with the rest, not pushed by the badge action.

`generate_coverage_report` needs the PHPUnit configuration too, and PHPUnit writes the report with
`--coverage-html`. `coverage_report_dir` is emptied before the run, so nothing else can live in it,
and it is staged with a plain `git add` - **a directory in `.gitignore` fails the commit step**.

### The commit

Staged explicitly: `package.json`, `composer.json`, the dump, `CHANGELOG.md`, the badge and the
report directory, each only if the corresponding input asked for it. Then `git clean -fd`, which
**removes untracked files a `pre_cmd`, `post_cmd` or the dependency install left behind** - build
output, in other words, does not end up in the release commit.

### For a Docker-based repository

Use the [`docker-prepare-release`](../actions/docker-prepare-release.md) action instead. It does the
same bookkeeping through `task.sh` in a job you already set up, and does not install a toolchain of
its own.
