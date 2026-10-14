# AI Test Advice

Part of [AI assisted development](../ai.md).

Comments on a pull request whose code no test covers yet, naming the unit or end-to-end tests worth
adding. It runs once, when a pull request that changes code is opened or leaves draft, and says
nothing when the tests already cover it.

## Integrating a repository

```yaml
name: AI Test Advice

on:
  pull_request:
    types: [ opened, ready_for_review ]

jobs:
  ai-test-advice:
    permissions:
      contents: read
      pull-requests: write
      issues: write
      id-token: write
    uses: uniquesca/ci/.github/workflows/ai-test-advice.yml@v11
    with:
      anthropic_federation_rule_id: ${{ vars.ANTHROPIC_FEDERATION_RULE_ID }}
      anthropic_organization_id: ${{ vars.ANTHROPIC_ORGANIZATION_ID }}
      anthropic_service_account_id: ${{ vars.ANTHROPIC_SERVICE_ACCOUNT_ID }}
      # Optional. Only these kinds of test are suggested
      test_setup: 'Unit: PHPUnit in tests/Unit. E2E: Playwright in e2e/'
```

A pull request gets one comment at most, and none when it is a draft, came from the harness or a
fork, or carries the `skip_label`.

## Secrets

None.

## Inputs

| Input | Type | Default | Description |
|---|---|---|---|
| `anthropic_federation_rule_id` | string | *required* | Identity federation rule the job authenticates against. An identifier rather than a secret |
| `anthropic_organization_id` | string | *required* | Anthropic organization the rule belongs to |
| `anthropic_service_account_id` | string | *required* | Service account the minted token acts as |
| `anthropic_workspace_id` | string | *(none)* | Workspace the minted token is scoped to. Only needed when the rule covers more than one workspace |
| `test_setup` | string | *(none)* | The kinds of test the repository has and where they live. Only those kinds are suggested. Empty lets the agent find out |
| `test_path_pattern` | string | `(^\|/)(tests?\|__tests__\|specs?\|e2e\|cypress\|playwright)/\|\.(test\|spec\|cy\|e2e)\.[a-z]+$\|Test\.php$` | Case-insensitive regular expression matching test files |
| `ignore_path_pattern` | string | `^(\.github\|docs)/\|\.(md\|txt\|json\|ya?ml\|lock\|xml\|neon\|dist\|ini\|env\|csv\|css\|scss\|less\|svg\|png\|jpe?g\|gif\|ico\|webp)$` | Case-insensitive regular expression matching files that never need a test |
| `branch_prefix` | string | `ai-feature/` | Prefix of the branches the implementing workflow pushes to. Keep it the same as [`ai-implement`](ai-implement.md)'s |
| `skip_label` | string | `no-ai-test-advice` | A pull request carrying this label gets no advice |
| `max_gaps` | number | `5` | Most tests the comment may suggest |
| `max_gap_chars` | number | `300` | Longest a single suggestion may be. A longer one is cut at the last whole sentence that fits |
| `model` | string | `claude-sonnet-5-5` | Model that judges which tests the change is missing |
| `effort` | string | `medium` | How much reasoning the agent spends. Empty leaves the CLI default |
| `max_turns` | number | `25` | How many turns the agent may spend before it has to answer |
| `max_diff_bytes` | number | `100000` | Longest diff to stage. A bigger change is truncated and the agent is told so |
| `timeout_minutes` | number | `15` | How long the whole job may run |

## Outputs

None. The result is a comment on the pull request.

## Dig deeper

### When the agent runs

A script decides first: the agent runs only when the pull request changes a file that matches
neither `test_path_pattern` nor `ignore_path_pattern`. Later pushes are not looked at, so the advice
is about the change as it was opened. Harness pull requests are left out because
[AI Review](ai-review.md) already asks for missing tests there.
