# AI Affected Modules

Part of [AI assisted development](../ai.md).

Reads a pull request's diff and the code around it, and answers which of the application's modules
it affects. The agent works out the framework and the modules itself. What to do with the answer is
up to the caller - typically, run only the end-to-end tests for those modules.

## Integrating a repository

```yaml
jobs:
  affected:
    permissions:
      contents: read
      pull-requests: read
      id-token: write
    uses: uniquesca/ci/.github/workflows/ai-affected-modules.yml@v11
    with:
      anthropic_federation_rule_id: ${{ vars.ANTHROPIC_FEDERATION_RULE_ID }}
      anthropic_organization_id: ${{ vars.ANTHROPIC_ORGANIZATION_ID }}
      anthropic_service_account_id: ${{ vars.ANTHROPIC_SERVICE_ACCOUNT_ID }}

  e2e:
    needs: [ affected ]
    # `all` is true outside a pull request, so pushes and schedules run everything
    if: needs.affected.outputs.all == 'true' || contains(fromJSON(needs.affected.outputs.modules), 'clients')
    runs-on: ubuntu-latest
    steps:
      - run: ./run-client-e2e
```

A module is named after its directory, in lower case with hyphens: `module/TrustAccount` is
`trust-account`, `packages/officio-common` is `officio-common`, `src/Case` is `case`.

## Secrets

None.

## Inputs

| Input | Type | Default | Description |
|---|---|---|---|
| `anthropic_federation_rule_id` | string | *required* | Identity federation rule the job authenticates against. An identifier rather than a secret |
| `anthropic_organization_id` | string | *required* | Anthropic organization the rule belongs to |
| `anthropic_service_account_id` | string | *required* | Service account the minted token acts as |
| `anthropic_workspace_id` | string | *(none)* | Workspace the minted token is scoped to. Only needed when the rule covers more than one workspace |
| `model` | string | `claude-sonnet-5-5` | Model that decides what the change affects |
| `effort` | string | `medium` | How much reasoning the agent spends. Empty leaves the CLI default |
| `max_turns` | number | `40` | How many turns the agent may spend before it has to answer |
| `max_diff_bytes` | number | `200000` | Longest diff to stage. A bigger change is truncated and the agent is told so |
| `timeout_minutes` | number | `15` | How long the whole job may run |

## Outputs

| Output | Description |
|---|---|
| `all` | `true` when the change may affect the whole application, or it could not be told |
| `modules` | JSON array of the affected modules |

## Dig deeper

### What the agent counts as affecting a module

A change to formatting, comments or import order affects nothing. Neither does a change inside a
method whose inputs and outputs stay the same, when an unchanged unit test calls it. Anything else
affects its own module and the modules that call it, through imports, dependency injection config,
events, routes or front-end code. Shared foundation code, dependencies, global config, the build and
the database schema affect everything. The job summary and log list each module with the reason, the
changes left out, and what made everything affected when it was. **Anything short of a valid answer is `all: true`** - a push or schedule, a pull
request from a fork, or the agent failing - so a caller never skips tests on a missing answer.
