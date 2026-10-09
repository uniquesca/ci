# AI Retro

Part of [AI assisted development](../ai.md).

When a pull request [AI Implement](ai-implement.md) opened is merged after too many rounds, an agent
reads the issue, the plan and every round, and posts a short comment on the pull request saying
what would have saved rounds. It tags the person who opened the issue, and the person who started
the work when a plan question they left open caused a round.

## Integrating a repository

```yaml
name: AI Retro

on:
  pull_request:
    types: [ closed ]

jobs:
  ai-retro:
    permissions:
      contents: read
      pull-requests: write
      issues: write
      id-token: write
    uses: uniquesca/ci/.github/workflows/ai-retro.yml@v11
    with:
      anthropic_federation_rule_id: ${{ vars.ANTHROPIC_FEDERATION_RULE_ID }}
      anthropic_organization_id: ${{ vars.ANTHROPIC_ORGANIZATION_ID }}
      anthropic_service_account_id: ${{ vars.ANTHROPIC_SERVICE_ACCOUNT_ID }}
      anthropic_workspace_id: ${{ vars.ANTHROPIC_WORKSPACE_ID }}
      # Writes the retro to the job summary only. Set to false once the retros read right
      shadow: true
```

A retro runs when any of these is true: `min_rounds` rounds after the pull request opened,
`min_change_requests` change requests from people, a restart with `/ai-do`, or the round limit
was hit. A pull request gets one retro at most.

## Secrets

None.

## Inputs

| Input | Type | Default | Description |
|---|---|---|---|
| `anthropic_federation_rule_id` | string | *required* | Identity federation rule the job authenticates against. An identifier rather than a secret |
| `anthropic_organization_id` | string | *required* | Anthropic organization the rule belongs to |
| `anthropic_service_account_id` | string | *required* | Service account the minted token acts as |
| `anthropic_workspace_id` | string | *(none)* | Workspace the minted token is scoped to. Only needed when the rule covers more than one workspace |
| `branch_prefix` | string | `ai-feature/` | Prefix of the branches the implementing workflow pushes to. Keep it the same as [`ai-implement`](ai-implement.md)'s |
| `min_rounds` | number | `3` | How many rounds after the first push make a retro |
| `min_change_requests` | number | `2` | How many change requests from people make a retro, whatever the number of rounds |
| `max_points` | number | `5` | Most points the comment may make |
| `max_point_chars` | number | `240` | Longest a single point may be. A longer one is cut at the last whole sentence that fits |
| `shadow` | boolean | `true` | Write the retro to the job summary instead of posting it |
| `model` | string | `claude-sonnet-5-5` | Model that works out why the pull request took so many rounds |
| `effort` | string | `medium` | How much reasoning the agent spends. Empty leaves the CLI default |
| `max_turns` | number | `30` | How many turns the agent may spend before it has to answer |
| `max_diff_bytes` | number | `100000` | Longest diff to stage. A bigger one is truncated and the agent is told so |
| `timeout_minutes` | number | `20` | How long the whole job may run |

## Outputs

None. The result is a comment on the pull request, or a job summary in shadow mode.

## Dig deeper

### What the retro is built from

Rounds, what started each one and who started the work are read from the comments the implementing
workflow leaves, so a change to its round or hand-off comment markers has to be made here too. The
cost is every `ai-cost` line on the issue and the pull request, so it covers planning and review as
well as the rounds. A point the agent cannot tie to a round, a plan id or a review is dropped
before posting.
