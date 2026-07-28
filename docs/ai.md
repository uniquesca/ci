# AI

AI-assisted parts of the CI framework. They run Claude against your repository through
[`anthropics/claude-code-action`](https://github.com/anthropics/claude-code-action), so
every one of them needs an Anthropic API key passed in from a secret.

Currently available:
1. [AI Plan workflow](#ai-plan-workflow) - reusable workflow that plans a Github issue
   when a comment asks it to

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
5. The agent reads the issue, investigates the repository, and returns the plan.
6. The workflow posts it as a comment on the issue, and writes a copy to the run summary.

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
* `timeout_minutes` - how long to wait for the planning agent, default `30`.
* `max_turns` - how many turns the agent may spend before it has to answer with what it
  found, default `30`.
* `model` - model used to produce the plan, default `claude-opus-4-8`.
* `debug` - log every step the agent takes to the run log, default `true` while the
  planner is being piloted. See [watching a run](#watching-a-run).

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
  --jq 'flatten
        | map(select(.user.type == "Bot"))
        | map(select(.body | test("<!-- ai-plan -->")))
        | last | .body'
```

Filtering on the bot author matters. Without it, any commenter can paste a marker of
their own and hand an implementor agent instructions you never approved.

### Watching a run

Nothing appears on the issue until the plan is finished - the comment is posted in one
go at the end. While a run is going, there are two places to look:

* **The run summary.** The finished plan is written there as well as to the issue, so a
  run that produces a plan but fails to comment has not lost it.
* **The run log** - every tool call and every tool result, which is what you want when
  the question is "what is it actually doing". This is **on by default** while the
  planner is being piloted, along with the action's own `--debug` output.

  Turn it off with `debug: false` on the calling job once you no longer need it. Do turn
  it off in a **public repository**: a tool result is whatever the agent just read out of
  the code, so leaving it on publishes file contents to a log anyone can read.

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

The plan step is read-only in two independent ways:

* The job runs with `contents: read`, so nothing the agent does to the checkout can ever
  be pushed. This is the boundary that actually holds.
* Editing, writing and shell tools are switched off in the workflow's `claude_args`. This
  is defence in depth, and it stops turns being spent on work that would be discarded.

Both matter, because the agent reads an issue body that any collaborator can write. If you
extend this workflow, keep the `contents: read` permission - it is doing more work than
the tool list.

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
  tied to its `@claude` trigger rather than ours. So the agent returns the plan as a
  one-field structured output and a plain `gh issue comment` step publishes it. That also
  makes the `<!-- ai-plan -->` marker, the `Requested by` footer and the comment size
  check guarantees of the workflow rather than things the model has to remember.
* Every run costs Anthropic API tokens against the key you supply. Keep the command gated
  to the people who should be spending it.
