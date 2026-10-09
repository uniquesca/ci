#!/usr/bin/env python3
# supervisord event listener: when a program gives up restarting, stop the container so its
# restart policy starts a clean one. A process killed outright can leave children holding its
# port, and then no restart inside the container can succeed.
import os
import signal
import sys

from supervisor import childutils

while True:
    headers, payload = childutils.listener.wait(sys.stdin, sys.stdout)
    sys.stderr.write('Program gave up restarting, stopping the container: %s\n' % payload)
    sys.stderr.flush()
    childutils.listener.ok(sys.stdout)
    os.kill(1, signal.SIGTERM)
