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
/ai-plan   -> plan revised ------------>  /ai-do             ->  branch reconciled
                                          |                      with the revision
                                          v
                                          AI Review can drive that loop by itself,
                                          for a bounded number of rounds
```

**The issue holds the plan. The pull request holds the review.** Once a pull request exists,
`/ai-do` on the issue stops doing anything except pointing at it. The issue stays the place the
plan lives, though, so `/ai-plan` keeps working - see [changing direction](#changing-direction).

One thing travels along that first arrow besides the plan text: **the branch the plan was written
against**. `/ai-plan base=develop` records `develop` in the plan; a later `/ai-plan` revises it
against the same branch, and `/ai-do` builds on it - neither has to be told again. See
[planning against another branch](#planning-against-another-branch).

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

**The issue body is what gets planned.** Prose you type after the command is ignored, so put the
task in the issue, not in the comment. An empty issue body gets a comment saying so, and nothing
is charged for it.

### Planning against another branch

By default the planner reads the repository default branch. Name another one and it plans against
that instead - **once, on the first run.** The plan remembers the branch, and everything
afterwards follows it:

```
/ai-plan base=develop     # plans against develop, and records it
...feedback...
/ai-plan                  # replans against develop - no need to say it again
/ai-do                    # branch cut from develop, pull request targets develop
```

A bare `/ai-plan` on an issue that already has a plan is a **revision of that plan**, so it reads
the branch that plan was written against. Falling back to the default branch there would be the
same mistake in a smaller form - the revision would describe files that have moved and work
already done, and it would be arguing with feedback written about different code. The default
branch is only right when no plan has an opinion yet.

`/ai-do` inherits the same way - see
[basing the work on another branch](ai-implement.md#basing-the-work-on-another-branch).

Every plan says which branch it was written against, in its last line under
`Requested by`. That is the thing to check when a plan looks like it read the wrong code.

Only read when `base=` is the first thing after the command. A branch that does not exist gets a
comment and no plan, which costs nothing.

**To change branch, say so again.** Replanning with a different `base=` overrides what the last
plan recorded, and it is how you correct a plan written against the wrong branch - the new plan
records the new branch, and later runs follow that one. If a pull request is already open for the
issue and the revised plan names a different branch than it targets, the pull request gets told -
it cannot move itself, because a base is settled when the branch is created.

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
newest one is the current plan. Bare `/ai-plan` is right even when the first run named a
`base=`: the revision reads the [same branch](#planning-against-another-branch) without being
told again.

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

**Nothing rebuilds on its own.** Ask for an
[implementing round](ai-implement.md#when-the-plan-is-revised-under-the-work) when the branch should
be brought in line, and expect a large one - it takes out the code for a step the revision dropped
as well as adding what it now asks for. Any round that runs before then does the same, so revise
again rather than leaving a revision you are unhappy with. Editing the comment in place is free.

## Secrets

| Secret | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | yes | Anthropic API key used to call the AI planning agent |

## Inputs

| Input | Type | Default | Description |
|---|---|---|---|
| `command` | string | `/ai-plan` | Comment command that triggers the planning. Has to be at the very beginning of the comment |
| `allowed_permissions` | string | `admin write` | Space-separated repository permission levels allowed to run the command. Github reports the maintain role as `write` and triage as `read`, so this covers owners, maintainers and developers |
| `model` | string | `claude-opus-4-8` | Model used to produce the plan |
| `max_turns` | number | `50` | How many turns the agent may spend reading the repository before it has to plan with what it found |
| `agent_timeout_minutes` | number | `30` | How long the planning agent itself may run before it is given up on |
| `timeout_minutes` | number | `35` | How long the whole job may run. Keep it a few minutes above `agent_timeout_minutes` |
| `branch_prefix` | string | `ai-feature/` | Prefix of the branch [`ai-implement`](ai-implement.md) pushes to, used to find the pull request already implementing this issue. Keep the two the same |
| `debug` | boolean | `false` | Log the raw agent transcript as JSON. **Not for a public repository** - tool results contain whatever the agent read |

## Outputs

None. The plan is posted as a comment on the issue.

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

The checkout is of the **default branch unless a branch was named**, and nothing about it is
inferred from the event. An `issue_comment` carries no ref worth checking out, and planning an
issue is a question about the mainline rather than about whichever branch happens to be open -
[`base=`](#planning-against-another-branch), on this run or on the one that produced the plan
being revised, is the only way to point it elsewhere.

### Revising a plan safely

Comments carry an `is_bot` flag, and the agent is told to treat only bot-authored comments
carrying the `<!-- ai-plan -->` marker as previous plans. Without that, anyone able to comment
could paste a marker and have the next run "revise" a plan they wrote themselves.

### When a run goes wrong

A failed run comments on the issue rather than going red where nobody looking at the issue can
see it, and it says why the agent stopped where the log recorded a reason - an exhausted credit
balance, a hit turn limit and a genuine bug look identical otherwise.

**A run that overran `max_turns` is not a failed run, whatever its step says.** `claude-code-action`
checks the turn count after the agent has already stopped and fails its own step when the count came
out over the limit - which happens because the limit is not enforced on a long run, so the agent
finishes of its own accord and the check only notices afterwards
([#1577](https://github.com/anthropics/claude-code-action/issues/1577)). The plan is complete, so the
workflow posts it and puts a warning on the run instead of failing. A run genuinely cut off part-way
reports `error_max_turns`, and that one still fails with nothing posted.

Not every stop is a failure. An empty issue body, or a `base=` naming a branch that does not exist
or is not a usable branch name, gets a comment and a green run - the command was asked too early or
typed wrong, which is not a CI error and should not read like one. A replan whose *previous* plan
named a branch that has since been merged and deleted stops the same way, and asks you to name a
branch: continuing against the default branch would silently replan against different code.

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

**`max_turns` is not a spending cap.** The SDK holds a short run to it exactly and lets a long one
run past it, so treat it as the size of run you are budgeting for rather than a limit that will stop
one. `agent_timeout_minutes` is the bound that actually holds.

Github caps a comment at 65536 characters. The agent is told to stay well under that; a plan that
would exceed it is a sign the issue should be split.
