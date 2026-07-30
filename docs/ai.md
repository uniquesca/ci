# AI

AI-assisted parts of the CI framework. They run Claude against your repository through
[`anthropics/claude-code-action`](https://github.com/anthropics/claude-code-action), so
every one of them needs an Anthropic API key passed in from a secret.

Currently available:
1. [AI Plan workflow](#ai-plan-workflow) - reusable workflow that plans a Github issue
   when a comment asks it to
2. [AI Implement workflow](#ai-implement-workflow) - reusable workflow that turns that plan
   into a pull request, and then keeps working on that pull request through its review

## How the two fit together

```
issue                                    pull request
-----                                    ------------
/ai-plan   -> plan posted
  (read it, correct it, re-run)
/ai-do     -> opens ------------------->  code to review
                                          |
                                          | Request changes  ->  round
                                          | /ai-do           ->  round
                                          | failing check    ->  read on every round
                                          |
                                          v
                                          replies on each thread, one round comment,
                                          another push
```

**The issue holds the plan. The pull request holds the review.** Up to the point where
there is a pull request, the issue is where everything happens. After that the work moves,
and `/ai-do` on the issue stops doing anything except pointing at the pull request.

The reason is not tidiness. A review gives you line-anchored feedback - "extract this",
attached to the exact hunk - and threads, which carry their own done-or-not state. An issue
thread has neither, and prose about "the error handling in the config loader" is far less
actionable than the same sentence pinned to the line.

The plan stays on the issue in exactly one copy for the whole run of the work, and every
round reads it again. So `/ai-plan` remains available after implementation has started: it
is the escape hatch for when the *approach* was wrong rather than the code, and a revision
reaches the next round on its own. The revised plan also gets announced on the open pull
request, because that is where people are looking by then.

## AI Plan workflow

Reusable workflow that turns a Github issue into an implementation plan on demand.
Someone comments `/ai-plan` on an issue, and the plan is posted back as a comment on the
same issue.

What happens on each command:
1. The comment is checked - it has to be a new comment on a real issue, starting with the
   command. Comments on pull requests are ignored.
2. The commenter's permission level in the repository is checked. Anyone not allowed gets
   a comment explaining that, and the run fails.
3. The **body of the issue** is what gets planned. Anything typed after the command in the
   comment is ignored. An issue with an empty body gets a comment saying so and the run
   stops there without failing - there is nothing to plan, which is not a CI error.
4. The repository is checked out, so the agent can plan against the real code.
5. The issue and all its comments are written into the checkout, at `.ai-plan/issue.json`
   and `.ai-plan/comments.json`.
6. The agent reads those, investigates the repository, and returns the plan.
7. The workflow posts it as a comment on the issue, and writes a copy to the run summary.
8. If a pull request is already open implementing this issue, it gets a comment saying the
   plan has been revised, with a link to the revision.

The checkout is always of the **default branch**. An `issue_comment` event carries no ref
to infer one from, and planning an issue is a question about the mainline rather than
about whichever branch happens to be open.

### Setting it up

Add a workflow like this to the repository that should get the command:

```yaml
name: AI

on:
  issue_comment:
    types: [ created ]

jobs:
  ai-plan:
    permissions:
      contents: read
      issues: write
      pull-requests: read
    uses: uniquesca/ci/.github/workflows/ai-plan.yml@main
    secrets:
      ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

Three things about this that are easy to get wrong:

* **The `permissions` block belongs on the calling job.** A called workflow can only
  narrow the token it is given, never widen it. If the repository's default token is
  read-only and the caller does not grant `issues: write`, the workflow cannot post
  anything.
* **The workflow file has to be on the default branch.** Github always runs the
  default-branch version of an `issue_comment` workflow, so changes to it cannot be
  tested from a feature branch.
* **`types: [ created ]`** keeps edits to an existing comment from planning the issue a
  second time. The workflow checks this too, so it is safe either way.

`pull-requests: read` is only there so the planner can find the pull request already
implementing the issue and mention the revision on it. Commenting on it needs nothing more,
because a pull request conversation comment is an issue comment as far as Github is
concerned.

You do **not** need the Claude Github App installed. The workflow passes the job's own
`GITHUB_TOKEN` to the agent, which is also what keeps it inside the permissions granted
above.

### Inputs

All optional:

* `command` - the comment command to react to, default `/ai-plan`. It has to be at the
  very beginning of the comment.
* `allowed_permissions` - space-separated repository permission levels allowed to run the
  command, default `admin write`.
* `timeout_minutes` - how long the whole job may run, default `35`.
* `agent_timeout_minutes` - how long the planning agent itself may run, default `30`.

  Keep the second a few minutes below the first. A job timeout cancels every remaining
  step, so an agent allowed to run right up to the job's limit takes the failure comment
  down with it, and the issue hears nothing at all. Github expressions cannot do
  arithmetic, so the gap is two defaults rather than something the workflow derives.
* `max_turns` - how many turns the agent may spend before it has to answer with what it
  found, default `30`.
* `model` - model used to produce the plan, default `claude-opus-4-8`.
* `branch_prefix` - default `ai-implement/`. Used only to find the pull request already
  implementing this issue. Keep it the same as the implementing workflow's.
* `debug` - add the raw agent transcript to the run log, default `false`. See
  [watching a run](#watching-a-run).

Required secret:

* `ANTHROPIC_API_KEY` - see [providing the API key](#providing-the-api-key).

### Who is allowed to run it

The commenter's permission comes from the repository collaborators API, not from the
comment payload, so team and organisation grants are taken into account.

That API reports the six repository roles as four levels - **`maintain` is reported as
`write`, and `triage` is reported as `read`**. The default `admin write` therefore means:

| Repository role      | Reported as | Allowed by default |
|----------------------|-------------|--------------------|
| Owner / admin        | `admin`     | yes                |
| Maintainer           | `write`     | yes                |
| Developer / write    | `write`     | yes                |
| Triage               | `read`      | no                 |
| Read                 | `read`      | no                 |
| Not a collaborator   | `none`      | no                 |

Gating on this is what keeps the API spend under control - without it, anyone able to
comment on an issue can spend tokens against your key.

If the permission check itself fails - a token without the access to read collaborators,
for example - the run fails loudly rather than quietly treating the commenter as
unauthorised.

### What the plan looks like

A single comment on the issue, in markdown:

* an `<!-- ai-plan -->` marker on the first line, which Github renders as nothing
* a short summary of the approach
* the steps as a **task list**, so Github renders real checkboxes - a step reads
  `- [ ] 1. Register the route`, followed by what to do, why, and the files it touches
* risks, unknowns and assumptions
* concrete checks that prove the task is complete
* a closing line naming who asked for it and what the run cost, for example
  `Requested by @someone. Planned in 6m 44s, 18 turns, 1250000 tokens, ~$3.41.`

The cost is the agent's own estimate from its token counts, not a billed figure - treat
it as an order of magnitude. Any part of it the agent did not report is left out rather
than guessed at, so a shorter line means less was recorded, not that less was spent.

### When planning fails

A failed run comments on the issue too, rather than going red where nobody looking at the
issue can see it:

> @someone the planning agent did not finish, so there is no plan for this issue.
>
> It stopped with: `Credit balance is too low`
>
> The run log has the detail: ...

The reason comes out of the agent's execution log where there is one. An exhausted credit
balance, a hit turn limit and a genuine bug all look identical from the issue otherwise.

There is no separate machine-readable copy. The plan is the comment: a human can edit it,
tick steps off, or reject it, and a later implementor agent reads the same text. Keeping
one copy is deliberate - two formats drift, and then the plan a human approved is not the
plan an agent executes.

The marker carries no data. It exists only so that "the current plan" can be found among
the other comments on an issue:

```bash
gh api --paginate --slurp "repos/$GH_REPO/issues/$ISSUE/comments" \
  | jq -r 'flatten
           | map(select(.user.type == "Bot"))
           | map(select(.body | startswith("<!-- ai-plan -->")))
           | last | .body'
```

`--slurp` cannot be combined with `--jq`, so the shaping has to be a separate `jq`. With
`--paginate` the result is one array per page, which is what `flatten` collapses.

Filtering on the bot author matters. Without it, any commenter can paste a marker of
their own and hand an implementor agent instructions you never approved.

### Watching a run

Nothing appears on the issue until the plan is finished - the comment is posted in one go
at the end. Afterwards, three places to look:

* **The `Show what the agent did` step**, always printed. The agent narrates as it works,
  and this pulls that narration and its tool calls out of the transcript:

  ```
  💬 Let me read the issue first.
  🔧 Read(file_path=.ai-plan/issue.json)
  💬 Now I'll search for the router.
  🔧 Grep(pattern=registerRoute, glob=src/**/*.js)
  💬 I have enough understanding of the codebase to write a grounded plan.
  ```

  It runs on failed runs too, which is when it is most useful - it shows how far the
  agent got before it stopped.
* **The run summary.** The finished plan is written there as well as to the issue, so a
  run that produces a plan but fails to comment has not lost it.
* **The raw transcript** - set `debug: true` on the calling job. Every message as JSON,
  including full tool results. Reach for it when the readable summary is not enough to
  explain what happened. Do not turn it on in a **public repository**: a tool result is
  whatever the agent just read out of the code, so it publishes file contents to a log
  anyone can read.

### Adjusting a plan

Three ways, depending on the size of the change:

* **A small correction - edit the comment.** There is no second copy to keep in sync, so
  editing the markdown is editing the plan. Fix a file path, drop a step, reword a
  detail. Nothing else needs to happen.
* **Feedback and revision - say what you want, then run the command again.** The agent
  reads the whole comment thread, takes the most recent plan as its starting point, and
  applies whatever was asked for after it was posted. Parts nobody objected to survive.
  Each run posts a new comment, and the newest one is the current plan.
* **A change of direction - edit the issue body, then run the command again.** The issue
  body is the task. When the task itself was wrong, fix it there rather than arguing with
  the plan.

Editing the comment and re-running do not mix well in one direction: a re-run reads your
edited comment as the starting point, so your edits survive, but the agent may reword
around them. If an edit has to stay exactly as written, say so in a follow-up comment.

**Replanning after the work has started** is allowed and sometimes right - it is the only
way to say "the whole approach is wrong" rather than "this line is wrong". The next round
on the pull request reads the plan off the issue again, so the revision reaches the code
without anybody copying it anywhere, and the open pull request gets a comment linking to
it. What replanning does **not** do is undo the code already pushed. Expect the next round
to be a large one.

### Helping the agent

The single most effective thing you can do for plan quality is add an **`AGENTS.md` or
`CLAUDE.md` to the repository being planned** - not to this one. The agent reads it before
anything else, and it saves several turns of inferring conventions from a sample of files.

Worth putting in it: how to build and test, how the code is laid out, the conventions a
change is expected to follow, and anything surprising a newcomer would get wrong.

### What the agent may and may not do

The agent has no shell and no network. It cannot fetch the issue, which is why the
workflow stages it into the checkout first - the agent only ever reads files. That is
also what keeps the issue text out of this workflow file: `gh` writes it straight to
disk, so nothing written by whoever opened the issue is expanded into YAML.

`comments.json` carries an `is_bot` flag per comment, and the agent is told to treat only
bot-authored `<!-- ai-plan -->` comments as previous plans. Without that, anyone able to
comment could paste a marker and have the next run "revise" a plan they wrote themselves.

The plan step is read-only in two independent ways:

* The job runs with `contents: read`, so nothing the agent does to the checkout can ever
  be pushed. This is the boundary that actually holds.
* Editing, writing and shell tools are switched off in the workflow's `claude_args`. This
  is defence in depth, and it stops turns being spent on work that would be discarded.

Both matter, because the agent reads an issue body that any collaborator can write. If you
extend this workflow, keep the `contents: read` permission - it is doing more work than
the tool list.

## AI Implement workflow

Reusable workflow that implements the plan `/ai-plan` posted, and then keeps working on the
result through its review. It has two halves:

* **The first run.** `/ai-do` on the issue. A branch is created, the plan is implemented, a
  pull request is opened, and the issue is told where to look.
* **Every round after.** On the pull request, not the issue. A review asking for changes, or
  `/ai-do` in the pull request, runs another round: the agent reads every unresolved review
  thread, everything said since the last round and every failing check, changes what needs
  changing, answers each thread, and pushes.

### Setting it up

Alongside the planner, in the same file:

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

Both jobs can live in one file. Each only runs for the events and commands it cares about,
so the other is skipped.

Two things here are new and easy to miss:

* **`pull_request_review: types: [ submitted ]` is required**, and leaving it out is silent.
  The reusable workflow declares only `workflow_call`, so the events belong to the caller.
  Without this one, requesting changes never starts a round and nothing anywhere says why.
* **`checks: read` is what makes failing checks part of the feedback.** Without it the checks
  are staged as an empty list, with a warning in the log, and everything else still works.

The wider `permissions` are why this is a separate job rather than more steps in the
planner: `contents: write` and `pull-requests: write` are needed to push a branch, open a
pull request and reply to review threads, and there is no reason for the planner to hold
them.

If the repository has **"Allow GitHub Actions to create and approve pull requests"**
switched off - Settings -> Actions -> General -> Workflow permissions - `gh pr create`
fails with a permissions error no matter what the job grants. Turn it on, or the push
lands and the pull request has to be opened by hand.

### Inputs

* `command` - default `/ai-do`. Starts the work on an issue; runs another round on a pull
  request.
* `allowed_permissions` - default `admin write`, as for
  [the planner](#who-is-allowed-to-run-it).
* `allowed_bots` - space-separated bot logins allowed to start a round, default
  `github-actions[bot]`. The collaborators API has no answer for a bot, so bots are checked
  against this list instead. See [rounds a bot asked for](#rounds-a-bot-asked-for).
* `timeout_minutes` - default `65`. `agent_timeout_minutes` - default `60`. The same rule
  applies as for the planner: keep the second below the first, or a run the agent overruns
  takes the failure comment down with it.
* `max_turns` - default `60`.
* `model` - default `claude-opus-4-8`.
* `branch_prefix` - default `ai-implement/`. The branch is this plus `issue-<number>`. Only
  branches carrying this prefix are ever worked on, which is also part of
  [the security boundary](#which-pull-requests-this-will-touch).
* `max_unattended_rounds` - default `5`. How many rounds in a row a bot may start before a
  person has to look. See [rounds a bot asked for](#rounds-a-bot-asked-for).
* `ignore_check_patterns` - case-insensitive regular expression matching check runs to leave
  out of the feedback, default `(ai.implement|ai.plan)`. See
  [failing checks](#failing-checks-as-feedback).
* `debug` - default `false`.

Required secret: `ANTHROPIC_API_KEY`.

### The first run

`/ai-do` on the issue:

1. The comment and the commenter's permission are checked, exactly as
   [the planner does it](#who-is-allowed-to-run-it).
2. **If a pull request already exists for this issue**, nothing is implemented. An open one
   gets a comment pointing at it; a merged one gets a comment saying the work already
   shipped. Neither is a failure - see [when nothing happens](#when-nothing-happens).
3. The repository is checked out at full depth.
4. The issue, its comments and **the most recent plan** are written into the checkout, at
   `.ai-plan/issue.json`, `.ai-plan/comments.json` and `.ai-plan/plan.md`.
5. An issue with no plan on it gets a comment saying to run `/ai-plan` first, and the run
   stops there without failing.
6. The branch `ai-implement/issue-<number>` is created.
7. The agent reads the plan, implements it, and runs whatever tests it can find.
8. Its work is committed and pushed.
9. A pull request is opened - or, if a previous one was closed unmerged, that one is
   reopened rather than a second one being opened beside it.
10. The pull request link is commented on the issue. **That comment is the hand-off**: after
    it, the issue is only for the plan.

The pull request body says `Implements #<number>`, deliberately not `Closes`. Review here is
the point, and auto-closing the issue on the first merge cuts that short - as does merging a
partial implementation. Close the issue yourself when the work is actually done.

### Rounds

Everything after the first run is a round, and rounds happen on the pull request. Three ways
to start one:

| How | Who it is for |
|-----|---------------|
| Submit a review as **Request changes** | The normal path. Batches every inline comment in that review into one round. |
| `/ai-do` in the pull request | When you want to say what you want in prose, or re-run with nothing new to say. |
| A bot doing either of the above | A reviewing agent. Bounded - see [below](#rounds-a-bot-asked-for). |

An `approved` or `commented` review deliberately does nothing. Requesting changes is a
decision; a passing remark is not, and firing an agent on every stray comment would be
expensive and surprising.

What a round does:

1. Checks the actor's permission, and checks that this pull request is one
   [it is allowed to touch](#which-pull-requests-this-will-touch).
2. Stages the feedback - see [what a round reads](#what-a-round-reads).
3. Stops with a comment if there is nothing to act on, or if
   [too many rounds in a row came from a bot](#rounds-a-bot-asked-for).
4. Checks out the pull request branch, so the agent starts from every earlier round's work.
5. Stages the issue and its plan again, so a revised plan is picked up.
6. The agent works through every feedback item, and writes what it wants to say back to each
   thread.
7. The work is committed and pushed to the same branch, so the pull request updates.
8. Each thread gets its reply.
9. The round is closed with one comment on the pull request.

### What a round reads

Everything asking for a change, from four sources, normalised into one list at
`.ai-review/feedback.json`:

| `source`  | Where it comes from                       | Filtered by |
|-----------|-------------------------------------------|-------------|
| `thread`  | An inline review comment and its replies  | Unresolved, and not already answered |
| `review`  | A reviewer's summary above their comments  | Submitted since the last round |
| `comment` | The pull request conversation             | Written since the last round |
| `check`   | A failing check run, with its annotations  | Currently red |

Each entry carries the same fields:

```json
{
  "id": "PRRT_kwDO...",
  "source": "thread",
  "author": "george",
  "is_bot": false,
  "created_at": "2026-07-29T12:00:00Z",
  "url": "https://github.com/...",
  "anchor": { "path": "src/config.js", "line": 42, "diff_hunk": "@@ -39,6 +39,9 @@ ..." },
  "state": "unresolved",
  "reply_target": 2264881234,
  "text": "@george wrote:\nThis should reuse the existing loader."
}
```

`anchor` is null when the feedback is not about one place. `reply_target` is the identifier
the agent answers that thread on, and is null for anything that has no thread. `state` is
`unresolved` or `outdated` for a thread, the review's state for a review, and the
conclusion for a check.

That schema is the extension point. A new kind of feedback - a different reviewing agent, a
different sort of check - is one more `source` value and one more entry in the list, with no
change to the trigger, the push, or the replies.

**Two different filters are at work here, on purpose.** Reviews and conversation comments
are filtered by *time*, from a watermark the previous round recorded. Threads and checks are
filtered by *state*, because "still unresolved" and "currently red" are not questions about
when something was said - a thread nobody has resolved is still open work however long it has
been sitting there.

The watermark is recorded when a round *starts staging*, not when it finishes. A review
submitted while a round is running therefore lands on the next round rather than falling into
the gap between the two.

### Replies, and who resolves what

The agent answers each thread it was given, including the ones it decided against. Those
replies are what makes the loop a conversation rather than a series of unexplained pushes -
and "I did not do this, because X" is the most useful thing it can say.

**The agent replies. You resolve.** Nothing here resolves a thread, and that is deliberate:
resolution is the reviewer's judgement that a concern has been dealt with, not the author's
claim that it has. If the agent resolved its own threads, the next round could not tell "I
addressed this and the reviewer agreed" from "I addressed this badly".

Which raises the obvious question - if an unresolved thread is open work, and the agent never
resolves anything, does every round redo everything? No:

* A thread whose **newest comment is a reply the agent posted** is treated as answered and
  left out of the next round. It is waiting on you, not on the agent.
* **Replying to it again puts it back in play.** Say "no, it really does leak" and the next
  round picks the thread up, with your reply and the agent's in the text it reads.
* Resolving it takes it out for good.

So the three things you can do with a reply you disagree with all work: reply again to push
back, resolve to accept, or leave it and it stays visible without costing anything.

Mechanically, replies come from a file. The agent has no token and cannot post anything
itself, so it writes `.ai-review/replies.json` - an array of
`{"reply_target": <number>, "body": "<markdown>"}` - and the workflow posts each one with a
hidden `<!-- ai-implement-reply -->` marker on the first line. That marker is what the next
round looks for. Entries are dropped rather than trusted if the target was not in this
round's feedback, if the same thread appears twice, or if the body is empty.

### Failing checks as feedback

A red check is feedback with no thread to answer. Every round reads the current check status
of the branch tip and stages what is failing, with up to twenty of its annotations - which
carry file and line, so a broken linter is as actionable as a review comment.

Three things to know:

* **Checks are read, not triggered on.** A round accounts for whatever is red at the moment
  it starts. There is no "CI went red, go fix it" trigger, which would be a second unbounded
  loop on top of the reviewing one.
* **The AI workflows' own check runs are filtered out**, via `ignore_check_patterns`. They
  live on the same commit, and a round that reads its own red status back as a code defect
  spends itself chasing its own tail. If you rename the calling jobs, update the pattern.
* **Green and "not finished" are not the same thing.** A round started ten seconds after a
  push sees nothing red because nothing has run yet. The count of unfinished checks is staged
  too, and the agent is told to say so rather than reporting the branch as passing.

Since a check has no thread, what the agent did about it appears in the round comment rather
than as a reply.

### Rounds a bot asked for

A person asking for another round is bounded by their own patience, and by their willingness
to spend the money. A bot asking is not. Once something automated can request changes -
a reviewing agent, most obviously - the loop can run until the API key is empty: push,
review, push, review.

So rounds are counted, and the count is only ever about **consecutive rounds a bot started**.
Any round a person asked for resets it to zero, because a person looking at the work is
exactly the thing the limit exists to wait for. `max_unattended_rounds` defaults to `5`,
which is not "five rounds per pull request" - iterating with a human ten times is normal and
uncapped.

Past the limit, the round is refused with a comment saying so, and it takes a human comment
or review to start another. A round that changes no file also says so plainly in its comment,
which is usually the more informative signal: two agents talking past each other tends to
produce a lot of activity and no diff.

**One thing to know before wiring up a reviewing agent:** events created with the built-in
`GITHUB_TOKEN` do not start workflow runs.
[That is deliberate on Github's part](https://docs.github.com/en/actions/concepts/security/github_token),
to stop workflows triggering themselves. So a review posted by a workflow using
`GITHUB_TOKEN` will **not** start a round, no matter what `allowed_bots` says. A reviewing
agent needs a personal access token or a Github App installation token to hand work back -
and at that point the cap above is the only thing standing between the two agents.

### Which pull requests this will touch

Only pull requests this workflow opened: the head branch has to be in **this** repository and
to start with `branch_prefix`. Anything else is left alone.

This is a security boundary, not tidiness. Both new triggers fire on every pull request in
the repository, including pull requests from forks - and `issue_comment` and
`pull_request_review` run in the base repository's context, with a write token and **full
access to secrets**, even for a fork. Without the branch check, `/ai-do` on a fork's pull
request would check out that fork's code and hand it a shell with `ANTHROPIC_API_KEY` in the
environment.

The two triggers behave differently when a pull request is out of scope, and that is also
deliberate:

* **A review says nothing.** Reviews land on every pull request in the repository, most of
  which have nothing to do with this workflow. Commenting on each one would be noise on
  somebody else's review.
* **An explicit `/ai-do` gets an answer.** A person asked, so they are told why it did not
  run.

Running this on human-authored pull requests would be a different feature, and the branch
check is what currently stands between the two.

### When nothing happens

Cases that end without a failure and without a red run:

| Situation | What you get |
|-----------|--------------|
| `/ai-do` on an issue that already has an open pull request | A comment pointing at it, and how to ask for changes there |
| `/ai-do` on an issue whose pull request was merged | A comment saying the work shipped, open a new issue |
| `/ai-do` on an issue with no plan | A comment saying to run `/ai-plan` first |
| A round with no unresolved thread, nothing said since the last round and no failing check | A comment saying exactly that |
| Too many rounds in a row from a bot | A comment asking for a person |
| The agent changed no files | On the first run, a comment on the issue. On a round, the round comment says so |
| `/ai-do` on a pull request this workflow did not open | A comment saying why not |
| A review on a pull request this workflow did not open | Nothing at all, by design |

Anything else that goes wrong comments on the issue or the pull request the same way
[a failed plan does](#when-planning-fails), with the reason the agent stopped.

### The round comment

Every round ends with one comment on the pull request, whatever else happened. Its first line
is a `<!-- ai-implement-round -->` marker and its second is a hidden metadata line:

```
<!-- ai-implement-round -->
<!-- {"attended":true,"round":3,"staged_at":"2026-07-29T12:00:00Z","trigger":"review"} -->
```

That is not decoration. The next round counts these comments to find the round number and the
unattended streak, and reads `staged_at` to know where to draw its watermark. A round that
failed to post one would have the next round act on the same feedback all over again - which
is why it is posted even when nothing changed.

The rest of the comment is the agent's own summary of the round, followed by a line saying how
many feedback items it worked from, how many threads it answered, who started it, and what
the run cost.

### One branch and one pull request per issue

The branch name is derived from the issue number, not generated, and that is the whole
mechanism:

* **First run** - the branch is created from the default branch, the work is pushed, a pull
  request is opened.
* **Every round** - the same branch is fetched and checked out, so the agent starts from the
  previous round rather than from scratch. The push updates the branch and the open pull
  request with it. No second pull request appears.
* **A closed pull request** - `/ai-do` on the issue revives it. Pushing to a closed pull
  request's branch does not reopen it, so the workflow reopens it explicitly rather than
  opening a second one.

Two rounds on one pull request never run at once. They are queued rather than cancelled, so
the second starts from what the first pushed.

### What the implementing agent may and may not do

It **may**: read and change any file in the checkout, and run any command on the runner - it
has a shell, on purpose. Without one it could not run the tests, and the plan's verification
section would be a list rather than something it executes.

It **may not**, and cannot:

* **Write to the default branch.** Everything lands on `ai-implement/issue-<number>`, behind
  a pull request that somebody reviews and merges. Nothing here merges anything.
* **Push, commit, open a pull request, or comment anywhere.** The checkout runs with
  `persist-credentials: false`, so there is no git credential on disk while the agent is
  working. The workflow supplies one per command, before the agent starts and after it
  finishes. An agent talked into `git push` finds it fails.
* **Change the plan or the feedback it was given.** `.ai-plan/` and `.ai-review/` are added to
  `.git/info/exclude`, so nothing under either can reach a commit however the agent leaves the
  working tree. `.ai-review/replies.json` is the one file it is expected to create, and it is
  read and validated rather than trusted.

What actually limits this is the permission gate and the branch check, not the tool list. An
agent with a shell runs whatever an issue body or a review comment talks it into, and
`ANTHROPIC_API_KEY` is in that environment. Keep `allowed_permissions` at `admin write` or
narrower, keep `allowed_bots` to bots you control, and do not widen the trigger to anything a
stranger can fire.

## Providing the API key

1. Add the key as an Actions secret under **Settings -> Secrets and variables ->
   Actions**, at repository or organisation level.
2. Pass it in as the `ANTHROPIC_API_KEY` secret for the workflow.

Two cases where the secret will not reach the agent:
* **Pull requests from forks** - `pull_request` runs for forks get no secrets at all. Note
  that `issue_comment` and `pull_request_review` are *not* in this category: they run in the
  base repository's context and do get secrets, which is why
  [the branch check](#which-pull-requests-this-will-touch) exists.
* **Reusable workflows** - a job called through `workflow_call` needs `secrets: inherit`,
  or the secret listed explicitly in the caller's `secrets:` block, as in the example
  above. Secrets do not cross the `workflow_call` boundary on their own.

## Notes

* Planning reads the repository, which means a model call per turn. Expect a run to take
  several minutes and to cost meaningfully more than a single prompt would. Set
  `timeout-minutes` on the calling job accordingly, or `timeout_minutes` on the workflow,
  and use `max_turns` to bound the worst case.
* Github caps a comment at 65536 characters. The agent is told to stay under that; a plan
  that would exceed it is a sign the issue should be split.
* The workflow posts every comment itself rather than letting the agent do it. Given only a
  prompt the action runs headless and posts nothing, and its own commenting modes are
  tied to its `@claude` trigger rather than ours. So the agent's final message is read
  out of its execution log and a plain `gh issue comment` step publishes it. That also
  makes the markers, the footers and the comment size check guarantees of the workflow
  rather than things the model has to remember.
* The plan used to come back through a one-field `--json-schema` instead. That forced the
  agent to generate the whole plan as a single escaped JSON string, which is slower than
  writing markdown and can fail outright on a long plan. The execution log carries the
  same text with none of that cost, and the workflow already reads that file for the
  run's cost and for the readable summary. Review replies go the other way for the same
  reason: a file on disk rather than a schema squeezing structured data through the final
  message.
* Every run costs Anthropic API tokens against the key you supply. Keep the commands gated
  to the people who should be spending it, and keep `max_unattended_rounds` low enough that
  a machine cannot spend it unwatched.
