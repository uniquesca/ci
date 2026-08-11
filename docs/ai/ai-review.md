# AI Review

AI workflows: [Plan](ai-plan.md) · [Implement](ai-implement.md) · **Review**

Reviews what [AI Implement](ai-implement.md) pushed, as a real Github review with real inline
comments. When it requests changes, that starts the next implementing round - so with this wired
up the loop runs on its own, for a bounded number of rounds, and stops to ask for a person.

It is opt-in on both sides: the reviewing workflow has to be listening, and the implementing
workflow has to be told to hand its work over.

## Integrating a repository

**First, the thing that will otherwise waste your afternoon.** Github will not let an identity
request changes on a pull request it opened. AI Implement opens its pull requests as
`github-actions[bot]`, so a review submitted with the built-in `GITHUB_TOKEN` is a self-review and
the API only allows a plain comment.

That matters beyond the label: a comment review blocks nothing, and it does not start another
round. So you need a **second identity**:

| What you configure | What you get |
|--------------------|--------------|
| `AI_REVIEW_TOKEN` — a machine user PAT with `repo` scope, or a Github App installation token | A real `changes_requested` review that blocks the merge and starts the next round automatically |
| Nothing | The same review with the same inline comments, as a plain comment. Nothing is blocked, nothing starts. Somebody runs `/ai-do` to act on it |

The second row is handled rather than hidden - the review still posts with its comments intact, and
the pull request gets a comment saying the agent wanted to request changes and could not.

Then add a **second workflow file**, because this one runs on a different event:

```yaml
name: AI Review

on:
  repository_dispatch:
    types: [ ai-review ]

jobs:
  ai-review:
    permissions:
      contents: read
      pull-requests: write
      issues: write
      checks: read
    uses: uniquesca/ci/.github/workflows/ai-review.yml@main
    secrets:
      ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
      AI_REVIEW_TOKEN: ${{ secrets.AI_REVIEW_TOKEN }}
```

And turn the hand-off on where [AI Implement](ai-implement.md) is called:

```yaml
  ai-implement:
    uses: uniquesca/ci/.github/workflows/ai-implement.yml@main
    with:
      dispatch_review: true
    # permissions and secrets as before
```

Two more things that fail silently:

* **`repository_dispatch` only ever runs the default-branch copy of the file**, same as
  `issue_comment`. There is no testing it from a branch.
* **`dispatch_review` and the `types:` above have to agree.** Both default to `ai-review`; change
  one and the dispatch lands with nothing to answer it.

Inputs are documented in `.github/workflows/ai-review.yml`. Keep `branch_prefix` and
`max_unattended_rounds` the same as the implementing workflow's.

## Using it

You do not trigger this one. AI Implement hands every push to it, and a review appears on the pull
request a few minutes later - inline comments on the lines it has something to say about, and a
summary at the top.

From there it behaves exactly like a review from a colleague, and you have the same options
[described for a human review](ai-implement.md#what-to-do-with-a-reply):

* **Let it run.** If it requested changes, the next implementing round has already started. It will
  push, reply to each of the review's own threads, and get reviewed again. This repeats up to
  `max_unattended_rounds` times (default 5) and then stops and asks for a person.
* **Resolve a thread** you think has been dealt with, or that you disagree with. Resolution is
  always yours - nothing here resolves anything.
* **Reply to a thread** to overrule either side. Your reply puts the thread back in play for the
  next round, and it carries more weight than the agent's own argument.
* **Take over.** Comment `/ai-do` with what you actually want, and that round counts as attended,
  which resets the round cap.

Two things to expect:

**It will sometimes find nothing**, and that is the point. A change that implements the plan and
reads like the surrounding code gets a plain comment review saying so, and the loop ends there. A
reviewer that always found something would never terminate.

**It never approves.** The verdict is either "changes requested" or "no blocking concerns" -
merging is a person's decision, and an agent approving its own pipeline's work is not a signal
anybody should act on. Approve and merge yourself.

### When to stop letting it run

Read the round comments rather than the individual replies. If two or three rounds have gone by
with a lot of activity and little diff, the reviewer and the implementer are talking past each
other, and the fastest fix is a sentence from you. If the *plan* turns out to be wrong rather than
the code, go back to [`/ai-plan` on the issue](ai-plan.md#changing-direction).

## Secrets

| Secret | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | yes | Anthropic API key used to call the AI reviewing agent |
| `AI_REVIEW_TOKEN` | no | Token the review is submitted with. **Without it the review cannot request changes and cannot start another round** - Github rejects `REQUEST_CHANGES` from the identity that opened the pull request, and [`ai-implement`](ai-implement.md) opens its pull requests as `github-actions[bot]`. A machine user PAT with `repo` scope, or a Github App installation token, is what makes the loop turn |

## Inputs

| Input | Type | Default | Description |
|---|---|---|---|
| `dispatch_type` | string | `ai-review` | The `repository_dispatch` event type this reacts to. [`ai-implement`](ai-implement.md) sends it after it pushes |
| `branch_prefix` | string | `ai-feature/` | Only pull requests whose branch lives in this repository and starts with this prefix are reviewed. Keep it the same as the implementing workflow's |
| `model` | string | `claude-opus-4-8` | Model used to review |
| `max_turns` | number | `40` | How many turns the agent may spend reading the code before it has to review with what it found |
| `agent_timeout_minutes` | number | `25` | How long the reviewing agent itself may run before it is given up on |
| `timeout_minutes` | number | `30` | How long the whole job may run. Keep it a few minutes above `agent_timeout_minutes` |
| `max_comments` | number | `30` | How many inline comments one review may carry |
| `max_diff_bytes` | number | `400000` | Longest diff to stage. A bigger change is truncated and the agent is told so - it has the repository on disk |
| `max_unattended_rounds` | number | `5` | Only used to tell the agent how close the loop is to needing a person. The limit itself is enforced by [`ai-implement`](ai-implement.md), so keep the two the same |
| `ignore_check_patterns` | string | `(ai.implement\|ai.plan\|ai.review)` | Case-insensitive regular expression matching check runs to leave out of the context. The default covers the AI workflows' own check runs |
| `debug` | boolean | `false` | Log the raw agent transcript as JSON. **Not for a public repository** - tool results contain whatever the agent read |

## Outputs

None. The result is a Github review on the pull request.

## Dig deeper

### Why `repository_dispatch` and not a `pull_request` trigger

Because a pull request opened or updated by `GITHUB_TOKEN` produces a workflow run that **waits for
somebody to click "Approve workflows to run"** - the opposite of reviewing it the moment it
appears.

Events made with `GITHUB_TOKEN` do not start workflow runs at all, normally; dispatch events are
[the documented exception](https://docs.github.com/en/actions/concepts/security/github_token). So
the implementing workflow can start the reviewer itself, with no extra token, and it does that as
the very last thing in a round - after the replies and the round comment are in place, so the
reviewer sees the whole of what it is reviewing.

Nothing is dispatched for a round that changed no file. Reviewing the same commit again produces
the same review, and the loop would turn without moving.

The dispatch payload is arbitrary JSON that anybody with `contents: write` could send, so the pull
request number is validated and then checked against the same boundary the implementing workflow
uses: branch in this repository, carrying the configured prefix, still open.

### What the review is built from

The agent gets the change and the intent behind it:

* the diff of the branch against its base - three dots, so it is what this branch changed rather
  than everything that has happened on the base since
* the **plan and the issue**, because a review that does not know what the change was *meant* to do
  is a style check. "This does not do what the plan says" is the most valuable thing it can find
* the review history and the failing checks, with **answered threads included** - unlike the
  implementing agent, this one needs to read the reply where its own last concern was addressed or
  argued with, before deciding whether to raise it again

The working tree is the branch, and the agent is told to open the files around each hunk rather
than review the diff in isolation. That is the biggest single difference between a useful review
and a noisy one.

### Inline comments, and why some go missing

Github rejects an **entire** review - summary, verdict, every comment - if one comment names a line
the diff does not contain. So the workflow works out from the diff which lines a comment may
anchor to (every added and every context line inside a hunk, numbered in the new file), drops the
ones that do not fit, and names them in the run log. Without that, one wrong line number would lose
the whole review and stall the loop.

If Github still refuses the review it degrades rather than disappears: retry without the inline
comments, then as a plain comment review, and failing all of that the summary is posted as an
ordinary comment. The summary is never lost.

### Making the loop terminate

Worth understanding before you turn it on. A reviewer that always finds something is worse than no
reviewer, because the loop never ends and every turn costs money. Four things work against that:

* **The cap** - [`max_unattended_rounds`](ai-implement.md#the-round-cap), enforced in the
  implementing workflow, which is the only place it lives.
* **A round that changes nothing does not dispatch a review**, so a stalled loop stops rather than
  spinning on one commit.
* **A "no blocking concerns" verdict starts nothing.** Only a changes-requested review does, so the
  loop ends the moment the reviewer is satisfied.
* **The agent is told, at length, that finding nothing is a valid outcome** - not to manufacture a
  concern to justify the review, and not to request changes over a preference. It is also told what
  to do with a concern the implementing agent answered with a reasoned refusal: accept the argument,
  or say in the summary that a person should settle it. **Not** to repeat it. Two agents restating
  positions at each other is the specific failure this has to avoid.

If the cap is reached while the reviewer still wants changes, the pull request is left with a
blocking review and a comment asking for a person. That is the correct end state: something needs
judgement, and the review says what.

### What the agent can and cannot do

It **may** read and search every file in the checkout.

It **may not**, and cannot:

* **Run anything.** No shell, no network. Tests and linters are CI's job, and what they find reaches
  the *implementing* agent directly through
  [the check intake](ai-implement.md#other-things-the-round-reads) rather than through the reviewer -
  which is also why it is told not to spend an inline comment restating what a linter already said.
* **Change any code.** The job holds `contents: read` and pushes nothing, so anything it writes is
  discarded with the runner.
* **Approve, merge, or comment directly.** It has no token at all. The review is submitted on its
  behalf, from a file it wrote, after that file has been validated.

### Costs

One review per push, on top of one implementing run per round. With the loop running unattended
that is up to `max_unattended_rounds` of both before anybody looks, so the cap is a spending
control as much as a correctness one. Lower it if that is more than you want to risk on a single
pull request.

`max_turns` is not the other half of that control: the SDK holds a short run to it exactly and lets
a long one run past it. A review the agent finished over the limit is submitted with a warning on the
run rather than discarded - see [when a run goes wrong](ai-plan.md#when-a-run-goes-wrong).
