# Prepare the check reports

Creates the directory a job's QA checks write their reports into, and installs `$AI_REPORT` - the
helper each check runs through, which keeps what the check printed only when it failed.

```yaml
- name: Prepare the check reports
  id: reports
  uses: uniquesca/ci/qa-report@v11

- name: Run the end to end suite
  run: '"$AI_REPORT" run e2e.log ./run-e2e'

- name: Upload the check reports
  # A failed check is what leaves a report, and a failed step skips everything after it. The
  # directory is empty until the step above has run, and the upload rejects an empty path
  if: always() && steps.reports.outputs.report_dir != ''
  uses: actions/upload-artifact@v7
  with:
    name: ai-report-e2e
    path: ${{ steps.reports.outputs.report_dir }}
    retention-days: 1
    # `.ai-reports` is a dot-directory, and the upload excludes hidden files by default
    include-hidden-files: true
    # A job where every check passed has nothing to upload
    if-no-files-found: ignore
```

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `report_dir` | no | `$GITHUB_WORKSPACE/.ai-reports` | Directory the reports are written into |
| `max_bytes` | no | `200000` | Longest report to keep. Anything over keeps its first and last half |

## Outputs

| Output | Description |
|---|---|
| `report_dir` | Directory the reports are written into, for the `upload-artifact` path |

## Dig deeper

### The helper

`"$AI_REPORT" run <report> <command> [args...]` runs the command with its output going to the job
log and to `<report>`, and exits with the command's own status - so the check reports red exactly as
it would have, and `|| status=$?` still holds a failure back where the caller wants to act on it
first. The command is passed as arguments rather than a shell string:
`"$AI_REPORT" run psalm.log ./vendor/bin/psalm --config=psalm.xml.dist`. `"$AI_REPORT" trim <report>`
caps a report something else wrote, which is what [`cs-fix`](cs-fix.md) does with the fixer's own
output. Both take a name within the report directory rather than a path, because the directory is
baked into the helper when it is installed - so a step cannot send a report somewhere the upload
does not look.

### Why a passing check leaves nothing behind

These reports exist for [`ai-implement`](../ai/ai-implement.md), which collects every `ai-report-*`
artifact on a commit and tells the agent to read what is in them, because **an agent cannot read job
logs** - a red check run on its own carries nothing but `Process completed with exit code 1`. What a
*passing* check printed says nothing its green check does not, and the agent pays for it twice over:
once in the artifact it downloads and once in the context it spends reading it. So the report is
written while the check runs and deleted again if it passed, which leaves the artifact holding the
failures and nothing else, and a green job with nothing to upload.

### The cap

`max_bytes` is the ceiling on one report, and a report over it keeps its first and last half with a
line between them saying how much was cut. Both ends carry something a reader needs: a check states
its findings from the top and how many of them there are at the bottom. The cut is also announced as
a warning on the job, so a suite that routinely prints more than this is visible rather than quietly
half-read.
