# AI Plan

AI workflows: **Plan** · [Implement](ai-implement.md) · [Review](ai-review.md)

Turns a Github issue into an implementation plan. Somebody comments `/ai-plan` on an issue, an
agent reads the issue and the real code, and the plan is posted back as a comment on the same
issue.

The plan is the specification for everything that follows, and it lives on the issue in exactly
one copy. There is no second, machine-readable version: you can edit it, tick steps off, or
reject it, and the implementing agent reads the same text you approved.

## How the three fit together

```
issue                                    pull request
-----                                    ------------
/ai-plan   -> plan posted
  (read it, correct it, re-run)
/ai-do     -> opens ------------------->  code to review
                                          |
                                          | Request changes   ->  another round
                                          | /ai-do            ->  another round
                                          |
                                          v
                                          AI Review can drive that loop by itself,
                                          for a bounded number of rounds
```

**The issue holds the plan. The pull request holds the review.** Once a pull request exists,
`/ai-do` on the issue stops doing anything except pointing at it. The issue stays the place the
plan lives, though, so `/ai-plan` keeps working - see [changing direction](#changing-direction).

## Integrating a repository

Add one workflow file to the repository that should get the commands. The planner and the
implementer are two jobs in it, and each only runs for the events and commands it cares about, so
the other is skipped.

```yaml
name: AI

on:
  issue_comment:
    types: [ created ]
  pull_request_review:
    types: [ submitted ]

jobs:
  ai-plan:
    permissions:
      contents: read
      issues: write
      pull-requests: read
    uses: uniquesca/ci/.github/workflows/ai-plan.yml@main
    secrets:
      ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}

  ai-implement:
    permissions:
      contents: write
      issues: write
      pull-requests: write
      checks: read
    uses: uniquesca/ci/.github/workflows/ai-implement.yml@main
    secrets:
      ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

[AI Review](ai-review.md) needs a second file, because it runs on a different event.

Four things to get right, all of which fail quietly rather than loudly:

* **The `permissions` block belongs on the calling job.** A called workflow can only narrow the
  token it is given, never widen it.
* **The file has to be on the default branch.** Github always runs the default-branch version of
  an `issue_comment` workflow, so this cannot be tested from a feature branch.
* **Both events are needed.** `issue_comment` carries the commands; `pull_request_review` is what
  lets a review start another implementing round. Leave the second out and reviews silently do
  nothing.
* **`ANTHROPIC_API_KEY` has to be listed explicitly**, or `secrets: inherit`. Secrets do not
  cross the `workflow_call` boundary on their own.

Add the key as an Actions secret under **Settings → Secrets and variables → Actions**, at
repository or organisation level. You do *not* need the Claude Github App installed.

Every input to every workflow has a description in the workflow file itself
(`.github/workflows/ai-plan.yml` and friends) - read those rather than a list here, which would
only go stale. The ones worth knowing about are called out where they matter.

## Triggering the planner

Comment `/ai-plan` on an issue. The command has to be at the very beginning of the comment.

**The issue body is what gets planned.** Anything you type after the command is ignored, so put
the task in the issue, not in the comment. An empty issue body gets a comment saying so, and
nothing is charged for it.

Only collaborators with **admin** or **write** access can run it. Github reports the `maintain`
role as `write` and `triage` as `read`, so owners, maintainers and developers can; triage and
read cannot. Anyone else gets a comment explaining why not. That gate is what stops a stranger
spending your API tokens.

Nothing appears until the plan is finished, which takes a few minutes. What comes back is one
comment: a summary of the approach, the steps as a real task list with checkboxes, risks and
unknowns, and concrete checks that would prove the work is done. The last line says who asked
for it and roughly what the run cost.

## Adjusting the plan

Three ways, depending on how wrong it is.

**A small correction — just edit the comment.** There is no second copy to keep in sync, so
editing the markdown *is* editing the plan. Fix a path, drop a step, reword a detail. Nothing
else needs to happen.

**Feedback and revision — say what you want, then run `/ai-plan` again.** The agent reads the
whole thread, takes the most recent plan as its starting point, and applies whatever was asked
for after it was posted. Parts nobody objected to survive. Each run posts a new comment, and the
newest one is the current plan.

Editing and re-running mix in one direction only: a re-run reads your edited comment as its
starting point, so your edits survive, but the agent may reword around them. If some wording has
to stay exactly as written, say so in a follow-up comment.

**The task itself was wrong — edit the issue body, then run `/ai-plan` again.** The body is the
task. When the task is wrong, fix it there rather than arguing with the plan.

### Changing direction

`/ai-plan` keeps working after the code exists, and it is the only way to say "the whole approach
is wrong" rather than "this line is wrong". Every implementing round re-reads the plan off the
issue, so a revision reaches the code without anybody copying it anywhere, and the open pull
request gets a comment linking to the revision.

What it does not do is undo the code already pushed. Expect the next round to be a large one.

## Dig deeper

### Getting better plans

The single most effective thing is an **`AGENTS.md` or `CLAUDE.md` in the repository being
planned** - not in this one. The agent reads it first, and it saves several turns of inferring
conventions from a sample of files. Worth putting in it: how to build and test, how the code is
laid out, the conventions a change is expected to follow, and anything surprising a newcomer
would get wrong.

### What the agent can and cannot do

It has **no shell and no network**. It cannot fetch the issue, so the workflow writes the issue
and its comments into the checkout first and the agent only ever reads files. That is also what
keeps issue text out of the workflow file: `gh` writes it straight to disk, so nothing written by
whoever opened the issue is ever expanded into YAML.

The plan step is read-only in two independent ways. The job holds `contents: read`, so nothing
the agent does to the checkout can be pushed - that is the boundary that actually holds. Editing,
writing and shell tools are switched off as well, which is defence in depth and stops turns being
spent on work that would be discarded. If you extend this workflow, keep `contents: read`: it is
doing more work than the tool list.

The checkout is always of the **default branch**. An `issue_comment` event carries no ref to
infer one from, and planning an issue is a question about the mainline rather than about whichever
branch happens to be open.

### Revising a plan safely

Comments carry an `is_bot` flag, and the agent is told to treat only bot-authored comments
carrying the `<!-- ai-plan -->` marker as previous plans. Without that, anyone able to comment
could paste a marker and have the next run "revise" a plan they wrote themselves.

### When a run goes wrong

A failed run comments on the issue rather than going red where nobody looking at the issue can
see it, and it says why the agent stopped where the log recorded a reason - an exhausted credit
balance, a hit turn limit and a genuine bug look identical otherwise.

Three places to look afterwards:

* **The `Show what the agent did` step**, always printed, including on failed runs - the agent's
  own narration and its tool calls, pulled out of the transcript. On a failure this shows how far
  it got.
* **The run summary**, which has a copy of the finished plan. A run that produces a plan but fails
  to comment has not lost it.
* **The raw transcript** - set `debug: true` on the calling job. Do not turn this on in a
  **public repository**: a tool result is whatever the agent just read out of the code, so it
  publishes file contents to a log anyone can read.

### Costs

Every run costs Anthropic API tokens against your key, and planning reads the repository, so it
is a model call per turn rather than a single prompt. The cost line on the plan is the agent's own
estimate from its token counts, not a billed figure - treat it as an order of magnitude. Keep the
command gated to the people who should be spending it.

Github caps a comment at 65536 characters. The agent is told to stay well under that; a plan that
would exceed it is a sign the issue should be split.
