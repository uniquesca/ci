# AI prepare workspace

Gets the checkout ready for an agent to check its own work: the application up in Docker, the
Composer and NPM dependencies installed, and a paragraph for the prompt naming the commands CI will
check its work with. What the repository has decides what is done. Nothing in it fails the job.

Used by [`ai-implement`](../ai/ai-implement.md).

```yaml
- id: workspace
  uses: uniquesca/ci/ai-prepare-workspace@v11
  with:
    env_variables: ${{ secrets.ENV_VARIABLES || '{}' }}
    composer_access_token: ${{ secrets.COMPOSER_ACCESS_TOKEN }}
    npm_access_token: ${{ secrets.NPM_ACCESS_TOKEN }}

# then, inside the agent's prompt
#   ${{ steps.workspace.outputs.instructions }}
```

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `spin_up_docker` | no | `true` | Bring the application up in Docker when the repository has a `task.sh` or a compose file |
| `docker_profile` | no | `''` | Docker Compose profile to bring up |
| `node_working_directory` | no | `.` | Directory holding the `package.json` to install from |
| `node_version` | no | `20` | Node version to install under, on the runner |
| `env_variables` | no | `{}` | JSON object of configuration tokens the config templates are rendered with. The agent can read them |
| `github_token` | no | `github.token` | Token to pull images from `ghcr.io` with. Needs `packages: read` |
| `composer_access_token` | no | `''` | Token for the Uniques private Composer registry |
| `npm_access_token` | no | `''` | Token for the Uniques private NPM registry |

## Outputs

| Output | Description |
|---|---|
| `instructions` | Text for the agent's prompt: what is installed, whether the application is up, and the commands CI checks its work with |
| `docker` | Outcome of bringing the application up: `success`, `failure`, or empty when it was not tried |

## Dig deeper

### Where things run

When the application comes up and `task.sh` supports `composer`, `npm` or `yarn`, that install runs
in the container. Otherwise it runs on the runner, under the PHP version from
`_ci_environment.json`, and only if there is something to run with it: a `phpcs` or `psalm` config
for PHP, any `package.json` for Node. Installs use the lock file, Composer runs with `--no-scripts`,
and lock files, dependency folders, rendered configs and leftover registry credentials are kept out
of the agent's commit. A failed spin-up or install is a warning, and the agent is told what it has.
