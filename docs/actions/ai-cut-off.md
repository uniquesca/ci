# AI cut off

Cleans up after an AI run that stopped before its own clean-up ran, most likely because it ran out
of time: says so on the issue or pull request, swaps 👀 for 😕, and takes the progress label off.
Never fails the job.

Used by [`ai-plan`](../ai/ai-plan.md), [`ai-implement`](../ai/ai-implement.md) and
[`ai-review`](../ai/ai-review.md), each in a `finish` job after the main one.

```yaml
- uses: uniquesca/ci/ai-cut-off@v11
  with:
    number: ${{ github.event.issue.number }}
    message: 'AI Plan did not finish. Comment `/ai-plan` here to try again.'
    subject: ${{ github.event.comment.node_id }}
    label: 'ai:planning'
    token: ${{ github.token }}
```

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `number` | yes | | Issue or pull request the run was working on |
| `message` | no | | What did not finish and how to try again. A line saying the run was stopped, with a link to it, goes under it. Empty posts nothing |
| `subject` | no | | GraphQL node id of the comment or review that started the run. Its 👀 is swapped for 😕. Empty leaves reactions alone |
| `label` | no | | Label to take off. Empty takes nothing off |
| `review_token` | no | | Post the message as an AI Review failure review with this token, so it starts the next round the way a finished review does. Falls back to a comment. Empty posts a comment |
| `token` | yes | | Github token. Needs `issues: write`, and `pull-requests: write` on a pull request |

## Outputs

This action produces no outputs.
