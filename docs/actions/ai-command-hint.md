# AI command hint

Answers a comment that tried to run an AI command but could not: the command was not at the start
of the comment, or it was posted on the wrong kind of page. A command mentioned mid-sentence or
inside a quote is left alone.

Used by [`ai-plan`](../ai/ai-plan.md), [`ai-implement`](../ai/ai-implement.md) and
[`ai-review`](../ai/ai-review.md), each in a job of its own that only runs for such a comment.

```yaml
- uses: uniquesca/ci/ai-command-hint@v11
  with:
    command: /ai-plan
    works_on: issue
    token: ${{ github.token }}
```

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `command` | yes | | The command, e.g. `/ai-plan` |
| `works_on` | yes | | Where the command runs - `issue`, `pull-request` or `both` |
| `token` | yes | | Github token. Needs `issues: write`, and `pull-requests: write` to answer on a pull request |

## Outputs

This action produces no outputs.
