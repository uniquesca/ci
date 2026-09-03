# Docker prepare release

Does the release bookkeeping for a Docker-based repository and commits it: version fields in
`composer.json` and `package.json`, the changelog section, optionally a refreshed database dump, a
coverage badge and a coverage report.

This is the step-level counterpart of the
[`prepare-release`](../workflows/prepare-release.md) workflow, for a job that already has the
application running in Docker.

```yaml
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 0

      - uses: uniquesca/ci/docker-spin-up@main

      - uses: uniquesca/ci/docker-prepare-release@main
        with:
          version: ${{ needs.version.outputs.version }}
```

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `version` | yes | | Version being prepared, `x.y.z` |
| `generate_changelog` | no | `true` | Write the changelog section for this version |
| `changelog_dir` | no | `.` | Directory holding `CHANGELOG.md`. Ignored unless `generate_changelog` |
| `update_db` | no | `false` | Export the database over the committed dump |
| `db_name` | no | `''` | Database to export. Ignored unless `update_db` |
| `db_dump_path` | no | | Dump to write. Ignored unless `update_db` |
| `generate_coverage_badge` | no | `false` | Run `./task.sh test` and commit a coverage badge |
| `coverage_badge_file` | no | `coverage.svg` | Badge path. Ignored unless `generate_coverage_badge` |
| `generate_coverage_report` | no | `false` | Run `./task.sh test` and commit an HTML coverage report |
| `coverage_report_dir` | no | `coverage-report` | Report directory. Ignored unless `generate_coverage_report` |

## Outputs

This action produces no outputs - it commits to the current branch and pushes.

## Dig deeper

### What it does, in order

1. Exports `db_name` over `db_dump_path` with [`mysql-export`](mysql-export.md), if `update_db`.
2. Sets `version` in `composer.json`, adding the field if it is not there. Skipped when the
   repository has no `composer.json`.
3. Writes the changelog section with [`update-changelog`](update-changelog.md).
4. Runs `./task.sh test`, if `generate_coverage_badge` or `generate_coverage_report`, and generates
   the badge from what it reports.
5. Sets `version` in `package.json` with `npm pkg set`. Skipped when there is no `package.json`.
6. Stages whatever the above touched, runs `git clean -fd`, and commits as
   `CI: automatic commit for the new release: #<sha> [skip ci]` - then pushes. Nothing is committed
   when nothing changed.

`[skip ci]` in the commit message is what stops the push starting another run.

### What it needs from the job

* A checkout with **`fetch-depth: 0`** and a branch to push to - the changelog reads tags and
  history, and the commit goes back to the branch the run is on.
* **`permissions: contents: write`**, since the push uses the run's own token.
* The application already **up in Docker** if you are using `update_db`,
  `generate_coverage_badge` or `generate_coverage_report` - the dump is taken over the network from
  `127.0.0.1:3306` as `root`/`root`, and the badge and the report come from `./task.sh test`. Use
  [`docker-spin-up`](docker-spin-up.md) first.
* A `task.sh test` that **honours `COVERAGE_HTML_DIR`** if you are using
  `generate_coverage_report`. The tests run in the container, so the action only sets the variable
  to `coverage_report_dir`; forwarding it in and passing PHPUnit `--coverage-html` is the task
  script's job, and a script that ignores it writes no report. The directory is emptied before the
  run and staged with a plain `git add`, so one in `.gitignore` fails the commit step.

### What it does not do

**No migrations.** The dump is exported as the running database has it, so anything that has to
migrate the dump first belongs in [`migrate-db-dump`](migrate-db-dump.md), or in the
[`prepare-release`](../workflows/prepare-release.md) workflow, which takes a `migration_command`.

No tests either, unless you asked for a coverage badge or report - those are the only reasons it
runs them.

### Which of the two to use

| | Use |
|---|---|
| Repository runs its CI in Docker through `task.sh` | This action |
| Repository sets up PHP, MySQL and Node on the runner | [`prepare-release`](../workflows/prepare-release.md) workflow |

The workflow additionally sets up the toolchain, installs dependencies, runs PHPUnit and can
migrate the dump. This action assumes the job already did whatever setup it needs.
