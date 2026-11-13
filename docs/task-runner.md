# Task runner

`task.sh` is the one command for working with a project's Docker stack: `./task.sh up -d`,
`./task.sh migrate`, `./task.sh psalm`. CI calls it too (`docker-spin-up`, `docker-qa-checks`).

It has two parts:

- **The engine**, [`task-runner/task-runner.sh`](../task-runner/task-runner.sh), lives here. It loads
  `.env`, works out the compose files and profile, provides helpers and the common commands, and
  runs the command you asked for.
- **The project's commands**, in `tasks.sh` at the project root.

The project's `task.sh` is a small stub. It downloads a pinned version of the engine on first run,
caches it in `.task-runner/`, and hands over to it.

## Install

Run this from the project root, with the release tag you want in the link:

```bash
curl -fsSL -o task.sh https://github.com/uniquesca/ci/releases/download/11.49.0/task.sh && chmod +x task.sh
echo '.task-runner/' >> .gitignore
```

That `task.sh` is pinned to the version in the link. Then create `tasks.sh` next to it (see below;
[`task-runner/tasks.sh`](../task-runner/tasks.sh) is an example) and commit all three files.

The project needs a `compose.yaml` at its root. The engine also picks up `compose.override.yaml` and
`compose.<profile>.yaml` when they exist.

To upgrade, run the `curl` line again with the new version. The engine for it is downloaded on the
next run, and other developers get it when they pull.

## Settings

Put these in `.env`. Each one can be overridden by the shell environment.

| Variable | Default | |
|---|---|---|
| `COMPOSE_PROJECT_NAME` | none | Set a default in `tasks.sh` |
| `SERVICE_NAME_APP` | `app` | The service `app` runs commands in |
| `COMPOSE_PROFILE` | `dev` | Also `--profile <name>` on the command line |
| `APP_ENV` | `dev` | Also `-e <env>` / `--env <env>` |
| `XDEBUG_MODE` | empty | Passed to compose |
| `BEHIND_PROXY` | `1` | `1` uses `vhost.conf`, anything else `vhost_ssl.conf` |

Everything in `.env` is exported, so compose files and commands can read it.

## Commands

Every project gets `build`, `pull`, `up`, `down`, `restart`, `logs` (the compose commands of the
same name), `connect` (shell in the app container), `exec <command>` and `bash '<script>'` (run a
command or a bash script in it).

These are added when the project has the file that shows it uses the tool:

| File in the project root | Commands |
|---|---|
| `composer.json` | `composer` (runs `composer.phar` if the project has one) |
| `phpcs.xml`, `phpcs.xml.dist` | `cs-check`, `cs-fix` |
| `psalm.xml`, `psalm.xml.dist` | `psalm` |
| `phpunit.xml`, `phpunit.xml.dist` | `test` |
| `phinx.php`, `phinx.yml`, `phinx.yaml`, `phinx.json` | `phinx`, `migrate` |
| `yarn.lock` | `yarn` |
| `package-lock.json` | `npm` |

They are only there when the file is, because CI asks `./task.sh supports <command>` to decide what
to run.

## Adding a command

A command is a bash function in `tasks.sh` named `task_<name>`. Underscores in the function name
become dashes in the command, so `task_cs_fix` is `./task.sh cs-fix`.

```bash
compose_project="${COMPOSE_PROJECT_NAME:-officio}"

task_clear_cache() { app ./scripts/cache.sh; }

task_yarn() {
  app bash -c '. "$NVM_DIR/nvm.sh" && nvm use default && yarn "$@"' yarn "$@"
}

task_mysql() {
  compose exec -T mysql mysql -u"${MYSQL_USER:-officio}" -p"${MYSQL_PASSWORD:-officio}" "${MYSQL_DATABASE:-officio}" "$@"
}
```

Arguments after the command name arrive as `"$@"`. The function's exit code is the exit code of
`task.sh`. `./task.sh supports <name>` and the list of commands pick the new one up by themselves.

Helpers you can call:

- `compose <args>` - `docker compose` with the project's files, project name and profile.
- `app <command>` - runs a command in the app container as the current user.
- `app_no_tty <command>` - the same without a TTY, for piping input in.

Variables you can read: `project_path`, `app_env`, `compose_profile`, `app_service`, `uid`, `gid`.

To change a default command, define the same function in `tasks.sh`; yours wins. To remove one,
`unset -f task_psalm`.

## Working on the engine

The `task.sh` in this repository says `TASK_RUNNER_VERSION=develop` and runs the engine from the
`develop` branch. The release replaces that with its own version in the copy it attaches.

Point `TASK_RUNNER_PATH` at your local copy to run a project against it without releasing:

```bash
TASK_RUNNER_PATH=~/projects/ci/task-runner/task-runner.sh ./task.sh up -d
```
