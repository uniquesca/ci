# shellcheck shell=bash disable=SC2034
# Commands for this project. Sourced by the task runner - see docs/task-runner.md in uniquesca/ci.

compose_project="${COMPOSE_PROJECT_NAME:-my-project}"

task_clear_cache() { app ./scripts/cache.sh; }
