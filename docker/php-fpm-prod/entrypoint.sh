#!/bin/bash
set -e

# The default command runs php-fpm, cron and anything in /etc/supervisor/conf.d/ under supervisord.
# Any other command (composer, a one-off script) runs on its own, as before.
if [ "$1" = "php-fpm" ] && [ "$#" -eq 1 ]; then
    exec supervisord -c /etc/supervisor/supervisord.conf
fi

# Check if crontab file exists before starting Supercronic
if [ -f /etc/crontab ]; then
    echo "Starting Supercronic with /etc/crontab..."
    /usr/local/bin/supercronic /etc/crontab &
else
    echo "No crontab found at /etc/crontab. Skipping Supercronic."
fi

# Continue with original entrypoint
exec docker-php-entrypoint "$@"
