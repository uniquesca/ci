# Communication plan

Tell people in Teams and ClickUp what needs them, at the right moment, without noise.

One new app, `comms-api` in `infra-apps`, does all of it. It receives GitHub events, keeps a small
SQLite database, runs timers, and is the only thing that sends messages. In Teams it is a bot. We
build it one phase at a time. Each phase works on its own before the next starts.

Each phase lists what a person sets up by hand (**Set up**), what we write (**Build**), and how we
know it works (**Done when**). Values marked 🔑 are secrets: they go to the deployment in
`devops-infra`, never into a repository.

## Phase 0: Stop the cost report leaking

The AI cost report runs in the public `ci` repository and writes the report - private repository
names, issue titles and costs - into its run summary and artifact.

**Set up**
1. In `uniquesca/ci`, Actions, AI cost report: **Disable workflow**.
2. Delete its earlier runs.

**Done when** no run of it is left to read. Phase 2 replaces it.

## Phase 1: The app, and collecting AI costs

The app is deployed and records the cost of every AI run as it is reported. It has no history from
before it went live, so **it must be running by the 1st of a month** for that month's report to be
complete.

**Set up**
1. **Hosting.** In `devops-infra`: `comms-api.unqs.ca`, a `/data` volume, and the secrets below.
2. **The webhook.** In the `uniquesca` organisation settings: Webhooks, **Add webhook**.
   - Payload URL: `https://comms-api.unqs.ca/webhooks/github`. Content type:
     **application/json** - the default form encoding is turned down.
   - Secret: the output of `openssl rand -hex 32`. 🔑 `GITHUB_WEBHOOK_SECRET`
   - Let me select individual events: Check suites, Issue comments, Pull requests, Pull request
     reviews, Statuses. These cover every phase.
3. **The token.** The organisation's shared `GHA_PRIVATE_ACCESS_TOKEN`, which reads issue titles
   for the cost card. 🔑 `GITHUB_TOKEN`

**Build**
1. Move the webhook signature check, the SQLite setup and the environment checks out of
   `ci-status-api` into Nx libraries both apps use.
2. Make the root `Dockerfile` build one image per app, and the publish workflow build both.
3. Create `comms-api`: Fastify, SQLite on `/data`, a health endpoint, and the test runner.
4. Webhook intake: check the signature, ignore events the app does not handle.
5. Read every `<!-- ai-cost {...} -->` line from comments and review bodies, and store it once
   per run. The same run is posted in more than one place, and an edit that drops the line
   keeps it.

**Done when** the next AI run on any repository is in the database.

## Phase 2: The Teams bot, and the monthly cost report

The bot posts last month's costs to the existing `Administerial` channel on the 1st, and can
message a person. The first card goes out on 1 November 2026. It covers October from the 19th,
when collection started, and says so.

**Set up**
1. **Channels.** Costs go to the existing `Administerial` channel. Create a `Dev` channel.
2. **The bot.** In the [Teams Developer Portal](https://dev.teams.microsoft.com): Tools, Bot
   management, **New bot**, named `Uniques Comms`. Choose single tenant if asked.
   - Endpoint address: `https://comms-api.unqs.ca/api/messages`.
   - Client secrets, **Add a client secret**. 🔑 `MICROSOFT_APP_SECRET`. Put a reminder in the
     calendar before it expires.
   - Note the bot ID. `MICROSOFT_APP_ID`. Note the Directory (tenant) ID from the Entra admin
     centre overview. `MICROSOFT_TENANT_ID`
3. **The Teams app.** In the Developer Portal: Apps, **New app**, `Uniques Comms`.
   - Basic information: descriptions, developer name, and the app's address for the website,
     privacy and terms links.
   - Branding: a 192×192 colour icon and a 32×32 outline icon.
   - App features, **Bot**: pick the bot, with the Personal and Team scopes.
   - Publish, **Publish to your org**.
4. **Teams admin.** In the Teams admin centre:
   - Teams apps, Manage apps: find `Uniques Comms` and **Publish** it.
   - Teams apps, Setup policies, Global: under Installed apps, **Add apps**, `Uniques Comms`. This
     installs it for everybody, so it can message them. It can take a day to reach everyone.
5. **Add it to the team** holding `Administerial` and `Dev`: in Teams, Apps, Built for your org,
   `Uniques Comms`, **Add to a team**.
6. **Channel ID.** On `Administerial`: `⋯`, **Get link to channel**. The ID is the
   `19:…@thread.tacv2` part. `TEAMS_COST_CHANNEL_ID`

**Build**
1. `/api/messages` answers Teams and acts on nothing. The bot only posts, through the Bot
   Connector REST API, so it needs no SDK.
2. A `teams` module that starts a post in a channel and retries one Teams turned away for now.
   Messages to a person come with phase 3.
3. On the 1st, post a card to `Administerial`: the total, the split by repository and by stage,
   and the five most expensive issues. It says how many runs reported no cost, and that the total
   is approximate: runs posted while the app was down are not counted. A month without runs is
   skipped.
4. `node main.js cost-report [YYYY-MM] [--post] [--channel <id>]` in the container prints the
   card, or sends it, without waiting for the 1st.
5. In `ci`, delete `self-ai-cost-report.yml` and `docs/self/self-ai-cost-report.md`, and the
   links to them in `docs/ai/ai-costs.md` and `docs/workflows-and-actions.md`. Keep
   `bin/ai-cost-report.sh` for looking up costs by hand.

**Done when** the first monthly card is in `Administerial` and the supervisor has read it, and a
test card has reached one person.

## Phase 3: Pull request notifications

| When | Who gets a message |
|---|---|
| Checks fail | Author |
| Checks pass, no reviewer | Author |
| Checks pass, reviewer assigned | Reviewer |
| Reviewer added after checks passed | That reviewer |

Nothing is sent until every check on the latest commit has finished. Draft pull requests and bots
get nothing, and Copilot does not count as a reviewer.

**Set up**
1. Fill in `people.json` in the app: each GitHub login, with the person's work email and ClickUp ID.
   Somebody missing is skipped and logged.

**Build**
1. The rules as plain functions - what happened, what GitHub says, what was already sent - and
   tests for every row above.
2. A record of what was sent to whom, for which commit, so a person is never told the same thing
   twice.

**Done when** each row above has happened once for real, and the message read right.

## Phase 4: ClickUp comments

When a pull request mentions a ClickUp task, the app comments on the task. When the pull request is
merged or closed, it edits that comment to say so. It never changes a task's status.

**Set up**
1. Decide whose name the comments carry. A ClickUp user just for this, for example `CI`, keeps them
   from looking like a colleague wrote them.
2. Signed in to ClickUp as that user: Settings, Apps, **API Token**, Generate. 🔑 `CLICKUP_TOKEN`
3. Note the workspace ID - the number after `app.clickup.com/` in any ClickUp address.
   `CLICKUP_TEAM_ID`
4. Check whether ClickUp's own GitHub integration is on. If it is, decide whether to keep both.

**Build**
1. Find task IDs in the pull request title, body and branch: `CU-…`, ClickUp task links, and our
   custom task IDs.
2. One comment per pull request and task. Keep its ID, and edit it on merge or close.

**Done when** a pull request mentioning a task has commented on it, and the comment changed when it
merged.

## Phase 5: Standup summary

The daily call is transcribed. A few minutes after it ends, the app reads the transcript, has the
AI summarise it, posts the summary to `Dev`, and deletes the transcript.

**Set up**
1. **Agree it.** The team knows the call is transcribed and that the text goes to Anthropic, and
   our client agreements allow it.
2. **Organiser account.** Create `standup@` in Microsoft 365, with a Teams licence. Microsoft only
   gives the transcript to the meeting's organiser.
3. **Permissions.** In the Microsoft Entra admin centre, App registrations, open the bot's
   registration (`MICROSOFT_APP_ID`):
   - Authentication, add a Web redirect URI: `https://comms-api.unqs.ca/auth/microsoft/callback`.
   - API permissions, Microsoft Graph, **Delegated**: `OnlineMeetings.Read`,
     `OnlineMeetingTranscript.Read.All`, `User.Read`, `offline_access`. **Grant admin consent**.
4. **Check it works before building.** Hold a short test meeting as `standup@` with transcription
   on. In [Graph Explorer](https://developer.microsoft.com/graph/graph-explorer), signed in as
   `standup@`, fetch the meeting with `GET /me/onlineMeetings?$filter=JoinWebUrl eq '<join link>'`,
   then `GET /me/onlineMeetings/{id}/transcripts`. A transcript in the answer means this phase will
   work.
5. **The meeting.** As `standup@`, schedule the recurring daily call and invite the team. In
   Meeting options, turn on recording and transcribing automatically if it is offered. If not,
   whoever opens the call clicks **Start transcription**.
6. **Anthropic.** In the Claude Console, create a `comms` workspace with a monthly spend limit, and
   an API key in it. 🔑 `ANTHROPIC_API_KEY`
7. **After deploying,** open `https://comms-api.unqs.ca/auth/microsoft` once and sign in as
   `standup@`.

**Build**
1. Microsoft sign-in for `standup@`: keep its refresh token. If the token stops working, post that
   to `Dev`.
2. After the call's end time, look for the transcript every two minutes, for up to an hour. If none
   appears, post that to `Dev`.
3. Summarise with one API call into fixed sections: decisions, blockers, action items per person.
4. Post the card, and delete the transcript whether or not that worked.

**Done when** a week of standups has been summarised, and the team finds the summaries right.

## Later

Each is its own phase, picked up when the ones above are in use.

- **Reviewer reminders.** If a review is still missing after a working day, remind the reviewer
  once.
- **Standup action items to ClickUp.** Comment on the task an action item names.
- **Edit notifications as things change.** "Checks failed" becomes "fixed" once they pass.
- **Buttons** such as "Snooze" or "I'll review it".
- **The full cost list,** as a download link that expires, if somebody needs more than the card.
- **A daily digest,** if messages to a person start piling up.

## Secrets and settings

| Name | Phase | From |
|---|---|---|
| `GITHUB_WEBHOOK_SECRET` 🔑 | 1 | Made up when creating the webhook |
| `GITHUB_TOKEN` 🔑 | 1 | `GHA_PRIVATE_ACCESS_TOKEN` |
| `MICROSOFT_APP_ID`, `MICROSOFT_TENANT_ID` | 2 | The bot, and the Entra admin centre |
| `MICROSOFT_APP_SECRET` 🔑 | 2 | The bot |
| `TEAMS_COST_CHANNEL_ID` | 2 | `Administerial`'s link |
| `CLICKUP_TOKEN` 🔑 | 4 | The ClickUp user's settings |
| `CLICKUP_TEAM_ID` | 4 | Any ClickUp address |
| `ANTHROPIC_API_KEY` 🔑 | 5 | The Claude Console |
