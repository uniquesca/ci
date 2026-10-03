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

## Round 1: Bugs and broken callers - Done (#24)

- The wait for the reviewer looks for its `ai:reviewing` label on the pull request.
- The CI framework catalogue reads the workflow ref and sha from the job's OIDC token.
- The reviewer is given the unattended round count.
- Failure comments give a stop reason only for unfinished runs, mention a person on unattended
  rounds, and say how to retry.
- Caller examples use the organisation's variable and secret names.
- Callers in ntnp-frontend, uforms, officio-gui, form-suite, sentry-lib, forms-dev-platform,
  angular-core, context-lib, field-framework and scoring-lib are fixed, staged in each repository.

Open:

- Add uforms to the AI Implement App installation. Check ntnp-frontend against the App installation
  and the federation rule.
- Copilot reviews in officio start "AI Do" runs that GitHub holds for approval. No workflow change
  can skip them: stop automatic Copilot reviews there, or delete those runs on a schedule.
- Verify whether a `.claude/settings.json` on a PR branch can widen the reviewer's tools or add hooks
  in a job holding the review App token.

## Round 2: Acknowledge and explain - Done (#25)

- `ai-react`: 👀 on the command or review a run picked up, 🚀 or 😕 when it ends.
- `ai-command-hint`: one line for a command not at the start of the comment, `/ai-plan` on a pull
  request, or `/ai-review` on an issue.
- Run and context links in every result footer.
- CI-started rounds name the workflow that started them.
- `run-name:` in the caller examples. Not yet in the callers.
- A round comment says when the branch conflicts with its base.

## Round 3: Structured output - 3a to 3c done (#26, #27, #28)

Agents write JSON; code in `src/ai-*.js` checks it and lays it out. Each falls back to the agent's
final message when the JSON is missing or unusable.

- **3a Review:** `headline` and `findings` with a `blocking`, `should` or `nit` severity. The
  verdict follows from the findings. A finding off the diff goes into the review body.
- **Style guide:** `ai-style-guide`, carried in every agent's prompt. The prompt, not
  `--append-system-prompt`: claude-code-action's argument parsing makes a long multi-line value
  risky.
- **3b Report:** `headline`, `done`, `not_done`, `verification`, `decisions`. It is the pull request
  description on the first run and the round comment after. A status block at the top of the pull
  request is rewritten every round and carries the report for the next round and the reviewer.
  `replies.json` stays separate.
- **3c Plan:** `summary`, `revision`, `risks`, `steps`, `qa` or `qa_none`, `checks`, `retired`. Ids
  are checked against the previous plan, which is carried hidden in the comment. The markdown keeps
  its shape, so `ai-qa-criteria` still parses it.

Watch the first real runs for: the planner's single-file write permission, plans that fit under
GitHub's comment limit only without their data, and how often each fallback is taken.

**3d, after a few real runs:**

- A linter in the render steps: length caps, banned patterns (internal file names, "Let me",
  "non-blocking"), cited ids that exist.
- `chars` and `lint_violations` in the `ai-cost` line.
- Prompts cut to about half: instructions only, the reasoning in YAML comments, the guardrails the
  two implement prompts share in one place.

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
