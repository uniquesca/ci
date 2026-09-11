# Set up application

Everything a job needs before it can do any work on a Dockerised application: the containers up, the
Composer and Yarn dependencies installed, the database migrated and the cache cleared.

```yaml
- uses: uniquesca/ci/setup-app@v11
  with:
    hostname: app.local.site
    env_variables: >
      {
      "site_version.domain":"app.local.site"
      }
    docker_password: ${{ secrets.GHA_PRIVATE_ACCESS_TOKEN }}
    composer_access_token: ${{ secrets.COMPOSER_ACCESS_TOKEN }}
    npm_access_token: ${{ secrets.NPM_ACCESS_TOKEN }}
```

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `working_directory` | no | `.` | Directory the application lives in |
| `env_variables` | no | `'{}'` | JSON object of variables the config templates are rendered with |
| `hostname` | no | | Hostname to point at `127.0.0.1` in `/etc/hosts` |
| `profile` | no | `ci` | Docker Compose profile to use |
| `sleep` | no | `0` | Seconds to wait after the containers are up |
| `docker_registry` | no | `ghcr.io` | Registry to log into before pulling |
| `docker_username` | no | | Registry username. Falls back to the `USERNAME_GITHUB` variable |
| `docker_password` | no | | Registry password or access token |
| `composer_cmd` | no | `./task.sh composer install --prefer-dist --no-interaction` | Command that installs the Composer dependencies |
| `composer_cache_dir` | no | `var/docker/.composer-cache/files/` | Composer cache directory |
| `composer_access_token` | no | | Token for `satis.unqs.ca`, the Uniques Composer registry |
| `skip_composer` | no | `false` | Skip Composer entirely |
| `yarn_install_cmd` | no | `./task.sh yarn install` | Command that installs the Yarn dependencies |
| `yarn_cache_dir` | no | `var/docker/yarn/` | Yarn cache directory |
| `npm_access_token` | no | | Token for the Uniques NPM registry |
| `skip_npm_yarn` | no | `false` | Skip NPM and Yarn entirely |
| `cache_key` | no | `''` | Extra fragment mixed into every cache key, to keep two callers' caches apart |

## Outputs

This action produces no outputs.

## Dig deeper

### What it is made of

[`docker-spin-up`](docker-spin-up.md), then [`install-packages`](install-packages.md), then
`./task.sh migrate` and `./task.sh clear-cache`. Call those directly when a job needs to do something
between the steps - generate fixtures after the migrations, say, or install a second working
directory's packages before the application comes up.

### The tasks it runs

`migrate` and `clear-cache` run only if `./task.sh supports` says they exist, so an application
without a database or a cache needs no configuration to skip them - it simply does not declare those
tasks. The commands go through `task.sh` for the same reason: the dependencies belong inside the
containers, not on the runner.

### Its defaults are the Docker ones

`composer_cmd`, `yarn_install_cmd` and both cache directories default to what a Dockerised Uniques
application wants, which is what makes the call short. [`install-packages`](install-packages.md) on
its own defaults to running on the runner instead, and has the full set of inputs - `composer_lock`,
`npm_install_cmd`, the NPM cache directory - for a repository that needs them.
