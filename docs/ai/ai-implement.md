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
  requesting changes never starts a round.
* **`checks: read`** on the job. Without it, failing CI checks are simply not part of the feedback.

You also need [a Github App](#the-github-apps) - this workflow does not run without one.
[Wiring CI into the loop](#wiring-ci-into-the-loop) then adds two optional things: showing the agent
what a check printed, and letting a red check start a round.

## The Github Apps

**Two apps, not one.** The implementing app pushes the branch and opens the pull request; the
reviewing app reviews it. Github rejects a `REQUEST_CHANGES` review from the identity that opened
the pull request, so one app doing both means the review can never block anything or start a round.

Both apps already exist at the organisation level, so there is nothing to create. **Ask a Uniques
Github administrator to grant them access to the repository**, and to confirm their id and private
key are readable from it as these secrets:

| Secret | App |
|---|---|
| `AI_IMPLEMENT_APP_ID` / `AI_IMPLEMENT_PRIVATE_KEY` | AI Implement |
| `AI_REVIEW_APP_ID` / `AI_REVIEW_PRIVATE_KEY` | AI Review |

An app that has not been granted the repository fails the run on its first step, which is the one
thing here that fails loudly. Two that do not:

* **`allowed_bots` has to name the reviewing app's bot login** - `<app-slug>[bot]`, the app name
  lowercased and hyphenated. A review from a login that is not in the list starts no round.
* **Neither app holds Workflows: write**, so a branch touching `.github/workflows` is refused. That
  is deliberate - see [what the agent can and cannot do](#what-the-agent-can-and-cannot-do).

Commits are then authored by `<app-slug>[bot]`, and pull requests opened by it, so the loop reads as
two named participants rather than as `github-actions[bot]` arguing with itself. The planner needs no
app of its own: it only comments, which the run's own token does.

## Starting the work

Comment `/ai-do` on an issue that already has a plan. Same permission gate as
[the planner](ai-plan.md#triggering-the-planner): admin or write access.

The agent implements the plan on a branch named after the issue, runs whatever tests and linters
it can find, and a pull request appears. The issue gets a comment with the link, and **that
comment is the hand-off** - from then on the issue is only for the plan, and running `/ai-do`
there again replies pointing at the pull request. The exception is a
[revised plan](#when-the-plan-is-revised-under-the-work), which is what `/ai-do` on the issue is
still for: it runs the round on the pull request.

The pull request body and every round comment cite the plan's
[ids](ai-plan.md#how-the-plan-is-numbered) - `(S3)` after the change that implements step 3, `(C2)`
after the check that passed - always next to what is being said rather than in place of it. The
plan's `C` checks are the agent's to run; its `QA` criteria are for a person to test after this
merges, and the agent never reports one as met - they are
[copied into the pull request body](#the-qa-criteria-on-the-pull-request), so testing it does not
mean going back to the issue. You can use the same ids talking back to it: "S5 is missing", "C1
still fails" lands exactly where you mean it.

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

The branch is created from `hotfix/1.2` and the pull request targets it. Doing this when the plan
named a different branch gets a comment saying which one won.

In full, for a new branch, most specific first:

1. `base=` on the `/ai-do` command
2. the branch the plan was written against
3. the branch a closed pull request being revived used to target
4. the repository default branch

`base=` is only read when it is the **first thing after the command**, so the rest of the comment
stays what it has always been - instructions for the agent. `/ai-do also update the changelog` is
not a request to retarget anything. Surrounding backticks are stripped, so ``/ai-do base=`develop` ``
works too.

A branch that does not exist gets a comment and nothing else - no branch, no pull request, and a
green run. A branch the *plan* named that has since been merged and deleted fails the run instead,
loudly. The base is only ever settled on the **first** run for an issue; see
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
decision; a passing remark is not.

Each round ends with the agent pushing to the same branch, **replying to every thread it was
given**, and posting one summary comment. It replies even to the comments it decided against -
"I did not do this, because X" is where you find out you disagree.

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

Each round also re-reads **the plan on the issue**, so [revising
it](#when-the-plan-is-revised-under-the-work) with `/ai-plan` is how you change the approach rather
than the code.

## Checking its own work

Before the agent starts, this workflow sets the runner up the way CI sets it up - configuration
rendered, application running, dependencies installed - and tells it the exact commands CI is going
to check its work with. The agent runs the fixer, runs the reporter, and pushes something that has
already passed, rather than spending a whole round finding out about a style violation.

Nothing to configure. It reads the repository and works out what applies:

| What it finds | What happens |
|---|---|
| `task.sh`, or a compose file | The application is brought up, which renders `_ci_environment.json`'s `configs` from the tokens you pass and keeps them out of the round's commit. With a `task.sh`, the agent is given whichever of `cs-fix`, `code-quality`, `cs-check`, `psalm` and `test` it supports |
| `composer.json` and a `phpcs.xml` or `psalm.xml`, or either one's `.dist` | Composer dependencies installed, and the agent is given `phpcbf`, `phpcs` and `psalm` as they are configured here |
| `composer.json` and neither | Nothing to install Composer dependencies for |
| `package.json` | NPM or Yarn dependencies installed, so this project's own toolchain under `node_modules/.bin` runs. The agent is given whichever of `npm run lint` and `npm run test` the package declares |
| Neither manifest | Nothing - the agent works out what it can run for itself |

A repository that is both a PHP application and a JavaScript one is treated as both, and gets one
merged list of commands.

Configuration tokens go in as a secret, and the agent has a shell, so **give it a test
environment's and never production's**:

```yaml
jobs:
  ai-implement:
    permissions:
      # What the run's own token pulls the images with - see below
      packages: read
    uses: uniquesca/ci/.github/workflows/ai-implement.yml@main
    with:
      # The default is 65 against an agent_timeout_minutes of 60, and pulling images eats that gap
      timeout_minutes: 80
    secrets:
      ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
      ENV_VARIABLES: ${{ secrets.ENV_VARIABLES }}
```

Images need no secret: `ghcr.io` is logged into with the run's own token, which is what
[`packages: read`](#pulling-the-images) is for. Add `COMPOSER_ACCESS_TOKEN` and `NPM_ACCESS_TOKEN`
for whichever of the two ecosystems has private dependencies. Everything the agent is told to run
is in
[Dig deeper](#what-the-agent-is-given-to-check-with).

Tests that need a browser, and anything else no `task.sh` task covers, are still the artifact
loop's job, below.

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

jobs:
  ai-implement:
    permissions:
      actions: read     # without this the reports cannot be listed or downloaded
```

Your QA workflows run on the agent's commits because [the app](#the-github-apps) pushes them, not
the run's own token - Github starts no workflow run from a push made with `GITHUB_TOKEN`.

## Secrets

| Secret | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | yes | Anthropic API key used to call the AI implementing agent |
| `AI_IMPLEMENT_APP_ID` | yes | Numeric id of [the AI Implement Github App](#the-github-apps). The app pushes branches and opens or updates pull requests, so QA workflows start from a real app event and the pull request author is distinct from the reviewer |
| `AI_IMPLEMENT_PRIVATE_KEY` | yes | Private key for the AI Implement app. Used only to mint a short-lived installation token; never passed to the agent |
| `ENV_VARIABLES` | no | JSON object of the configuration tokens this repository's config templates are rendered with. Read only when the application is brought up, which is what renders the templates. **The agent can read them**, so make them a test environment's |
| `COMPOSER_ACCESS_TOKEN` | no | Token for cloning Uniques private Composer repositories, so the agent can [check its own work](#checking-its-own-work) against installed dependencies. A repository whose dependencies are all public installs without it; one with private dependencies falls back to the artifact reports |
| `NPM_ACCESS_TOKEN` | no | Token for `npm.pkg.github.com`, where the `@uniquesca` NPM scope is served from. The Composer token's counterpart for a JavaScript repository, on the same terms - and it buys more there, because `node_modules` is where the type checker, the framework CLI and the test runner live |

## Inputs

| Input | Type | Default | Description |
|---|---|---|---|
| `command` | string | `/ai-do` | Comment command that triggers a round. Has to be at the very beginning of the comment. On an issue it starts the work - or runs a round on the pull request already implementing it, when the plan has been revised since that work last read it; on the pull request it always runs a round |
| `allowed_permissions` | string | `admin write` | Space-separated repository permission levels allowed to run the command. Github reports the maintain role as `write` and triage as `read`, so this covers owners, maintainers and developers |
| `allowed_bots` | string | `github-actions[bot] ai-review[bot]` | Space-separated bot logins allowed to trigger a round. The collaborators API has no answer for a bot, so bots are checked against this list instead. **This has to name [the reviewing app](#the-github-apps)** - `<app-slug>[bot]` - or a review starts no round |
| `model` | string | `claude-opus-4-8` | Model used to implement the plan and to act on review feedback |
| `max_turns` | number | `60` | How many turns the agent may spend before it has to stop with what it has |
| `agent_timeout_minutes` | number | `60` | How long the implementing agent itself may run before it is given up on |
| `timeout_minutes` | number | `65` | How long the whole job may run. Keep it a few minutes above `agent_timeout_minutes`, so a run the agent overruns still has time to say so |
| `branch_prefix` | string | `ai-feature/` | Prefix of the branch the work is pushed to - the branch is this plus `issue-<number>`. Only branches carrying it are ever worked on |
| `max_unattended_rounds` | number | `5` | How many rounds in a row a bot may trigger before a person has to look. A round a person asked for resets this to zero |
| `ignore_check_patterns` | string | `(ai.implement\|ai.plan\|ai.review)` | Case-insensitive regular expression matching check runs to leave out of the feedback, so a run does not read its own red status back as a code defect |
| `dispatch_review` | boolean | `false` | Ask [`ai-review`](ai-review.md) to look at the work as soon as it is pushed, with a `repository_dispatch` event. Turn it on only once a workflow is subscribed to that event |
| `review_dispatch_type` | string | `ai-review` | The `repository_dispatch` event type the reviewing workflow listens for. Keep it the same as its `dispatch_type` |
| `request_review` | boolean | `true` | Ask the person who triggered a round to review the pull request when it finishes. Skipped for a bot-triggered round, and when that person opened the pull request themselves |
| `review_check_patterns` | string | `ai.review` | Case-insensitive regular expression matching the reviewing agent's own check runs, used by the [wait](#how-the-wait-works). Deliberately separate from `ignore_check_patterns` - the gate has to see what the feedback must not |
| `provision_checks` | boolean | `true` | Set the runner up before the agent starts and tell it the exact commands CI will check its work with. Detected from the repository rather than configured - see [checking its own work](#checking-its-own-work). The master switch for all of it: turn it off and nothing is prepared |
| `spin_up_docker` | boolean | `true` | Bring the application up when the repository has a `task.sh` or a compose file. `timeout_minutes` needs room above `agent_timeout_minutes` for it |
| `docker_profile` | string | `''` | Docker Compose profile to bring up, for a repository whose test services are behind one |
| `node_version` | number | `20` | Node version the JavaScript dependencies are installed under. The same default as [`npm-qa-checks`](../qa-checks.md#npm-qa-checks-workflow), so the two agree unless both are changed |
| `debug` | boolean | `false` | Log the raw agent transcript as JSON. **Not for a public repository** - tool results contain whatever the agent read |

## Outputs

None. The result is a branch, a pull request and a round comment.

## Dig deeper

### What the agent is given to check with

The commands are the ones [`php-qa-checks`](../qa-checks.md#php-qa-checks-workflow),
[`npm-qa-checks`](../qa-checks.md#npm-qa-checks-workflow) and
[`docker-qa-checks`](../actions/docker-qa-checks.md) run, worked out from the same configuration
files, so the agent gets the answer CI will rather than one that differs by a flag - which is also
why the Node scripts are given as `npm run`, whichever package manager installed them. In a container
the tasks come from `./task.sh supports`, so a task that was renamed is never offered. Each one is
listed with what it does, since the set overlaps - `code-quality` is the fixer and both reporters in
one call, and an agent told only the names runs it and then the three tools inside it again.

The agent is told to run the fixer before the reporter, and that a clean run is the floor: the plan's
`C` checks and this repository's tests are still its own to find and run. A `test` task is given as
**one run per job**, because the unit tests share the container's database and leave state in it - so
a failure appearing only in a second run may be the first run's leftovers.

Two things end up in the commit that a reviewer may not expect:

* **`phpcbf` fixes the whole repository, not the diff.** Violations that were there before the round
  are swept into it - the same thing [`cs-fix`](../actions/cs-fix.md) would have done a round later.
* **A repository that commits `vendor/` or `node_modules`** gets the install in the commit and in
  the review diff. The run warns when installing changed tracked files and lists them, rather than
  acting on it.

`composer.lock`, `package-lock.json`, `yarn.lock`, `vendor/`, `node_modules` and every path in
`_ci_environment.json`'s `configs` are added to `.git/info/exclude`, so the round does not push a
lock file a library never committed, a dependency tree the repository neither commits nor ignores,
or a rendered config holding the credentials it was rendered from. That only hides untracked files:
a repository that *commits* a file it renders gets a warning naming it and the file goes into the
pull request, so either gitignore it or do not give this workflow a secret you would mind reading
there. Anything the containers write into the checkout is swept into the commit unless the
repository already ignores it, which is why they run as the runner's own user rather than as root.

A lock file that *is* tracked cannot be hidden that way, so a repository with one is installed with
`npm ci` or `yarn install --frozen-lockfile` - `npm install` would rewrite it into the pull request.

Rendering is [`docker-spin-up`](../actions/docker-spin-up.md)'s and happens only as part of bringing
the application up - there is no standalone render.

The spin-up cannot fail a round. A template referencing a token nobody supplied, or a compose file
the branch itself just broke, leaves a warning on the run and the round goes on without a
container - back to the artifact reports for what CI would say. It costs time as well, inside the
job's own limit, which is what `timeout_minutes` has to have room for.

Composer installs with `--no-scripts`, because post-install scripts are arbitrary repository code
and this job has `ANTHROPIC_API_KEY` in its environment. **NPM's lifecycle scripts do run**, because
`npm-qa-checks` runs them and skipping them would leave the agent a `node_modules` CI never has.
Both tokens are scoped to the install step alone; the agent inherits a
populated `vendor/` and `node_modules`, never the credentials that filled them. The other place
repository code runs is `_ci_environment.json`'s `init_script`, which `docker-spin-up` executes
before the containers start.

The PHP version comes from [`_ci_environment.json`](../actions/get-default-ci-environment.md) - the
`default` matrix entry, or the only one, or PHP 8.2 where the repository says nothing. A repository
whose linters only pass on one leg of a matrix should name that leg `default`. Node's version is the
`node_version` input instead.

Set `provision_checks: false` to skip all of it. The agent still has a shell and is still told to
verify its own work; it just has to work out what it can run.

### Pulling the images

`ghcr.io` is the only registry logged into, with `github.actor` and the run's own `GITHUB_TOKEN`, so
there is no secret to configure and nothing for the agent to find. Two things have to be true for a
private image, and both fail the same way - the pull is denied and the round carries on without a
container:

* **`packages: read` on the calling job.** A reusable workflow cannot hold a permission its caller
  does not grant. Without it the token has `packages: none`.
* **The package has to be linked to the repository.** An image first pushed to `ghcr.io` with a
  personal access token belongs to no repository, and `GITHUB_TOKEN` is refused for it until that
  package grants this one the Read role under **Package settings → Manage Actions access**.

Public images need neither, and a repository pulling only from Docker Hub is unaffected either way.

### Reports from other workflows

Three lines in the upload are load-bearing, and getting any of them wrong fails quietly:

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

There is no handshake between them - each asks Github what is still reporting on that commit - so a
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
  silently, because this fires on every push.

The optional `branches:` filter narrows this to branches the workflow could have pushed. Without it
every QA run in the repository creates a run that immediately works out it has nothing to do - the
job `if` skips those, so they cost nothing, but they still appear in the Actions tab. It matches on
the head branch and nothing checks it against `branch_prefix`, so a pattern narrower than the prefix
stops rounds starting with no error to say why.

### The round cap

Rounds are counted, and the count is only ever about **consecutive rounds a bot started**. Any
round a person asked for resets it to zero, because a person looking at the work is exactly the
thing the limit exists to wait for. `max_unattended_rounds` defaults to `5`, which is *not* "five
rounds per pull request" - iterating with a human ten times is normal and uncapped.

Past the limit the round is refused with a comment asking for a person, and it takes a human
comment or review to start another.

A round counts as a bot's when the actor is a `Bot`, **or** the review body starts with
`<!-- ai-review -->`. The second is the one that matters in practice, because a review token
belonging to a machine *user* account makes Github report the review as authored by a `User`.
Anyone can paste that marker into a review of their own; all that does is make their own round count
against the cap.

A round that changes no file says so plainly in its comment. That is usually the more informative
signal than the cap itself: two agents talking past each other tends to produce a lot of activity
and no diff.

### Which pull requests it will touch

Only pull requests it opened: the head branch has to be in **this** repository and to carry the
configured prefix. Anything else is left alone.

This is a security boundary. `issue_comment` and `pull_request_review` fire on every pull request in
the repository, including ones from forks, and both run in the base repository's context with a
write token and **full access to secrets**. Without the branch check, `/ai-do` on a fork's pull
request would check out that fork's code and hand it a shell with `ANTHROPIC_API_KEY` in the
environment.

The check happens twice. The job's `if` pre-filters `pull_request_review` and `workflow_run`, whose
payloads carry the head branch, so an out-of-scope pull request is **skipped** before a runner is
allocated - a pre-filter only, since `startsWith` in a Github expression is case-insensitive while
branch names are not. `Resolve the pull request` then checks against the API for every trigger, and
that is the one that decides. An `issue_comment` payload carries no head branch at all, so a typed
`/ai-do` always costs a runner.

An out-of-scope review or finished QA run says nothing at all; an explicit `/ai-do` gets an answer,
because a person asked. That answer is behind the permission gate, and the gate is behind the
branch check - so somebody who could not have run the command anyway gets silence, and a refusal is
only ever posted on something this workflow owns.

### Two filters, on purpose

Your review comments and conversation comments are filtered by **time**, from a watermark the
previous round recorded. Threads and failing checks are filtered by **state**, because "still
unresolved" and "currently red" are not questions about when something was said.

The watermark is recorded when a round *starts* reading, not when it finishes, so a review you
submit while a round is running lands on the next round rather than falling into the gap between
the two.

### One branch, one pull request

The branch name is derived from the issue number rather than generated, and that is the whole
mechanism:

* **First run** - branch created from
  [whatever the plan named, or `base=`, or the default branch](#basing-the-work-on-another-branch);
  work pushed, pull request opened.
* **Every round** - the same branch is fetched, so the agent starts from the previous round rather
  than from scratch. The push updates the open pull request. No second one appears.
* **An open pull request** - `/ai-do` on the issue runs a round on it when the plan has moved
  since it was last worked to, and points at it when the plan has not.
* **A closed pull request** - `/ai-do` on the issue revives it. Pushing to a closed pull request's
  branch does not reopen it, so it is reopened explicitly.
* **A merged pull request** - `/ai-do` says the work already shipped. Open a new issue.

The pull request body says `Implements #<number>`, deliberately not `Closes`, so the first merge
does not close the issue. Close it yourself when the work is actually done.

**The base is settled when the branch is created**, and after that the pull request is the record
of it. So `base=` on a round, or on an issue whose branch is still lying around from an abandoned
attempt, gets a comment saying so and is otherwise ignored. Retarget the pull request yourself if
you need to move it, with `gh pr edit --base` or the **Edit** button by its title: later rounds
read the base off the pull request, so they follow along. Retargeting changes what the pull request
is compared against and not what is on the branch, so a rebase is usually wanted too.

Reviving a closed pull request whose branch was deleted does honour `base=`, because there is no
branch left and one has to be created - and the pull request is retargeted to match. Revive one
without saying anything and it keeps the base it had rather than snapping back to the default
branch.

Two rounds on one pull request queue rather than cancel, so the second starts from what the first
pushed. How well they queue is limited by what the event can say: a comment on the pull request
carries no branch, so a round started that way can overlap one started from the issue, from a
review or by CI. The one that pushes second has its push refused as non-fast-forward and fails
loudly - the branch keeps the work of the one that got there first.

### When the base moves under the work

A first run replays its work on top of the base as it stands at the moment of the push, rather than
pushing a branch cut from wherever the base was an hour earlier. The run log says which it did,
under `work replayed:`.

This matters for one refusal in particular. A branch being created has no previous tip for Github
to compare it against, so it compares the workflow files it carries against the default branch -
and a branch cut before somebody edited `.github/workflows/something.yml` still carries the older
copy, which reads as this push updating a workflow file. Github refuses that from any identity
without the `workflows` permission, which [the app](#the-github-apps) deliberately does not have,
and the message names a file the agent never opened. Replaying the work first is what stops that.

Rounds are not replayed. They push to a branch that already exists, which Github compares against
its own previous tip, and moving one would mean force pushing over work somebody may be part way
through reviewing.

If the replay hits a conflict, nothing is force-fixed: the work is pushed as it was cut, with a
warning on the run, and the pull request arrives wanting a rebase. The exception is a conflict that
leaves a stale workflow file on the branch, which is the case above and gets refused - the run then
comments with the file's name and asks you to run the command again now the base has settled.

### The round comment

Every round ends with one comment, whatever else happened, and its first two lines are hidden
markers carrying the round number, whether a person asked for it, and a timestamp.

The next round counts these comments to find the round number and the unattended streak, and reads
the timestamp to know where to draw its watermark. A round that failed to post one would have the
next round act on the same feedback all over again - which is why it is posted even when nothing
changed.

### The QA criteria on the pull request

The plan's `## QA acceptance criteria` section is copied into the pull request body when it is
opened, under what the agent did and above the review instructions, by
[`ai-qa-criteria`](../actions/ai-qa-criteria.md). It is a marked block rather than prose, so it is
rewritten in place rather than added to: [`ai-plan`](ai-plan.md) refreshes it the moment it revises
a plan under an open pull request, and a round that worked to a revised plan refreshes it too. The
plan on the issue stays the original - where the two disagree, believe the plan - and a plan with no
such section leaves the body alone. Retired ids are left behind, because a tester should see what
they have to test and nothing else.

### When the plan is revised under the work

**Revising a plan never starts a round** - ask for one with `/ai-do` or a review when the branch
should be brought in line. Each round compares the plan comment against its watermark, and a newer
one is reconciled against the whole branch: what the plan now asks for is added, what it no longer
asks for comes back out, and the round says so above its summary. Feedback still wins where the two
disagree. That reconciling happens on any round that runs, including one CI started, so a revision
can be picked up before you are finished with it - revise again rather than leaving one you are
unhappy with. Editing a plan comment in place is not a revision, because the comparison is on when
it was posted. `/ai-do` on the issue is the shortest way to ask: with a plan newer than anything
the open pull request has been built to, it runs the round there rather than replying with a
pointer, copies what you typed into that thread so the agent reads it, and says on the issue where
the work went.

### When nothing happens

Cases that end without a failure and without a red run:

| Situation | What you get |
|-----------|--------------|
| `/ai-do` on an issue whose pull request is open, with the plan unchanged | A comment pointing at it. A plan revised since [runs a round](#when-the-plan-is-revised-under-the-work) there instead |
| `/ai-do` on an issue whose pull request was merged | A comment saying the work shipped |
| `/ai-do` on an issue with no plan | A comment saying to run `/ai-plan` first |
| `base=` naming a branch that does not exist | A comment saying so, and nothing is started |
| `base=` with no branch after it | A comment saying to name one |
| `base=` when the branch already exists | A comment saying the base is settled - the run carries on regardless |
| `base=` naming a different branch than the plan did | A comment saying which one won - the run carries on with the command's |
| A round with no unresolved thread, nothing new said and no failing check | A comment saying exactly that - unless [the plan was revised](#when-the-plan-is-revised-under-the-work), which is work in itself |
| Too many rounds in a row from a bot | A comment asking for a person |
| The agent changed no files | A comment saying so |
| `/ai-do` on a pull request this workflow did not open | A comment saying why not |
| `/ai-do` from somebody without permission, on a pull request this workflow did not open | Nothing at all - the run is green |
| A review on a pull request this workflow did not open | No job at all - it reports as skipped |
| A QA run finishing on a branch this workflow did not push | No job at all - it reports as skipped |
| A QA run finishing on a prefixed branch with no open pull request | Nothing at all - the run is green |

Anything else that goes wrong comments on the issue or the pull request with the reason the agent
stopped, the same way [a failed plan does](ai-plan.md#when-a-run-goes-wrong) - including the same
exception: a round the agent finished a few turns over `max_turns` is pushed with a warning on the
run rather than thrown away.

### What the agent can and cannot do

It **may** read and change any file in the checkout, and run any command on the runner - it has a
shell, on purpose. Without one it could not run the tests, and the plan's `C` checks would be a
list rather than something it executes.

It **may not**, and cannot:

* **Write to the default branch.** Everything lands on its own branch, behind a pull request
  somebody reviews and merges. Nothing here merges anything.
* **Push, commit, open a pull request, or comment anywhere.** The checkout runs with
  `persist-credentials: false`, so there is no git credential on disk while the agent is working.
  The workflow supplies one per command, before the agent starts and after it finishes.
* **Change a workflow file.** Github refuses a push that creates or updates anything under
  `.github/workflows/` unless the identity behind it holds the `workflows` permission, and
  [the app](#the-github-apps) does not hold it. An agent that edits one costs the run its whole
  working tree, so the push warns about the files by name before it tries. Unlike the rest of this
  list it is a granted permission rather than a hard limit, so it is the one thing here an
  administrator could switch on - ask for CI changes yourself instead, and keep the boundary.
* **Change the plan or the feedback it was given.** Both are excluded from git, so nothing under
  them can reach a commit however the agent leaves the working tree. Its replies to your threads
  are the one thing it writes back, and they are validated rather than trusted - a reply to a
  thread that was not part of this round is discarded.

It is also told never to touch `CHANGELOG.md` - the release generates it from the git log, so an
entry written by hand is overwritten or left conflicting. Instruction rather than enforcement,
unlike the list above, and [`ai-review`](ai-review.md) is told to comment if one appears anyway.

What actually limits this is the permission gate and the branch check, not the tool list. An agent
with a shell runs whatever an issue body or a review comment talks it into, and
`ANTHROPIC_API_KEY` is in that environment. Keep the permission gate at `admin write` or narrower,
and do not widen the trigger to anything a stranger can fire.
