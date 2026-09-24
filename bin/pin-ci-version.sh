#!/usr/bin/env bash

# Pins every reference between this repository's own actions and workflows to one major version
# branch, so a caller on that branch stays inside its code instead of reaching the tip of main.
#
#   bin/pin-ci-version.sh          # re-pin to the active version - a no-op unless something drifted
#   bin/pin-ci-version.sh v12      # move the whole repository to v12
#   bin/pin-ci-version.sh --check  # fail if anything is off the active version, rewrite nothing
#
# A reference that belongs off the version branch carries `# pin-ci-version: skip` and a comment
# saying why. This leaves it alone and reports it, so a bump still puts it in front of you.

set -euo pipefail

cd "$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"

version_file='.github/workflows/update-current-version.yml'

check_only=false
if [[ "${1:-}" == '--check' ]]; then
    check_only=true
    shift
fi

# `VERSION_BRANCH` is where the active version is declared, so everything here works off it and
# there is no second place to keep in step
current="$(sed -nE 's/^[[:space:]]*VERSION_BRANCH:[[:space:]]*([^[:space:]#]+).*/\1/p' "$version_file")"
target="${1:-$current}"

if [[ ! "$target" =~ ^v[0-9]+$ ]]; then
    echo "The version has to name a branch, so it has to look like v11 - got '$target'" >&2
    exit 1
fi

# `git ls-files` rather than `find`, because node_modules is committed here and holds thousands of
# files this has no business reading. CHANGELOG.md is generated from the git log - never edit it
mapfile -t files < <(
    git ls-files -- '*.yml' '*.yaml' '*.md' ':!:node_modules/**' ':!:CHANGELOG.md'
)

# Anchoring on `uses:` is what makes the rewrite safe: the references that appear in prose - an
# exact-tag illustration, a quoted error message - are left for a human to judge
reference='uses:[[:space:]]*uniquesca/ci/[A-Za-z0-9._/-]+'
skip='pin-ci-version: skip'

report_skipped() {
    local skipped
    skipped="$(grep -nE "$reference@" "${files[@]}" | grep -F "$skip" || true)"

    if [[ -n "$skipped" ]]; then
        echo
        echo "Deliberately off $target:"
        echo "$skipped"
    fi
}

if [[ "$check_only" == true ]]; then
    # The trailing boundary stops `@v11` from counting `@v110` as pinned
    drift="$(
        grep -nE "$reference@" "${files[@]}" \
            | grep -vF "$skip" \
            | grep -vE "$reference@$target([^A-Za-z0-9._/-]|$)" || true
    )"

    if [[ -n "$drift" ]]; then
        echo "These references are not pinned to $target:" >&2
        echo "$drift" >&2
        echo "Run bin/pin-ci-version.sh to pin them, or mark one '# $skip' with a reason." >&2
        exit 1
    fi

    echo "Every reference between this repository's actions and workflows is pinned to $target"
    report_skipped
    exit 0
fi

sed -i -E "/$skip/!s#($reference)@[A-Za-z0-9._/-]+#\1@$target#g" "${files[@]}"
sed -i -E "s#^([[:space:]]*VERSION_BRANCH:[[:space:]]*)[^[:space:]#]+#\1$target#" "$version_file"

echo "Pinned to $target"

report_skipped

# A version in prose is a judgement call rather than a substitution, so these are reported instead
prose="$(grep -nE 'uniquesca/ci/[A-Za-z0-9._/-]+@' "${files[@]}" | grep -vE "$reference@" || true)"

if [[ -n "$prose" ]]; then
    echo
    echo "Left alone - these mention a version in prose, check them by hand:"
    echo "$prose"
fi
