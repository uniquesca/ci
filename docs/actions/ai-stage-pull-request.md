# AI stage pull request

Writes a pull request and everything asking for changes on it - review threads, review bodies,
conversation comments and failing checks - into the checkout as one normalised feedback list.

Used by [`ai-implement`](../ai/ai-implement.md), which acts on the feedback, and by
[`ai-review`](../ai/ai-review.md), which reads it to see what has already been said.

```yaml
- uses: uniquesca/ci/ai-stage-pull-request@main
  id: staged
  with:
    pull_request: ${{ github.event.issue.number }}
    repository: ${{ github.repository }}
    token: ${{ github.token }}
    head_sha: ${{ steps.pr.outputs.head_sha }}
```

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `pull_request` | yes | | Number of the pull request to stage |
| `repository` | yes | | Repository the pull request belongs to, in `owner/name` form |
| `token` | yes | | Github token used to read it. Needs `checks: read` on top of `pull-requests: read` |
| `head_sha` | yes | | Commit the checks are read from - the tip of the branch, not the merge commit |
| `directory` | no | `.ai-review` | Directory inside the checkout to write into |
| `round_marker` | no | `<!-- ai-implement-round -->` | First line of the round comment the caller posts. Used to count rounds and find the watermark |
| `reply_marker` | no | `<!-- ai-implement-reply -->` | First line of a reply the implementing agent already posted |
| `include_answered_threads` | no | `false` | Keep threads the implementing agent has already answered |
| `ignore_check_patterns` | no | `(ai.implement\|ai.plan)` | Case-insensitive regular expression matching check runs to leave out |
| `max_annotations` | no | `20` | How many annotations of a failing check to stage |

## Outputs

| Output | Description |
|---|---|
| `has_feedback` | Whether anything is asking for changes - `true` or `false` |
| `feedback_count` | How many feedback items were staged, across every source |
| `thread_count` | How many unresolved review threads were staged |
| `check_count` | How many failing check runs were staged |
| `checks_pending` | How many check runs had not finished yet |
| `round` | Which round this run is, counting from 1 |
| `unattended_rounds` | How many rounds in a row were triggered by a bot, counting back from the most recent |
| `since` | Timestamp the time-based sources were filtered from |
| `staged_at` | Timestamp taken before anything was read. The caller records it in the round comment, and it becomes the next round's `since` |
| `title` | Title of the pull request |

## Dig deeper

### What lands in the directory

| File | Contents |
|---|---|
| `pull-request.json` | Number, title, state, draft, body, head and base branch, url and size |
| `feedback.json` | Every item asking for changes, one shape, oldest first |

A feedback item is `{id, source, author, is_bot, created_at, url, anchor, state, answered,
reply_target, text}`, where `source` is `thread`, `review`, `comment` or `check`. A `thread` carries
an `anchor` with the file, line and diff hunk, and a `reply_target` that
[`ai-post-review-replies`](ai-post-review-replies.md) can answer. The rest carry `null` for both.

### Which feedback is included

| Source | Rule |
|---|---|
| Review threads | Unresolved, regardless of when they were written. `state` is `outdated` when the code under the comment has moved |
| Review bodies | Non-empty, submitted since `since`. `state` is the lowercased review state - `changes_requested`, `commented`, `approved` |
| Conversation comments | Written since `since`, except the workflow's own round comments |
| Failing checks | Currently `failure`, `timed_out` or `action_required` on `head_sha` |

State-based sources ignore `since` entirely. Time-based ones are read from the end of the previous
round, or from the pull request's creation on the first round.

A thread whose newest comment carries `reply_marker` has been answered and is left out, or every
round would re-address the same comment forever. A human replying after the bot puts the thread back
in play. `include_answered_threads` turns the exception off, which is what a reviewing agent wants -
those threads are where its own last concern was met or argued with.

Only the first 100 review threads are staged, with a warning when there are more.

### Rounds, and the two counters

Each finished round leaves one `round_marker` comment carrying its own metadata, and those comments
are the history. `round` is how many have run plus one. `unattended_rounds` counts consecutive
bot-triggered rounds back from the newest, and **any round a person asked for resets it to zero**. A
round whose metadata cannot be parsed counts as unattended, erring towards stopping rather than
looping.

### Checks

`ignore_check_patterns` exists because the AI workflows report their own check runs on the very
commit being staged, and without it the previous round's red status arrives as a code defect. Keep
the pattern covering whatever the AI workflows are named in your repository.

`checks_pending` above zero means the commit is **not known to be green, only not known to be red**.
It is said out loud in the staged data too, so an agent reading an empty failure list ten seconds
after a push does not report the branch as passing.

A failing check becomes one item rather than one per annotation, with at most `max_annotations` of
them quoted - the agent has a shell to run the linter again for the rest.

When `checks: read` is missing the checks are staged as an empty list with a warning, rather than
failing.

### Why files and not step outputs

The agent has a shell here, but no network and no token, so it cannot fetch any of this for itself.
Writing it to disk also keeps review text out of the calling workflow - `gh` and `jq` write straight
to files, so **nothing a reviewer typed is ever expanded into YAML**. Scratch files live under
`$RUNNER_TEMP`, since the calling workflow commits its working tree.
