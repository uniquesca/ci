# AI Review

Part of [AI assisted development](../ai.md).

Reviews a pull request as a real Github review with real inline comments. Every
[AI Implement](ai-implement.md) round hands its push over for one, and `/ai-review` asks for one on
any pull request in the repository - including one somebody wrote by hand.

On a branch AI Implement pushed, a review requesting changes starts the next round - so with this
wired up the loop runs on its own, for a bounded number of rounds, and stops to ask for a person.
That much is opt-in on both sides: the reviewing workflow has to be listening, and the implementing
workflow has to be told to hand its work over.

## Integrating a repository

This is its own workflow file, subscribed to the dispatch [the implementer](ai-implement.md) sends
and to `/ai-review`. The setup all three share is in
[AI assisted development](../ai.md#integrating-a-repository).

```yaml
name: AI Review

on:
  # What an implementing round sends when it has pushed
  repository_dispatch:
    types: [ ai-review ]
  # `/ai-review` on a pull request, which is how one nobody dispatched for gets reviewed
  issue_comment:
    types: [ created ]

jobs:
  ai-review:
    permissions:
      contents: read
      pull-requests: write
      issues: write
      checks: read
      # Mints the agent's Claude credential from this run's own identity
      id-token: write
    uses: uniquesca/ci/.github/workflows/ai-review.yml@v11
    with:
      # Identifiers, not secrets - the same three the other two jobs are passed
      anthropic_federation_rule_id: ${{ vars.ANTHROPIC_FEDERATION_RULE_ID }}
      anthropic_organization_id: ${{ vars.ANTHROPIC_ORGANIZATION_ID }}
      anthropic_service_account_id: ${{ vars.ANTHROPIC_SERVICE_ACCOUNT_ID }}
    secrets:
      AI_REVIEW_APP_ID: ${{ secrets.AI_REVIEW_APP_ID }}
      AI_REVIEW_PRIVATE_KEY: ${{ secrets.AI_REVIEW_PRIVATE_KEY }}
```

`/ai-review` works from that alone. For the loop, also make sure
[AI Implement](ai-implement.md#integrating-a-repository) is called with `dispatch_review: true`, or
no round ever reaches this workflow.

Three things that fail silently:

* **Both events only ever run the default-branch copy of the file.** There is no testing either of
  them from a branch.
* **`dispatch_review` and the `types:` above have to agree.** Both default to `ai-review`; change
  one and the dispatch lands with nothing to answer it.
* **The implementing workflow's `allowed_bots` has to name this app's bot login.** It defaults to
  `github-actions[bot] uniques-ai-review[bot] uniques-ai-implement[bot]`; if the app's slug is
  anything else, the review lands happily and starts no round.

Keep `branch_prefix` and `max_unattended_rounds` the same as the implementing workflow's.

## Using it

Comment `/ai-review` on an open pull request whose branch lives in this repository, and a review
appears a few minutes later. Anything typed after the command reaches the agent, so `/ai-review the
migration is the part I am unsure about` is a briefing.

A pull request AI Implement opened needs no asking - every round hands its push over. From there it
behaves like a review from a colleague, with the same options
[described for a human review](ai-implement.md#what-to-do-with-a-reply) - let it run, resolve a
thread, reply to overrule either side, or take over with `/ai-do`.

**It either requests changes or it does not**: it never approves, and merging is a person's
decision. A changes-requested review blocks the merge until somebody deals with it, wherever the
branch came from. It will sometimes find nothing, which ends the loop there. And it cannot test the
QA criteria - what it can say is that the code cannot satisfy one as written, or that nothing in the
diff addresses the steps a criterion covers.

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
| `command` | string | `/ai-review` | Comment command that asks for a review, at the very beginning of a comment on a pull request. This is how a pull request nothing dispatched for is reviewed |
| `allowed_permissions` | string | `admin write` | Space-separated repository permission levels allowed to run the command. Github reports the maintain role as `write` and the triage role as `read`, so this covers owners, maintainers and developers |
| `dispatch_type` | string | `ai-review` | The `repository_dispatch` event type this reacts to. [`ai-implement`](ai-implement.md) sends it after it pushes |
| `branch_prefix` | string | `ai-feature/` | Prefix of the branches the implementing workflow pushes to. A dispatched review is only accepted for a branch carrying it, and the prefix is also what tells that workflow's pull requests from ones somebody wrote - which decides whether the agent is told about the plan and the round. Keep it the same as the implementing workflow's |
| `progress_label` | string | `ai:reviewing` | Label put on the pull request while the run is reviewing, and taken off however it ends. Created if the repository has not got it, then left alone, so recolouring it there sticks. Empty to not label anything |
| `model` | string | `claude-opus-5` | Model used to review |
| `effort` | string | `''` | How much reasoning the agent spends - `low`, `medium`, `high`, `xhigh` or `max`. Empty leaves the model on whatever the CLI defaults it to |
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

It also gets **what has already been decided**, separately from the open feedback: threads somebody
resolved, and every review delivered on the branch before this round, its own included. A resolved
thread stands whatever the agent makes of the code. Only the code under it moving reopens one, and
the inline comment then has to say what moved. An approval is a baseline: the reviewer still runs,
but it is handed the diff since the approved commit. A finding inside code already accepted has to
be a real defect, and the summary has to say it is raised against an approval.

Where there is no plan, the pull request's own title and description are the specification, and a
closing keyword in that description is followed to the issue behind it - so one saying `Closes
#4217` is still reviewed against why the work was wanted, while a number naming a pull request or an
issue of some other repository is ignored rather than staged. Rounds go unmentioned there, and the
agent is told a person is reading what it writes.

### Inline comments, and why some go missing

Github rejects an **entire** review - summary, verdict and every comment - if one comment names a
line the diff does not contain, so the workflow drops comments that cannot anchor to an added or
context line inside a hunk, and names them in the run log. If Github still refuses, the review
degrades rather than disappears: without inline comments, then as a plain comment review, then as
an ordinary comment. The summary is never lost.

### Making the loop terminate

A reviewer that always finds something never lets the loop end. Five things work against that: the
[`max_unattended_rounds`](ai-implement.md#the-round-cap) cap, enforced in the implementing workflow;
a round that changes nothing dispatching no review, so a stalled loop stops rather than spinning on
one commit; a "no blocking concerns" verdict starting nothing, since only a changes-requested review
does; the settled record, so a concern somebody closed cannot come back as a fresh finding; and the
agent being told at length that finding nothing is a valid outcome - not to manufacture a concern,
not to request changes over a preference, and to accept a reasoned refusal rather than repeat the
concern. If the cap is reached while it still wants changes, the pull request is left with a
blocking review and a comment asking for a person.

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
