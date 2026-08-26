# AI post review

Submits the review a reviewing agent wrote as a real Github review, with its inline comments
validated against the lines the diff actually has.

Used by [`ai-review`](../ai/ai-review.md).

```yaml
- uses: uniquesca/ci/ai-post-review@main
  id: review
  with:
    pull_request: ${{ steps.pr.outputs.number }}
    repository: ${{ github.repository }}
    token: ${{ steps.app_token.outputs.token }}
    head_sha: ${{ steps.pr.outputs.head_sha }}
```

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `pull_request` | yes | | Number of the pull request to review |
| `repository` | yes | | Repository the pull request belongs to, in `owner/name` form |
| `token` | yes | | Github token the review is submitted with. **Neither `GITHUB_TOKEN` nor the app that opened the pull request** - see below |
| `head_sha` | yes | | Commit the review is submitted against |
| `review_file` | no | `.ai-review/review.json` | File the agent wrote: an object with `verdict`, `summary` and `comments` |
| `diff_file` | no | `.ai-review/diff.patch` | The unified diff the agent reviewed. Every inline comment is checked against it |
| `marker` | no | `<!-- ai-review -->` | Hidden first line of the review body |
| `max_comments` | no | `30` | How many inline comments one review may carry |
| `max_length` | no | `4000` | Longest inline comment body, in characters. Anything over is truncated rather than dropped |

## Outputs

| Output | Description |
|---|---|
| `submitted` | Whether a review was submitted - `true` or `false` |
| `event` | What was actually submitted - `REQUEST_CHANGES` or `COMMENT`. Empty when nothing was |
| `verdict` | The verdict the agent asked for - `changes_requested` or `comment` |
| `comments_posted` | How many inline comments the submitted review carries |
| `comments_dropped` | How many inline comments were rejected before submitting |

## Dig deeper

### The token, and the two things it must not be

Supply an installation token for a Github App, which is
what [`ai-review`](../ai/ai-review.md) mints and passes in. Two identities cannot do this job, and
they fail differently:

* **The app that opened the pull request.** Github **rejects `REQUEST_CHANGES` from the identity
  that opened it**, so the verdict is refused outright - and handled, by the downgrade below.
* **`GITHUB_TOKEN`.** This one is accepted: the run's own token did not open the pull request, so
  the review is submitted and does block the merge. Github simply raises no `pull_request_review`
  event for it, so **nothing starts the next implementing round**, and there is no error anywhere to
  say so.

When it happens anyway the verdict is downgraded to a comment rather than lost, with a warning
saying so - the inline comments survive a comment review perfectly well.

### Approving is not an option

Only `changes_requested` and `comment` are meaningful verdicts; merging is a person's decision. An
unknown verdict is submitted as a comment, with a warning.

### Inline comments, and why some go missing

**Github rejects the entire review - summary, every comment, the lot - if one inline comment names a
line the diff does not contain.** So the acceptable positions are worked out here from `diff_file`
and the bad comments are dropped, rather than finding out on submit and losing the review.

A comment may sit on any line of a hunk on the `RIGHT` side - added lines and context lines,
numbered in the new file. Comments are also dropped for an empty body, a non-numeric line, or being
over `max_comments`. Every dropped one is named in the log.

With no `diff_file` at all, the summary is submitted on its own.

### It does not fail the run

A review that could not be submitted is a warning and an output the caller acts on, since the caller
still has the agent's summary to post as a plain comment. The fallbacks, in order: as asked;
downgraded to a comment if Github said "your own pull request"; without the inline comments; as a
comment without them.

`head_sha` is pinned explicitly so that a push which landed since the diff was taken makes the review
outdated rather than silently misplaced.

`marker` is how [`ai-implement`](../ai/ai-implement.md) tells a review an agent wrote from one a
person wrote, which is what keeps its
[unattended round cap](../ai/ai-implement.md#the-round-cap) honest. Identity cannot answer that on
its own: which login the reviewer arrives as is the caller's to configure. Change the marker in one
place and you have to change it in both.
