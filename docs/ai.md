# AI

AI-assisted parts of the CI framework. They run Claude against your repository through
[`anthropics/claude-code-action`](https://github.com/anthropics/claude-code-action), so
every one of them needs an Anthropic API key passed in from a secret.

Currently available:
1. [AI Plan workflow](#ai-plan-workflow) - reusable workflow that plans a Github issue
   when a comment asks it to
2. [AI Implement workflow](#ai-implement-workflow) - reusable workflow that turns that plan
   into a pull request

The two are meant to be used in that order. `/ai-plan` writes the plan onto the issue, you
read it and correct it, then `/ai-do` builds it. The issue is the specification the
whole way through - there is no second copy anywhere.

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

Reusable workflow that implements the plan `/ai-plan` posted. Someone comments
`/ai-do` on the issue, and a pull request appears with the work in it.

What happens on each command:
1. The comment and the commenter's permission are checked, exactly as
   [the planner does it](#who-is-allowed-to-run-it).
2. The repository is checked out at full depth.
3. The issue, its comments and **the most recent plan** are written into the checkout, at
   `.ai-plan/issue.json`, `.ai-plan/comments.json` and `.ai-plan/plan.md`.
4. An issue with no plan on it gets a comment saying to run `/ai-plan` first, and the run
   stops there without failing. Running the command too early is not a CI error.
5. The branch `ai-implement/issue-<number>` is checked out - created if this is the first
   run, fetched if it is not.
6. The agent reads the plan, implements it, and runs whatever tests it can find.
7. Its work is committed and pushed to that branch.
8. A pull request is opened, or the existing one is left to pick up the push.
9. The pull request link is commented on the issue, with the same run summary the planner
   posts.

### Setting it up

Alongside the planner, in the same file:

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
    uses: uniquesca/ci/.github/workflows/ai-plan.yml@main
    secrets:
      ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}

  ai-implement:
    permissions:
      contents: write
      issues: write
      pull-requests: write
    uses: uniquesca/ci/.github/workflows/ai-implement.yml@main
    secrets:
      ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

Both jobs can live in one file. Each only runs when a comment starts with its own command,
so the other is skipped.

The wider `permissions` are why this is a separate job rather than more steps in the
planner: `contents: write` and `pull-requests: write` are needed to push a branch and open
a pull request, and there is no reason for the planner to hold them.

If the repository has **"Allow GitHub Actions to create and approve pull requests"**
switched off - Settings -> Actions -> General -> Workflow permissions - `gh pr create`
fails with a permissions error no matter what the job grants. Turn it on, or the push
lands and the pull request has to be opened by hand.

### Inputs

The same as the planner's, plus one, and with larger time defaults because implementing
takes longer than planning:

* `command` - default `/ai-do`.
* `allowed_permissions` - default `admin write`.
* `timeout_minutes` - default `65`. `agent_timeout_minutes` - default `60`. The same rule
  applies: keep the second below the first, or a run the agent overruns takes the failure
  comment down with it.
* `max_turns` - default `60`.
* `model` - default `claude-opus-4-8`.
* `branch_prefix` - default `ai-implement/`. The branch is this plus `issue-<number>`.
* `debug` - default `false`.

Required secret: `ANTHROPIC_API_KEY`.

### One branch and one pull request per issue

The branch name is derived from the issue number, not generated, and that is the whole
mechanism behind re-running:

* **First run** - the branch is created from the default branch, the work is committed and
  pushed, a pull request is opened.
* **Every run after** - the same branch is fetched and checked out, so the agent starts
  from the previous attempt rather than from scratch. The push updates the branch, and the
  open pull request updates with it. No second pull request appears.

So the loop is: read the pull request, comment what you want changed **on the issue**, run
`/ai-do` again. The agent reads the comments after the plan and treats them as
taking precedence over it.

Comment on the issue rather than on the pull request. Only issue comments are staged for
the agent - a review comment on the pull request is not something it can see.

The pull request body says `Implements #<number>`, deliberately not `Closes`. Adjusting and
re-running is the normal path here, and auto-closing the issue on the first merge cuts that
short. Close the issue yourself when the work is actually done.

### When there is nothing to do

Two cases that end without a pull request and without a red run:

* **No plan on the issue** - a comment saying to run `/ai-plan` first.
* **The agent changed no files** - a comment saying so, with a link to the run. Usually it
  means the plan was already implemented, or the agent decided it could not proceed. What
  it decided is in the `Show what the agent did` step.

Anything else that goes wrong comments on the issue the same way
[a failed plan does](#when-planning-fails), with the reason the agent stopped.

### What the implementing agent may and may not do

This is the first workflow here that writes anything, so the boundaries are worth stating
plainly.

It **may**: read and change any file in the checkout, and run any command on the runner -
it has a shell, on purpose. Without one it could not run the tests, and the plan's
verification section would be a list rather than something it executes.

It **may not**, and cannot:

* **Write to the default branch.** Everything lands on `ai-implement/issue-<number>`,
  behind a pull request that somebody reviews and merges. Nothing here merges anything.
* **Push, commit or open a pull request itself.** The checkout runs with
  `persist-credentials: false`, so there is no git credential on disk while the agent is
  working. The workflow supplies one per command, before the agent starts and after it
  finishes. An agent talked into `git push` finds it fails.
* **Change the plan it was given.** `.ai-plan/` is added to `.git/info/exclude`, so nothing
  under it can reach a commit however the agent leaves the working tree.

What actually limits this is the permission gate, not the tool list. An agent with a shell
runs whatever an issue body talks it into, and `ANTHROPIC_API_KEY` is in that environment.
Keep `allowed_permissions` at `admin write` or narrower, and do not widen the trigger to
anything a stranger can fire.

## Providing the API key

1. Add the key as an Actions secret under **Settings -> Secrets and variables ->
   Actions**, at repository or organisation level.
2. Pass it in as the `ANTHROPIC_API_KEY` secret for the workflow.

Two cases where the secret will not reach the agent:
* **Pull requests from forks** - `pull_request` runs for forks get no secrets at all. Use
  `pull_request_target` or an `issue_comment` trigger if fork contributions need planning.
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
* The workflow posts the comment itself rather than letting the agent do it. Given only a
  prompt the action runs headless and posts nothing, and its own commenting modes are
  tied to its `@claude` trigger rather than ours. So the agent's final message is read
  out of its execution log and a plain `gh issue comment` step publishes it. That also
  makes the `<!-- ai-plan -->` marker, the `Requested by` footer and the comment size
  check guarantees of the workflow rather than things the model has to remember.
* The plan used to come back through a one-field `--json-schema` instead. That forced the
  agent to generate the whole plan as a single escaped JSON string, which is slower than
  writing markdown and can fail outright on a long plan. The execution log carries the
  same text with none of that cost, and the workflow already reads that file for the
  run's cost and for the readable summary.
* Every run costs Anthropic API tokens against the key you supply. Keep the command gated
  to the people who should be spending it.
