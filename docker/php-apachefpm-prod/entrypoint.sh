#!/bin/bash
set -e

# Check if crontab file exists before starting Supercronic
if [ -f /etc/crontab ]; then
    echo "Starting Supercronic with /etc/crontab..."
    /usr/local/bin/supercronic /etc/crontab &
else
    echo "No crontab found at /etc/crontab. Skipping Supercronic."
fi

# Start PHP-FPM in background
php-fpm -D

# Start Apache in foreground
apache2ctl -D FOREGROUND
