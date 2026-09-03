# AI stage issue

Writes a Github issue, its comments and its most recent plan into the checkout, for an agent that
has no shell and no network of its own.

Used by [`ai-plan`](../ai/ai-plan.md) and [`ai-implement`](../ai/ai-implement.md).

```yaml
- uses: uniquesca/ci/ai-stage-issue@v11
  id: issue
  with:
    issue: ${{ github.event.issue.number }}
    repository: ${{ github.repository }}
    token: ${{ github.token }}
```

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `issue` | yes | | Number of the issue to stage |
| `repository` | yes | | Repository the issue belongs to, in `owner/name` form |
| `token` | yes | | Github token used to read the issue |
| `directory` | no | `.ai-plan` | Directory inside the checkout to write into |

## Outputs

| Output | Description |
|---|---|
| `title` | Title of the issue, suitable for use as a pull request title |
| `has_plan` | Whether a plan comment was found on the issue - `true` or `false` |
| `plan_file` | Path to the staged plan, empty when the issue has no plan yet |
| `plan_url` | Link to the comment the staged plan came from, empty when there is none |
| `plan_base` | Branch the staged plan was written against, empty when the plan does not record one |
| `plan_created_at` | When the plan comment was posted, as an ISO 8601 UTC timestamp. Empty when there is no plan |

## Dig deeper

### What lands in the directory

| File | Contents |
|---|---|
| `issue.json` | `number`, `title` and `body` |
| `comments.json` | Every comment, as `author`, `is_bot`, `created_at`, `url` and `body`, oldest first |
| `plan.md` | The plan, when the issue has one. Absent otherwise |

### Why files and not step outputs

A planning or implementing agent runs without a shell and without network access, so it cannot fetch
any of this for itself. Writing it into the checkout is also what keeps issue text out of the
calling workflow: `gh` writes straight to disk, so **nothing written by whoever opened the issue is
ever expanded into YAML**.

### Which comment counts as the plan

The newest **bot-authored** comment starting with `<!-- ai-plan -->`. The bot filter matters:
anybody able to comment on the issue can paste a marker of their own, and `is_bot` in
`comments.json` is what lets the agent apply the same rule to everything else it reads.

`plan_base` comes from a metadata line the planning workflow writes directly under that marker. A
plan posted before that line existed has prose on its second line, which is not JSON, so
`plan_base` comes back empty and the caller falls back to its own default.

`plan_created_at` is that comment's own timestamp, which is how a caller with a watermark spots a
plan revised under work already done -
[`ai-implement`](../ai/ai-implement.md#when-the-plan-is-revised-under-the-work) compares it against
the end of its last round. It is `created_at` and not `updated_at`, so editing a plan in place is
not a revision.
