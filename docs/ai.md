# AI assisted development

Three workflows that take an issue to a reviewed pull request. Each has its own page:

| Workflow | What it does |
|---|---|
| [AI Plan](ai/ai-plan.md) | Turns an issue into an implementation plan, on `/ai-plan` |
| [AI Implement](ai/ai-implement.md) | Builds the plan on a branch and opens a pull request, then runs a round for every review or red check, on `/ai-do` |
| [AI Review](ai/ai-review.md) | Reviews what a round pushed, as a real Github review that can start the next one |

## How the three fit together

```
issue                                    pull request
-----                                    ------------
/ai-plan   -> plan posted
  (read it, correct it, re-run)
/ai-do     -> opens ------------------->  code to review
                                          |
                                          | Request changes   ->  another round
                                          | /ai-do            ->  another round
                                          |
/ai-plan   -> plan revised ------------>  /ai-do             ->  branch reconciled
                                          |                      with the revision
                                          v
                                          AI Review can drive that loop by itself,
                                          for a bounded number of rounds
```

**The issue holds the plan. The pull request holds the review.** Once a pull request exists,
`/ai-do` on the issue only points at it. The plan also records the branch it was written against,
and later commands follow it without being told again.

## Integrating a repository

The planner and the implementer are two jobs in one workflow file, because they run on the same
events. The reviewer needs a second file, because it runs on a different one. Each page carries the
job to copy: [AI Plan](ai/ai-plan.md#integrating-a-repository),
[AI Implement](ai/ai-implement.md#integrating-a-repository),
[AI Review](ai/ai-review.md#integrating-a-repository).

The three federation identifiers every job is passed come from **Workload identity → Connect
workload** in the Claude Console. They are identifiers rather than secrets, so organisation-level
Actions variables suit them - rotating the rule is then one edit rather than one per repository.

Four things fail quietly rather than loudly:

* **The `permissions` block belongs on the calling job.** A called workflow can only narrow the
  token it is given, never widen it - including `id-token: write`, which the agent's Claude
  credential is minted from.
* **The files have to be on the default branch.** Github always runs the default-branch copy of an
  `issue_comment` or `repository_dispatch` workflow, so none of this can be tested from a branch.
* **Every secret has to be listed explicitly**, or `secrets: inherit`. Secrets do not cross the
  `workflow_call` boundary on their own.
* **The implementing and reviewing workflows each need a Github App**, and they have to be two
  different ones - Github rejects a `REQUEST_CHANGES` review from the identity that opened the pull
  request.
