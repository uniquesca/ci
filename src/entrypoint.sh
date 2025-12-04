#!/bin/bash
set -e

# Check if crontab file exists before starting Supercronic
if [ -f /etc/crontab ]; then
    echo "Starting Supercronic with /etc/crontab..."
    /usr/local/bin/supercronic /etc/crontab &
else
    echo "No crontab found at /etc/crontab. Skipping Supercronic."
fi

# Setting up an IP address pointing application's URL to the
# Apache web-server
# Expect WEB_SERVER_HOSTNAME and APP_URL to be set in docker-compose.yaml
WEB_SERVER_HOSTNAME="${WEB_SERVER_HOSTNAME:-apache}"
APP_URL="${APP_URL:-https://officio.dev-unqs.ca}"

# Resolve the hostname to an IP using Docker DNS
APACHE_IP=$(getent hosts "$WEB_SERVER_HOSTNAME" | awk '{ print $1 }')

if [ -n "$APACHE_IP" ]; then
  APP_HOST=$(echo "$APP_URL" | sed -E 's~https?://~~' | cut -d/ -f1)
  echo "$APACHE_IP $APP_HOST" >> /etc/hosts
  echo "Mapped $APP_HOST → $APACHE_IP"
else
  echo "Could not resolve $WEB_SERVER_HOSTNAME"
fi


# Continue with original entrypoint
exec docker-php-entrypoint "$@"
