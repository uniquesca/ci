# Fix code style

Runs a code style fixer and commits what it fixed back to the pull request branch, so that a
problem a tool can fix does not become a check a developer has to act on.

Used by [`php-qa-checks`](../qa-checks.md#php-qa-checks-workflow) and
[`docker-qa-checks`](docker-qa-checks.md); call it directly when your job runs a fixer of its own.

```yaml
- uses: uniquesca/ci/cs-fix@main
  with:
    token: ${{ secrets.AUTOFIX_ACCESS_TOKEN }}
    # As many attempts as there are jobs racing to land a fix
    attempts: ${{ strategy.job-total }}
```

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `cmd` | no | `./vendor/bin/phpcbf` | Command that fixes the code style in place. Whatever it leaves in the working tree is what gets committed |
| `token` | no | `''` | Token the fixes are pushed with. Empty falls back to the run's own `GITHUB_TOKEN` |
| `attempts` | no | `'3'` | How many times to try landing the fixes. Set it to `${{ strategy.job-total }}` |
| `commit_message` | no | `CI: automatic code style fixes` | Subject of the fix commit. Also how the circuit breaker recognises its own commits, so keep it stable |
| `report_dir` | no | `''` | Directory the fixer output is written to, for an AI implementing round to read. Nothing is written when empty |

## Outputs

| Output | Description |
|---|---|
| `fixed` | `true` when the fixer changed something |
| `pushed` | `true` when the fixes were committed and pushed to the branch |

## Dig deeper

### The token decides whether anybody has to click

Supply `token` - a personal access token, or a Github App installation token - and the fix commit
starts its own checks, which is the point of fixing automatically at all. Leave it empty and the
push uses the run's own `GITHUB_TOKEN`, which needs `contents: write` on the calling job and leaves
the run for the fix commit waiting on *Approve workflows to run*: Github holds any `pull_request`
run that `GITHUB_TOKEN` triggered, so that a workflow cannot start itself in a loop. The step says
which of the two happened, as a notice.

### When it does nothing

A `push` run, a pull request from a fork, and a missing fixer (`cmd` not found) each end in a
warning and no fixes - the code style check reports the problems as it always did. Full table in
[QA Checks](../qa-checks.md#when-it-does-nothing).

### Everything else

The matrix race, the five-commit circuit breaker, why the commit is made in a separate worktree,
and why a fix that cannot land is taken back out of the working tree are all covered in
[Automatic code style fixes](../qa-checks.md#automatic-code-style-fixes). That page is written for
the QA workflows, and every word of it applies here.

Two things that matter when calling this action yourself:

* **`attempts` should be the size of your matrix.** Every leg fixes and races to push; a leg that
  loses starts over from the tip the winner made and re-runs the fixer. `${{ strategy.job-total }}`
  is how many jobs can be racing.
* **The commit carries the fixer's files and nothing else.** A file that was already modified when
  this step started - by a `setup_cmd`, say - stays out, even if the fixer touched it too.
