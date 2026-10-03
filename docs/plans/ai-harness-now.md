# AI harness: near-term rounds

## Goals

In priority order:

1. Convenient to use from GitHub.
2. Less sloppy text, and a fixed structure for the plan, the implementation report and the review.
3. Better context for the agents, and fewer tokens.
4. Usable across many repositories.

Workflows keep control of credentials, writes and loop decisions. Agents reason over structured
context.

## Where things stand (2026-10-02)

Measured on 105 `ai-feature/` pull requests, 692 bot comments, 15 consuming repositories and
`ai-pr-costs.csv` (74 issues, $1,172, all before Opus 5.5).

- **Text volume.** officio#1146: 101k characters of AI text against 0.9k from people. The median
  plan is 10.5k characters. 10 PR bodies had 10 different heading sets.
- **Retelling.** Every output is free markdown that has to stand alone, and no agent sees the
  previous round's report (`ai-stage-pull-request` filters out `ROUND_MARKER`). So each output
  retells the plan, the diff and earlier rounds.
- **Code comments.** 13 of 40 human inline comments ask the agent to cut a code comment it wrote.
- **Silence.** Nothing acknowledges a command. Misplaced commands and reviews that start no run
  look the same as work in progress.
- **Noise.** Each round notifies k + 4 times. officio has about 600 skipped runs.
- **Cost.** Coding 68%, review 17%, plan 15%. officio is 78%. The Doctrine series alone is 27%.
  Caching works. Output and context growth drive the cost.
- **Callers.** 11 plan callers exist in 8 versions. Two are broken, and seven can be cancelled by
  an unrelated comment.

## Round 0: GitHub App identity - Done

AI Implement and AI Review apps own branch, PR and review authorship. Both workflows mint
installation tokens.

## Round 1: Bugs and broken callers

- The implementer's wait for the reviewer looks for a check run on the PR head. Dispatched reviews
  run on the default branch, so a round started by CI never waits. Step: "Wait for the other half
  of the feedback".
- `github.job_workflow_ref` and `job_workflow_sha` come back empty, so the CI framework catalogue
  is never staged and every plan and implement run warns. Step: "Stage the CI framework
  catalogue", in both workflows.
- The reviewer is told the round number where it needs `unattended_rounds`, and writes "the loop
  now stops for a person" on rounds people started (`ai-review.yml`, the `ai_authored` prompt
  line).
- Failure comments quote the agent's `result` as the stop reason even when it finished
  (`ai-run-report`). Name a timeout or turn overrun, say how to retry, and @-mention the last human
  requester. Unattended failures currently @-mention the bot.
- Copilot reviews start "AI Do" runs that fail with zero jobs in officio.
- Callers: fix ntnp-frontend (old inputs, `@main`) and uforms (App ID read as a secret, not in the
  App installation). Remove caller-level `cancel-in-progress` from sentry-lib, forms-dev-platform,
  angular-core, context-lib, field-framework and scoring-lib. Move the plan pins off `@main` in
  officio-gui and form-suite.
- Docs: the caller examples use secret names the org does not have, and `docs/ai/ai-plan.md` says
  text after `/ai-plan` is ignored, which is false.
- Add `CLAUDE.md` = `@AGENTS.md` to ntnp-frontend, where `AGENTS.md` was never loaded.
- Verify: claude-code-action loads project settings from the checked-out branch, so a
  `.claude/settings.json` on a PR branch could widen the reviewer's tools or add hooks in a job
  holding the review App token.

## Round 2: Acknowledge and explain

- React 👀 to the triggering comment or review once the permission gate passes. Swap it for 🚀 or 😕
  at the end.
- Answer a near-miss with one line: a command not at the start of the comment, `/ai-plan` on a PR,
  `/ai-review` on an issue. A cheap job with no checkout.
- Put the run link and the context artifact link in every result footer.
- Give CI-started rounds the footer "Started by failing `<workflow>`".
- Add `run-name:` to the caller examples so runs can be told apart in the Actions list.
- Say so when a round ends with the PR in conflict: reviews start no runs until it is resolved.

## Round 3: Structured output

Agents write JSON. A new `ai-render` action renders it through fixed templates. Keep the fields
short: one long string field fails on long answers (e861f29).

- **Plan:** `summary`, `revision_note`, `decisions[{id, kind, text, ask}]`,
  `steps[{id, title, depends_on, files, do}]`, `qa[{id, covers, where, action, expect}]` or
  `qa_none_reason`, `checks[{id, command, expect}]`, `retired[{id, reason}]`. The plan agent gets
  `Write`. `ai-qa-criteria` reads `qa[]` directly.
- **Report**, for the first run and for rounds: `headline`, `status[{ref, state, note}]`,
  `deviations[{ref, what, why}]`, `verification[{ref, command, result}]`, `decisions[{ask, ref}]`,
  `replies[{reply_target, body}]`.
- **Review:** `verdict`, `headline`, `findings[{severity: blocking|should|nit, refs, path, line,
  title, body}]`, `plan_gaps[]`, `qa_focus[]`. `changes_requested` if and only if there is a
  blocking finding.
- **Rendering:** fixed headings in a fixed order, empty sections left out, tables for status and
  verification, per-field length caps.
- **One place per fact:**
  - The PR body carries a status block between markers, re-rendered every round.
  - A round comment has one line per item, linking to its reply.
  - Plan steps are cited by id, never retold.
  - The implementer and the reviewer both get the previous round's JSON.
  - Open decisions carry over as one line each.
- **Shared style guide** passed with `--append-system-prompt`, about 15 rules:
  - Conclusion first.
  - No narrating what was read.
  - Never name `.ai-*` files or `replies.json`.
  - Cite ids, don't restate.
  - Severity instead of hedges.
  - The code-comment rule from this repo's `AGENTS.md`.
- **Linter** in the render step:
  - Length caps.
  - Banned patterns: internal file names, "Let me", "non-blocking".
  - Every cited id exists, and every previous id is live or retired.

  Add `chars` and `lint_violations` to the `ai-cost` line.
- **Prompts** rewritten around the schema, at about half their length. Instructions only. The
  reasoning moves into the YAML comments. The guardrails duplicated across both implement prompts
  move into the shared system prompt.

## Round 4: Tokens

- Re-baseline with `bin/ai-cost-report.sh --from 2026-09-24`. The CSV predates Opus 5.5 and
  overstates today's cost by about 35-40%. Check whether the coding costs clustered around $26
  were runs hitting the 60-minute timeout.
- Have the implementer write a script for an edit repeated across many files (sed, rector,
  php-cs-fixer) instead of one Edit per call site. Mass-edit issues are about $250 of the CSV.
- From round 2, review only what changed since the last AI review: stage `since-last-review.patch`
  the way `since-approval.patch` is staged. Lower `max_diff_bytes`.
- Pick effort and model by round type: a round fixing only failing checks at `medium`, delta
  reviews on Sonnet. A/B test first, and check model support as `AGENTS.md` requires.
- Where a repository has `AGENTS.md` and no `CLAUDE.md`, write the `@AGENTS.md` shim into the
  checkout and keep it out of the commit. Write `AGENTS.md` for scoring-lib, condition-manager,
  field-framework and uforms.
- Stage a repository map: directories with file counts, excluding `vendor/` and `node_modules`.
- Cap check output with `tail` in the commands the agent is given.
- Turn off `Task`, `Agent`, `WebFetch` and `WebSearch`, and delete the prompt paragraphs about
  them.
- Stage `comments.json` only from after the latest plan. Stop staging it for the reviewer.
- `/ai-plan from=#N` starts from an earlier issue's plan and PR summary, for issue series.

## Round 5: Fewer notifications, visible state

- One review per round: a pending review, one reply per thread, then submitted with the round
  summary as its body. That is 1 notification instead of k + 1.
- One status comment per issue and PR, edited in place. It shows queued, running round N, waiting
  for CI and review, or stood down because X, plus "2 of 5 unattended rounds", the last run link,
  the cost so far and the commands.
- A Comment review whose body starts with `/ai-do` starts a round.
- Mark superseded plan comments as outdated.
- Labels as controls: `ai:paused`, `ai:needs-human`, `ai:allow-workflow-changes`.

## Round 6: Callers

- Shrink callers to triggers, permissions and `uses`:
  - Default the `anthropic_*` inputs and the App IDs to `vars.*`.
  - Move plan concurrency into `ai-plan.yml`.
  - Fix the secret names in the docs.
- A scheduled caller audit, reusing the cost report's code search. It flags:
  - pins other than `VERSION_BRANCH`;
  - secrets the workflow does not declare;
  - caller-level `cancel-in-progress`;
  - repositories missing from an App installation;
  - `workflow_run` names that do not exist, and check workflows not listed or ignored.
- `bin/ai-adopt.sh <repo>` opens a PR with the caller filled in from what the repository has.

## Round 7: CI feedback through `ai-context-mcp`

Replaces the `ai-report-*` artifact channel.

- Read-only tools:
  - `failed_checks(sha)`: failing runs, the failed step, annotations.
  - `job_log(job_id, step, grep, tail)`.
  - `check_reports(sha)`: optional structured reports.
- `ai-report/v1` as the format of those structured reports.
- Classify failures before a round runs: `agent_fixable`, `flaky`, `environment_failure`,
  `missing_secret`, `dependency_install_failure`, `infra_failure`, `unknown`. Group matrix
  failures by tool, file and version.
- Authentication by GitHub Actions OIDC: audience `mcp.unqs.ca`, `repository_owner` checked. The
  GitHub token stays on the server.
- Staged files cost the same tokens as tool results. A tool earns its place by returning less than
  the agent would otherwise read, or by reaching what the runner cannot.

## Round 8: Feedback package, aggregator, policy

- One per-round input package, served by the MCP server and computed by the same code that feeds
  the workflow gates:
  - PR and plan metadata;
  - unresolved threads;
  - comments since the last round;
  - failing checks;
  - the round watermark.
- Aggregator: all relevant checks done, reviewer not running, actionable feedback present, the
  same feedback fingerprint not already acted on (`pull_request + head_sha + feedback_fingerprint`),
  unattended cap not reached.
- Policy validated before commit, push or comment:
  - `.ai-*/**` read-only;
  - `CHANGELOG.md` forbidden;
  - `.github/workflows/**` only when attended or labelled;
  - no generated config or known secret values staged;
  - replies target known threads.

## Round 9: Planning across repositories

- The planner checks out named sibling repositories read-only, through a third App with
  `contents: read`. The repositories come from `/ai-plan repos=...` or from the `uniquesca/*`
  dependencies. Their `AGENTS.md` is staged.
- Plan steps carry a repository, and the metadata line records the repositories.
- The plan fans out into one linked child issue per repository, ordered by sub-issues or "blocked
  by". Each repository's own `/ai-do` loop implements its part.
