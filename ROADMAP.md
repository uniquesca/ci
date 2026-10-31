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

### Point people at the harness

`ai-harness-hint.yml` comments on a merged pull request somebody wrote by hand when QA failed on its
first run or Copilot review took several rounds. Still to do:

- Commit the `ai-pr-post-analytics.yml` callers staged in forms-dev-platform, context-lib,
  sentry-lib, uforms, form-suite, field-framework, condition-manager, angular-core,
  formula-builder and scoring-lib. Until then the old callers there fail on every run.
- Read the first 20 hints posted, and change the prompt if they read wrong.
- Count both triggers on past pull requests, to see how often each would fire.
- A person gets at most one hint a week, but in each repository. Across repositories needs a token
  that can read the whole organisation.

### Measure how the harness is used

A report in Grafana, from the Events API, showing per person how many pull requests they opened,
and how each was made:

- **Harness:** the branch starts with `ai-feature/`.
- **Local AI:** a commit has a `Co-Authored-By: Claude` line, or the description says it was
  generated with Claude Code. People can remove these, so this number is a lower bound.
- **By hand:** everything else.

For pull requests made by hand or with local AI, it also shows how many the hint workflow checked
and how many it found were a good fit for the harness. For this, `ai-harness-hint.yml` first has
to save every verdict, including "not a fit". Today it saves nothing.
Decide who sees the numbers for each person before it goes out.

### Say which tests a pull request is missing

`ai-test-advice.yml` comments on a pull request whose code no test covers yet, naming the unit or
end-to-end tests to add. Still to do:

- If the advice often asks for tests of code that is already tested, or misses real gaps, have the
  QA workflows upload a coverage report so a script can tell the agent which changed lines no test
  runs. The advice then has to wait for QA.
- Save every verdict, including "no gap", and count how often people add the test it asked for.

### Say why a run failed

`failure-history` gives each failed job a verdict from earlier runs: flaky, broken on this branch,
broken on other branches too, new or unknown. `ai-failure-summary` adds what failed, why and what
to do next, in the run's summary. It calls the API directly, so it works on every kind of run. The
QA, deployment and release workflows run it when given the federation inputs. Still to do:

- Run it for real on a failing run in a repository, and read what it writes.
- Re-run flaky jobs once, on strong evidence only, and pass the verdict to the implementing agent
  so it does not spend a round on a flaky or outside failure.
- Check how often flaky is called right. Failures with no test names match on the step alone,
  which is weaker.

### See what CI and the AI workflows do

The Events API in infra-apps stores every GitHub event in the organisation, and every event a job
sends it with `send-event`. Grafana, at grafana.unqs.ca, shows how often runs, jobs and e2e jobs
fail and how long they take, and which tests fail. officio, form-suite and bcpnp-frontend send
their Cypress results. It also shows the test advice, harness hints and retros the AI posted and
whom they were for, and who uses the harness in which repository, at what cost. Only the people
listed in devops-infra's `grafana/users.json` can sign in. Still to do:

- Switch on Cypress retries in the e2e repositories. Until then no test can pass on a retry, so
  the dashboard cannot tell a flaky test from a broken one.
- Send the Cypress results from any other repository with e2e tests.
- Count the times an AI workflow checked and found nothing: test advice with no gap, a pull
  request that was no fit for the harness. Those post no comment, so the workflows have to send
  them with `send-event`. What they post is already counted, from the comments.
- Count failure summaries. They go to the run's summary page, not a comment.
- Store the `failure-history` verdict for each failed job and test the same way.
- For each, also count whether somebody acted on it: used the harness afterwards, added the test
  before merging, or re-ran a job called flaky and saw it pass.
- Move the AI cost report from comms-api to the Events API, so there is one place to look. Wait
  until the 2026-11-01 report has gone out; its data is only in comms-api.

### Learn from issues that needed a lot of rounds

`ai-retro.yml` comments on a merged harness pull request that took too many rounds: what would have
saved them, how the issue could have been approached better, and plan questions left open when work
started. It tags the issue author. Still to do:

- Read the first retros posted, and change the prompt if they read wrong.
- Check `min_rounds` and `min_change_requests` against past pull requests. On officio, #1194 had 2
  rounds but 3 change requests, so the change request limit may fire too often.
- Count the causes it finds in the monthly report, so patterns across pull requests show up.
- Once a pull request records which plan version it was built from, use that instead of working it
  out from comment dates.

### Act on bugs a plan finds

A plan lists a bug it found outside the issue as an `R`, and leaves it alone. Nobody has to act on
it, so it is forgotten once the pull request merges, like the 500 in officio#1268. Still to do:

- Read what plans find for a while, to see whether the finds are usually real bugs.
- If they are, give them their own place in the plan, and open an issue for each one nobody took
  on by the time the pull request merges.

## For v12

These are breaking changes, so they wait for the next major version.

- Remove `review_check_patterns` from AI Implement. It already does nothing, and warns when it is
  set.
- Remove `verb` from AI run report. It already does nothing, and warns when it is set.
- Rename `review_label_minutes` in AI Implement to `review_wait_minutes`. It is how long a round
  waits for a review, and has nothing to do with the label.

## Done

### Step 4: Spend less

The 53 issues opened from 2026-09-24 to 2026-10-14 cost $276 so far. That is $5.21 an issue, down
from $15.84, with a median of $3.92. Writing code was 64% of the cost, planning 24% and review 12%.
Planning was 15% before, and issues now get 1.3 plans each. No run hit the 60-minute limit; the
most expensive took 45 minutes and cost $8.68. The old issues that cost about $26 to code took many
rounds, not one long run.

### Plans that continue an earlier issue

`/ai-plan from=#N` stages issue N's plan, and the comments since it, next to the new issue. The
planner starts from it and plans only what comes next. The new plan records it, so a revision
starts from the same plan. Officio's queue work was planned as six issues, #1204 to #1220: 9
plans, $7.74, from 11 to 53 turns each, and #1212 alone took 4. At under $1.25 a plan, the gain is
in plans that do not guess where the series stands more than in the cost.

Still open:

- On the next issue in a series, check that the plan picks up where the last one stopped, and how
  many turns it takes.
- Take the branch from issue N's plan too, when the new issue has no plan and no `base=`.

### How much check output the AI reads

What the workflow stages about failing checks is already short. Of 267 rounds from early September
to 2026-10-15, 17 had check reports, 30 files in all, with a median of 111 bytes and the largest 10
KB. None came near the 200 KB cut. The 65 failing checks in the feedback had a median of 381
characters, and the longest 1,237. What the agent gets back from the checks it runs itself was not
recorded anywhere, so the cost line now records the characters each tool hands back, and the
longest single result.

Still open:

- After a few weeks, read `tool output chars` and `largest tool output` in the runs CSV. If `Bash`
  output is a large share of what the agent reads, have it send long check output to a file and
  read only the failures.

### A map of the repository's folders

AI Plan and AI Implement's first build get a map of the folders git tracks, with how many files are
under each, at most 100 lines. In forms-dev-platform, before it had an `AGENTS.md`, 22 of 54 and 15
of 62 tool calls in a plan were spent listing folders. In officio it was 1 to 8, and reviews list
almost none, so AI Review and the rounds do not get it.

Still open:

- On the next plans in a repository without an `AGENTS.md`, check that fewer tool calls go on
  listing folders.

### Fewer issue comments for the AI

AI Plan and AI Implement get only the issue comments since the latest plan, or all of them before
the first plan. Earlier comments, and every older plan, are already answered by the latest plan.
AI Review gets no issue comments. AI Retro still gets them all.

### The AI reads `AGENTS.md`

The plan, implement and review prompts tell the agent to read `AGENTS.md` when it is not already in
its instructions. Claude Code reads it on its own only when there is no `CLAUDE.md`, and not in
every session. Every repository with the harness has an `AGENTS.md` and a `CLAUDE.md` that
imports it, except form-suite, which has only its own `CLAUDE.md`, and ntnp-frontend, which has no
`CLAUDE.md` and relies on the prompt.

Still open:

- form-suite's `CLAUDE.md` tells the agent to log every change in `.docs/CLAUDE_CHANGELOG.md`,
  which is gitignored, so it costs turns but never reaches a pull request. It also says to comment
  complex code. Agree with its owner what the harness should skip.

### Less effort for rounds

A round acting on review feedback runs at `medium` effort, and the first build stays at `high`. Of
51 rounds from 2026-09-24 to 2026-10-14, only 2 just fixed failing checks, so a setting for those
alone would save almost nothing. All 85 rounds cost $76, about $0.90 each.

Still open:

- After a few weeks, compare what a round costs, and how many rounds a pull request needs, with the
  figures above. If rounds get cheaper but there are more of them, go back to `high`.

### A later review reads only what changed

From the second review on, AI Review is told to review only what changed since its last review. It
still has the whole diff for context. It reviews everything again when a person approved after it,
when the base branch was merged in since, or when nothing changed.

Still open:

- On the next pull request with several rounds, check that later reviews cost less and do not miss
  what an earlier round broke outside the new diff.

### A script for the same edit in many files

When the same edit goes into many files, the coding agent writes a script for it, runs it and
checks the result, and fixes by hand only what the script got wrong. The phpcs, psalm and module
dependency issues cost $75 from 2026-09-24 to 2026-10-14. Building a phpcs round took around 100
turns.

Still open:

- On the next phpcs round, check that the agent used a script and that it cost less.

### Only the tools each AI needs

Each AI workflow gets only the tools it uses. Sub-agents, web search, background commands and task
lists are switched off. The coding agent used to have sub-agents even though its prompt said it did
not. In 48 recent runs no agent used any of the tools that are now off.

### Close the issue when its pull request merges

AI pull requests say `Closes #N`. Of 125 merged by October 2026, every issue was closed, including
the 4 that went into a release branch, so no job is needed for the other branches.

### Clean up even when a run runs out of time

When GitHub stops a run for taking too long, it skips everything left in it. A small job after each
of AI Plan, AI Implement and AI Review then does the clean-up the run never got to: it takes the
`ai:…` label off, swaps 👀 for 😕, and says the run did not finish and how to try again. A cut-off
review is still posted as a review, so the next round starts.

Still open:

- On the first run that really runs out of time, check that the small job got what it needed from
  the run: which issue or pull request, and whether there was a label and a 👀 to take off.

### To fix, or recommended

A review used to ask for changes only for a high finding. Everything else sat on the pull request
and nobody knew whose job it was.

- Each finding still has a severity, and also says who acts on it: **to fix** or **recommended**.
- Anything to fix, at any severity, asks for changes and goes back to the coding agent.
- A recommendation is for a person. The review says what to do: resolve the threads you do not
  want, then comment `/ai-do` and the agent does the rest.
- Rounds nobody asked for leave open recommendations alone.

### Waiting for the review

After a round pushes, the QA checks and the AI review run at the same time, and whichever finishes
second starts the next round.

- The round writes in the pull request description which commit it asked a review for, once the
  request has gone through.
- A round waits only until a review of that commit or of the branch head arrives, and for no more than 60
  minutes. The `ai:reviewing` label is only there to show people a review is coming.
- A review run that fails posts its failure as a review, so the next round still starts and acts on
  red checks.

Still open:

- A review that never starts, or could not be submitted and was posted as a plain comment, starts
  nothing. If QA finished first, the round waits for somebody to type `/ai-do`.

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
  🟠 medium, 🟡 low - then the findings to fix and the recommendations, each from high to low and
  linked to its inline comment. Only a finding to fix asks for changes.
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

### Step 10: Let the AI push back on bad instructions

Today the AI mostly does what it is told. The implementing agent can turn down a review comment
with a reason, but it builds a plan step it thinks is wrong, and guesses when feedback is unclear.
The reviewer says nothing about a person's request, only about the code that comes out of it.
Make both of them stop and ask a person when an instruction looks wrong, unclear or against the
issue, instead of guessing or going along with it. Keep it rare, so it does not slow down the
ordinary rounds, and use `ai-retro.yml` to see how often a round was lost to a bad instruction.

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
