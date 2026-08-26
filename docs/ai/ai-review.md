# AI Review

Part of [AI assisted development](../ai.md).

Reviews what [AI Implement](ai-implement.md) pushed, as a real Github review with real inline
comments. When it requests changes, that starts the next implementing round - so with this wired
up the loop runs on its own, for a bounded number of rounds, and stops to ask for a person.

It is opt-in on both sides: the reviewing workflow has to be listening, and the implementing
workflow has to be told to hand its work over.

## Integrating a repository

**First, the thing that will otherwise waste your afternoon.** Github will not let an identity
request changes on a pull request it opened. So the review is submitted as the
AI Review app, which is a second identity from the one
[AI Implement](ai-implement.md) opens pull requests with. That is what buys a real
`changes_requested` review: it blocks the merge, and it starts the next round by itself.

Add a **second workflow file**, because this one runs on a different event:

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
      # Mints the agent's Claude credential from this run's own identity
      id-token: write
    uses: uniquesca/ci/.github/workflows/ai-review.yml@main
    with:
      # Identifiers, not secrets - the same three the other two jobs are passed
      anthropic_federation_rule_id: ${{ vars.ANTHROPIC_FEDERATION_RULE_ID }}
      anthropic_organization_id: ${{ vars.ANTHROPIC_ORGANIZATION_ID }}
      anthropic_service_account_id: ${{ vars.ANTHROPIC_SERVICE_ACCOUNT_ID }}
    secrets:
      AI_REVIEW_APP_ID: ${{ secrets.AI_REVIEW_APP_ID }}
      AI_REVIEW_PRIVATE_KEY: ${{ secrets.AI_REVIEW_PRIVATE_KEY }}
```

And make sure [AI Implement](ai-implement.md#integrating-a-repository) is called with
`dispatch_review: true`, or nothing ever reaches this workflow.

Three more things that fail silently:

* **`repository_dispatch` only ever runs the default-branch copy of the file**, same as
  `issue_comment`. There is no testing it from a branch.
* **`dispatch_review` and the `types:` above have to agree.** Both default to `ai-review`; change
  one and the dispatch lands with nothing to answer it.
* **The implementing workflow's `allowed_bots` has to name this app's bot login.** It defaults to
  `github-actions[bot] ai-review[bot]`; if the app's slug is anything else, the review lands
  happily and starts no round.

Keep `branch_prefix` and `max_unattended_rounds` the same as the implementing workflow's.

## Using it

You do not trigger this one. Every implementing round hands its push over, and a review appears on
the pull request a few minutes later. From there it behaves like a review from a colleague, with the
same options [described for a human review](ai-implement.md#what-to-do-with-a-reply) - let it run,
resolve a thread, reply to overrule either side, or take over with `/ai-do`.

**It never approves**: the verdict is either changes requested or "no blocking concerns", and
merging is a person's decision. It will sometimes find nothing, which ends the loop there. And it
cannot test the QA criteria - what it can say is that the code cannot satisfy one as written, or
that nothing in the diff addresses the steps a criterion covers.

### When to stop letting it run

Read the round comments rather than the individual replies. If two or three rounds have gone by
with a lot of activity and little diff, the reviewer and the implementer are talking past each
other, and the fastest fix is a sentence from you. If the *plan* turns out to be wrong rather than
the code, go back to [`/ai-plan` on the issue](ai-plan.md#adjusting-the-plan).

## Secrets

| Secret | Required | Description |
|---|---|---|
| `AI_REVIEW_APP_ID` | yes | Numeric id of the AI Review Github App. The review is submitted as this app, which is the second identity the loop needs - Github rejects `REQUEST_CHANGES` from the identity that opened the pull request, and that is the implementing app |
| `AI_REVIEW_PRIVATE_KEY` | yes | Private key for the AI Review app. Used only to mint a short-lived installation token for submitting the review; never passed to the agent |

## Inputs

| Input | Type | Default | Description |
|---|---|---|---|
| `anthropic_federation_rule_id` | string | *required* | Identity federation rule the job authenticates against. The agent is called with a token minted from this run's own Github OIDC identity, and the rule is what decides which repositories and branches may mint one. An identifier rather than a secret |
| `anthropic_organization_id` | string | *required* | Anthropic organization the rule belongs to. In the Claude Console under **Settings → Organization** |
| `anthropic_service_account_id` | string | *required* | Service account the minted token acts as. Usage and rate limits are attributed to it |
| `anthropic_workspace_id` | string | *(none)* | Workspace the minted token is scoped to. Only needed when the rule covers more than one workspace - a rule bound to a single workspace resolves it on its own |
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

### What the review is built from

The agent gets the diff of the branch against its base (three dots, so it is what this branch
changed rather than everything on the base since), the **plan and the issue** - a review that does
not know what the change was *meant* to do is a style check, and the plan's
[ids](ai-plan.md#how-the-plan-is-numbered) are what it checks the diff against - and the review
history with **answered threads included**, so it can read the reply where its own last concern was
addressed before deciding whether to raise it again. The working tree is the branch, and it is told
to open the files around each hunk rather than review the diff in isolation.

### Inline comments, and why some go missing

Github rejects an **entire** review - summary, verdict and every comment - if one comment names a
line the diff does not contain, so the workflow drops comments that cannot anchor to an added or
context line inside a hunk, and names them in the run log. If Github still refuses, the review
degrades rather than disappears: without inline comments, then as a plain comment review, then as
an ordinary comment. The summary is never lost.

### Making the loop terminate

A reviewer that always finds something never lets the loop end. Four things work against that: the
[`max_unattended_rounds`](ai-implement.md#the-round-cap) cap, enforced in the implementing workflow;
a round that changes nothing dispatching no review, so a stalled loop stops rather than spinning on
one commit; a "no blocking concerns" verdict starting nothing, since only a changes-requested review
does; and the agent being told at length that finding nothing is a valid outcome - not to manufacture
a concern, not to request changes over a preference, and to accept a reasoned refusal rather than
repeat the concern. If the cap is reached while it still wants changes, the pull request is left with
a blocking review and a comment asking for a person.

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
