# AI post review replies

Posts the implementing agent's answer to each review thread it was given, from a file the agent
wrote.

Used by [`ai-implement`](../ai/ai-implement.md) at the end of a round.

```yaml
- uses: uniquesca/ci/ai-post-review-replies@main
  with:
    pull_request: ${{ steps.pr.outputs.number }}
    repository: ${{ github.repository }}
    token: ${{ github.token }}
```

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `pull_request` | yes | | Number of the pull request the replies belong to |
| `repository` | yes | | Repository the pull request belongs to, in `owner/name` form |
| `token` | yes | | Github token used to post the replies. Needs `pull-requests: write` |
| `replies_file` | no | `.ai-review/replies.json` | File the agent wrote, a JSON array of `{reply_target, body}` |
| `feedback_file` | no | `.ai-review/feedback.json` | The staged feedback the agent was given |
| `marker` | no | `<!-- ai-implement-reply -->` | Hidden first line added to every reply |
| `max_replies` | no | `50` | How many replies may be posted in one round |
| `max_length` | no | `4000` | Longest reply body, in characters. Anything over is truncated rather than dropped |

## Outputs

| Output | Description |
|---|---|
| `posted` | How many replies were posted |
| `skipped` | How many entries were rejected |

## Dig deeper

### Every target is checked against the staged feedback

The agent read a pull request body and review comments any collaborator can write, so what it hands
back is untreated input. A reply is only posted to a thread whose `reply_target` appears in
`feedback_file` - the list [`ai-stage-pull-request`](ai-stage-pull-request.md) wrote for this round.
The reply endpoint is scoped to this pull request, so a wrong identifier would fail rather than post
somewhere unexpected, but there is no reason to try it.

Duplicates are dropped in the order the agent wrote them, so one thread gets one answer. Empty
bodies and non-numeric targets go too, and the count ends up in `skipped` with a warning naming how
many of how many.

Bodies are moved from file to request by `jq` alone, never through a shell word - a review comment
can contain anything, including quoted shell.

### Nothing here fails the run

By the time this executes the work is already committed and pushed, so a rejected reply must not turn
a good round red. A missing `replies_file` is not an error either: an agent that answered in its
round summary alone had a worse round, not a failed one.

### The marker

`marker` is the first line of every reply, and it is what later rounds use to tell a thread the agent
has already answered from one still waiting for it - see `reply_marker` on
[`ai-stage-pull-request`](ai-stage-pull-request.md). The two have to match, or every round
re-addresses the same comments.
