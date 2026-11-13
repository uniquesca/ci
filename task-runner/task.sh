#!/usr/bin/env bash
# Downloads the shared task runner and runs it. Commands live in tasks.sh next to this file.
# See https://github.com/uniquesca/ci/blob/develop/docs/task-runner.md

# The release sets this to its own version in the copy it attaches. develop means unreleased.
TASK_RUNNER_VERSION=develop

project_path="$(cd -- "$(dirname "$0")" > /dev/null 2>&1 && pwd -P)"
runner="${TASK_RUNNER_PATH:-$project_path/.task-runner/$TASK_RUNNER_VERSION/task-runner.sh}"

if [[ ! -f "$runner" ]]; then
  mkdir -p "$(dirname "$runner")"
  if ! curl -fsSL -o "$runner.tmp" \
    "https://raw.githubusercontent.com/uniquesca/ci/$TASK_RUNNER_VERSION/task-runner/task-runner.sh"; then
    rm -f "$runner.tmp"
    echo " ❌  Could not download task runner $TASK_RUNNER_VERSION" >&2
    exit 1
  fi
  mv "$runner.tmp" "$runner"
fi

# shellcheck disable=SC1090
source "$runner"
