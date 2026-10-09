# AI Harness Hint

Part of [AI assisted development](../ai.md).

Comments on a pull request somebody wrote by hand when it went back and forth in a way the harness
would have handled on its own: QA failed on its first run, or Copilot review took several rounds of
fixes. An agent first checks that the change suited the harness, and the comment tags the author
and says why.

## Integrating a repository

```yaml
name: AI Harness Hint

on:
  workflow_run:
    # The same name as the qa_workflow input
    workflows: [ QA ]
    types: [ completed ]
  pull_request_review:
    types: [ submitted ]

jobs:
  ai-harness-hint:
    permissions:
      contents: read
      pull-requests: write
      issues: write
      actions: read
      id-token: write
    uses: uniquesca/ci/.github/workflows/ai-harness-hint.yml@v11
    with:
      anthropic_federation_rule_id: ${{ vars.ANTHROPIC_FEDERATION_RULE_ID }}
      anthropic_organization_id: ${{ vars.ANTHROPIC_ORGANIZATION_ID }}
      anthropic_service_account_id: ${{ vars.ANTHROPIC_SERVICE_ACCOUNT_ID }}
      qa_workflow: QA
      # Writes the hint to the job summary only. Set to false once the hints read right
      shadow: true
```

A pull request gets one hint at most, and none when it is a draft, came from the harness, or
carries the `skip_label`.

## Secrets

None.

## Inputs

| Input | Type | Default | Description |
|---|---|---|---|
| `anthropic_federation_rule_id` | string | *required* | Identity federation rule the job authenticates against. An identifier rather than a secret |
| `anthropic_organization_id` | string | *required* | Anthropic organization the rule belongs to |
| `anthropic_service_account_id` | string | *required* | Service account the minted token acts as |
| `anthropic_workspace_id` | string | *(none)* | Workspace the minted token is scoped to. Only needed when the rule covers more than one workspace |
| `qa_workflow` | string | *required* | Name of the QA workflow whose first run is watched. The caller lists the same name under `workflow_run: workflows:` |
| `ignore_job_patterns` | string | *(none)* | Case-insensitive regular expression matching QA jobs whose failure does not count, such as ones needing secrets or external services |
| `copilot_login` | string | `copilot-pull-request-reviewer[bot]` | Login the Copilot reviewer submits its reviews as |
| `copilot_rounds` | number | `2` | How many rounds of fixes after a Copilot review make a hint |
| `branch_prefix` | string | `ai-feature/` | Prefix of the branches the implementing workflow pushes to. Keep it the same as [`ai-implement`](ai-implement.md)'s |
| `skip_label` | string | `no-ai-hint` | A pull request carrying this label gets no hint |
| `docs_url` | string | `https://github.com/uniquesca/ci/blob/main/docs/ai.md` | Where the hint sends somebody to get started |
| `shadow` | boolean | `true` | Write the hint to the job summary instead of posting it |
| `max_reason_chars` | number | `300` | Longest reason the agent may give. A longer one is cut at the last whole sentence that fits |
| `model` | string | `claude-sonnet-5-5` | Model that judges whether the change suited the harness |
| `effort` | string | `low` | How much reasoning the agent spends. Empty leaves the CLI default |
| `max_turns` | number | `15` | How many turns the agent may spend before it has to decide |
| `max_diff_bytes` | number | `100000` | Longest diff to stage. A bigger change is truncated and the agent is told so |
| `timeout_minutes` | number | `15` | How long the whole job may run |

## Outputs

None. The result is a comment on the pull request, or a job summary in shadow mode.

## Dig deeper

### How a round of fixes is counted

Every Copilot review records the commit it read, so a round is a change of commit between two
Copilot reviews, and commit dates play no part. The QA trigger counts only the first `pull_request`
run of `qa_workflow` since the pull request was opened, on its first attempt. Both triggers run
only the default-branch copy of the calling file, so neither can be tried from a branch.
