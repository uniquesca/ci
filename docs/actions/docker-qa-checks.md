# Docker QA checks

Runs a Docker-based repository's tests, code style check and Psalm through `task.sh`, fixes what the
code style check reports, and uploads what every check printed as an artifact.

For a repository that sets up PHP on the runner instead, use the
[`php-qa-checks`](../qa-checks.md#php-qa-checks-workflow) workflow.

```yaml
    steps:
      - uses: actions/checkout@v7
      - uses: uniquesca/ci/docker-spin-up@main
      - uses: uniquesca/ci/docker-qa-checks@main
        with:
          autofix_token: ${{ secrets.AUTOFIX_ACCESS_TOKEN }}
```

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `setup_cmd` | no | `''` | Command to run before the checks |
| `auto_fix` | no | `'true'` | Run `cs-fix` and commit what it fixed when the code style check reports something |
| `autofix_token` | no | `''` | Token the fixes are pushed with. Empty falls back to the run's own `GITHUB_TOKEN` |
| `report_name` | no | `ai-report-qa-checks` | Artifact name the check output is uploaded as |

## Outputs

This action produces no outputs. It uploads an artifact named after `report_name`.

## Dig deeper

### Every check is optional, and asked for by name

Each check runs only if `./task.sh supports <task>` says the repository has it, so a repository
without Psalm is not failed for missing Psalm:

| `task.sh` task | What runs |
|---|---|
| `cs-check` | The code style check, before everything else |
| `cs-fix` | The code style fixer, when that check reported something |
| `test` | The test suite |
| `psalm` | Static analysis |

Nothing else is set up for you - no PHP, no MySQL, no dependencies. The job is expected to have the
application running already, usually via [`docker-spin-up`](docker-spin-up.md).

### The reports, and who reads them

Every check tees its output to `.ai-reports/<check>.log` in the workspace, and the directory goes up
as an artifact with one day of retention. This exists because **an AI implementing round cannot read
job logs** - a red check run on its own carries nothing but `Process completed with exit code 1`.
Any artifact whose name starts with `ai-report-` is picked up by
[`ai-implement`](../ai/ai-implement.md), which is why that is the default prefix.

Artifact names have to be unique within a run, so give each leg its own `report_name` if this action
runs more than once.

`set -o pipefail` is on for each check, so `tee` cannot report success for a task that failed.
The upload runs on `always()`, since a failed run is the only one anybody wants the reports from.

### Code style fixing

The code style is checked first, and the fixer runs only when that check reported something - before
the tests, so a failing test cannot stop a ready fix from landing. It is [`cs-fix`](cs-fix.md) with
`cmd: ./task.sh cs-fix`, and the check runs again afterwards to report whatever is left. Supply
`autofix_token` and the fix commit starts its own checks; leave it out and the job needs
`permissions: contents: write` and somebody has to press *Approve workflows to run*. The full
behaviour - the matrix race, the circuit breaker, when it does nothing - is in
[Automatic code style fixes](../qa-checks.md#automatic-code-style-fixes).
