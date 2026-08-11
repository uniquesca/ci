# Docker deploy

Deploys over SSH to a Docker host. Renders the config files on the runner and uploads them, resets
the checkout on the server to a ref, restarts the containers through `task.sh`, then installs
dependencies, clears the cache and migrates inside them.

For a server that runs the application without containers use [`deploy`](deploy.md).

```yaml
name: Deploy to staging

on:
  push:
    branches: [ develop ]

jobs:
  deploy:
    uses: uniquesca/ci/.github/workflows/docker-deploy.yml@main
    with:
      host: staging.example.com
      username: deploy
      deployment_path: /srv/app
      ref: develop
    secrets:
      SSH_KEY: ${{ secrets.SSH_KEY }}
      UNIQUES_GITHUB_ACCESS_TOKEN: ${{ secrets.UNIQUES_GITHUB_ACCESS_TOKEN }}
      NODE_AUTH_TOKEN: ${{ secrets.NODE_AUTH_TOKEN }}
      ENV_VARIABLES: ${{ secrets.ENV_VARIABLES }}
```

## Secrets

| Secret | Required | Description |
|---|---|---|
| `SSH_KEY` | yes | SSH private key used to connect to the host |
| `UNIQUES_GITHUB_ACCESS_TOKEN` | yes | Access token for cloning Uniques private repositories |
| `NODE_AUTH_TOKEN` | no | Access token for authentication with the NPM registry |
| `ENV_VARIABLES` | no | JSON object of variables the config files are rendered with. A secret rather than an input, because it holds the environment's credentials |

## Inputs

| Input | Type | Default | Description |
|---|---|---|---|
| `host` | string | | **Required.** Address of the server |
| `username` | string | | **Required.** SSH login |
| `deployment_path` | string | | **Required.** Directory the project lives in on the server |
| `ref` | string | | **Required.** Branch, tag or pull request ref to deploy |
| `port` | string | `22` | SSH port |
| `prepare_environment` | boolean | `true` | Render the config files on the runner and upload them |
| `docker_up_args` | string | `--force-recreate --remove-orphans --build` | Arguments for `./task.sh up -d` |
| `npm_working_directory` | string | `.` | Directory the NPM commands run in |
| `composer_working_directory` | string | `.` | Directory the Composer commands run in |
| `pre_cmd` | string | `''` | Command to run on the server after the containers are up, before the dependencies |
| `post_cmd` | string | `''` | Command to run on the server once the deployment is complete |
| `timeout` | string | `5m` | Timeout for the deployment connection and script |

## Outputs

None.

## Dig deeper

### The configs are built on the runner, not the server

With `prepare_environment` on, the workflow checks the repository out, runs any `init_script` from
`_ci_environment.json`, renders the templates with
[`prepare-environment`](../actions/prepare-environment.md) using `ENV_VARIABLES`, and `scp`s the
rendered files - plus `_ci_environment.json` itself - into `deployment_path`.

Uploading the environment file as well is what makes a deployment work the first time a repository
introduces one: the server's checkout may not have it yet at the point the remote script reads it.

The upload happens **after** the initialize step below and **before** the containers restart, so the
containers come up against the configuration this deployment intends.

**`prepare_environment: false` turns all of that off** - no checkout on the runner, no rendering, no
upload. The containers come up against whatever configuration is on the server already, which is what
you want when it is managed outside this pipeline.

A repository with no `_ci_environment.json` deploys as well: there is nothing to render and nothing to
upload, both steps say so, and the deployment carries on. `task.sh` is what brings the application up
and it does not need an environment file.

### It clones on first use

The first step over SSH checks for `deployment_path/.git` and, if there is none, clones the
repository with the server's own SSH key and checks out `ref`. It reports back which of the two
happened, and an `init_script` from `_ci_environment.json` is run on the server **only on a fresh
clone** - one-time setup belongs there, and running it on every deployment would undo the point.

So unlike [`deploy`](deploy.md), this workflow can be pointed at an empty directory. The server does
need SSH access to Github for the clone.

### How the ref is applied

Stale refs are cleaned up first, and thoroughly: remote-tracking refs whose branch is gone are
deleted, local branches with no upstream or a `[gone]` upstream are deleted, and `git fetch --prune`
runs. That keeps a long-lived server checkout from accumulating years of dead branches.

| `ref` | What happens |
|---|---|
| `refs/pull/123/merge` | Hard reset, then the pull request head is fetched and checked out detached |
| A branch that exists on `origin` | The remote-tracking ref is force-created and `git reset --hard origin/<ref>` runs |
| Anything else - a tag, a sha | `git reset --hard <ref>` |

**This is a hard reset every time**, preceded by `git clean -fd`. Nothing on the server that is not
in git or ignored survives a deployment.

### What runs inside the containers

In order: `./task.sh down`, then `./task.sh up -d <docker_up_args>`, then `pre_cmd`. After that,
each conditional on the repository having it:

| Condition | What runs |
|---|---|
| `composer.json` in `composer_working_directory` | `./task.sh composer install`, authenticated with `UNIQUES_GITHUB_ACCESS_TOKEN` |
| `package.json` and `yarn.lock` | `./task.sh yarn install`, retried once without `yarn.lock` on a `401 Unauthorized` |
| `package.json`, no `yarn.lock` | `./task.sh npm install` |
| `./task.sh supports clear-cache` | `./task.sh clear-cache` |
| `./task.sh supports migrate` | `./task.sh migrate` |
| `./task.sh supports init` | `./task.sh init`, after `post_cmd` |

`auth.json` and `.npmrc` are written for the installs and removed afterwards, so neither token stays
on the server.

**`task.sh` is required.** Everything above goes through it, so a repository without one cannot use
this workflow - which is the practical difference between this and [`deploy`](deploy.md).

### Downtime

`./task.sh down` before `up` means the containers are stopped for the length of the rebuild. With
`--build` in the default `docker_up_args` that is however long the image takes. Drop `--build` when
the image comes from a registry and nothing local needs compiling.
