# Roadmap

What we plan to do next, what is in progress, and what is done. When you finish something, mark it
done here in the same pull request. When you find something new that needs doing, add it here.

## What we are aiming for

The AI workflows (AI Plan, AI Implement, AI Review) should:

1. Be easy to use from GitHub.
2. Write less, and write it clearly, with the same layout every time.
3. Give the AI the right information, and spend less money doing it.
4. Work the same way in every repository that uses them.

The workflows stay in charge: they hold the keys, they push, they post, and they decide when the
next round runs. The AI only reads what it is given and writes back an answer.

## Where we started

We looked at 105 AI pull requests across 15 repositories in early October 2026 (74 issues, $1,172).

- **Too much text.** One pull request had 101,000 characters from the AI and 900 from people. A
  typical plan was 10,500 characters. Pull request descriptions had no fixed layout.
- **Repeating itself.** Every comment had to make sense on its own, so the AI kept retelling the
  plan, the change and earlier rounds.
- **Unwanted code comments.** A third of what people asked the AI to change was code comments it had
  written.
- **Silence.** Nothing showed that a command was picked up, so a mistyped command looked the same as
  work in progress.
- **Noise.** Each round sent several notifications.
- **Cost.** Writing code was 68% of the cost, review 17%, planning 15%.
- **Broken setups.** Repositories used 8 different versions of the workflows, and two setups did not
  work at all.

## Fix next

### Waiting for the review

After a round pushes, the QA checks and the AI review run at the same time. Whichever finishes
first stands down, and the second starts the next round. Today the round knows a review is still
running from the `ai:reviewing` label. That has three problems:

- If the review never starts (for example the reviewer is set up wrong), the label stays on. The
  next round waits, and nothing wakes it up until somebody types `/ai-do`.
- If a second review is asked for while the first is still running, the first one takes the label
  off when it finishes. The round then runs without waiting for the second review, and that review
  starts one more round later.
- If a person takes the label off, the round stops waiting.

**Plan:** stop using the label to decide anything. Labels are only there to show people what is
happening.

- The round comment says which commit it asked a review for.
- The review itself shows the review is done, because GitHub records which commit it was for. A
  review run that fails says so in its failure comment, for that commit.
- A round waits only while the review it asked for has not arrived, and for no more than 60
  minutes.

This needs no new permissions and no change in the repositories that use the workflows.

### A failed review leaves red checks unanswered

If QA finishes first and the review run then fails, nothing starts the next round, and the failing
checks wait for a person. The plan above fixes this too: the failure comment counts as the review
having finished.

### Clean up even when a run runs out of time

When a whole run takes too long, GitHub stops it and skips everything left to do. That includes
the clean-up at the end: taking the `ai:…` label off, swapping 👀 for 🚀 or 😕, and posting the
failure comment. The label and 👀 then stay on, as if the AI were still working, and nobody is told
the run failed. Each run leaves the AI about 5 minutes less than the whole run, so this is rare.

**Plan:** move the clean-up into a small separate job that runs after the main one, however the main
one ended, in all three workflows.

### Close the issue when its pull request merges

AI pull requests say `Closes #N`, so the issue closes when the pull request merges into the default
branch. Still left open: issues whose pull request went into another branch, and pull requests
opened before this change.

**Plan, if this happens often:** a small job on merge that closes the issue for any branch.

### Point people at the harness

`ai-harness-hint.yml` comments on a pull request somebody wrote by hand when QA failed on its first
run or Copilot review took several rounds. Still to do:

- Run it in shadow mode in a few repositories, read about 20 verdicts, then turn posting on.
- Count both triggers on past pull requests, to see how often each would fire.
- Post at most one hint per person per week.
- When a pull request goes back and forth a lot, look at its issue and suggest how it could have
  been written better.

## For v12

These are breaking changes, so they wait for the next major version.

- Remove `review_check_patterns` from AI Implement. It already does nothing, and warns when it is
  set.
- Remove `verb` from AI run report. It already does nothing, and warns when it is set.

## Done

### Step 0: The AI has its own GitHub accounts

The AI Implement and AI Review GitHub Apps push the branches, open the pull requests and post the
reviews.

### Step 1: Bugs and broken setups (#24)

- A round started by QA waits for the AI review to finish.
- The AI gets the list of shared workflows again.
- The reviewer is told how many rounds ran without a person.
- Failure comments say why the run stopped only when it did not finish, mention a person, and say
  how to try again, including the `base=` branch that was asked for.
- When the AI reviewer approves or only comments, a round still runs if checks are failing.
- The examples in the docs use our real variable and secret names.
- Every workflow is checked with actionlint on every pull request.
- `AGENTS.md` has a checklist to go through before opening a pull request.
- The setups in ntnp-frontend, uforms, officio-gui, form-suite, sentry-lib, forms-dev-platform,
  angular-core, context-lib, field-framework and scoring-lib are fixed, ready in each repository.

Still open from step 1:

- Add uforms to the AI Implement App. Check that ntnp-frontend is in the App and the sign-in rule.
- In officio, Copilot reviews start AI Implement runs that GitHub holds for approval. A workflow
  change cannot skip them: turn off automatic Copilot reviews there, or delete those runs on a
  schedule.
- Check whether a `.claude/settings.json` on a pull request branch can give the reviewer more tools
  while it holds the review App's key.

### Step 2: Show that a command was heard (#25)

- React 👀 to a command when a run picks it up, then 🚀 or 😕 when it ends.
- Answer a command that will not run (not at the start of the comment, or on the wrong kind of page)
  with one line saying how to run it.
- Link the run and what the AI was given at the end of every result.
- Say which workflow started a round that a failing check started.
- Name the runs in the Actions list in the caller examples. Not yet done in the repositories that
  use them.
- Say when the branch conflicts with its base, because reviews then start nothing.

### Step 3: A fixed layout for everything the AI writes (#26, #27, #28)

The AI writes its answer as data, and the workflow checks it and lays it out the same way every
time. If the data is missing or broken, the AI's plain answer is used instead.

- **The review:** a verdict, a one-line summary, a count of findings by severity - 🔴 high,
  🟠 medium, 🟡 low - and the findings from high to low, each linked to its inline comment. Only a
  high finding asks for changes.
- **The report after each round:** notes for the reviewer, what was not done, and the questions for
  a person come first, then the QA steps. What was done and how it was checked are folded away. From
  round 2 on, an "Update on round N" section under the links is rewritten every round.
- **The plan:** a short summary, the risks, the steps with a line each on what they touch, and the
  QA steps. The whole plan, with each step's detail and the checks, is folded underneath as JSON for
  the agents. Every item has an id that stays the same when the plan is revised.
- **A shared style guide** in every prompt: say the conclusion first, do not describe what you read,
  refer to ids instead of repeating things.

Watch the first real runs for: whether the planner can write its one file, how long the visible
part of a plan really is, and how often the plain answer is used instead of the data.

### Step 3d: Tidy up the AI's writing

- What the AI wrote is checked before it is posted: length limits, phrases the style guide rules
  out, and references to plan ids that do not exist, which are dropped.
- The planner decides how much QA a change needs from what a user could see break: none for
  formatting or annotations, regression checks for refactors, real type changes and upgrades, and
  none for a flow an end-to-end test already covers.
- The cost line records how long the posted text was, whether the plain answer was used instead of
  the data, and what the checks found. The runs CSV of the cost report shows them.
- The prompts are about half as long: instructions only.

Still open from step 3d:

- If plans still get QA wrong, make the planner name the user flows the change runs through first,
  and check its QA steps against that list.
- Check on real plans that the planner finds a repository's end-to-end tests.

## Next

### Step 4: Spend less

- Measure the cost again from 2026-09-24. The old numbers are from before Opus 5.5 and are about
  35-40% too high. Check whether the runs that cost about $26 each were hitting the 60-minute limit.
- When the same edit is needed in many files, have the AI write a script for it instead of editing
  each file by hand. These issues cost about $250.
- From the second review on, review only what changed since the last review.
- Use a cheaper model or less effort for simple rounds, such as one that only fixes failing checks.
  Test it first, and check the model is supported (see `AGENTS.md`).
- Make sure the AI reads `AGENTS.md` in every repository. Write one for scoring-lib,
  condition-manager, field-framework and uforms.
- Give the AI a short map of the repository's folders.
- Cut long check output down before the AI reads it.
- Turn off the AI tools we do not need: sub-agents and web search.
- Give the AI only the comments since the latest plan, and none to the reviewer.
- `/ai-plan from=#N`: start a plan from an earlier issue's plan, for a series of issues.

### Step 5: Fewer notifications, and show what is happening

- Post each round as one review with all the replies in it: one notification instead of many.
- Keep one status comment per issue and pull request, updated in place: queued, working on round N,
  waiting for checks and review, or stopped and why. Also how many rounds ran without a person, a
  link to the last run, the cost so far, and the commands.
- Let a comment-only review that starts with `/ai-do` start a round.
- Hide old plan comments once a new plan is posted.
- Labels people can set to control the AI: `ai:paused`, `ai:needs-human`,
  `ai:allow-workflow-changes`.

### Step 6: Simpler setup in each repository

- Make the setup in each repository just the triggers, the permissions and one `uses:` line: the
  shared settings come from organisation variables.
- Check every repository's setup on a schedule and flag problems: old versions, wrong secret names,
  settings that cancel runs, repositories missing from an App, and checks the AI does not know
  about.
- `bin/ai-adopt.sh <repo>` opens a pull request with the setup filled in for that repository.

### Step 7: Better information about failing checks

- A small server the AI can ask about failing checks: which failed, at which step, and the relevant
  part of the log. It returns less than the AI would otherwise read.
- Sort failures before a round runs: something the AI can fix, a flaky test, a broken environment,
  a missing secret, a failed install, or unknown.
- The server only answers runs from our own organisation, and the GitHub key stays on the server.

### Step 8: One package of feedback, and firm rules

- Gather everything a round needs in one place: the pull request and plan, open review threads, new
  comments, failing checks, and where the last round stopped.
- One decision on whether a round should run: all checks done, the review not running, something to
  act on, not the same feedback as last time, and not too many rounds without a person.
- Check every change before it is pushed or posted: no editing the AI's input files, no
  `CHANGELOG.md`, no workflow changes without permission, no secrets, and replies only to real
  threads.

### Step 9: Plans across several repositories

- The planner can read other repositories it needs, without being able to change them.
- Each plan step says which repository it is for.
- The plan becomes one linked issue per repository, in order, and each repository's AI does its
  part.

## Later

Bigger ideas, for after the steps above.

- **A service that remembers.** Keeps the history of every pull request and every check, so the AI
  and people can see why a round did or did not run, even after GitHub deletes old files. Do not
  start here: it is a lot to run and look after.
- **One GitHub App for the whole organisation,** reacting to events instead of each repository
  having its own triggers. Faster answers, and no skipped runs. Needs the service above.
- **One AI run changing several repositories at once.** Only if one issue per repository turns out
  not to be enough.
- **A clear state for every pull request:** planned, working, waiting for checks, waiting for
  review, fixing, blocked, ready for a person, merged or abandoned. Easier to see what is going on.
- **Risk check before pushing.** Look at what changed (workflows, secrets, migrations, lock files,
  size) and decide whether the AI may carry on alone or a person must look.
- **A separate AI that sorts failing checks** before the main AI starts. Only once the failure
  information is well structured, or it just adds noise.
- **Cheap automatic fixes first.** Run the formatter and other fixers before paying for the AI, and
  only call the AI if checks still fail.
- **Treat browser tests differently.** Tell a real bug from a broken test, a flaky test or a broken
  environment, so the AI does not chase flakes.
- **Replay old rounds.** Save what the AI saw in important rounds, so prompt changes can be tested
  against real past cases.
- **A ready-to-merge check:** checks green, no open threads, a person approved, QA steps copied over,
  nothing forbidden changed, a final summary written.
- **More specialised AIs** (security, migrations, docs, release notes). Only once the basics are
  solid: more AIs means more noise.
- **Version every prompt and rule,** so any past run can be explained and repeated.
- **Track the numbers:** rounds per pull request, time to the first pull request and to green
  checks, cost per pull request, how often a person had to step in. And set limits: cost per issue,
  rounds without a person, run time, files changed without a review.
