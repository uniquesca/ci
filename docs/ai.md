# AI

AI-assisted parts of the CI framework. They call Anthropic's API directly through
the official SDK, so every one of them needs an API key passed in from a secret.

Currently available:
1. [`ai-plan`](#ai-plan) action - turns a task into an implementation plan

## ai-plan

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
        uses: uniquesca/ci/ai-plan@v9
        with:
          task: ${{ inputs.task }}
          api_key: ${{ secrets.ANTHROPIC_API_KEY }}

      - name: Publish the plan
        shell: bash
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
        shell: bash
        env:
          PLAN_JSON: ${{ steps.plan.outputs.plan_json }}
        run: |
          echo "$PLAN_JSON" | jq -r '.steps[] | "\(.id): \(.title)"'
```

### Providing the API key

The key is read from the `api_key` input only - the action deliberately ignores
`ANTHROPIC_API_KEY` in the environment, so the credential is always visible in the
workflow that supplies it.

1. Add the key as an Actions secret under **Settings -> Secrets and variables ->
   Actions**, at repository or organisation level.
2. Pass it in as `api_key`, as in the example above.

The action calls `core.setSecret()` on the value before using it, so it stays
masked in the logs even if an error message quotes it.

Two cases where the secret will not reach the action:
* **Pull requests from forks** - `pull_request` runs for forks get no secrets at
  all, and the action fails with `api_key is not set`. Use `pull_request_target`
  or an `issue_comment` trigger if fork contributions need planning.
* **Reusable workflows** - a job called through `workflow_call` needs
  `secrets: inherit`, or the secret listed explicitly in the caller's `secrets:`
  block. Secrets do not cross the `workflow_call` boundary on their own.

### The plan shape

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

### Notes

* The action uses an Opus-tier model with extended thinking and a high effort
  budget, so a call can run well past the usual length of a CI step. Set
  `timeout-minutes` on the job accordingly. The model and its settings live in
  `src/ai-plan.js` - `PLAN_MODEL` is the value to change.
* The model is allowed to decline a task. When it does, the step fails with
  `AI agent declined to produce a plan for this task` rather than emitting an
  empty plan.
* Every run costs Anthropic API tokens against the key you supply. Prefer
  explicit triggers - `workflow_dispatch`, a label, a slash command in a comment -
  over running the action on every push.
