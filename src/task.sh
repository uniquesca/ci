#!/usr/bin/env bash

### BOOTSTRAP CODE #################################################################
# There is usually no need to modify this                                          #
####################################################################################
script_path="$( cd -- "$(dirname "$0")" >/dev/null 2>&1 ; pwd -P )"
infrastructure_path="$script_path"

# require default env file
env_file="$infrastructure_path/.env"
if test -f "$env_file"; then
  source $env_file
fi

### INTEGRATION CONFIGURATION ######################################################
# Things that HAVE to be configured when integration task.sh with your application #
####################################################################################
# Example: compose_project="${COMPOSE_PROJECT_NAME:-officio}"
compose_project="${COMPOSE_PROJECT_NAME:-}"

### OPTIONAL CONFIGURATION #########################################################
# Things that MIGHT need to be configured during the integration                   #
####################################################################################

# This is a name of app service which will be used for executing commands through
app_service="${SERVICE_NAME_APP:-app}"


### CONFIGURATION ##################################################################
# These values shouldn't be set here, but rather in .env file and they can vary    #
# from instance to instance, like launching multiple projects with a different     #
# compose profile for example.                                                     #
####################################################################################

app_env="${APP_ENV:-dev}"
compose_profile="${COMPOSE_PROFILE:-dev}"
xdebug_mode="${XDEBUG_MODE:-}"
behind_proxy="${BEHIND_PROXY:-1}"

### CODE ###########################################################################
# Below is the code that you shouldn't really change, it goes until the COMMANDS   #
# section. Make sure to scroll down and adjust your commands  depending on what    #
# is available in your application                                                 #
####################################################################################

if [ "$behind_proxy" == 1 ]; then
  vhost_filename="vhost.conf"
else
  vhost_filename="vhost_ssl.conf"
fi

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
set -a

# Set compose files
compose_files="$infrastructure_path/compose.yaml"
if test -f "$infrastructure_path/compose.override.yaml"; then
  compose_files="$compose_files:$infrastructure_path/compose.override.yaml"
fi
if test -f "$infrastructure_path/compose.$compose_profile.yaml"; then
    compose_files="$compose_files:$infrastructure_path/compose.$compose_profile.yaml"
fi

# binary shortcuts
docker_compose="\
  COMPOSE_FILE=$compose_files \
  COMPOSE_PROJECT_NAME=$compose_project \
  VHOST_FILENAME=$vhost_filename \
  XDEBUG_MODE=$xdebug_mode \
  docker compose --profile $compose_profile \
"
app="$docker_compose exec --tty -u $(id -u):$(id -g) $app_service"

### COMMANDS #######################################################################
# Below are commands that this task.sh file provides. Make sure to adjust them to  #
# whatever your application supports.                                              #
####################################################################################

commands=("build" "up" "down" "restart" "logs" "connect" "exec" "bash" "composer" \
  "officio" "yarn" "phinx" "migrate" "cs-check" "cs-fix" "psalm" "test" "clear-cache")


# Function to check if a value is in the commands list
is_supported() {
  local cmd="$1"
  for c in "${commands[@]}"; do
    if [[ "$c" == "$cmd" ]]; then
      return 0
    fi
  done
  return 1
}

# Check if $1 is provided
if [[ -z "$1" ]]; then
  echo " ❌  No command provided. Supported commands: ${commands[*]}"
  exit 1
fi

# This provides an ability to check if a command is supported or not
if [ "$1" == "supports" ]; then
  if [[ -z "$2" ]]; then
    echo " ❌  No command specified to check."
    exit 1
  fi
  if is_supported "$2"; then
    echo " ✅  Command '$2' is supported."
    exit 0
  else
    echo " ❌  Command '$2' is NOT supported."
    exit 1
  fi
fi

# Check if $1 is in the list
if ! is_supported "$1"; then
  echo " ❌  Command '$1' is not supported."
  echo " ✅  Supported commands are: ${commands[*]}"
  exit 1
fi

# If valid, proceed
echo " ⏩  Running command: $1"

# docker compose build
if [ "$1" == "build" ]; then
  shift
  exec env UID=$(id -u) GID=$(id -g) bash -c "$docker_compose build $*"
fi

# docker compose up
if [ "$1" == "up" ]; then
  shift
  exec env UID=$(id -u) GID=$(id -g) bash -c "$docker_compose up $*"
fi

# docker compose down
if [ "$1" == "down" ]; then
  shift
  exec env UID=$(id -u) GID=$(id -g) bash -c "$docker_compose down $*"
fi

# docker compose restart
if [ "$1" == "restart" ]; then
  shift
  exec env UID=$(id -u) GID=$(id -g) bash -c "$docker_compose restart $*"
fi

# docker compose logs
if [ "$1" == "logs" ]; then
  shift
  exec env UID=$(id -u) GID=$(id -g) bash -c "$docker_compose logs $*"
fi

# Enter the app container
if [ "$1" == "connect" ]; then
  exec env UID=$(id -u) GID=$(id -g) bash -c "$app bash"
fi

# Exec a command in the app container
if [ "$1" == "exec" ]; then
  shift
  exec env UID=$(id -u) GID=$(id -g) bash -c "$app ${*@Q}"
fi

# Exec a command through bash in the app container
if [ "$1" == "bash" ]; then
  shift
  exec env UID=$(id -u) GID=$(id -g) bash -c "$app bash -c '${*@Q}'"
fi

# Execute composer commands in the app container
if [ "$1" == "composer" ]; then
  shift
  exec env UID=$(id -u) GID=$(id -g) bash -c "$app php composer.phar $*"
fi

# Execute composer commands in the app container
if [ "$1" == "yarn" ]; then
  shift
  exec env UID=$(id -u) GID=$(id -g) bash -c "$app bash -c '. \$NVM_DIR/nvm.sh && nvm use default && yarn $*'"
fi

# Phinx for DB migrations
if [ "$1" == "phinx" ]; then
  shift
  exec env UID=$(id -u) GID=$(id -g) bash -c "$app ./vendor/bin/phinx $*"
fi

# Shortcut for phinx migrate
if [ "$1" == "migrate" ]; then
  shift
  exec env UID=$(id -u) GID=$(id -g) bash -c "$app ./vendor/bin/phinx migrate $*"
fi

# Static analyser PHPCodesniffer
if [ "$1" == "cs-check" ]; then
  exec env UID=$(id -u) GID=$(id -g) bash -c "$app ./vendor/bin/phpcs"
fi

# Static analyser PHPCodesniffer - fix
if [ "$1" == "cs-fix" ]; then
  exec env UID=$(id -u) GID=$(id -g) bash -c "$app ./vendor/bin/phpcbf"
fi

# Static analyser Psalm
if [ "$1" == "psalm" ]; then
  shift
  exec env UID=$(id -u) GID=$(id -g) bash -c "$app ./vendor/bin/psalm $*"
fi

# Tests
if [ "$1" == "test" ]; then
  shift
  exec env UID=$(id -u) GID=$(id -g) bash -c "$app ./vendor/bin/phpunit $*"
fi

# Cache clear
if [ "$1" == "clear-cache" ]; then
    exec bash -c ":"
fi

echo "No command found with given name: $1"
exit 1