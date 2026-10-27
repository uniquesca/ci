# AI failure summary

Summarises a failed run into the job's summary page: what failed, why, and what to do next, with a
flaky or broken verdict from earlier runs. The step behind
[`ai-failure-summary.yml`](../ai/ai-failure-summary.md), which is how a repository uses it.

The job needs `contents: read`, `actions: read` and `id-token: write`.

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `run_id` | yes | | The failed run to summarise |
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

None.

## Dig deeper

### The agent needs an event it accepts

claude-code-action refuses to start on `push`, tag and `create` events, which is what most failing
runs start from. Called from a `workflow_run` workflow, as `ai-failure-summary.yml` does, it starts
on every failure.
