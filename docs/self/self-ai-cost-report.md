# AI cost report

`self-ai-cost-report.yml` adds up what the AI workflows spent across the organisation and emails
the total on the first of the month. What the report contains is in [AI costs](../ai/ai-costs.md);
this page is how to get it sending.

## Secrets

Set these on this repository, or on the organisation for every repository at once - a repository
secret wins over an organisation one.

| Secret | What it is for |
|---|---|
| `GHA_PRIVATE_ACCESS_TOKEN` | Reading issues across the organisation, and finding the repositories that call the AI workflows. Needs read on contents and issues in every repository; `GITHUB_TOKEN` sees only this one |
| `MICROSOFT_CLIENT_ID` | The app registration the mail is sent as |
| `MICROSOFT_CLIENT_SECRET` | Its client secret |
| `MICROSOFT_TENANT_ID` | The tenant that app lives in |
| `AI_COST_REPORT_SENDER` | Mailbox the report is sent from, and the only one the app may send as |
| `AI_COST_REPORT_RECIPIENTS` | Who it goes to, comma separated |

Without the Microsoft secrets or the recipients the report is still written to the run summary and
kept as an artifact, and the run warns which ones are missing. Without the token the run fails.

## Registering the app

In **Entra → App registrations → New registration**, single tenant, no redirect URI. Take the
application and directory IDs for `MICROSOFT_CLIENT_ID` and `MICROSOFT_TENANT_ID`, then add a
client secret under **Certificates & secrets** for `MICROSOFT_CLIENT_SECRET`.

**Grant it no API permissions here.** Granted in Entra, Graph's `Mail.Send` lets the app send as
every mailbox in the organisation, and such a grant adds to the scoped one below rather than being
replaced by it.

## Scoping it to one mailbox

Exchange Online grants the same permission against a single mailbox. In
[Exchange Online PowerShell](https://learn.microsoft.com/en-us/powershell/exchange/connect-to-exchange-online-powershell):

```powershell
# The enterprise application's object ID, not the app registration's
New-ServicePrincipal -AppId <application-id> -ObjectId <enterprise-application-object-id> `
    -DisplayName 'AI cost report'

New-ManagementScope -Name 'AI cost report sender' `
    -RecipientRestrictionFilter "PrimarySmtpAddress -eq 'ci-reports@example.com'"

New-ManagementRoleAssignment -App <application-id> -Role 'Application Mail.Send' `
    -CustomResourceScope 'AI cost report sender'

# Answers for the mailbox it is scoped to and no other
Test-ServicePrincipalAuthorization -Identity <application-id> -Resource 'ci-reports@example.com'
```

The assignment is cached for up to two hours, so a send can still be refused after
`Test-ServicePrincipalAuthorization` says it is allowed.

## Checking it works

**Actions → AI cost report → Run workflow**, with a month to report and your own address in
`recipients`. Both take precedence over the schedule's month and the recipients secret, so this
sends nothing to anybody else.

| Input | Default | What it does |
|---|---|---|
| `month` | Empty | Month to report, as `2026-08`. Empty reports the month that just ended |
| `recipients` | Empty | Send to these addresses instead of `AI_COST_REPORT_RECIPIENTS`, comma separated |

Then uncomment the `cron` under `schedule:` in the workflow to start the monthly run.

## Dig deeper

### Microsoft Graph rather than SMTP

Exchange Online disables basic authentication for SMTP submission at the end of December 2026, so
a username and password against `smtp.office365.com` is a credential with an expiry date on it.
The workflow makes two `curl` requests instead - a client credentials token, then `sendMail` - and
the app never holds a mailbox password. A scope granted through Exchange's
[RBAC for Applications](https://learn.microsoft.com/en-us/exchange/permissions-exo/application-rbac)
needs no consent in Entra at all, which is what keeps the organisation-wide permission from ever
existing: a stolen client secret can send as the reporting mailbox and nothing else.

### Who the report goes to is not a permission

`AI_COST_REPORT_RECIPIENTS` is the whole of it - the workflow sends to those addresses and no
others. Graph has nothing to say about recipients: the scope above governs which mailbox the app
may send **as**, never who it may write **to**. A mail flow rule on the sending mailbox is what
restricts that, if the addresses being right is not enough on its own.

### Running it as its own app

Nothing in the workflow names the organisation's app registration. Set the three `MICROSOFT_*`
secrets on this repository, from a registration scoped to its own mailbox, and the report sends as
that one instead.
