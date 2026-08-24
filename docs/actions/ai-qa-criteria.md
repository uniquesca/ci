# AI QA criteria

Copies the QA acceptance criteria out of a plan and into the pull request body, so a tester never
has to go back to the issue for them.

Used by [`ai-implement`](../ai/ai-implement.md) and [`ai-plan`](../ai/ai-plan.md).

```yaml
- uses: uniquesca/ci/ai-qa-criteria@main
  id: qa
  with:
    pull_request: ${{ steps.pr.outputs.number }}
    repository: ${{ github.repository }}
    token: ${{ github.token }}
    # What `ai-stage-issue` staged, or whatever file the plan is in
    plan_file: ${{ steps.issue.outputs.plan_file }}
    plan_url: ${{ steps.issue.outputs.plan_url }}
```

The copy is a marked block, replaced in place every time this runs, so calling it again after the
plan changes is the whole update. Nothing here fails the run.

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `pull_request` | yes | | Number of the pull request whose body carries the criteria |
| `repository` | yes | | Repository the pull request belongs to, in `owner/name` form |
| `token` | yes | | Github token the body is edited with. Needs `pull-requests: write` |
| `plan_file` | no | `.ai-plan/plan.md` | The plan to read the criteria out of |
| `plan_url` | no | | Link to the plan comment, for the line above the criteria. Left out when empty |
| `section` | no | `QA acceptance criteria` | Heading to copy, without the `##` |
| `marker` | no | `<!-- ai-qa-criteria -->` | Hidden line that opens the block |
| `end_marker` | no | `<!-- /ai-qa-criteria -->` | Hidden line that closes it |

## Outputs

| Output | Description |
|---|---|
| `synced` | Whether the body now carries the criteria - `true` or `false` |
| `criteria` | How many `**QA<n>**` ids the plan section holds. `0` when there was nothing to copy |

## Dig deeper

### What gets copied

Everything under `## <section>` up to the next `##` heading, verbatim. A `###` subheading inside the
section is part of it and does not end it.

The one thing dropped is the `Retired:` line, where a revised plan records the
[ids](../ai/ai-plan.md#how-the-plan-is-numbered) it no longer asks for. That is bookkeeping between
two versions of the plan, and a tester should see what they have to test and nothing else. The plan
on the issue still has it.

A plan with no such section - one written before the section existed - leaves the body exactly as it
is, with `synced` coming back `false`. That is not an error.

### Where the block lands

Between `marker` and `end_marker` if the body already has both, otherwise appended at the end.

**A caller that cares where the block goes prints the empty pair when it composes the body**, which
is what [`ai-implement`](../ai/ai-implement.md) does - the criteria sit under what the agent did and
above the review instructions. Appending is the fallback for a body composed by somebody who never
had the chance: a pull request opened before this existed, or one revived from a closed one.

A body carrying one marker and not the other is left alone with a warning. Somebody deleted a line
while editing, and guessing where the block ended would eat whatever they wrote after it.

### Why the copy is rewritable, and what refreshes it

The plan lives on the issue in one copy, and a second copy anybody can edit is a specification that
disagrees with itself. So this one is not a second copy to maintain: it is replaced wholesale
whenever the plan moves, and it says so, pointing at the plan as the original.

Two things call it. `ai-implement` seeds the block when it opens the pull request, and refreshes it
on a round that [worked to a revised plan](../ai/ai-implement.md#when-the-plan-is-revised-under-the-work).
`ai-plan` refreshes it the moment it revises a plan under an open pull request, which is the moment
the copy would otherwise start lying.

Editing the plan comment in place is deliberately not a revision anywhere in these workflows, so it
does not refresh the block either. Replan when the criteria themselves change.

### When nothing is written

The body is only edited when it would actually differ, so a call that changes nothing costs one API
read and leaves the description unmarked as edited.

A body that would come out over 65536 bytes - Github's cap - is left alone with a warning, as is one
that could not be read or written. In every case the criteria are still on the issue, and the run
stays green: this is presentation on top of work that is already pushed.
