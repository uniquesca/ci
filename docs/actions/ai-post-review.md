# AI post review

Renders the findings a reviewing agent wrote into a Github review and submits it - the verdict
derived from their severity, each placed inline where the diff has its line.

Used by [`ai-review`](../ai/ai-review.md).

```yaml
- uses: uniquesca/ci/ai-post-review@v11
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
| `review_file` | no | `.ai-review/review.json` | File the agent wrote: an object with `headline`, `findings` and `qa_focus` - see below |
| `diff_file` | no | `.ai-review/diff.patch` | The unified diff the agent reviewed. Every inline comment is checked against it |
| `plan_file` | no | `.ai-plan/plan.json` | The plan the change was built from. A reference to an id it does not have is dropped |
| `marker` | no | `<!-- ai-review -->` | Hidden first line of the review body |
| `footer` | no | | Markdown added under a rule at the end of the review body |
| `cost` | no | | Hidden last line of the review body, the `cost_line` output of [`ai-run-report`](ai-run-report.md) - what the run cost, where a cost report can read it back. [What was posted](../ai/ai-costs.md#what-the-hidden-line-holds) is added to it |
| `max_comments` | no | `30` | How many findings one review may place inline |
| `max_length` | no | `1500` | Longest finding body, in characters. Anything over is truncated rather than dropped |

## Outputs

| Output | Description |
|---|---|
| `submitted` | Whether a review was submitted - `true` or `false` |
| `event` | What was actually submitted - `REQUEST_CHANGES` or `COMMENT`. Empty when nothing was |
| `verdict` | `changes_requested` when a finding is high, `comment` otherwise |
| `comments_posted` | How many inline comments the submitted review carries |
| `comments_dropped` | How many findings named a line but went into the body instead - off the diff, or over the cap |
| `body_file` | The rendered review body, for a caller to post when the review could not be submitted |
| `cost_line` | The `cost` input as the review carries it, for a caller posting `body_file` |

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

### The review file, and the verdict

The agent writes `headline`, one sentence, and `findings`, each with a `severity` of `high`,
`medium` or `low`, a `title`, a `body`, and optionally `path`, `line` and `refs` (plan ids). One
high finding requests changes; anything else comments. Approving is not an option - merging is a
person's decision. `src/ai-review.js` lays the body out: a verdict line, the headline, a count by
severity, then every finding from high to low - by its title where it is an inline comment, in full
where it is not - and `qa_focus` as one line. Once the review is posted, the list is linked to its
inline comments. Anything malformed is normalised or dropped with a warning, never allowed to fail
the review - including a reference to an id `plan_file` does not have. A phrase the style guide
rules out is reported as a warning.

### Inline comments, and why some are not

**Github rejects the entire review - body, every comment, the lot - if one inline comment names a
line the diff does not contain.** So the acceptable positions are worked out here from `diff_file`,
and a finding whose line is not one of them - or that is over `max_comments` - goes into the review
body with its text instead of inline.

A comment may sit on any line of a hunk on the `RIGHT` side - added lines and context lines,
numbered in the new file. With no `diff_file` at all, every finding goes into the body.

### It does not fail the run

A review that could not be submitted is a warning and an output the caller acts on, since the caller
still has `body_file` to post as a plain comment. The fallbacks, in order: as asked;
downgraded to a comment if Github said "your own pull request"; without the inline comments; as a
comment without them. Without the inline comments, the body carries every finding's text, and so
does `body_file`. A body too long for Github loses the text of its least severe findings first, and
then the findings themselves, with a line saying how many were left out.

`head_sha` is pinned explicitly so that a push which landed since the diff was taken makes the review
outdated rather than silently misplaced.

`marker` is how [`ai-implement`](../ai/ai-implement.md) tells a review an agent wrote from one a
person wrote, which is what keeps its
[unattended round cap](../ai/ai-implement.md#the-round-cap) honest. Identity cannot answer that on
its own: which login the reviewer arrives as is the caller's to configure. Change the marker in one
place and you have to change it in both.
