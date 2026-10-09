#!/bin/bash
# supervisord event listener: when a program gives up restarting, stop the container so its
# restart policy starts a clean one. A process killed outright can leave children holding its
# port, and then no restart inside the container can succeed.
# Bash, not Python: the PHP 5.6 image's supervisor runs on Python 2.

while true; do
    echo "READY"
    read -r header || exit 0
    length=$(echo "$header" | sed -E 's/.*len:([0-9]+).*/\1/')
    read -r -n "$length" payload || exit 0
    echo "Program gave up restarting, stopping the container: $payload" >&2
    printf 'RESULT 2\nOK'
    kill -TERM 1
done
