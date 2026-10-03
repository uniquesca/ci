# AI react

Adds or removes a reaction on the comment or review that started an AI run, so whoever typed the
command can see it was picked up and how it ended. Never fails the job.

Used by [`ai-plan`](../ai/ai-plan.md), [`ai-implement`](../ai/ai-implement.md) and
[`ai-review`](../ai/ai-review.md).

```yaml
- uses: uniquesca/ci/ai-react@v11
  with:
    subject: ${{ github.event.comment.node_id }}
    add: EYES
    token: ${{ github.token }}
```

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `subject` | yes | | GraphQL node id of the comment or review. Empty does nothing |
| `add` | no | | Reaction to add, as a GraphQL `ReactionContent` - `EYES`, `ROCKET`, `CONFUSED` and so on |
| `remove` | no | | Reaction of this token's identity to remove |
| `token` | yes | | Github token. Needs `issues: write` or `pull-requests: write` |

## Outputs

This action produces no outputs.

## Dig deeper

### Why GraphQL

The REST reactions endpoints cover issue comments but not pull request reviews. GraphQL
`addReaction` and `removeReaction` take the node id of either, and removing by content needs no
reaction id to be carried between steps.
