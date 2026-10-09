#!/bin/bash

if [ ! -f /etc/crontab ]; then
    echo "No crontab found at /etc/crontab. Skipping Supercronic."
    exit 0
fi

exec /usr/local/bin/supercronic /etc/crontab
