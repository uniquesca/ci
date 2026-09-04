# AI harness: near-term phases

## Goal

Move the AI harness from prompt-heavy workflow glue toward a reliable, structured engineering loop:

- GitHub Apps own automation identity.
- CI emits structured feedback.
- Agents consume context through a typed interface.
- Policies are enforced by workflow code, not only by prompts.
- Automatic rounds happen once, for the right reason.

## Phase 1: Finish GitHub App identity integration — Completed

Status: **Completed**

Dedicated GitHub Apps now exist for implementation and review identities.

### Completed outcomes

- AI Implement app created.
- AI Review app created.
- The intended identity split is established:
  - AI Implement owns implementation branch/PR authorship.
  - AI Review owns review feedback.
  - humans remain requesters, reviewers and approvers.
  - `github-actions[bot]` remains orchestration-only where possible.

### Follow-up integration work

The remaining workflow reintegration work is:

- mint AI Implement installation tokens in implementation workflows;
- use the AI Implement token for branch pushes;
- use the AI Implement token for PR create/reopen/edit;
- mint AI Review installation tokens in review workflows;
- use the AI Review token for review submission;
- remove legacy PAT-based push/review paths where appropriate;
- update allowed bot names to the exact app bot logins GitHub reports.

This phase is marked completed because the apps and intended identity model exist. The remaining work is implementation cleanup, not an architecture decision.

## Phase 2: Introduce `ai-context-mcp` and `ai-report/v1` together

Build a Dockerized MCP server that acts as the agent-facing interface to task context, feedback, CI reports, check policy and edit policy.

Do not build a persistent report service yet. Start file/artifact-backed.

### Outcomes

- Define `ai-report/v1` as the standard machine-readable CI report format.
- QA workflows continue uploading artifacts, but the artifacts contain structured reports.
- MCP reads local staged context from the workflow workspace.
- MCP exposes tools/resources such as:
  - `get_task_context`
  - `get_plan`
  - `get_feedback`
  - `get_ci_failures`
  - `get_matrix_summary`
  - `get_allowed_checks`
  - `get_edit_policy`
  - `record_review_reply`
  - `record_round_summary`
- The same MCP image can run in CI and locally.

### Why now

This should not wait until after report work. `ai-report/v1` is the data contract and MCP is the access layer, so they should be designed together.

## Phase 3: Create a canonical feedback package

Separate feedback collection from implementation.

### Outcomes

Produce one canonical per-round input package containing:

- pull request metadata;
- plan metadata;
- unresolved review threads;
- PR comments since the previous round;
- failing CI reports;
- matrix summaries;
- actionability classification;
- plan revision status;
- previous round watermark and metadata.

The implementing agent should consume this through MCP rather than reconstructing state from comments, check runs and artifact directories.

### Why now

This reduces duplicate logic and makes CI runs, local reproduction and tests all use the same input contract.

## Phase 4: Add actionability classification and matrix grouping

Turn raw CI failure data into agent-usable feedback.

### Outcomes

CI/staging/MCP should classify failures as:

- `agent_fixable`
- `probably_agent_fixable`
- `test_failure_needs_investigation`
- `flaky`
- `environment_failure`
- `missing_secret`
- `dependency_install_failure`
- `infra_failure`
- `unknown`

Matrix failures should be grouped by useful dimensions:

- tool;
- file/message;
- PHP version;
- dependency mode;
- OS;
- database/service version;
- browser/shard where relevant.

### Why now

This prevents expensive rounds where the agent tries to fix missing secrets, registry failures, flaky browser jobs or runner problems as if they were code defects.

## Phase 5: Shrink prompts around MCP

After MCP tools are reliable, reduce workflow prompts.

### Outcomes

Prompts should keep high-level intent:

- implement the plan;
- respect feedback;
- use engineering judgment;
- summarize what changed;
- say what was verified.

Operational details should move into MCP and schemas:

- where context lives;
- feedback JSON shape;
- CI report format;
- allowed checks;
- edit restrictions;
- reply output format;
- check-running policy.

### Rule

Do not shrink prompts before MCP and the feedback package are proven. Until then, prompt redundancy is useful safety.

## Phase 6: Add policy validation

Make important rules enforceable after the agent finishes.

### Outcomes

Validate before commit/push/comment:

- forbidden paths were not modified;
- restricted paths require explicit permission or label;
- generated configs and known secret values are not staged;
- review replies are valid and target known threads;
- required round summary exists;
- workflow-file changes are allowed only by policy.

### Initial policy examples

- `.ai-plan/**` is read-only to implementer.
- `.ai-reports/**` is read-only to implementer.
- `.ai-review/**` is read-only except for reply output.
- `CHANGELOG.md` is forbidden for normal implementation.
- `.github/workflows/**` requires attended mode or an explicit allow label.
- `vendor/**` and `node_modules/**` are ignored unless explicitly requested.

## Phase 7: Add CI feedback aggregation and idempotency

Move from many workflow events to one useful implementation decision.

### Outcomes

Add a controller/aggregator that decides:

- whether all relevant checks have completed for the head SHA;
- whether a reviewing agent is still running;
- whether actionable feedback exists;
- whether the same feedback fingerprint already triggered a round;
- whether the unattended round cap has been reached.

Use an idempotency key such as:

```text
pull_request + head_sha + feedback_fingerprint
```

### Why after MCP

The aggregator should consume the same structured feedback package/MCP-facing data rather than duplicating raw GitHub/check/artifact parsing.

## Phase 8: Add labels as human controls

Use labels as simple visible controls over automation.

### Suggested labels

- `ai:paused`
- `ai:blocked`
- `ai:needs-human`
- `ai:do-not-run`
- `ai:allow-workflow-changes`
- `ai:high-risk`
- `ai:rerun`

### Outcomes

Humans can pause, unblock or authorize risky automation without editing workflow files or posting special comments.

## Phase 9: Add replay packages

Create reproducible bundles for important rounds.

### Package contents

- plan;
- feedback package;
- CI reports;
- check manifest;
- edit policy;
- prompt or prompt version;
- MCP server version;
- agent summary;
- result metadata.

### Outcomes

A developer can reproduce locally what the CI agent saw. These packages also become fixtures for future evaluation tests.
