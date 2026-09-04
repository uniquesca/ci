# AI harness: future architecture

## Purpose

This document holds larger architectural moves that are useful, but should follow the near-term work on GitHub App identities, MCP, structured CI reports, feedback packaging, policy validation and idempotency.

## Persistent AI context service

A persistent service may eventually replace purely file/artifact-backed context.

### Possible responsibilities

- accept CI report ingestion through HTTP;
- store per-PR round history;
- expose current PR state to MCP;
- retain normalized CI summaries after artifacts expire;
- support local agents without downloading artifacts manually;
- provide audit history for why a round did or did not run.

### Possible API

```text
POST /ci-reports
POST /rounds
POST /feedback
GET /repositories/{owner}/{repo}/pulls/{number}/context
GET /repositories/{owner}/{repo}/pulls/{number}/rounds
```

### Do not start here

A persistent service adds operations, auth, retention and migration concerns. Start with file/artifact-backed MCP first.

## Explicit PR loop state machine

Move from inferred state to explicit state.

### Example states

- `planned`
- `implementation_running`
- `waiting_for_ci`
- `waiting_for_review`
- `fixing_ci`
- `fixing_review`
- `blocked`
- `ready_for_human`
- `merged`
- `abandoned`

### Storage options

- hidden PR marker;
- issue/PR labels;
- artifact;
- branch metadata;
- persistent service.

### Value

This makes “what is happening now?” visible and reduces duplicated event interpretation.

## Risk scoring

Classify every AI change before pushing or before continuing unattended.

### Signals

- files touched;
- workflow/config/secret/migration files touched;
- dependency lock changes;
- number of files and lines changed;
- failed check type;
- unattended round count;
- plan risk ids;
- whether tests were run;
- whether CI is flaky or incomplete.

### Possible outcomes

- `low`
- `medium`
- `high`
- `blocked`

### Policy examples

- low risk can continue automatically;
- high risk requests human review;
- workflow changes require explicit label;
- repeated same failure fingerprint stops the loop.

## Specialized triage agent

Add a CI triage agent before the implementation agent.

### Responsibilities

- read CI reports;
- classify actionability;
- group matrix failures;
- identify infra/flaky/missing-secret failures;
- decide whether implementation should run.

### Value

The implementation agent receives cleaner, smaller, more actionable input.

### Caution

Do this only after the CI report schema and feedback package are stable. A triage agent over unstructured logs adds noise.

## Safe deterministic autofix path

Run cheap deterministic fixers before invoking an expensive coding agent.

### Examples

- code style fixer;
- formatter;
- import sorter;
- lockfile refresh where policy allows;
- generated metadata refresh.

### Flow

```text
CI failure
  -> deterministic autofix
  -> push if changed
  -> rerun CI
  -> invoke AI only if still failing
```

### Value

This reduces cost and avoids using an LLM for work a formatter can do better.

## E2E-specific triage

Treat e2e failures differently from unit/static failures.

### Classifications

- app bug;
- test bug;
- flaky;
- environment;
- data/setup;
- unknown;
- needs screenshot/video review.

### Value

Prevents the implementation agent from chasing browser flakes or environment failures as code defects.

## Evaluation suite from historical rounds

Use replay packages as evaluation fixtures.

### Example evals

- agent runs fixer before reporter;
- agent does not edit forbidden paths;
- agent treats missing secrets as non-code failure;
- agent handles plan revision correctly;
- agent replies to every required review thread;
- agent does not claim QA acceptance criteria as completed;
- agent does not chase flaky e2e failures as code bugs.

### Value

Prompt, MCP and policy changes can be tested against known historical cases.

## Merge readiness check

Add a deterministic or agent-assisted readiness gate.

### Checks

- required CI checks green;
- no unresolved conversations;
- human approval present;
- QA criteria copied to PR;
- branch is not stale beyond policy;
- no forbidden files changed;
- no unresolved blocker;
- final summary exists.

### Value

Keeps implementation focused on code and reduces human bookkeeping.

## Broader multi-agent architecture

Potential specialized agents:

- planner;
- implementer;
- reviewer;
- CI triager;
- security reviewer;
- migration reviewer;
- documentation reviewer;
- release-note assistant.

### Caution

Multiple agents amplify noise unless contracts, policies and state are already strong. Prefer fewer agents with better structured context first.

## Organization-wide prompt and policy versioning

Version every contract the harness depends on.

### Versioned items

- prompts;
- MCP server;
- `ai-report` schema;
- feedback package schema;
- edit policy;
- check manifest;
- planner output format.

### Value

Historical runs become explainable and replayable. Regressions become testable.

## Observability and cost controls

Track loop-level metrics.

### Useful metrics

- rounds per pull request;
- time to first PR;
- time to green CI;
- token cost per PR;
- CI failures fixed automatically;
- duplicate rounds suppressed;
- unattended-loop stops;
- actionability categories;
- flaky/e2e failure rate;
- human interventions.

### Budget controls

- max cost per issue;
- max unattended rounds;
- max repeated failure fingerprint;
- max runtime;
- max changed files without human review.

## Long-term target

The mature architecture should look like this:

```text
GitHub events
  -> controller / state machine
  -> feedback package
  -> MCP context interface
  -> agent execution
  -> policy validation
  -> app-authored push/review/comment
  -> CI report ingestion
  -> idempotent next decision
```

The important principle is that agents should reason over structured context, while workflows and policies retain 
control over credentials, writes and loop decisions.