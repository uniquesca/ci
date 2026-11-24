# AI work order

Builds the work order the coding agent works from, posts it on the pull request, or reads the
newest one back from there. The work order holds the plan, the task and the comments made on the
plan, so the rounds on a pull request never go back to where the work was asked for.

Used by [`ai-implement`](../ai/ai-implement.md).

```yaml
- uses: uniquesca/ci/ai-work-order@v11
  id: order
  with:
    mode: fetch
    pull_request: ${{ steps.event.outputs.pull_request }}
```

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `mode` | yes | | `build` it from what [`ai-stage-issue`](ai-stage-issue.md) staged, `post` it on `pull_request`, or `fetch` the newest one from `pull_request` |
| `directory` | no | `.ai-plan` | Directory inside the checkout the order and the plan files are written to and read from |
| `source` | no | | For `build`: where the work was asked for, as JSON, such as `{"kind":"issue","repository":"owner/name","number":12,"url":"..."}` |
| `plan_url` | no | | For `build`: the `plan_url` output of `ai-stage-issue` |
| `plan_base` | no | | For `build`: the `plan_base` output of `ai-stage-issue` |
| `plan_created_at` | no | | For `build`: the `plan_created_at` output of `ai-stage-issue` |
| `pull_request` | no | | For `post` and `fetch`: the pull request number |
| `repository` | no | `${{ github.repository }}` | For `post` and `fetch`: the repository, in owner/name form |
| `token` | no | `${{ github.token }}` | For `post` and `fetch`: a token that can read and comment on pull requests. Only comments by a bot count |

## Outputs

| Output | Description |
|---|---|
| `found` | Whether there is a work order - `true` or `false`. Always `true` after `build` |
| `file` | Path to the work order, empty when there is none |
| `source` | Where the work was asked for, as JSON |
| `title` | Title of the task, suitable for use as a pull request title |
| `has_plan` | Whether the order holds a plan - `true` or `false` |
| `plan_file` | Path to the plan as a person sees it, written next to the order. Empty when there is no plan |
| `plan_url` | Link to where the plan was posted |
| `plan_base` | Branch the plan was written against, empty when it did not say |
| `plan_created_at` | When the plan was posted, as an ISO 8601 UTC timestamp |

## Dig deeper

### Where it is kept

A comment on the pull request, with the `<!-- ai-work-order -->` marker and the JSON folded under it.
`fetch` reads the newest one written by a bot, since anybody can paste the marker. A work order too
large for a comment is stored gzipped and base64-encoded on a hidden line. `build` takes the issue
and its comments out of the directory once they are in the order, so the agent reads them in one
place only; `plan.json` and `plan.md` stay for the steps that read the plan after the agent.
