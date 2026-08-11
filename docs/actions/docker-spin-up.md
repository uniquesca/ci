# Spin up application in Docker

Brings the application up in Docker on the runner: renders the config files, logs into a registry if
one is given, starts the containers and waits for MySQL to answer.

```yaml
- uses: uniquesca/ci/docker-spin-up@main
  with:
    env_variables: ${{ secrets.ENV_VARIABLES }}
    hostname: app.local
```

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `working_directory` | no | `.` | Directory to spin Docker up in |
| `env_variables` | no | `'{}'` | JSON object of variables the config templates are rendered with |
| `hostname` | no | | Hostname to point at `127.0.0.1` in `/etc/hosts` |
| `docker_up_command` | no | `''` | Alternative command to bring Docker up. Detected when empty |
| `docker_up_arguments` | no | `--force-recreate` | Arguments for the up command, excluding `-d` and `--profile` |
| `profile` | no | | Docker Compose profile to use |
| `docker_registry` | no | | Registry to log into before pulling |
| `docker_username` | no | | Registry username |
| `docker_password` | no | | Registry password or access token |
| `sleep` | no | `0` | Seconds to wait after the containers are up |

## Outputs

This action produces no outputs.

## Dig deeper

### How the containers are started

`docker_up_command` wins if you set one. Otherwise: `./task.sh up -d` when the working directory has
a `task.sh`, and `docker compose up -d` when it does not. `docker_up_arguments` and `--profile` are
appended to whichever it picked, so `-d` must not be in either.

### The environment it renders

`docker.user_map` is set to the runner's own `uid:gid` and merged **under** `env_variables`, so a
compose file can run the containers as the runner's user and the checkout stays writable
afterwards. The merged object then goes to
[`prepare-environment`](prepare-environment.md), which renders whatever `_ci_environment.json`
declares. Override `docker.user_map` in `env_variables` if you need to.

An `init_script` in `_ci_environment.json` runs before any of that, with `VARIABLES_FILE` in its
environment pointing at a temporary file holding `env_variables` as JSON. A repository without
`_ci_environment.json` gets a warning here and no config rendering.

### Waiting for MySQL

If `./task.sh supports ping-mysql`, the action polls `./task.sh ping-mysql` every 5 seconds and
**fails after 120 seconds**. Without that task nothing is waited for, and `sleep` is the only tool
left - a container that accepts TCP connections before the database is ready is what that input
exists for.

### After it

The application is up, so the job can run [`docker-qa-checks`](docker-qa-checks.md),
[`docker-prepare-release`](docker-prepare-release.md), or anything else through `task.sh`. Nothing
is torn down - the runner is thrown away at the end of the job.
