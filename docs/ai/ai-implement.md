# AI Implement

Part of [AI assisted development](../ai.md).

Builds the plan [AI Plan](ai-plan.md) posted, opens a pull request with it, and then keeps working
on that pull request through its review. Every change after the first one is a **round**: you say
what you want on the pull request, an agent acts on it, answers each of your comments, and pushes.

## Integrating a repository

This is one job in the repository's AI workflow file; [the planner](ai-plan.md) is the other. The
setup both share is in [AI assisted development](../ai.md#integrating-a-repository).

```yaml
name: AI

on:
  issue_comment:
    types: [ created ]
  # Without this, requesting changes on a pull request never starts a round
  pull_request_review:
    types: [ submitted ]

jobs:
  ai-implement:
    permissions:
      contents: write
      issues: write
      pull-requests: write
      # Without this, failing CI checks are simply not part of the feedback
      checks: read
      # Required: without it the check reports cannot be listed or downloaded
      actions: read
      # Needed for pulling the application's Docker images
      packages: read
      # Mints the agent's Claude credential from this run's own identity
      id-token: write
    uses: uniquesca/ci/.github/workflows/ai-implement.yml@main
    with:
      # Identifiers, not secrets. Organisation-level Actions variables, so rotating the rule
      # is one edit rather than one per repository
      anthropic_federation_rule_id: ${{ vars.ANTHROPIC_FEDERATION_RULE_ID }}
      anthropic_organization_id: ${{ vars.ANTHROPIC_ORGANIZATION_ID }}
      anthropic_service_account_id: ${{ vars.ANTHROPIC_SERVICE_ACCOUNT_ID }}
      # Hands each push to AI Review, which can then start the next round. Turn it on once
      # that workflow is subscribed to the event - until then the dispatch lands nowhere
      dispatch_review: true
    secrets:
      # This one pushes and opens pull requests, so it needs an app of its own
      AI_IMPLEMENT_APP_ID: ${{ secrets.AI_IMPLEMENT_APP_ID }}
      AI_IMPLEMENT_PRIVATE_KEY: ${{ secrets.AI_IMPLEMENT_PRIVATE_KEY }}
      # Rendered into this project's config templates to spin the Docker sandbox up. The
      # agent has a shell there, so give it a test environment's and never production's
      ENV_VARIABLES: ${{ secrets.ENV_VARIABLES }}
      # The agent works from this project's dependencies. Pass whichever of the two
      # ecosystems this repository has private packages in
      COMPOSER_ACCESS_TOKEN: ${{ secrets.COMPOSER_ACCESS_TOKEN }}
      NPM_ACCESS_TOKEN: ${{ secrets.NPM_ACCESS_TOKEN }}
```

## Starting the work

Comment `/ai-do` on an issue that already has a plan. Same permission gate as
[the planner](ai-plan.md#triggering-the-planner): admin or write access.

The agent implements the plan on a branch named after the issue, runs whatever tests and linters
it can find, and a pull request appears. The issue gets a comment with the link, and **that
comment is the hand-off** - from then on the issue is only for the plan, and running `/ai-do`
there again replies pointing at the pull request. The exception is a
[revised plan](#when-the-plan-is-revised-under-the-work), which is what `/ai-do` on the issue is
still for: it runs the round on the pull request.

The pull request cites the plan's [ids](ai-plan.md#how-the-plan-is-numbered), and you can use them
talking back to it - "S5 is missing", "C1 still fails" lands exactly where you mean it. The plan's
`C` checks are the agent's to run; its `QA` criteria are for a person to test after this merges, so
they are copied into the pull request body and the agent never reports one as met.

### Basing the work on another branch

**Usually you do not tell this workflow anything.** The plan records the branch it was written
against, and the work is built on that one - so
[`/ai-plan base=develop`](ai-plan.md#planning-against-another-branch) is normally the only place
the branch gets named:

```
/ai-plan base=develop     # planner reads develop, and the plan remembers
/ai-do                    # branch cut from develop, pull request targets develop
```

Say it here when it should differ from the plan - the plan was right, but the landing place moved:

```
/ai-do base=hotfix/1.2
```

For a new branch the base is whichever comes first: `base=` on the command, the branch the plan was
written against, the branch a closed pull request being revived used to target, then the repository
default branch. `base=` is only read as the **first thing after the command**, so the rest of the
comment stays instructions for the agent - `/ai-do also update the changelog` retargets nothing.

**The base is settled on the first run for an issue.** `base=` on a later round is ignored;
retarget the pull request yourself and later rounds follow it.

## Reviewing it, and asking for changes

Two ways to start another round. Both need admin or write access.

**Submit a review as "Request changes".** This is the normal path. Comment on the lines you want
changed, submit the review, and a round starts by itself. Every inline comment in that review is
batched into one round, so you can leave twenty comments over twenty minutes and only pay for one
run.

**Comment `/ai-do` on the pull request.** For when you would rather say what you want in prose, or
re-run with nothing new to say.

An **approved** or plain **commented** review deliberately does nothing. Requesting changes is a
decision; a passing remark is not.

Each round ends with the agent pushing to the same branch, **replying to every thread it was
given**, and posting one summary comment. It replies even to the comments it decided against -
"I did not do this, because X" is where you find out you disagree.

### What to do with a reply

**The agent replies. You resolve.** Nothing here resolves a thread: that is your judgement that the
concern has been dealt with, not the author's claim that it has. Resolve it, reply again to put it
back in play, or leave it - **a thread the agent has answered is skipped by later rounds until
somebody replies to it again**, which is what stops every round redoing the same work.

### Other things the round reads

Besides your review comments, each round picks up anything said in the pull request conversation
since the last round and **any check that is currently failing**, with its annotations - so there is
no need to paste a CI failure in, and a red check is expected to be fixed rather than explained.
Each round also re-reads **the plan on the issue**, so [revising
it](#when-the-plan-is-revised-under-the-work) is how you change the approach rather than the code.

## Wiring CI into the loop

Two opt-in additions, both useful, both independent of each other. Details and traps for each are
in [Dig deeper](#dig-deeper).

**Show the agent what a check printed.** It cannot read job logs, so upload an artifact named
`ai-report-*` from a run on the pull request's head commit. Every match is collected into
`.ai-reports/` before each round, and the agent is told to read it.
[`docker-qa-checks`](../actions/docker-qa-checks.md) and
[`php-qa-checks`](../qa-checks.md#php-qa-checks-workflow) already upload one; for a check of your
own:

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
    branches: [ 'ai-feature/**' ]    # optional, must match `branch_prefix`
```

Your QA workflows run on the agent's commits because the implementing app pushes them, not
the run's own token - Github starts no workflow run from a push made with `GITHUB_TOKEN`.

## Secrets

| Secret | Required | Description |
|---|---|---|
| `AI_IMPLEMENT_APP_ID` | yes | Numeric id of the AI Implement Github App. The app pushes branches and opens or updates pull requests, so QA workflows start from a real app event and the pull request author is distinct from the reviewer |
| `AI_IMPLEMENT_PRIVATE_KEY` | yes | Private key for the AI Implement app. Used only to mint a short-lived installation token; never passed to the agent |
| `ENV_VARIABLES` | no | JSON object of the configuration tokens this repository's config templates are rendered with. Read only when the application is brought up, which is what renders the templates. **The agent can read them**, so make them a test environment's |
| `COMPOSER_ACCESS_TOKEN` | no | Token for cloning Uniques private Composer repositories, so the agent can [check its own work](#what-the-agent-is-given-to-check-with) against installed dependencies. A repository whose dependencies are all public installs without it; one with private dependencies falls back to the artifact reports |
| `NPM_ACCESS_TOKEN` | no | Token for `npm.pkg.github.com`, where the `@uniquesca` NPM scope is served from. The Composer token's counterpart for a JavaScript repository, on the same terms - and it buys more there, because `node_modules` is where the type checker, the framework CLI and the test runner live |

## Inputs

| Input | Type | Default | Description |
|---|---|---|---|
| `anthropic_federation_rule_id` | string | *required* | Identity federation rule the job authenticates against. The agent is called with a token minted from this run's own Github OIDC identity, and the rule is what decides which repositories and branches may mint one. An identifier rather than a secret |
| `anthropic_organization_id` | string | *required* | Anthropic organization the rule belongs to. In the Claude Console under **Settings → Organization** |
| `anthropic_service_account_id` | string | *required* | Service account the minted token acts as. Usage and rate limits are attributed to it |
| `anthropic_workspace_id` | string | *(none)* | Workspace the minted token is scoped to. Only needed when the rule covers more than one workspace - a rule bound to a single workspace resolves it on its own |
| `command` | string | `/ai-do` | Comment command that triggers a round. Has to be at the very beginning of the comment. On an issue it starts the work - or runs a round on the pull request already implementing it, when the plan has been revised since that work last read it; on the pull request it always runs a round |
| `allowed_permissions` | string | `admin write` | Space-separated repository permission levels allowed to run the command. Github reports the maintain role as `write` and triage as `read`, so this covers owners, maintainers and developers |
| `allowed_bots` | string | `github-actions[bot] ai-review[bot]` | Space-separated bot logins allowed to trigger a round. The collaborators API has no answer for a bot, so bots are checked against this list instead. **This has to name the reviewing app's bot login** - `<app-slug>[bot]` - or a review starts no round |
| `model` | string | `claude-opus-4-8` | Model used to implement the plan and to act on review feedback |
| `max_turns` | number | `60` | How many turns the agent may spend before it has to stop with what it has |
| `agent_timeout_minutes` | number | `60` | How long the implementing agent itself may run before it is given up on |
| `timeout_minutes` | number | `65` | How long the whole job may run. Keep it a few minutes above `agent_timeout_minutes`, so a run the agent overruns still has time to say so |
| `branch_prefix` | string | `ai-feature/` | Prefix of the branch the work is pushed to - the branch is this plus `issue-<number>`. Only branches carrying it are ever worked on |
| `allow_workflow_changes` | boolean | `false` | Let the agent change this repository's own workflow files. Off by default, and then a change it wants to `.github/workflows/` is [reported as a patch](#what-the-agent-can-and-cannot-do) instead of pushed. Turning it on needs the AI Implement app to hold the `workflows` permission, which means an agent editing your CI |
| `max_unattended_rounds` | number | `5` | How many rounds in a row a bot may trigger before a person has to look. A round a person asked for resets this to zero |
| `ignore_check_patterns` | string | `(ai.implement\|ai.plan\|ai.review)` | Case-insensitive regular expression matching check runs to leave out of the feedback, so a run does not read its own red status back as a code defect |
| `dispatch_review` | boolean | `false` | Ask [`ai-review`](ai-review.md) to look at the work as soon as it is pushed, with a `repository_dispatch` event. Turn it on only once a workflow is subscribed to that event |
| `review_dispatch_type` | string | `ai-review` | The `repository_dispatch` event type the reviewing workflow listens for. Keep it the same as its `dispatch_type` |
| `request_review` | boolean | `true` | Ask the person who triggered a round to review the pull request when it finishes. Skipped for a bot-triggered round, and when that person opened the pull request themselves |
| `review_check_patterns` | string | `ai.review` | Case-insensitive regular expression matching the reviewing agent's own check runs, used by the [wait](#what-starts-a-round-and-what-it-reads). Deliberately separate from `ignore_check_patterns` - the gate has to see what the feedback must not |
| `provision_checks` | boolean | `true` | Set the runner up before the agent starts and tell it the exact commands CI will check its work with. Detected from the repository rather than configured - see [what it is given to check with](#what-the-agent-is-given-to-check-with). The master switch for all of it: turn it off and nothing is prepared |
| `spin_up_docker` | boolean | `true` | Bring the application up when the repository has a `task.sh` or a compose file. `timeout_minutes` needs room above `agent_timeout_minutes` for it |
| `docker_profile` | string | `''` | Docker Compose profile to bring up, for a repository whose test services are behind one |
| `node_version` | number | `20` | Node version the JavaScript dependencies are installed under. The same default as [`npm-qa-checks`](../qa-checks.md#npm-qa-checks-workflow), so the two agree unless both are changed |
| `debug` | boolean | `false` | Log the raw agent transcript as JSON. **Not for a public repository** - tool results contain whatever the agent read |

## Outputs

None. The result is a branch, a pull request and a round comment.

## Dig deeper

### What the agent is given to check with

The agent is handed this repository's own linters and tests, so a clean run here is a clean run in
CI: `phpcbf`, `phpcs` and `psalm` as `phpcs.xml` and `psalm.xml` configure them, the `npm run`
scripts the package declares, and whichever of `cs-fix`, `code-quality`, `cs-check`, `psalm` and
`test` a `task.sh` answers `./task.sh supports` with. They are worked out from the same
configuration files [`php-qa-checks`](../qa-checks.md#php-qa-checks-workflow) and
[`npm-qa-checks`](../qa-checks.md#npm-qa-checks-workflow) read, and the fixer is run before the
reporter. `phpcbf` fixes the whole repository rather than the diff, so a round can sweep in
violations that were already there. `provision_checks: false` skips all of it.

The dependencies those commands come out of are installed where they run: through `./task.sh
composer install` and `./task.sh yarn install` for a repository whose application is up, and on the
runner for one without a container task for that ecosystem. Either way they land in the working
tree, and an install that fails costs the round its checks rather than the round.

### What starts a round, and what it reads

After a round pushes, your QA workflows and the reviewing agent run in parallel and finish in either
order, so each one starting a round asks Github whether the other is still reporting on that commit:
the first to finish exits having posted nothing, and the second runs the round with both sets of
feedback. There is no handshake between them, so a duplicated or lost trigger cannot wedge it, and
nothing waits for a reviewer that was never dispatched. These rounds count as unattended against
[the round cap](#the-round-cap), which is what stops the round → push → CI → round cycle running
away. **`workflow_run` only fires when the workflow file containing it is on the default branch**,
which on a feature branch looks exactly like a broken gate.

A round reads your review and conversation comments by **time**, from a watermark the previous round
recorded when it started reading rather than when it finished, so a review submitted while a round
is running lands on the next one. Threads and failing checks are read by **state** instead, because
"still unresolved" and "currently red" are not questions about when something was said.

What those rules exclude is staged separately as the settled record: threads already answered or
resolved, and earlier reviews. None of it is work. Where the feedback asks again for something the
record shows was settled, the round replies saying where it was settled and leaves the code alone.

### The round cap

The count is only ever consecutive rounds a bot started, and any round a person asks for resets it
to zero - so `max_unattended_rounds`, default `5`, is not "five rounds per pull request", and
iterating with a human is uncapped. Past the limit the round is refused with a comment asking for a
person. A round counts as a bot's when the actor is a `Bot` or the review body starts with
`<!-- ai-review -->`; the marker is what catches a review token belonging to a machine *user*
account, which Github reports as authored by a `User`.

### When the base moves under the work

A first run replays its work on top of the base as it stands at the moment of the push, and the run
log says so under `work replayed:`. That is what stops a spurious refusal: a branch being created
has no previous tip, so Github compares the workflow files it carries against the default branch,
and a branch cut before somebody edited one still carries the older copy - which reads as this push
updating a workflow file. Rounds are not replayed, because they push to a branch Github can compare
against its own previous tip. A replay that hits a conflict pushes the work as it was cut, with a
warning, and the pull request arrives wanting a rebase.

### When the plan is revised under the work

**Revising a plan never starts a round** - ask for one with `/ai-do` or a review. Each round
compares the plan comment against its watermark and reconciles a newer one against the whole
branch: what the plan now asks for is added, what it no longer asks for comes back out, and your
feedback still wins where the two disagree. Editing a plan comment in place is not a revision,
because the comparison is on when it was posted. `/ai-do` on the issue is the shortest way to ask -
against a plan newer than the open pull request was built to, it runs the round there and says on
the issue where the work went.

### What the agent can and cannot do

It **may** read and change any file in the checkout and run any command on the runner - it has a
shell on purpose, because without one the plan's `C` checks would be a list rather than something it
executes. It **may not**:

* **Write to the default branch.** Everything lands on its own branch, behind a pull request
  somebody reviews and merges. Nothing here merges anything.
* **Push, commit, or comment.** The checkout runs with `persist-credentials: false`, so there is no
  git credential on disk while the agent is working - the workflow supplies one per command, before
  the agent starts and after it finishes.
* **Change a workflow file.** Github refuses a push touching `.github/workflows/` from an identity
  without the `workflows` permission, and a refusal loses the rest of the round with it - so the
  change arrives as a `git apply`-able patch appended to the run's report, to apply by hand. Set
  `allow_workflow_changes` where the app holds that permission and you want an agent editing CI.
* **Change the plan or the feedback it was given.** Both are excluded from git. Its replies to your
  threads are the one thing it writes back, and a reply to a thread that was not part of this round
  is discarded.

It is also told to leave `CHANGELOG.md` alone, because the release generates it from the git log.

What actually limits this is the permission gate and the branch check, not the list above: an agent
with a shell runs whatever an issue body or a review comment talks it into. Keep the gate at
`admin write` or narrower, and do not widen the trigger to anything a stranger can fire.
