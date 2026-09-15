# Renders the Markdown `ai-cost-report.sh` writes as HTML, for an email body.
#
#   awk -f bin/md-to-html.awk ai-cost-report/ai-costs.md > body.html
#
# It covers what that report uses and nothing else: the two heading levels, tables, bold,
# inline code and links. Anything else arrives as a paragraph of its own text. Styles are
# inline because mail clients drop a stylesheet, and `match`/`substr` do the inline markup
# because `gensub` is GNU awk only.

function escape(s) {
    gsub(/&/, "\\&amp;", s); gsub(/</, "\\&lt;", s); gsub(/>/, "\\&gt;", s)
    return s
}

function wrap(s, pre, post, skip,    out, body) {
    # Replaces every match of the regex in `pattern` with `open` + its inner text + `close`.
    # `skip` is how many characters of the match are markup on each side.
    out = ""
    while (match(s, pattern)) {
        body = substr(s, RSTART + skip, RLENGTH - 2 * skip)
        out = out substr(s, 1, RSTART - 1) pre body post
        s = substr(s, RSTART + RLENGTH)
    }
    return out s
}

function link(s,    out, text, url, inner) {
    out = ""
    while (match(s, /\[[^]]+\]\([^)]+\)/)) {
        inner = substr(s, RSTART, RLENGTH)
        text = substr(inner, 2, index(inner, "](") - 2)
        url = substr(inner, index(inner, "](") + 2, length(inner) - index(inner, "](") - 2)
        out = out substr(s, 1, RSTART - 1) "<a href=\"" url "\">" text "</a>"
        s = substr(s, RSTART + RLENGTH)
    }
    return out s
}

function inline(s) {
    s = escape(s)
    # The patterns are strings, not regex constants: `pattern = /re/` in awk assigns the
    # result of matching `re` against the current line, which is 0 or 1
    pattern = "\\*\\*[^*]+\\*\\*"; s = wrap(s, "<strong>", "</strong>", 2)
    pattern = "`[^`]+`";                  s = wrap(s, "<code>", "</code>", 1)
    return link(s)
}

function end_block() {
    if (in_table) { print "</tbody></table>"; in_table = 0 }
    if (in_para) { print "</p>"; in_para = 0 }
}

BEGIN {
    print "<!doctype html>"
    print "<html><head><meta charset=\"utf-8\"><title>AI spend</title></head>"
    print "<body style=\"font-family: -apple-system, Segoe UI, Helvetica, Arial, sans-serif; font-size: 14px; color: #1f2328; line-height: 1.5;\">"
}

/^#{1,2} / {
    end_block()
    level = ($0 ~ /^## /) ? 2 : 1
    sub(/^#+ /, "")
    printf "<h%d style=\"border-bottom: 1px solid #d1d9e0; padding-bottom: 4px; margin-top: 24px;\">%s</h%d>\n", level, inline($0), level
    next
}

# The row of dashes under a table header carries no content
/^\|[ :|-]+\|$/ { next }

/^\|/ {
    if (in_para) { print "</p>"; in_para = 0 }
    gsub(/^\| *| *\|$/, "")
    n = split($0, cells, / *\| */)
    if (!in_table) {
        in_table = 1
        print "<table style=\"border-collapse: collapse; margin: 8px 0;\"><thead><tr>"
        for (i = 1; i <= n; i++)
            printf "<th style=\"text-align: left; padding: 4px 12px 4px 0; border-bottom: 1px solid #d1d9e0;\">%s</th>", inline(cells[i])
        print "</tr></thead><tbody>"
        next
    }
    print "<tr>"
    for (i = 1; i <= n; i++)
        printf "<td style=\"padding: 4px 12px 4px 0; border-bottom: 1px solid #eaeef2;\">%s</td>", inline(cells[i])
    print "</tr>"
    next
}

/^ *$/ { end_block(); next }

{
    if (in_table) { print "</tbody></table>"; in_table = 0 }
    if (!in_para) { print "<p>"; in_para = 1 }
    print inline($0)
}

END {
    end_block()
    print "</body></html>"
}
