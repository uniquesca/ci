#!/bin/sh
# Fails the build on a base image older than the release that fixes the latest critical hole in
# its PHP branch, so a stale base is never published under a tag people trust to be patched.
# A branch missing here has no fixed release: it builds, with a warning.

set -eu

version="$(php -r 'echo PHP_VERSION;')"

# PHP2Shell, CVE-2026-109618 and CVE-2026-109619
case "$version" in
    8.2.*) minimum='8.2.35' ;;
    8.3.*) minimum='8.3.36' ;;
    8.4.*) minimum='8.4.27' ;;
    8.5.*) minimum='8.5.12' ;;
    *)
        echo "WARNING: PHP $version has no release with the latest security fixes" >&2
        exit 0
        ;;
esac

if php -r "exit(version_compare(PHP_VERSION, '$minimum', '<') ? 0 : 1);"; then
    echo "PHP $version is older than $minimum, the oldest release this image may be built on" >&2
    exit 1
fi
