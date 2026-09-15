#!/usr/bin/env bash

# Adds up what the AI workflows spent, from the hidden `<!-- ai-cost {...} -->` line every agent
# run leaves on the issue or pull request it worked on.
#
#   bin/ai-cost-report.sh                          # this month so far, every repository with the harness
#   bin/ai-cost-report.sh --last-month             # what the monthly report sends
#   bin/ai-cost-report.sh --month 2026-08          # one calendar month
#   bin/ai-cost-report.sh --from 2026-08-15 --to 2026-09-02 officio bcpnp-frontend
#   bin/ai-cost-report.sh --out /tmp/costs         # where the three files go
#
# Named repositories are taken as given. With none, the repositories are the ones Github code
# search finds calling the AI workflows - which only sees default branches and can lag a few
# minutes behind a repository that integrated the harness today, so name them to be sure.
#
# `--to` is exclusive: a run at midnight on the `--to` date belongs to the next report, never to
# two. Runs are counted once per workflow run even where the same line was posted twice.
#
# Needs `gh` authenticated against the organisation, and GNU `date` for the month arithmetic.
# Runs from anywhere: it works out of the repository root, which is also where it reads
# `bin/md-to-html.awk` from.

set -euo pipefail

org='uniquesca'
out_dir='ai-cost-report'
from=''
to=''
repos=()

today=$(date -u +%Y-%m-%d)

while [[ $# -gt 0 ]]; do
    case "$1" in
        --from) from="${2:-}"; shift 2 ;;
        --to) to="${2:-}"; shift 2 ;;
        --month)
            month="${2:-}"
            [[ "$month" =~ ^[0-9]{4}-[0-9]{2}$ ]] || { echo "A month looks like 2026-08 - got '$month'" >&2; exit 1; }
            from="$month-01"
            to=$(date -u -d "$from +1 month" +%Y-%m-%d)
            shift 2
            ;;
        --last-month)
            to=$(date -u -d "$(date -u +%Y-%m-01)" +%Y-%m-%d)
            from=$(date -u -d "$to -1 month" +%Y-%m-%d)
            shift
            ;;
        --org) org="${2:-}"; shift 2 ;;
        --out) out_dir="${2:-}"; shift 2 ;;
        -*) echo "Unknown option '$1' - read the header of this script for what it takes" >&2; exit 1 ;;
        *) repos+=("$1"); shift ;;
    esac
done

# This month so far, for somebody who just wants to know where the spend is
[[ -n "$from" ]] || from="${today%-*}-01"
[[ -n "$to" ]] || to=$(date -u -d "$today +1 day" +%Y-%m-%d)

for date in "$from" "$to"; do
    [[ "$date" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] || { echo "A date looks like 2026-08-15 - got '$date'" >&2; exit 1; }
done
[[ "$from" < "$to" ]] || { echo "The window is empty: --from $from is not before --to $to" >&2; exit 1; }

since="${from}T00:00:00Z"
until="${to}T00:00:00Z"

command -v gh > /dev/null || { echo 'This needs the gh CLI, authenticated against the organisation' >&2; exit 1; }

# Code search rather than a list kept by hand, so a repository that integrates the harness is in
# the next report without anybody remembering to add it
if [[ ${#repos[@]} -eq 0 ]]; then
    echo "Looking for repositories calling the AI workflows in $org..." >&2
    mapfile -t repos < <(
        for workflow in ai-plan.yml ai-implement.yml ai-review.yml; do
            gh api -X GET search/code \
                -f q="org:$org $workflow in:file path:.github/workflows" \
                -f per_page=100 --jq '.items[].repository.full_name' 2> /dev/null || true
        done | sort -u
    )
    [[ ${#repos[@]} -gt 0 ]] || { echo "Code search found no repository in $org calling the AI workflows - name them instead" >&2; exit 1; }
fi

mkdir -p "$out_dir"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

: > "$work/runs.jsonl"
: > "$work/issues.tsv"
: > "$work/unreadable.txt"

for repo in "${repos[@]}"; do
    [[ "$repo" == */* ]] || repo="$org/$repo"
    echo "Reading $repo..." >&2

    # Only what was touched in the window. An agent run comments on what it worked on, so an
    # issue with spend in the window is always an issue updated in it.
    #
    # A repository the token cannot read is named in the report rather than skipped quietly: a
    # total that is missing a repository looks exactly like a month nobody spent anything in.
    if ! gh api --paginate "repos/$repo/issues?state=all&since=$since&per_page=100" \
        --jq '.[] | [.number, (if .pull_request then "pr" else "issue" end), .created_at, (.title | gsub("[\r\n\t]"; " "))] | @tsv' \
        > "$work/touched.tsv" 2> "$work/error.log"; then
        echo "Could not read $repo: $(tr '\n' ' ' < "$work/error.log" | cut -c1-200)" >&2
        printf '%s\n' "$repo" >> "$work/unreadable.txt"
        continue
    fi

    while IFS=$'\t' read -r number type created title; do
        [[ -n "$number" ]] || continue
        printf '%s\t%s\t%s\t%s\n' "$repo" "$number" "$created" "$title" >> "$work/issues.tsv"

        # Comments carry the line for a plan, a round, an implementation and a review Github
        # would not take; a submitted review carries it in the review body itself
        gh api --paginate "repos/$repo/issues/$number/comments?since=$since&per_page=100" \
            --jq '.[].body' 2> /dev/null || true

        if [[ "$type" == 'pr' ]]; then
            gh api --paginate "repos/$repo/pulls/$number/reviews?per_page=100" \
                --jq '.[].body' 2> /dev/null || true
        fi
    done < "$work/touched.tsv" \
        | grep -oE '<!-- ai-cost \{.*\} -->' \
        | sed -e 's/^<!-- ai-cost //' -e 's/ -->$//' \
        >> "$work/runs.jsonl" || true
done

# One row per workflow run, inside the window. The same line reaches Github twice on one path -
# a review that could not be submitted is posted as a comment as well - and the plan is copied
# into the pull request body, so the run is what identifies a row rather than where it was read.
jq -s --arg since "$since" --arg until "$until" '
    map(select(.at >= $since and .at < $until))
    | unique_by([.run_id, .run_attempt])
    | sort_by(.at)' "$work/runs.jsonl" > "$work/runs.json"

runs=$(jq 'length' "$work/runs.json")
total=$(jq '[.[].cost_usd // 0] | add // 0' "$work/runs.json")

# Titles for issues the window did not touch - a round on a pull request can be the only spend
# on an issue that was opened months ago
sort -u -k1,2 "$work/issues.tsv" > "$work/issues-unique.tsv"
while IFS=$'\t' read -r repo issue; do
    if awk -F'\t' -v r="$repo" -v i="$issue" '$1 == r && $2 == i { found = 1; exit } END { exit !found }' \
        "$work/issues-unique.tsv"; then
        continue
    fi
    gh api "repos/$repo/issues/$issue" \
        --jq "[\"$repo\", \"$issue\", .created_at, (.title | gsub(\"[\r\n\t]\"; \" \"))] | @tsv" \
        2> /dev/null >> "$work/issues-unique.tsv" || true
done < <(jq -r '.[] | select(.issue) | [.repo, .issue] | @tsv' "$work/runs.json" | sort -u)

jq -R 'split("\t") | {repo: .[0], issue: (.[1] | tonumber), created: .[2], title: .[3]}' \
    "$work/issues-unique.tsv" | jq -s '.' > "$work/titles.json"

# Every run, for when a number looks wrong and somebody has to see which run made it
{
    printf 'repo,issue,pull request,kind,round,at (UTC),cost usd,turns,minutes,input tokens,output tokens,cache read tokens,cache write tokens,model,completed,actor,run url\n'
    jq -r '.[] | [
        .repo, (.issue // ""), (.pull_request // ""), (.kind // ""), (.round // ""),
        (.at // "" | sub("T"; " ") | sub("Z"; "")),
        (.cost_usd // 0 | . * 100 | round / 100),
        (.turns // ""), ((.duration_ms // 0) / 60000 | . * 10 | round / 10),
        (.input_tokens // ""), (.output_tokens // ""),
        (.cache_read_tokens // ""), (.cache_write_tokens // ""),
        (.model // ""), (.completed // ""), (.actor // ""),
        (if .run_id then "https://github.com/\(.repo)/actions/runs/\(.run_id)" else "" end)
    ] | @csv' "$work/runs.json"
} > "$out_dir/ai-costs-runs.csv"

# One row per issue: a plan, the rounds that built it and the reviews of those rounds are all
# spend on the one piece of work, which is the level somebody asks about it at
jq --slurpfile titles "$work/titles.json" '
    def money: . * 100 | round / 100;
    ($titles[0] | map({key: "\(.repo)#\(.issue)", value: .}) | from_entries) as $t
    | map(select(.issue))
    | group_by([.repo, .issue])
    | map({
        repo: .[0].repo,
        issue: .[0].issue,
        title: ($t["\(.[0].repo)#\(.[0].issue)"].title // ""),
        created: ($t["\(.[0].repo)#\(.[0].issue)"].created // "" | sub("T"; " ") | sub("Z"; "")),
        plan: ([.[] | select(.kind == "plan") | .cost_usd // 0] | add // 0 | money),
        coding: ([.[] | select(.kind == "implement") | .cost_usd // 0] | add // 0 | money),
        review: ([.[] | select(.kind == "review") | .cost_usd // 0] | add // 0 | money),
        total: ([.[] | .cost_usd // 0] | add // 0 | money),
        runs: length
      })
    | sort_by(-.total)' "$work/runs.json" > "$work/rollup.json"

jq -r '(["repo", "issue", "issue created (UTC)", "plan cost", "coding cost", "review cost", "total cost", "runs"]),
       (.[] | ["\(.repo)", "\(.issue): \(.title)", .created, .plan, .coding, .review, .total, .runs])
       | @csv' "$work/rollup.json" > "$out_dir/ai-costs-issues.csv"

# The page somebody actually reads
{
    printf '# AI spend, %s to %s\n\n' "$from" "$(date -u -d "$to -1 day" +%Y-%m-%d)"
    printf '**$%s** over %s agent run(s)' "$(printf '%.2f' "$total")" "$runs"
    issues=$(jq '[.[] | select(.issue) | "\(.repo)#\(.issue)"] | unique | length' "$work/runs.json")
    printf ' on %s issue(s).' "$issues"
    if [[ "$issues" -gt 0 ]]; then
        printf ' That is $%s an issue.' "$(jq -r --argjson t "$total" --argjson i "$issues" -n '($t / $i) | . * 100 | round / 100 | tostring' )"
    fi
    printf '\n\n'

    if [[ "$runs" -eq 0 ]]; then
        printf 'No agent run recorded a cost in this window.\n'
    else
        printf '## By repository\n\n| Repository | Issues | Runs | Spend |\n|---|---|---|---|\n'
        jq -r 'group_by(.repo) | sort_by(- ([.[].cost_usd // 0] | add // 0)) | .[]
               | "| \(.[0].repo) | \([.[] | select(.issue) | .issue] | unique | length) | \(length) | $\(([.[].cost_usd // 0] | add // 0) * 100 | round / 100) |"' \
            "$work/runs.json"

        printf '\n## By what the run was doing\n\n| Kind | Runs | Spend | Per run |\n|---|---|---|---|\n'
        jq -r 'group_by(.kind) | sort_by(- ([.[].cost_usd // 0] | add // 0)) | .[]
               | ([.[].cost_usd // 0] | add // 0) as $s
               | "| \(.[0].kind // "unknown") | \(length) | $\($s * 100 | round / 100) | $\($s / length * 100 | round / 100) |"' \
            "$work/runs.json"

        printf '\n## The most expensive work\n\n| Issue | Spend | Runs |\n|---|---|---|\n'
        jq -r '.[0:10][]
               | "| [\(.repo | sub("^[^/]+/"; ""))#\(.issue)](https://github.com/\(.repo)/issues/\(.issue)) \(.title[0:70]) | $\(.total) | \(.runs) |"' \
            "$work/rollup.json"

        printf '\n## What the money went on\n\n'
        jq -r '([.[].cache_read_tokens // 0] | add // 0) as $cache
               | ([.[].input_tokens // 0] | add // 0) as $in
               | ([.[].output_tokens // 0] | add // 0) as $out
               | ([.[].turns // 0] | add // 0) as $turns
               | ([.[].duration_ms // 0] | add // 0) as $ms
               | "\($turns) turns over \(($ms / 3600000) * 10 | round / 10) hours of agent time. "
                 + "Tokens: \(($in / 1000) | round)K in, \(($out / 1000) | round)K out, "
                 + "\(($cache / 1000000) * 10 | round / 10)M read from cache - cache reads are most of the volume "
                 + "and a fraction of the price."' "$work/runs.json"
        printf '\n'

        printf '\nRuns that did not finish: %s.\n' "$(jq '[.[] | select(.completed == false)] | length' "$work/runs.json")"
    fi

    if [[ -s "$work/unreadable.txt" ]]; then
        printf '\n**This report is incomplete.** These repositories could not be read, so whatever'
        printf ' was spent in them is missing from every figure above: %s.\n' \
            "$(paste -sd', ' "$work/unreadable.txt")"
    fi

    printf '\nThe detail is in `ai-costs-issues.csv` and `ai-costs-runs.csv`. Figures are the'
    printf ' agents own estimates from their token counts, not billed amounts.\n'
} > "$out_dir/ai-costs.md"

# The same summary as an email body. Mail clients render a Markdown table as a wall of pipes.
awk -f bin/md-to-html.awk "$out_dir/ai-costs.md" > "$out_dir/ai-costs.html"

cat "$out_dir/ai-costs.md"
echo "Written to $out_dir/: ai-costs.md, ai-costs.html, ai-costs-issues.csv, ai-costs-runs.csv" >&2
