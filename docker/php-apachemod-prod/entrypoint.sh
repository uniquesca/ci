#!/bin/bash
set -e

# Check if crontab file exists before starting Supercronic
if [ -f /etc/crontab ]; then
    echo "Starting Supercronic with /etc/crontab..."
    /usr/local/bin/supercronic /etc/crontab &
else
    echo "No crontab found at /etc/crontab. Skipping Supercronic."
fi

# Continue with original entrypoint
exec docker-php-entrypoint "$@"
