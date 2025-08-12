#!/bin/bash
set -e

# Start Supercronic with your mapped crontab
/usr/local/bin/supercronic /etc/crontab

# Continue with original entrypoint
exec docker-php-entrypoint "$@"
