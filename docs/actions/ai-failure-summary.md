# AI failure summary

Writes into the run's summary page, for each failed job: **what failed**, **why**, with how sure
it is (`certain`, `highly likely`, `likely`, `probably` or `maybe`), and **what to do next**. The
why also carries the verdict from [`failure-history`](failure-history.md): flaky, broken on this
branch, broken on other branches too, new or unknown. The log lines that show it are folded
underneath.

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
      actions: read          # to read the run's jobs, logs and history
      id-token: write        # to log in to the AI
    steps:
      - uses: uniquesca/ci/ai-failure-summary@v11
        with:
          anthropic_federation_rule_id: ${{ vars.ANTHROPIC_FEDERATION_RULE_ID }}
          anthropic_organization_id: ${{ vars.ANTHROPIC_ORGANIZATION_ID }}
          anthropic_service_account_id: ${{ vars.ANTHROPIC_SERVICE_ACCOUNT_ID }}
```

For the shared workflows, pass the same three as inputs and grant the calling job those two
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
| `max_log_lines` | no | `150` | How many log lines before the first error the model reads, per job |
| `github_token` | no | `github.token` | Token the run's jobs and logs are read with. Needs `actions: read` |

## Outputs

None. The summary goes to the run's summary page.

## Dig deeper

### When it says nothing

It summarises the jobs `failure-history` checks, so inside a reusable workflow only that workflow's
own. Without `actions: read` it warns and writes nothing. If the model call fails, the summary still
has the verdicts, a next step that follows from them, and the end of each log. The model gets the
staged logs in its prompt and nothing else: no tools, no checkout.
