# AI failure summary

Writes into the run's summary page, for each failed job: **what failed**, **why**, with how sure
it is (`certain`, `highly likely`, `likely`, `probably` or `maybe`), and **what to do next**. The
why also says whether the failure is **flaky**, **broken**, **new** or **unknown**, going by the
same job's earlier runs. The log lines that show it are folded underneath.

The QA workflows, [`deploy`](../workflows/deploy.md), [`docker-deploy`](../workflows/docker-deploy.md),
[`prepare-release`](../workflows/prepare-release.md) and [`publish-npm`](../workflows/publish-npm.md)
run it when they are given the federation inputs. Any other workflow adds it as its last job:

```yaml
jobs:
  # ... your jobs
  failure-summary:
    needs: [ build, test ]   # every job it should summarise
    if: failure()
    runs-on: ubuntu-latest
    permissions:
      contents: read         # for the checkout the agent needs
      actions: read          # to read the run's jobs, logs and history
      id-token: write        # to authenticate the agent
    steps:
      - uses: uniquesca/ci/ai-failure-summary@v11
        with:
          anthropic_federation_rule_id: ${{ vars.ANTHROPIC_FEDERATION_RULE_ID }}
          anthropic_organization_id: ${{ vars.ANTHROPIC_ORGANIZATION_ID }}
          anthropic_service_account_id: ${{ vars.ANTHROPIC_SERVICE_ACCOUNT_ID }}
```

For the shared workflows, pass the same three as inputs and grant the calling job those three
permissions.

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `anthropic_federation_rule_id` | yes | | Identity federation rule the job authenticates against |
| `anthropic_organization_id` | yes | | Anthropic organization the federation rule belongs to |
| `anthropic_service_account_id` | yes | | Service account the minted token acts as |
| `anthropic_workspace_id` | no | `''` | Workspace the minted token is scoped to. Only needed when the rule covers more than one |
| `model` | no | `claude-haiku-5-5` | Model that explains the failures |
| `history` | no | `20` | How many earlier runs of the workflow to look back on, on this branch and on all branches each |
| `max_history_logs` | no | `10` | How many earlier failed logs to read, to check whether the same tests failed in them |
| `max_jobs` | no | `5` | How many failed jobs to summarise |
| `max_log_lines` | no | `150` | How many log lines before the first error the agent reads, per job |
| `github_token` | no | `github.token` | Token the run's jobs and logs are read with. Needs `actions: read` and `contents: read` |

## Outputs

None. The summary goes to the run's summary page.

## Dig deeper

### How flaky and broken are told apart

The verdict is counted from the same job, by name, in earlier runs and attempts of the workflow,
not guessed by the model. A failure matches an earlier one when the same step failed and, where
the log names failed tests (PHPUnit, Jest, Vitest, Playwright), at least one of the same tests did.
In order: passed on the same commit is **flaky**. Failed the same way in the last two runs on this
branch or more is **broken**. Failing in the latest run on most other branches is **broken**, and
not this branch's fault. Failed the same way on two other branches or more, while most of them
pass, is **flaky**. Failed once before on this branch is **broken**. Passed last time on this branch
is **new**, probably the latest change. Anything else is **unknown**. Runs of deleted branches still
count, until Github's retention removes them.

### When it says nothing

Inside a reusable workflow the job summarises only its own workflow's jobs, so two calls in one run
do not repeat each other. Without `actions: read` it warns and writes nothing. If the agent fails,
the summary still has the verdicts, a next step that follows from them, and the end of each log.
Runs started by `push` or `create` always get that short summary, because claude-code-action
refuses those events. The agent reads only the staged logs and has no tools beyond reading them
and writing its answer.
