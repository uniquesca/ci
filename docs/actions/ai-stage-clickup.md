# AI stage ClickUp task

Writes a ClickUp task, its parent and linked tasks, its comments since the last plan and that plan
into the checkout, for an agent that has no network of its own. The ClickUp counterpart of
[`ai-stage-issue`](ai-stage-issue.md).

Used by [`ai-plan`](../ai/ai-plan.md) and [`ai-implement`](../ai/ai-implement.md).

```yaml
- uses: uniquesca/ci/ai-stage-clickup@v11
  id: task
  with:
    task: ${{ inputs.clickup_task }}
    token: ${{ secrets.CLICKUP_TOKEN }}
```

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `task` | yes | | ClickUp task ID |
| `token` | yes | | API token of the ClickUp user that posts the plans (System Bot). Its own comments are what count as plans |
| `directory` | no | `.ai-plan` | Directory inside the checkout to write into |
| `plan_json` | no | `false` | Also read the plan's JSON from the newest `ai-plan.json` attachment the planner uploaded, into `plan.json` and `plan.md` |

## Outputs

| Output | Description |
|---|---|
| `title` | Name of the task |
| `url` | Link to the task |
| `display_id` | The task's custom ID, such as `DV-4686`, or its own ID when it has none |
| `has_plan` | Whether a plan was found - `true` or `false`. With `plan_json`, whether the attachment was |
| `plan_base` | Branch the plan was written against, from the attachment. Empty without `plan_json` |
| `plan_created_at` | When the plan was written, as an ISO 8601 UTC timestamp, from the attachment. Empty without `plan_json` |

## Dig deeper

### What counts as the plan

The comments hold only the readable plan: System Bot's comment starting with the `AI plan` line, and
the risks, steps and QA comments posted after it. Only the token's own comments count, since anybody
can type that line. Replies in comment threads are staged with the comment they answer. The plan's
JSON is in the `ai-plan.json` attachment `ai-plan` uploads; ClickUp keeps every upload, and the
newest one counts.
