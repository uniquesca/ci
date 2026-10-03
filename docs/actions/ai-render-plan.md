# AI render plan

Checks the plan a planning agent wrote as JSON against the plan before it, and renders it as the
markdown posted on the issue. Never fails the job: a plan it cannot use falls back to the final
message the agent ended on.

Used by [`ai-plan`](../ai/ai-plan.md).

```yaml
- uses: uniquesca/ci/ai-render-plan@v11
  id: render
  with:
    fallback_file: ${{ steps.report.outputs.result_file }}
```

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `plan_file` | no | `.ai-plan/new-plan.json` | File the agent wrote |
| `previous_file` | no | `.ai-plan/plan.json` | The plan before this one, as [`ai-stage-issue`](ai-stage-issue.md) staged it |
| `fallback_file` | no | | What to post when the plan is missing or unusable - the agent's final message |

## Outputs

| Output | Description |
|---|---|
| `rendered` | Whether the JSON plan was usable - `true` or `false` |
| `plan_file` | The rendered plan, or a copy of `fallback_file`. Empty when there was neither |
| `data` | The plan as a hidden HTML comment, to add to the posted comment. Empty for a fallback |
| `has_qa` | Whether the plan has QA acceptance criteria - `true` or `false` |

## Dig deeper

### What is checked

`src/ai-plan.js` has the shape. Ids that are malformed, in the wrong section or used twice are
dropped, and so are references to steps that do not exist - each with a warning. An id the previous
plan had that this one neither uses nor retires is retired as "dropped", and retired ids keep their
reason from one revision to the next. A plan without steps or checks is refused. The markdown keeps
the shape every reader of a plan parses: `## Steps`, `**C1**`, and the `## QA acceptance criteria`
section [`ai-qa-criteria`](ai-qa-criteria.md) copies.
