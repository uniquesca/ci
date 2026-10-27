# Failure history

Checks each failed job of this run against the same job's earlier runs, and gives it a verdict. No
AI. Used by [`ai-failure-summary`](ai-failure-summary.md), and as JSON by anything else that wants
to know whether a failure is worth acting on.

| Verdict | Meaning |
|---|---|
| `flaky` | Failed and passed on the same code, or fails now and then on other branches |
| `broken-here` | Fails on this branch, so probably its own change |
| `broken-elsewhere` | Fails on most other branches too, so the cause is outside this branch |
| `new` | First failure after passing on this branch |
| `unknown` | Not enough earlier runs to tell |

Run it as the last job, after the jobs it should check:

```yaml
  check-failures:
    needs: [ build, test ]
    if: failure()
    runs-on: ubuntu-latest
    permissions:
      actions: read
    steps:
      - id: history
        uses: uniquesca/ci/failure-history@v11
      - run: jq . "$FILE"
        env:
          FILE: ${{ steps.history.outputs.file }}
```

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `dir` | no | `.failure-history` | Directory the result and the trimmed logs are written to, relative to the workspace |
| `history` | no | `20` | How many earlier runs of the workflow to look back on, on this branch and on all branches each |
| `max_history_logs` | no | `10` | How many earlier failed logs to read, to check whether the same tests failed in them |
| `max_jobs` | no | `5` | How many failed jobs to check |
| `max_log_lines` | no | `150` | How many log lines before the first error to keep, per job |
| `upload` | no | `true` | Whether to upload the result as an artifact, for anything that reads it after the run |
| `retention_days` | no | `7` | How long the uploaded result is kept |
| `github_token` | no | `github.token` | Token the run's jobs and logs are read with. Needs `actions: read` |

## Outputs

| Output | Description |
|---|---|
| `count` | How many failed jobs were checked |
| `result` | The result as JSON. Each job in `jobs` has `name`, `url`, `step`, `tests`, `verdict`, `reason` and `log` |
| `file` | Path of the same JSON in `dir`, as `result.json`. `log` paths are relative to `dir` |

## Dig deeper

### How the verdict is worked out

The verdict is counted from the same job, by name, in runs and attempts of the workflow that started
before this one. A failure matches an earlier one when the same step failed and, where the log names
failed tests (PHPUnit, Jest, Vitest, Playwright), at least one of the same tests did. In order:
passed on the same commit is `flaky`. Failed the same way in the last two runs on this branch or more
is `broken-here`. Failing in the latest run on most other branches is `broken-elsewhere`. Failed the
same way on two other branches or more, while most of them pass, is `flaky`. Failed once before on
this branch is `broken-here`. Passed last time on this branch is `new`. Anything else is `unknown`.
Runs of deleted branches still count, until Github's retention removes them.

### Which jobs it checks

Inside a reusable workflow it checks only that workflow's own jobs, so two calls in one run do not
repeat each other, and each uploads its own artifact. Without `actions: read` it warns and writes an
empty result. The uploaded artifact holds only `result.json`, not the logs.
