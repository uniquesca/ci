# AI render report

Renders the `report.json` an implementing agent wrote into the pull request description or the
round comment, and keeps the status block in the pull request description current. Never fails the
job: a report it cannot use falls back to the final message the agent ended on.

Used by [`ai-implement`](../ai/ai-implement.md).

```yaml
- uses: uniquesca/ci/ai-render-report@v11
  id: render
  with:
    fallback_file: ${{ steps.report.outputs.result_file }}
    label: Update on round 3
```

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `report_file` | no | `.ai-review/report.json` | File the agent wrote |
| `fallback_file` | no | | What to post when the report is missing or unusable - the agent's final message |
| `plan_file` | no | `.ai-plan/plan.json` | The plan the work was built from. A reference to an id it does not have is dropped |
| `cost_line` | no | | The `cost_line` output of [`ai-run-report`](ai-run-report.md) |
| `label` | no | | Heading of the status block, e.g. `Update on round 3`. Empty on the first run, whose status block shows only the open decisions |
| `under_status` | no | `false` | Whether the body goes under the status block, which already gives the open decisions |
| `pull_request` | no | | Pull request whose status block to replace. Empty leaves every pull request alone |
| `token` | no | | Github token, with `pull-requests: write` when `pull_request` is set |

## Outputs

| Output | Description |
|---|---|
| `rendered` | Whether the report was usable - `true` or `false` |
| `body_file` | What a reviewer reads first, or a copy of `fallback_file`. Empty when there was neither |
| `details_file` | What changed and the checks the agent ran, folded, to go after `body_file` and the QA criteria. Empty when there is none |
| `status_file` | The status block, markers included. Empty when the report was not usable |
| `headline` | The headline the agent gave |
| `cost_line` | The `cost_line` input with [what was posted](../ai/ai-costs.md#what-the-hidden-line-holds) added. Empty when the input was |

## Dig deeper

### The report and the status block

The agent writes a `headline`, a two-or-three-sentence `summary` and five lists - `done`, `notes`,
`not_done`, `verification` and `decisions` - whose items can carry plan ids in `refs`;
`src/ai-report.js` has the shape and the layout, and leaves empty sections out. The status block
sits between `<!-- ai-status -->` markers under the links in the pull request description. It shows
the open decisions, and from round 2 the latest round's headline under `label`; it also carries the
report itself base64-encoded in a hidden comment, which is where
[`ai-stage-pull-request`](ai-stage-pull-request.md) reads it back as `last-report.json` for the next
round and the reviewer. A report over 12,000 bytes is cut to fit Github's size limit next to the
held-back workflow changes, leaving out check results first and the questions for a person last,
with a line saying how many items were left out. A reference to an id `plan_file` does not have is
dropped with a warning, and a phrase the style guide rules out is reported as one.