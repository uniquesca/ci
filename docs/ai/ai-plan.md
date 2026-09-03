# AI Plan

Part of [AI assisted development](../ai.md).

Turns a Github issue into an implementation plan. Somebody comments `/ai-plan` on an issue, an
agent reads the issue and the real code, and the plan is posted back as a comment on the same
issue.

## Integrating a repository

This is one job in the repository's AI workflow file; [the implementer](ai-implement.md) is the
other. The setup both share is in [AI assisted development](../ai.md#integrating-a-repository).

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
      # Buys one comment - telling an open pull request its plan moved
      pull-requests: write
      # Mints the agent's Claude credential from this run's own identity
      id-token: write
    uses: uniquesca/ci/.github/workflows/ai-plan.yml@v11
    with:
      # Identifiers, not secrets. Organisation-level Actions variables, so rotating the rule
      # is one edit rather than one per repository
      anthropic_federation_rule_id: ${{ vars.ANTHROPIC_FEDERATION_RULE_ID }}
      anthropic_organization_id: ${{ vars.ANTHROPIC_ORGANIZATION_ID }}
      anthropic_service_account_id: ${{ vars.ANTHROPIC_SERVICE_ACCOUNT_ID }}
    secrets:
      # The agent plans against this project's dependencies. Pass whichever of the two
      # ecosystems this repository has private packages in
      COMPOSER_ACCESS_TOKEN: ${{ secrets.COMPOSER_ACCESS_TOKEN }}
      NPM_ACCESS_TOKEN: ${{ secrets.NPM_ACCESS_TOKEN }}
```

## Triggering the planner

Comment `/ai-plan` on an issue, with the command at the very beginning. **The issue body is what
gets planned** - prose typed after the command is ignored, so put the task in the issue. Only
collaborators with admin or write access can run it, and the plan comes back as a single comment a
few minutes later.

### Planning against another branch

The planner reads the default branch unless you name another, and it only needs naming once - the
plan records the branch, and later commands follow it:

```
/ai-plan base=develop     # plans against develop, and records it
/ai-plan                  # replans against develop - no need to say it again
/ai-do                    # branch cut from develop, pull request targets develop
```

`base=` is only read as the first thing after the command. Replanning with a different one overrides
what the last plan recorded, which is how you correct a plan written against the wrong branch;
`/ai-do` inherits the same way, described under
[basing the work on another branch](ai-implement.md#basing-the-work-on-another-branch).

## How the plan is numbered

Every item carries an id, and feedback can use it - "S4 and S5 are the wrong way round" lands
precisely without quoting a paragraph back:

| Prefix | Section | What it is |
|---|---|---|
| `S1`, `S2` | Steps | The work, in the order it should be done |
| `R1`, `R2` | Risks, unknowns and assumptions | Something that could go wrong |
| `U1`, `U2` | Risks, unknowns and assumptions | Something the agent could not determine, or is assuming |
| `C1`, `C2` | Checks | A check that proves the work is done. The [implementing agent](ai-implement.md) runs these itself |
| `QA1`, `QA2` | QA acceptance criteria | What to test by hand, written for somebody who will not read the code. Each names the steps it covers, as `QA1 (S2, S5)` |

**Ids are stable across revisions.** An item that survives keeps its number even if it was
reworded, new work takes the next number the plan has never used, and a dropped one is struck
through on its section's `Retired:` line rather than renumbered away - so gaps are normal, and
steps are listed in the order to work in rather than in numeric order.

## Adjusting the plan

Three ways, depending on how wrong it is. **A small correction** - edit the comment; there is no
second copy, so editing the markdown is editing the plan. **Feedback and revision** - say what you
want in the thread and run `/ai-plan` again; the agent takes the most recent plan as its starting
point and applies what was asked for after it was posted, so parts nobody objected to survive.
**The task itself was wrong** - edit the issue body and run `/ai-plan` again.

Work already started is no obstacle: revise the plan on the issue, then ask for an
[implementing round](ai-implement.md#when-the-plan-is-revised-under-the-work) when the branch
should be brought in line. Expect a large one - it takes out the code for a step the revision
dropped as well as adding what it now asks for.

## Secrets

| Secret | Required | Description |
|---|---|---|
| `COMPOSER_ACCESS_TOKEN` | no | Token for cloning Uniques private Composer repositories, so the agent plans against [the source of what this project depends on](#what-the-agent-can-and-cannot-do). A repository whose dependencies are all public installs without it; one with private dependencies is planned without them |
| `NPM_ACCESS_TOKEN` | no | Token for `npm.pkg.github.com`, where the `@uniquesca` NPM scope is served from. The Composer token's counterpart for a JavaScript repository, on the same terms |

## Inputs

| Input | Type | Default | Description |
|---|---|---|---|
| `anthropic_federation_rule_id` | string | *required* | Identity federation rule the job authenticates against. The agent is called with a token minted from this run's own Github OIDC identity, and the rule is what decides which repositories and branches may mint one. An identifier rather than a secret |
| `anthropic_organization_id` | string | *required* | Anthropic organization the rule belongs to. In the Claude Console under **Settings → Organization** |
| `anthropic_service_account_id` | string | *required* | Service account the minted token acts as. Usage and rate limits are attributed to it |
| `anthropic_workspace_id` | string | *(none)* | Workspace the minted token is scoped to. Only needed when the rule covers more than one workspace - a rule bound to a single workspace resolves it on its own |
| `command` | string | `/ai-plan` | Comment command that triggers the planning. Has to be at the very beginning of the comment |
| `allowed_permissions` | string | `admin write` | Space-separated repository permission levels allowed to run the command. Github reports the maintain role as `write` and triage as `read`, so this covers owners, maintainers and developers |
| `model` | string | `claude-opus-4-8` | Model used to produce the plan |
| `max_turns` | number | `50` | How many turns the agent may spend reading the repository before it has to plan with what it found |
| `agent_timeout_minutes` | number | `30` | How long the planning agent itself may run before it is given up on |
| `timeout_minutes` | number | `45` | How long the whole job may run. Keep it above `agent_timeout_minutes` plus what installing this project's dependencies costs |
| `install_dependencies` | boolean | `true` | Install this project's Composer and NPM dependencies before the agent starts, so it plans against [what the project really depends on](#what-the-agent-can-and-cannot-do). Detected from the repository - a manifest is what decides |
| `node_version` | number | `20` | Node version the JavaScript dependencies are installed under. The same default as [`npm-qa-checks`](../qa-checks.md#npm-qa-checks-workflow) |
| `branch_prefix` | string | `ai-feature/` | Prefix of the branch [`ai-implement`](ai-implement.md) pushes to, used to find the pull request already implementing this issue. Keep the two the same |
| `debug` | boolean | `false` | Log the raw agent transcript as JSON. **Not for a public repository** - tool results contain whatever the agent read |

## Outputs

None. The plan is posted as a comment on the issue.

## Dig deeper

### Getting better plans

The most effective thing is an `AGENTS.md` or `CLAUDE.md` in the repository being planned - the
agent reads it first, and it saves several turns of inferring conventions from a sample of files.
Worth putting in it: how to build and test, how the code is laid out, and the conventions a change
is expected to follow.

### What the agent can and cannot do

It has **no shell and no network**, and only ever reads files - the issue and its comments are
written into the checkout by [`ai-stage-issue`](../actions/ai-stage-issue.md) first, which is also
what keeps issue text out of the workflow file. Dependencies reach it the same way, a
`composer.json` getting `vendor/` and a `package.json` getting `node_modules`, so it plans against
the signature a library actually exposes; an install that fails leaves a warning and a plan written
from the code alone.

The step is read-only in two independent ways: the job holds `contents: read`, and the editing,
writing and shell tools are switched off. If you extend this workflow, keep `contents: read` - it
does more work than the tool list.

### When a run goes wrong

A failed run comments on the issue rather than going red where nobody looking at the issue can see
it, and says why the agent stopped wherever the log recorded a reason.

**A run that overran `max_turns` is not a failed run, whatever its step says.** `claude-code-action`
checks the turn count after the agent has already stopped and fails its own step when the count came
out over the limit, which happens because the limit is not enforced on a long run
([#1577](https://github.com/anthropics/claude-code-action/issues/1577)). The plan is complete, so it
is posted with a warning on the run instead. A run genuinely cut off part-way reports
`error_max_turns`, and that one fails with nothing posted.

The `Show what the agent did` step is printed on every run, failed ones included, and the run
summary carries a copy of the finished plan. `debug: true` adds the raw transcript - never on a
public repository, because a tool result is whatever the agent just read out of the code.
