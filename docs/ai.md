# AI

AI-assisted parts of the CI framework. They call Anthropic's API directly through
the official SDK, so every one of them needs an API key passed in from a secret.

Currently available:
1. [AI Plan workflow](#ai-plan-workflow) - reusable workflow that plans a Github
   issue when a comment asks it to
2. [ai-plan action](#ai-plan-action) - the planning step on its own, for wiring
   into a workflow of your own

## AI Plan workflow

Reusable workflow that turns a Github issue into an implementation plan on demand.
Someone comments `/ai-plan` on an issue, and the plan is posted back as a comment
on the same issue.

What happens on each command:
1. The comment is checked - it has to be a new comment on a real issue, starting
   with the command. Comments on pull requests are ignored.
2. The commenter's permission level in the repository is checked. Anyone not
   allowed gets a comment explaining that, and the run fails.
3. The **body of the issue** is taken as the task. Anything typed after the command
   in the comment is ignored. An issue with an empty body gets a comment saying so
   and the run stops there without failing - there is nothing to plan, which is not
   a CI error.
4. The [`ai-plan`](#ai-plan-action) action produces the plan.
5. The readable plan is posted as an issue comment, with the machine-friendly plan
   carried along inside it - see [the hidden plan marker](#the-hidden-plan-marker).

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
* **`types: [ created ]`** keeps edits to an existing comment from planning the issue
  a second time. The workflow checks this too, so it is safe either way.

### Inputs

All optional:

* `command` - the comment command to react to, default `/ai-plan`. It has to be at
  the very beginning of the comment.
* `allowed_permissions` - space-separated repository permission levels allowed to run
  the command, default `admin write`.
* `timeout_minutes` - how long to wait for the planning agent, default `30`.

Required secret:

* `ANTHROPIC_API_KEY` - see [providing the API key](#providing-the-api-key).

### Who is allowed to run it

The commenter's permission comes from the repository collaborators API, not from the
comment payload, so team and organisation grants are taken into account.

That API reports the six repository roles as four levels - **`maintain` is reported as
`write`, and `triage` is reported as `read`**. The default `admin write` therefore
means:

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

If the permission check itself fails - a token without the access to read
collaborators, for example - the run fails loudly rather than quietly treating the
commenter as unauthorised.

## ai-plan action

Asks an AI agent to turn a free-form task description into an implementation plan
in two forms at once:
* a human-readable markdown document, meant to be posted for review
* a machine-friendly JSON document, meant to be handed to a downstream AI
  implementor agent

The plan is produced from the task text alone - the action does not check out or
read the repository, so anything the agent needs to know has to be in the `task`
input.

### Inputs

* `task` (required) - the task to plan for, plain text or markdown
* `api_key` (required) - Anthropic API key, pass it from a secret

### Outputs

* `plan` - the plan as markdown
* `plan_json` - the plan as a JSON string, see [the plan shape](#the-plan-shape)

### Usage

Use the action directly when the [workflow](#ai-plan-workflow) above does not fit -
planning something that is not an issue, for example:

```yaml
name: Plan a task

on:
  workflow_dispatch:
    inputs:
      task:
        description: 'What should be planned'
        required: true

jobs:
  plan:
    runs-on: ubuntu-latest
    steps:
      - name: Generate the plan
        id: plan
        uses: uniquesca/ci/ai-plan@main
        with:
          task: ${{ inputs.task }}
          api_key: ${{ secrets.ANTHROPIC_API_KEY }}

      - name: Publish the plan
        env:
          PLAN: ${{ steps.plan.outputs.plan }}
        run: echo "$PLAN" >> "$GITHUB_STEP_SUMMARY"
```

Pass the plan through the environment as shown above rather than interpolating
`${{ steps.plan.outputs.plan }}` straight into a `run` script. The plan is
model-generated multi-line text, and interpolating it inline would both break on
quoting and let its contents run as shell commands.

To feed the machine-friendly plan to another step, use `plan_json` the same way:

```yaml
      - name: Hand the plan to the implementor
        env:
          PLAN_JSON: ${{ steps.plan.outputs.plan_json }}
        run: |
          echo "$PLAN_JSON" | jq -r '.steps[] | "\(.id): \(.title)"'
```

## Providing the API key

The key is read from the `api_key` input only - the action deliberately ignores
`ANTHROPIC_API_KEY` in the environment, so the credential is always visible in the
workflow that supplies it.

1. Add the key as an Actions secret under **Settings -> Secrets and variables ->
   Actions**, at repository or organisation level.
2. Pass it in as `api_key` for the action, or as the `ANTHROPIC_API_KEY` secret for
   the workflow.

The action calls `core.setSecret()` on the value before using it, so it stays
masked in the logs even if an error message quotes it.

Two cases where the secret will not reach the action:
* **Pull requests from forks** - `pull_request` runs for forks get no secrets at
  all, and the action fails with `api_key is not set`. Use `pull_request_target`
  or an `issue_comment` trigger if fork contributions need planning.
* **Reusable workflows** - a job called through `workflow_call` needs
  `secrets: inherit`, or the secret listed explicitly in the caller's `secrets:`
  block, as in the example above. Secrets do not cross the `workflow_call` boundary
  on their own.

## The plan shape

`plan_json` is a JSON object with a guaranteed shape - the agent is constrained by
a schema, so the output always parses and always contains every field below:

* `task` - the agent's restatement of the task the plan addresses
* `summary` - short overview of the approach
* `steps` - ordered array of steps, each with:
  * `id` - stable integer identifier, starting at 1
  * `title` - short imperative title
  * `details` - what to do and why
  * `files` - array of files the step is expected to create or modify
  * `depends_on` - array of step ids that must be completed first
* `risks` - array of risks, unknowns and assumptions worth flagging
* `verification` - array of concrete checks proving the task is complete

Arrays are always present but may be empty - a plan with no flagged risks has
`"risks": []`, not a missing key.

### The hidden plan marker

The comment posted by the [workflow](#ai-plan-workflow) ends with a marker that
Github renders as nothing:

```
<!-- ai-plan:v1 <base64 of plan_json> -->
```

This is where the machine-friendly plan lives between runs - a workflow output only
exists for the length of its own run, so a later step, such as an implementor agent
triggered by a second command, reads the plan back out of the comment. Keeping both
forms in one comment means the plan a human reviewed and the plan an agent executes
cannot drift apart.

The payload is base64 encoded on purpose: a plan is free to contain `-->` in its own
text, and an encoded single line survives someone editing the comment around it.

To read the most recent plan off an issue:

```bash
body=$(gh api --paginate --slurp "repos/$GH_REPO/issues/$ISSUE/comments" \
  --jq 'flatten
        | map(select(.user.login == "github-actions[bot]"))
        | map(select(.body | test("<!-- ai-plan:v1 ")))
        | last | .body')

printf '%s' "$body" \
  | sed -n 's/.*<!-- ai-plan:v1 \([A-Za-z0-9+/=]*\) -->.*/\1/p' | tail -1 | base64 -d
```

Filtering on `github-actions[bot]` matters. Without it, any commenter can paste a
forged marker and hand an implementor agent instructions of their own.

Two consequences worth knowing:
* Running the command again posts a new comment, and "the last comment carrying the
  marker" is the current plan. Older plans stay in the issue history.
* Editing the readable markdown in a posted comment does not change the encoded plan.
  Treat approval as all or nothing - accept the plan as posted, or run the command
  again after amending the issue.

## Notes

* The action uses an Opus-tier model with extended thinking and a high effort
  budget, so a call can run well past the usual length of a CI step. Set
  `timeout-minutes` on the job accordingly, or `timeout_minutes` on the workflow.
  The model and its settings live in `src/ai-plan.js` - `PLAN_MODEL` is the value
  to change.
* The model is allowed to decline a task. When it does, the step fails with
  `AI agent declined to produce a plan for this task` rather than emitting an
  empty plan.
* A Github issue comment cannot exceed 65536 characters. The workflow checks the
  size before posting and fails with the full plan in the run summary rather than
  letting the API reject it.
* Every run costs Anthropic API tokens against the key you supply. Keep the command
  gated to the people who should be spending it.
