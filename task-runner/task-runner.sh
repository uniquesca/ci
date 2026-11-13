#!/usr/bin/env bash
# Variables and functions here are used by tasks.sh and by dispatch, which shellcheck cannot see.
# shellcheck disable=SC2034,SC2329
# Shared engine behind every project's task.sh. Do not copy it into a project: the project's
# task.sh downloads a pinned version, and the project's own commands go in its tasks.sh.
# See docs/task-runner.md.

if [[ -z "$project_path" ]]; then
  echo " ❌  project_path is not set. Run this through the project's task.sh." >&2
  exit 1
fi

# Everything from here on is exported, so .env values and the settings below reach docker compose
# and the commands it runs.
set -a

if [[ -f "$project_path/.env" ]]; then
  # shellcheck disable=SC1091
  source "$project_path/.env"
fi

compose_project="${COMPOSE_PROJECT_NAME:-}"
app_service="${SERVICE_NAME_APP:-app}"
app_env="${APP_ENV:-dev}"
compose_profile="${COMPOSE_PROFILE:-dev}"
xdebug_mode="${XDEBUG_MODE:-}"
behind_proxy="${BEHIND_PROXY:-1}"

remaining_args=()
while [[ $# -gt 0 ]]; do
  case $1 in
    --profile)
      compose_profile="$2"
      shift 2
      ;;
    -e|--env)
      app_env="$2"
      shift 2
      ;;
    *)
      remaining_args+=("$1")
      shift
      ;;
  esac
done
set -- "${remaining_args[@]}"

# Docker Desktop on macOS maps file ownership itself and expects the default user.
if [[ "$OSTYPE" == darwin* ]]; then
  uid=1000
  gid=1000
else
  uid=$(id -u)
  gid=$(id -g)
fi

### Commands every project gets. A project overrides one by defining the same function in tasks.sh.

task_build()   { compose build "$@"; }
task_pull()    { compose pull "$@"; }
task_up()      { compose up "$@"; }
task_down()    { compose down "$@"; }
task_restart() { compose restart "$@"; }
task_logs()    { compose logs "$@"; }
task_connect() { app bash; }
task_exec()    { app "$@"; }
task_bash()    { app bash -c "$*"; }

# Tool commands exist only when the project has the tool's config, so `supports` stays truthful:
# CI uses it to decide which checks to run.
has() {
  local file
  for file in "$@"; do
    [[ -f "$project_path/$file" ]] && return 0
  done
  return 1
}

if has composer.json; then
  if has composer.phar; then
    task_composer() { app php composer.phar "$@"; }
  else
    task_composer() { app composer "$@"; }
  fi
fi
if has phpcs.xml phpcs.xml.dist .phpcs.xml .phpcs.xml.dist; then
  task_cs_check() { app ./vendor/bin/phpcs "$@"; }
  task_cs_fix()   { app ./vendor/bin/phpcbf "$@"; }
fi
if has psalm.xml psalm.xml.dist; then
  task_psalm() { app ./vendor/bin/psalm "$@"; }
fi
if has phpunit.xml phpunit.xml.dist; then
  task_test() { app ./vendor/bin/phpunit "$@"; }
fi
if has phinx.php phinx.yml phinx.yaml phinx.json; then
  task_phinx()   { app ./vendor/bin/phinx "$@"; }
  task_migrate() { app ./vendor/bin/phinx migrate "$@"; }
fi
if has yarn.lock; then
  task_yarn() { app yarn "$@"; }
elif has package-lock.json; then
  task_npm() { app npm "$@"; }
fi

# shellcheck disable=SC1091
source "$project_path/tasks.sh"

if [[ "$behind_proxy" == 1 ]]; then
  vhost_filename="vhost.conf"
else
  vhost_filename="vhost_ssl.conf"
fi

compose_files="$project_path/compose.yaml"
for extra in compose.override.yaml "compose.$compose_profile.yaml"; do
  if [[ -f "$project_path/$extra" ]]; then
    compose_files="$compose_files:$project_path/$extra"
  fi
done

### Helpers for tasks.sh

# docker compose with the project's files, project name and profile
compose() {
  env UID="$uid" GID="$gid" \
    COMPOSE_FILE="$compose_files" \
    COMPOSE_PROJECT_NAME="$compose_project" \
    VHOST_FILENAME="$vhost_filename" \
    XDEBUG_MODE="$xdebug_mode" \
    docker compose --profile "$compose_profile" "$@"
}

# Runs a command in the app container as the current user
app() {
  compose exec --tty -u "$uid:$gid" "$app_service" "$@"
}

# Same as app, with no TTY - for piping input in, like a SQL script
app_no_tty() {
  compose exec -T -u "$uid:$gid" "$app_service" "$@"
}

### Dispatch

mapfile -t commands < <(declare -F | awk '{print $3}' | sed -n 's/^task_//p' | tr '_' '-' | sort)

is_supported() {
  [[ -n "$1" ]] && declare -F "task_${1//-/_}" > /dev/null
}

if [[ -z "$1" ]]; then
  echo " ❌  No command provided. Supported commands: ${commands[*]}"
  exit 1
fi

if [[ "$1" == "supports" ]]; then
  if [[ -z "$2" ]]; then
    echo " ❌  No command specified to check."
    exit 1
  fi
  if is_supported "$2"; then
    echo " ✅  Command '$2' is supported."
    exit 0
  fi
  echo " ❌  Command '$2' is NOT supported."
  exit 1
fi

if ! is_supported "$1"; then
  echo " ❌  Command '$1' is not supported."
  echo " ✅  Supported commands are: ${commands[*]}"
  exit 1
fi

echo " ⏩  Running command: $1"
command_function="task_${1//-/_}"
shift
"$command_function" "$@"
exit $?
