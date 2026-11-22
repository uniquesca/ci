# AI hold workflow changes

Takes an agent's edits under `.github/workflows/` out of the working tree before the commit, and
appends them to its report as a `git apply` command for a person to run. Github refuses a push
touching workflow files from an identity without the `workflows` permission, and that refusal
would lose the rest of the work too.

Used by [`ai-implement`](../ai/ai-implement.md).

```yaml
- id: workflow_changes
  uses: uniquesca/ci/ai-hold-workflow-changes@v11
  with:
    report_file: ${{ steps.render.outputs.body_file }}
```

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `report_file` | no | `''` | The agent's rendered report, which the patch is appended to. Empty if there is none |

## Outputs

| Output | Description |
|---|---|
| `held_back` | Comma-separated workflow files that were held back. Empty if none were |
| `report_file` | The report with the patch appended. Empty if nothing was held back |

## Dig deeper

### A long patch

A patch over 20,000 characters is not pasted into the report, which links to the run summary
instead. The summary always has the full patch.
