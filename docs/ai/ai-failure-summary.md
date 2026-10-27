# AI Failure Summary

Part of [AI assisted development](../ai.md).

When a watched workflow fails, writes a summary on its own run's page, linked to the failed run.
For each failed job: **what failed**, **why**, with how sure it is (`certain`, `highly likely`,
`likely`, `probably` or `maybe`), and **what to do next**. The why also says whether the failure
is **flaky**, **broken**, **new** or **unknown**, going by the same job's earlier runs.

## Integrating a repository

One file. It only runs from the default branch, so it cannot be tried from a pull request.

```yaml
# .github/workflows/ai-failure-summary.yml
name: AI Failure Summary

on:
  workflow_run:
    # The `name:` of each workflow to watch. A workflow left out gets no summary
    workflows: [ QA Checks, E2E Tests ]
    types: [ completed ]

jobs:
  summary:
    if: github.event.workflow_run.conclusion == 'failure'
    permissions:
      contents: read
      actions: read
      id-token: write
    uses: uniquesca/ci/.github/workflows/ai-failure-summary.yml@v11
    with:
      anthropic_federation_rule_id: ${{ vars.ANTHROPIC_FEDERATION_RULE_ID }}
      anthropic_organization_id: ${{ vars.ANTHROPIC_ORGANIZATION_ID }}
      anthropic_service_account_id: ${{ vars.ANTHROPIC_SERVICE_ACCOUNT_ID }}
      anthropic_workspace_id: ${{ vars.ANTHROPIC_WORKSPACE_ID }}
```

## Secrets

None.

## Inputs

| Input | Type | Default | Description |
|---|---|---|---|
| `anthropic_federation_rule_id` | string | *required* | Identity federation rule the job authenticates against. An identifier rather than a secret |
| `anthropic_organization_id` | string | *required* | Anthropic organization the rule belongs to |
| `anthropic_service_account_id` | string | *required* | Service account the minted token acts as |
| `anthropic_workspace_id` | string | *(none)* | Workspace the minted token is scoped to. Only needed when the rule covers more than one workspace |
| `model` | string | `claude-haiku-5-5` | Model that explains the failures |
| `timeout_minutes` | number | `15` | How long the whole job may run |

## Outputs

None.

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

### When the summary is short

If the agent fails, the summary still has the verdicts, a next step that follows from them, and the
end of each log. The agent reads only the staged logs and has no tools beyond reading them and
writing its answer.
