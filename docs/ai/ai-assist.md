# AI Assist

Part of [AI assisted development](../ai.md).

Does a job on a pull request a person opened. Comment `/ai-do` and what you want on the pull
request; the agent reads the description, the diff, the review threads and the failing checks, does
the job, and pushes one commit to the branch. It replies once with what it did. There are no rounds:
review the commit, and take it from there.

```
/ai-do address the review comments on the validator, and add a test for the empty case
```

## Integrating a repository

Nothing to add. [AI Implement](ai-implement.md) hands `/ai-do` on a pull request it did not open to
this workflow, with its own inputs and secrets. Set its `assist_human_pull_requests: false` to
refuse the command there instead.

To call it on its own, with another `command`:

```yaml
on:
  issue_comment:
    types: [ created ]

jobs:
  ai-assist:
    permissions:
      contents: write
      issues: write
      pull-requests: write
      checks: read
      actions: read
      packages: read
      id-token: write
    uses: uniquesca/ci/.github/workflows/ai-assist.yml@v11
    secrets: inherit
    with:
      anthropic_federation_rule_id: ${{ vars.ANTHROPIC_FEDERATION_RULE_ID }}
      anthropic_organization_id: ${{ vars.ANTHROPIC_ORGANIZATION_ID }}
      anthropic_service_account_id: ${{ vars.ANTHROPIC_SERVICE_ACCOUNT_ID }}
      command: '/ai-help'
```

## Secrets

| Secret | Required | Description |
|---|---|---|
| `AI_IMPLEMENT_APP_ID` | yes | App id of AI Implement, which the work is pushed as, so the push starts the QA workflows |
| `AI_IMPLEMENT_PRIVATE_KEY` | yes | Private key of that app |
| `COMPOSER_ACCESS_TOKEN` | no | Token for the Uniques private Composer registry, so the agent can run the checks |
| `NPM_ACCESS_TOKEN` | no | Token for the Uniques private NPM registry, on the same terms |
| `ENV_VARIABLES` | no | JSON object the config templates are rendered with. The agent can read it, so use a test environment's credentials |

## Inputs

| Input | Type | Default | Description |
|---|---|---|---|
| `anthropic_federation_rule_id` | string | *required* | Identity federation rule the job authenticates against |
| `anthropic_organization_id` | string | *required* | Anthropic organization the rule belongs to |
| `anthropic_service_account_id` | string | *required* | Service account the minted token acts as |
| `anthropic_workspace_id` | string | *(none)* | Workspace to bill the run to |
| `command` | string | `/ai-do` | Comment prefix that starts a run |
| `allowed_permissions` | string | `admin write` | Repository permissions allowed to run the command |
| `branch_prefix` | string | `ai-feature/` | AI Implement's branch prefix. Pull requests on such a branch are left to it |
| `progress_label` | string | `ai:implementing` | Label on the pull request while the agent works. Empty for none |
| `timeout_minutes` | number | `65` | Timeout for the whole job. Keep it above `agent_timeout_minutes` |
| `agent_timeout_minutes` | number | `60` | Timeout for the agent |
| `max_turns` | number | `100` | Turns the agent may take |
| `model` | string | `claude-opus-5-5` | Model the agent runs on |
| `effort` | string | `high` | Effort the agent runs at. Empty for the model default |
| `max_diff_bytes` | number | `200000` | How much of the diff to stage. The agent can read the files past it |
| `allow_workflow_changes` | boolean | `false` | Push edits under `.github/workflows/`. Off, they are posted as a patch |
| `provision_checks` | boolean | `true` | Bring the application up and install its dependencies, so the agent can run the checks |
| `spin_up_docker` | boolean | `true` | Bring the application up in Docker when there is a `task.sh` or a compose file |
| `docker_profile` | string | *(none)* | Docker Compose profile to bring up |
| `node_working_directory` | string | `.` | Directory holding the `package.json` to install from |
| `node_version` | number | `20` | Node version to install under, on the runner |
| `debug` | boolean | `false` | Log the raw agent transcript. **Not for a public repository** |

## Outputs

None.

## Dig deeper

### What it pushes, and when it does not

One commit on top of the head the run started from, as the AI Implement app, with a message the
agent writes in the changelog format; a line without a known prefix is dropped. It never force
pushes: if somebody pushed while the agent worked, the push is refused and the reply carries the
commit as a `git am` command instead. Workflow file edits are held back as a patch, as in
[AI Implement](ai-implement.md#what-the-agent-can-and-cannot-do). It refuses a pull request from a
fork, a closed one, and one on AI Implement's own branches.
