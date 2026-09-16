# AI costs

Every agent run records what it cost on the issue or pull request it worked on, as a hidden line
that renders as nothing. `bin/ai-cost-report.sh` reads those back and adds them up, and a
scheduled workflow emails the total once a month.

## Getting a report

```bash
bin/ai-cost-report.sh                       # this month so far, every repository with the harness
bin/ai-cost-report.sh --last-month          # what the monthly email sends
bin/ai-cost-report.sh --month 2026-08       # one calendar month
bin/ai-cost-report.sh --from 2026-08-15 --to 2026-09-02 officio bcpnp-frontend
bin/ai-cost-report.sh --out /tmp/costs      # where the three files go
```

Three files land in `ai-cost-report/`, and the summary is printed as it is written:

| File | What is in it |
|---|---|
| `ai-costs.md` | Spend by repository, by kind of run and by issue, and what the money went on |
| `ai-costs.html` | The same summary as an email body, rendered by `bin/md-to-html.awk` |
| `ai-costs-issues.csv` | One row per issue: plan, coding and review cost, and the total |
| `ai-costs-runs.csv` | One row per agent run, for when a figure needs explaining |

Needs `gh` authenticated against the organisation. `--to` is exclusive, so a run at midnight on
that date belongs to the next report rather than to both.

## The monthly email

`self-ai-cost-report.yml` runs on the first of every month, reports the month that just ended,
and emails the summary with both spreadsheets attached. It also takes a month and a set of
addresses by hand, from **Actions → AI cost report → Run workflow**.

| Secret | What it is for |
|---|---|
| `GHA_PRIVATE_ACCESS_TOKEN` | Reading issues across the organisation. Without it the run fails rather than reporting a total that is missing every private repository |
| `AI_COST_REPORT_SENDER` | Mailbox the report is sent from, and the only one the app is allowed to send as |
| `AI_COST_REPORT_RECIPIENTS` | Who it goes to, comma separated |
| `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_TENANT_ID` | The app registration the mail is sent as, through Microsoft Graph. Organisation secrets already |

Setting up the app registration and the mailbox it sends as is
[AI cost report](../self/self-ai-cost-report.md). Without any of these secrets the report is still
written to the run's summary and kept as an artifact, with a warning saying which ones are
missing.

## Dig deeper

### What the hidden line holds

`ai-run-report` builds it and the caller puts it on the last line of whatever it posts:
`<!-- ai-cost {"v":1,"kind":"plan","repo":"uniquesca/officio","issue":1113,"cost_usd":1.97,...} -->`,
carrying the cost, the four token counters separately, turns, duration, the model, and the run
that produced it. The token counters stay separate because cache reads are most of the volume and
a fraction of the price, so a month that costs more than the one before it cannot be explained
without knowing which of the two grew.

### One run is one row, however many comments carry it

A review Github will not take as a review is posted as a comment as well, and the plan is copied
into the pull request body, so the same line can be read more than once. The report keys on the
run that wrote it rather than on where it was found, and two lines from one run collapse to one
row - which is also what makes the figures safe to add up by hand.

### What the report cannot see

The cost line rides on something the run posts, so a run that posts nothing is missing from the
report: a job Github cancelled is the one that does this. Spend that predates the line is still
in the prose footers on the issue, where reading it back means parsing English. Repositories come
from code search, which only sees default branches and can lag, so name a repository on the
command line to be certain of it; one that cannot be read at all is named in the report rather
than quietly dropped.
