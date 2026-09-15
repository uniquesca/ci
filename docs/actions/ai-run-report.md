# AI run report

Reads a Claude Code execution log: prints what the agent did, and hands back its final message,
what the run cost and why it stopped.

Used by [`ai-plan`](../ai/ai-plan.md), [`ai-implement`](../ai/ai-implement.md) and
[`ai-review`](../ai/ai-review.md) after the agent step.

```yaml
- uses: anthropics/claude-code-action@v1
  id: agent
  # ...

- uses: uniquesca/ci/ai-run-report@v11
  if: always()
  id: report
  with:
    execution_file: ${{ steps.agent.outputs.execution_file }}
    verb: Planned
```

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `execution_file` | no | `''` | Path to the agent execution log, the `execution_file` output of `claude-code-action` |
| `verb` | no | `Ran` | Past-tense verb the summary opens with, for example `Planned` or `Implemented` |
| `kind` | no | | What the run was doing - `plan`, `implement` or `review`. Recorded in `cost_line` |
| `issue` | no | | Issue the run belongs to. Recorded in `cost_line`, and what a cost report groups by |
| `pull_request` | no | | Pull request the run belongs to, where there is one |
| `round` | no | | Which round this run was, where the caller counts them |

## Outputs

| Output | Description |
|---|---|
| `has_result` | Whether the agent produced a final message - `true` or `false` |
| `result_file` | Path to a file holding the agent's final message, empty when there is none |
| `summary` | What the run cost, for example `Planned in 6m 44s, 18 turns, 1250000 tokens, ~$3.41`. Empty when the log recorded none of it |
| `reason` | Why the run stopped, truncated to 200 characters, for a failure comment |
| `completed` | Whether the agent finished of its own accord - `true` or `false` |
| `turns` | How many turns the run took. Empty when the log recorded none |
| `cost_usd` | What the run cost in US dollars, as a bare number - for example `3.41`. Empty when the log recorded none |
| `cost_line` | The run as one hidden HTML comment, `<!-- ai-cost {...} -->`, for the comment the caller posts to carry |

## Dig deeper

### `completed` is not the same as the step going green

`claude-code-action` fails a step whose run overran `--max-turns`, and a run it fails that way is
still `completed`. Conversely `completed` is `false` for a run that was cut off, one that died, and
one that wrote no closing record at all - **anything but a clear yes is a no**.

That is why the callers compare `turns` against the budget they set: a finished-but-overrun round
is worth keeping, and a killed one is not.

### Why the result is a file

`result_file` rather than a string output, because a plan can run to tens of kilobytes and a step
output cannot. It is written under `$RUNNER_TEMP`, outside the checkout, so a workflow that commits
its working tree cannot sweep the agent's own output into the commit.

The text comes from the `result` field of the log's closing record. On an `api_error` that field
holds the error rather than an answer, so it is treated as no result.

### `reason`, and why it is surfaced

An exhausted credit balance and a genuine bug both show up as a red step. `reason` carries the
closing record's `result` or `terminal_reason`, collapsed to one line, so a failure comment can say
which. Call this action with `if: always()` - a run that died partway is exactly when you want it.

### The cost line

`summary` is prose for whoever opens the issue, and `cost_line` is the same run as one hidden
HTML comment holding compact JSON: the cost, the four token counters separately, turns, duration,
the model, the run that produced it, and the issue, pull request and round the caller named.
Whatever the log did not record drops out of the object rather than arriving as a null, so a
report can tell a run that recorded no cost from a run that cost nothing. Put it on the **last**
line of the comment - `ai-stage-issue` and `ai-stage-pull-request` read a fixed line of the
comments they parse, and a line added anywhere else moves the one they are looking for.
[AI costs](../ai/ai-costs.md) is what reads these back.

### The narration

The first step prints the agent's own text and every tool call it made, pulled out of the JSON
transcript. The raw transcript is left to the caller's `debug` input.
