#!/bin/bash
set -e

# Runs Apache, php-fpm, cron and anything in /etc/supervisor/conf.d/ under supervisord.
exec supervisord -c /etc/supervisor/supervisord.conf
