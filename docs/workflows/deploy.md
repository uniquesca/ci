# Deploy

Deploys over SSH to a server that runs the application directly - no containers. Resets the checkout
on the server to a ref, installs Composer and Yarn dependencies, runs the migrations and clears the
cache.

For a Docker host use [`docker-deploy`](docker-deploy.md) instead.

```yaml
name: Deploy to staging

on:
  push:
    branches: [ develop ]

jobs:
  deploy:
    uses: uniquesca/ci/.github/workflows/deploy.yml@main
    with:
      host: staging.example.com
      username: deploy
      deployment_path: /var/www/app
      ref: develop
    secrets:
      SSH_KEY: ${{ secrets.SSH_KEY }}
      UNIQUES_GITHUB_ACCESS_TOKEN: ${{ secrets.UNIQUES_GITHUB_ACCESS_TOKEN }}
      NODE_AUTH_TOKEN: ${{ secrets.NODE_AUTH_TOKEN }}
```

## Secrets

| Secret | Required | Description |
|---|---|---|
| `SSH_KEY` | yes | SSH private key used to connect to the host |
| `UNIQUES_GITHUB_ACCESS_TOKEN` | yes | Access token for cloning Uniques private repositories |
| `NODE_AUTH_TOKEN` | no | Access token for authentication with the NPM registry |

## Inputs

| Input | Type | Default | Description |
|---|---|---|---|
| `host` | string | | **Required.** Address of the server |
| `username` | string | | **Required.** SSH login |
| `deployment_path` | string | | **Required.** Directory the project lives in on the server |
| `ref` | string | | **Required.** Branch, tag or pull request ref to deploy |
| `port` | string | `22` | SSH port |
| `node_version` | string | `24` | Node version to use on the server |
| `pre_cmd` | string | `''` | Command to run on the server after the code is updated, before anything else |
| `db_migration_cmd` | string | `''` | Migration command to run after the dependencies are installed |
| `clean_cache_cmd` | string | `''` | Cache-clearing command |
| `post_cmd` | string | `''` | Command to run once the deployment is complete |
| `timeout` | string | `5m` | Timeout for the connection and for the script |

## Outputs

None.

## Dig deeper

### What it needs on the server

**The repository has to be cloned there already**, and the SSH user has to be able to write to it -
this workflow updates a checkout, it does not create one. It also expects whatever the application
needs to run: PHP with the right extensions, and a MySQL the migrations can reach.

`composer.phar` is downloaded into `deployment_path` if it is not there, and `nvm` is installed if
the user does not have it, so neither has to be provisioned by hand.

### How the ref is applied

| `ref` | What happens on the server |
|---|---|
| `refs/pull/123/merge` | Hard reset, then the pull request head is fetched and checked out detached |
| A branch that exists on `origin` | `git reset --hard origin/<ref>` |
| Anything else - a tag, a sha | `git reset --hard <ref>` |

**This is a hard reset every time.** Local changes on the server are discarded, along with untracked
files (`git clean -fd` runs first). That is deliberate - a deployment that fails because somebody
edited a file on the server is worse than one that overwrites the edit - but it means the server is
not a place to keep anything that is not either in git or ignored.

### What it installs

* Composer, when there is a `composer.json`: `composer install --no-dev`, authenticated with
  `UNIQUES_GITHUB_ACCESS_TOKEN`. Any `auth.json` is removed before and after.
* Yarn, when there is a `package.json`, under `node_version` via `nvm`. An `.npmrc` pointing
  `@uniquesca` at `npm.pkg.github.com` is written for the install and **deleted afterwards**, so the
  token does not stay on disk. A `401 Unauthorized` failure is retried once with `yarn.lock` removed
  and the caches cleaned, which works around Yarn intermittently failing to authenticate for a
  pinned package.

Note that Yarn is used for `package.json` regardless of whether the repository uses Yarn or NPM -
unlike [`install-packages`](../actions/install-packages.md) on a runner, which picks by `.yarnrc`.

### Migrations

Phinx runs by itself when the server has both `vendor/bin/phinx` and `phinx.php`. `db_migration_cmd`
runs after that, for a repository whose migrations are something else - or for one whose Phinx
configuration is not called `phinx.php`.

### How a failure is detected

The remote script runs under `set -euxo pipefail` with an `ERR` trap, so the first command that
fails stops the deployment and names itself:

```
❌ Deployment failed at line 138: ./vendor/bin/phinx migrate -c phinx.php (exit 1)
```

**`pipefail` is why a pipeline no longer hides a failure.** Without it only the last command of a
pipeline can fail the script, so `curl -o- https://...nvm/install.sh | bash` reported success on a
download that never happened, and `git ls-remote ... | wc -l` returning `0` because git errored read
as "the branch does not exist".

The deployment is then called successful on two conditions, not one: the SSH step did not fail,
**and** the script recorded that it reached its last line. It writes that verdict to
`/tmp/ci-deployment-<run id>-<attempt>.status` on the server, and a second SSH step reads the file,
removes it, and fails if it says anything other than `complete` or is not there at all. A verdict
that rests only on an exit code rests on that code surviving the remote shell, the SSH session and
the action, and on the session living long enough to return one; the file does not.

Two things this cannot catch:

* **A command that fails and exits 0**, because there is nothing left to detect it with. A
  `phinx.php` that cannot reach the database prints `Connect Error: SQLSTATE[HY000] ...` and calls
  `die($message)` - and `die()` with a string exits **0**, as does a bare `exit;`. Phinx is then a
  command that succeeded, and the run is green with no migrations applied. Fix that in the
  application: `exit(1)`.
* **The Yarn install**, deliberately. It runs as `yarn install 2>&1 || true` so that its output can
  be searched for the `401 Unauthorized` retry, which means any other Yarn failure is discarded.

### Timeouts, and partial deployments

`timeout` bounds the connection and the whole remote script. A script that runs past it is cut off
mid-deployment, so a slow `composer install` on a large repository is worth raising it for. A
deployment that stops part way leaves the server updated but not fully installed. Re-running is the
fix; every step is written to be repeatable.
