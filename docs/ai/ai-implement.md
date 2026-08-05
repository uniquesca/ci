# AI Implement

AI workflows: [Plan](ai-plan.md) · **Implement** · [Review](ai-review.md)

Builds the plan [AI Plan](ai-plan.md) posted, opens a pull request with it, and then keeps working
on that pull request through its review. Every change after the first one is a **round**: you say
what you want on the pull request, an agent acts on it, answers each of your comments, and pushes.

## Integrating a repository

See [integrating a repository](ai-plan.md#integrating-a-repository) - both workflows go in one
file. Two things in there matter specifically to this one, and both fail silently if you miss
them:

* **`pull_request_review: types: [ submitted ]`** in the caller's `on:` block. Without it,
  requesting changes never starts a round and nothing says why.
* **`checks: read`** on the job. Without it, failing CI checks are simply not part of the feedback.

That is enough to run. [Wiring CI into the loop](#wiring-ci-into-the-loop) adds two optional
things: showing the agent what a check printed, and letting a red check start a round.

Inputs are documented in `.github/workflows/ai-implement.yml`. The two you are most likely to
change are `max_unattended_rounds` (see [the round cap](#the-round-cap)) and `dispatch_review`
(see [AI Review](ai-review.md)).

If your repository has **"Allow GitHub Actions to create and approve pull requests"** switched off
(Settings → Actions → General → Workflow permissions), `gh pr create` fails no matter what the job
grants. Turn it on, or the branch lands and you open the pull request by hand.

## Starting the work

Comment `/ai-do` on an issue that already has a plan. Same permission gate as
[the planner](ai-plan.md#triggering-the-planner): admin or write access.

The agent implements the plan on a branch named after the issue, runs whatever tests and linters
it can find, and a pull request appears. The issue gets a comment with the link, and **that
comment is the hand-off** - from then on the issue is only for the plan.

Running `/ai-do` on the issue again does not implement anything. It replies pointing at the pull
request, because that is where the work continues.

### Basing the work on another branch

By default the branch is cut from the repository default branch and the pull request targets it.
Name another one to work from instead:

```
/ai-do base=develop
```

The branch is created from `develop` and the pull request targets `develop`. Useful when the
repository does not develop on its default branch, or when the work has to sit on top of another
feature branch rather than beside it.

Only read when `base=` is the **first thing after the command**, so the rest of the comment stays
what it has always been - instructions for the agent. `/ai-do also update the changelog` is not a
request to retarget anything, and neither is a `base=` mentioned mid-sentence. Surrounding
backticks are stripped, so ``/ai-do base=`develop` `` works too.

A branch that does not exist gets a comment and nothing else - no branch, no pull request, and a
green run. The base is only ever read on the **first** run for an issue; see
[one branch, one pull request](#one-branch-one-pull-request) for what happens if you ask later.

## Reviewing it, and asking for changes

Two ways to start another round. Both need admin or write access.

**Submit a review as "Request changes".** This is the normal path. Comment on the lines you want
changed, submit the review, and a round starts by itself. Every inline comment in that review is
batched into one round, so you can leave twenty comments over twenty minutes and only pay for one
run.

**Comment `/ai-do` on the pull request.** For when you would rather say what you want in prose, or
re-run with nothing new to say.

An **approved** or plain **commented** review deliberately does nothing. Requesting changes is a
decision; a passing remark is not, and firing an agent on every stray comment would be expensive
and surprising.

Each round ends with the agent pushing to the same branch, **replying to every thread it was
given**, and posting one summary comment. It replies even to the comments it decided against -
"I did not do this, because X" is the most useful thing it can tell you, and it is where you find
out you disagree.

### What to do with a reply

**The agent replies. You resolve.** Nothing in these workflows resolves a thread: that is your
judgement that the concern has been dealt with, not the author's claim that it has.

So each thread has three outcomes, and all of them work:

| You do | What happens next |
|--------|-------------------|
| **Resolve it** | Done. It never comes back. |
| **Reply again** - "no, it really does leak" | The thread goes back in play, and the next round reads your reply and the agent's together. |
| **Leave it** | It stays visible and costs nothing. A thread the agent has answered is skipped by later rounds until somebody replies to it again. |

That last rule is what stops every round redoing the same work.

### Other things the round reads

Besides your review comments, each round picks up anything said in the pull request conversation
since the last round, and **any check that is currently failing** - with its annotations, so a
broken linter is as actionable as a review comment. You do not need to paste a CI failure in; just
start a round and it will be there.

Where a check is red, expect it to be fixed rather than explained. A failing check has no thread
to answer, so what the agent did about it is in the round summary comment instead.

## Wiring CI into the loop

Two opt-in additions, both useful, both independent of each other. Details and traps for each are
in [Dig deeper](#dig-deeper).

**Show the agent what a check printed.** It cannot read job logs, so upload an artifact named
`ai-report-*` from a run on the pull request's head commit. Every match is collected into
`.ai-reports/` before each round, and the agent is told to read it. Nothing to configure here:

```yaml
      - name: Run the thing
        run: |
          set -o pipefail
          mkdir -p .ai-reports
          ./run-e2e 2>&1 | tee .ai-reports/e2e.log

      - name: Upload the report
        if: always()
        uses: actions/upload-artifact@v7
        with:
          name: ai-report-e2e
          path: .ai-reports
          retention-days: 1
          include-hidden-files: true
          if-no-files-found: ignore
```

**Let a red check start a round.** By default only a review can, so a failing check that nobody
commented on is never acted on. Add this to the caller and whichever of your QA workflows and the
reviewing agent finishes **second** starts one round, with both sources in the feedback:

```yaml
on:
  workflow_run:
    workflows: [ 'PHP QA Checks' ]   # the QA workflow's `name:`, not its filename
    types: [ completed ]

jobs:
  ai-implement:
    permissions:
      actions: read
```

## Dig deeper

### Reports from other workflows

Three lines there are load-bearing, and getting any of them wrong fails quietly:

* **`if: always()`** - a failed step skips the ones after it, so without this the run you wanted the
  report from is the one that uploads nothing.
* **`set -o pipefail`** - a `run:` step that does not name its shell does not get it, and `tee` then
  returns success for a command that failed, turning a red check green.
* **`include-hidden-files: true`** - `.ai-reports` starts with a dot, and `upload-artifact` excludes
  hidden files by default. Without it the report is written and then dropped, and the log says
  `No files were found with the provided path`.

Reports are found by commit, so a workflow triggered by a schedule or `workflow_dispatch` is not
picked up. Missing reports never fail a round - the agent says what it could not see instead.

**Keep secrets out of them.** Stack traces and environment dumps carry credentials, and a model
reads these and quotes from them in pull request comments.

Uploading a report does not start a round; it is picked up by whatever round runs next. Starting one
is the `workflow_run` trigger, below.

### How the wait works

A round pushes, and your QA workflows and the reviewing agent start in parallel and finish in either
order. The first to finish starts a round, sees the other still working, and exits within about a
minute having posted nothing. The second finds nothing pending and runs the round properly.

There is no handshake between them - each asks GitHub what is still reporting on that commit - so a
duplicated or lost trigger cannot wedge it. If `dispatch_review` is off or the reviewing agent
fails, nothing waits for it: the question is whether the reviewer is *still working*, not whether a
review arrived.

**The trap:** `workflow_run` only fires when the workflow file containing it is on your **default
branch**. On a feature branch it does nothing, which looks exactly like a broken gate.

Two consequences worth expecting:

* **These rounds never count as attended**, whoever pushed the commit CI ran on. Nobody asked for
  them, so they count against [the round cap](#the-round-cap) - which is what stops the
  round → push → CI → round cycle running away.
* **A green pull request produces no comment.** The round starts, finds nothing to act on and exits
  silently, because this fires on every push and saying so each time would be noise.

### The round cap

A person asking for another round is bounded by their own patience and their willingness to spend
the money. A bot asking is not - with [AI Review](ai-review.md) wired up, the loop could otherwise
run until the API key is empty.

So rounds are counted, and the count is only ever about **consecutive rounds a bot started**. Any
round a person asked for resets it to zero, because a person looking at the work is exactly the
thing the limit exists to wait for. `max_unattended_rounds` defaults to `5`, which is *not* "five
rounds per pull request" - iterating with a human ten times is normal and uncapped.

Past the limit the round is refused with a comment asking for a person, and it takes a human
comment or review to start another.

Two mechanisms decide whether a round counts, and it takes both: the actor is a `Bot`, **or** the
review body starts with `<!-- ai-review -->`. The second is the one that matters in practice,
because a review token belonging to a machine *user* account makes Github report the review as
authored by a `User`. Anyone can paste that marker into a review of their own; all that does is
make their own round count against the cap, so it can only ever stop the loop sooner.

A round that changes no file says so plainly in its comment. That is usually the more informative
signal than the cap itself: two agents talking past each other tends to produce a lot of activity
and no diff.

### Which pull requests it will touch

Only pull requests it opened: the head branch has to be in **this** repository and to carry the
configured prefix. Anything else is left alone.

This is a security boundary, not tidiness. `issue_comment` and `pull_request_review` fire on every
pull request in the repository, including ones from forks, and both run in the base repository's
context with a write token and **full access to secrets**. Without the branch check, `/ai-do` on a
fork's pull request would check out that fork's code and hand it a shell with
`ANTHROPIC_API_KEY` in the environment.

The two triggers behave differently when a pull request is out of scope, deliberately. A review
says nothing at all - reviews land on every pull request in the repository and commenting on each
would be noise on somebody else's work. An explicit `/ai-do` gets an answer, because a person
asked.

Running this on human-authored pull requests would be a different feature, and the branch check
is what currently stands between the two.

### Two filters, on purpose

Your review comments and conversation comments are filtered by **time**, from a watermark the
previous round recorded. Threads and failing checks are filtered by **state**, because "still
unresolved" and "currently red" are not questions about when something was said - a thread nobody
has resolved is still open work however long it has been sitting there.

The watermark is recorded when a round *starts* reading, not when it finishes, so a review you
submit while a round is running lands on the next round rather than falling into the gap between
the two.

### One branch, one pull request

The branch name is derived from the issue number rather than generated, and that is the whole
mechanism:

* **First run** - branch created from the default branch, or from
  [whatever `base=` named](#basing-the-work-on-another-branch); work pushed, pull request opened.
* **Every round** - the same branch is fetched, so the agent starts from the previous round rather
  than from scratch. The push updates the open pull request. No second one appears.
* **A closed pull request** - `/ai-do` on the issue revives it. Pushing to a closed pull request's
  branch does not reopen it, so it is reopened explicitly rather than a second one being opened
  beside it.
* **A merged pull request** - `/ai-do` says the work already shipped. Open a new issue.

The pull request body says `Implements #<number>`, deliberately not `Closes`. Review here is the
point, and auto-closing the issue on the first merge cuts that short. Close the issue yourself
when the work is actually done.

**The base is settled when the branch is created**, and after that the pull request is the record
of it. So `base=` on a round, or on an issue whose branch is still lying around from an abandoned
attempt, gets a comment saying so and is otherwise ignored - the history is already sitting on top
of something else, and quietly retargeting it would misrepresent the diff. Retarget the pull
request yourself if you need to move it, with `gh pr edit --base` or the **Edit** button by its
title: later rounds read the base off the pull request, so they follow along. Retargeting changes
what the pull request is compared against and not what is on the branch, so a rebase is usually
wanted too.

The one apparent exception follows the same rule. Reviving a closed pull request whose branch was
deleted does honour `base=`, because there is no branch left and one has to be created - and the
pull request is retargeted to match, so its diff still describes only this work. Revive one
without saying anything and it keeps the base it had rather than snapping back to the default
branch.

Two rounds on one pull request never run at once. They queue rather than cancel, so the second
starts from what the first pushed.

### The round comment

Every round ends with one comment, whatever else happened, and its first two lines are hidden
markers carrying the round number, whether a person asked for it, and a timestamp.

That is not decoration. The next round counts these comments to find the round number and the
unattended streak, and reads the timestamp to know where to draw its watermark. A round that
failed to post one would have the next round act on the same feedback all over again - which is
why it is posted even when nothing changed.

### When nothing happens

Cases that end without a failure and without a red run:

| Situation | What you get |
|-----------|--------------|
| `/ai-do` on an issue whose pull request is open | A comment pointing at it |
| `/ai-do` on an issue whose pull request was merged | A comment saying the work shipped |
| `/ai-do` on an issue with no plan | A comment saying to run `/ai-plan` first |
| `base=` naming a branch that does not exist | A comment saying so, and nothing is started |
| `base=` with no branch after it | A comment saying to name one |
| `base=` when the branch already exists | A comment saying the base is settled - the run carries on regardless |
| A round with no unresolved thread, nothing new said and no failing check | A comment saying exactly that |
| Too many rounds in a row from a bot | A comment asking for a person |
| The agent changed no files | A comment saying so |
| `/ai-do` on a pull request this workflow did not open | A comment saying why not |
| A review on a pull request this workflow did not open | Nothing at all, by design |

Anything else that goes wrong comments on the issue or the pull request with the reason the agent
stopped, the same way [a failed plan does](ai-plan.md#when-a-run-goes-wrong).

### What the agent can and cannot do

It **may** read and change any file in the checkout, and run any command on the runner - it has a
shell, on purpose. Without one it could not run the tests, and the plan's verification section
would be a list rather than something it executes.

It **may not**, and cannot:

* **Write to the default branch.** Everything lands on its own branch, behind a pull request
  somebody reviews and merges. Nothing here merges anything.
* **Push, commit, open a pull request, or comment anywhere.** The checkout runs with
  `persist-credentials: false`, so there is no git credential on disk while the agent is working.
  The workflow supplies one per command, before the agent starts and after it finishes. An agent
  talked into `git push` finds it fails.
* **Change the plan or the feedback it was given.** Both are excluded from git, so nothing under
  them can reach a commit however the agent leaves the working tree. Its replies to your threads
  are the one thing it writes back, and they are validated rather than trusted - a reply to a
  thread that was not part of this round is discarded.

What actually limits this is the permission gate and the branch check, not the tool list. An agent
with a shell runs whatever an issue body or a review comment talks it into, and
`ANTHROPIC_API_KEY` is in that environment. Keep the permission gate at `admin write` or narrower,
and do not widen the trigger to anything a stranger can fire.
