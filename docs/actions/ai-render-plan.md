# AI render plan

Checks the plan a planning agent wrote as JSON against the plan before it, and renders it as the
comment posted on the issue: what a person needs to read, with the whole plan folded under it as
JSON. Never fails the job: a plan it cannot use falls back to the final
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
| `cost_line` | no | | The `cost_line` output of [`ai-run-report`](ai-run-report.md) |

## Outputs

| Output | Description |
|---|---|
| `rendered` | Whether the JSON plan was usable - `true` or `false` |
| `plan_file` | The rendered plan, with the whole plan folded under it as JSON - or a copy of `fallback_file`. Empty when there was neither |
| `has_qa` | Whether the plan has QA acceptance criteria - `true` or `false` |
| `cost_line` | The `cost_line` input with [what was posted](../ai/ai-costs.md#what-the-hidden-line-holds) added. Empty when the input was |

## Dig deeper

### What is checked

`src/ai-plan.js` has the shape. Ids that are malformed, in the wrong section or used twice are
dropped, and so are references to steps that do not exist - each with a warning. An id the previous
plan had that this one neither uses nor retires is retired as "dropped", and retired ids keep their
reason from one revision to the next and are never used again. A plan without steps or checks is
refused. The `## QA acceptance criteria` section stays in the part a person sees, where
[`ai-qa-criteria`](ai-qa-criteria.md) copies it from. A plan over 60,000 bytes keeps every item but
has its text cut, risks and QA steps before step details, until it fits Github's comment limit. The
agent's text cannot end or fake a section: a one-line field loses its line breaks, and a line that
starts with a heading, `---` or `<details>` is shown as text. A phrase the style guide rules out,
such as "let me" or a path under `.ai-plan/`, is posted as written and reported as a warning.
