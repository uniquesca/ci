# Communication plan

Tell people in Teams and ClickUp what needs them, at the right moment, without noise.

One new app, `comms-api` in `infra-apps`, does all of it. It receives GitHub events, keeps a small
SQLite database, runs timers, and is the only thing that sends messages. We build it one phase at a
time. Each phase works on its own before the next starts.

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

## Phase 1: The app, and posting to Teams

The app is deployed and can post a card to a channel and to a person.

**Set up**
1. **Service account.** Create `notifications@` in Microsoft 365, with a Teams licence. Messages
   are sent under it.
2. **Channels.** Create a `Reports` channel and a `Dev` channel. Add `notifications@` to their team.
   Add the supervisor to `Reports`.
3. **The flow.** Sign in to [Power Automate](https://make.powerautomate.com) as `notifications@` and
   create an instant cloud flow:
   - Trigger: **When a Teams webhook request is received**, who can trigger: **Anyone**.
   - It receives `{"target": {"channel": "reports"} or {"user": "email"}, "card": {...},
     "file": {"name": "...", "content": "base64"}}`, where `file` is optional.
   - If there is a `file`: SharePoint **Create file** in the channel's folder of the team site, with
     `base64ToBinary()` of the content.
   - **Post card in a chat or channel**, posting as **Flow bot**:
     - for a `channel`, a **Switch** on its name picks the team and channel. Any other name ends the
       flow with an error.
     - for a `user`, post in **Chat with Flow bot**, with the email as recipient.
   - Save, and copy the trigger URL. 🔑 `TEAMS_FLOW_URL`
4. **Hosting.** In `devops-infra`: a public hostname, a `/data` volume, and the secrets above.

**Build**
1. Move the webhook signature check, the SQLite setup and the environment checks out of
   `ci-status-api` into Nx libraries both apps use.
2. Make the root `Dockerfile` build one image per app, and the publish workflow build both.
3. Create `comms-api`: Fastify, SQLite on `/data`, a health endpoint, and the test runner.
4. A `teams` module that sends `{target, card, file}` to the flow, and retries a failed send.
5. `people.json` in the app: GitHub login to work email and ClickUp ID. Somebody missing is skipped
   and logged.
6. A command that sends a test card, run inside the container.

**Done when** a test card reaches `Reports` and one person's chat.

## Phase 2: GitHub App, and the cost report

The app collects AI costs as the runs report them, and posts last month's total on the 1st. It has
no history from before it went live.

**Set up**
1. **The GitHub App.** In the `uniquesca` organisation settings: Developer settings, GitHub Apps,
   **New GitHub App**.
   - Name: `Uniques Comms`. Homepage URL: the app's address.
   - Webhook URL: `https://<host>/webhooks/github`. Webhook secret: the output of
     `openssl rand -hex 32`. 🔑 `GITHUB_WEBHOOK_SECRET`
   - Repository permissions, all **Read-only**: Checks, Commit statuses, Issues, Metadata, Pull
     requests. These cover phases 2 to 4, so the app does not need approving again.
   - Subscribe to events: Check suite, Issue comment, Pull request, Pull request review, Status.
   - Where it can be installed: **Only on this account**. Create it.
   - Note the App ID. 🔑 `GITHUB_APP_ID`
   - **Generate a private key** and keep the downloaded file. 🔑 `GITHUB_APP_PRIVATE_KEY`
2. **Install App**, on **All repositories**.

**Build**
1. Webhook intake: check the signature, ignore events the app does not handle.
2. On startup, ask GitHub for failed deliveries and redeliver them, so a deploy loses nothing.
3. Read every `<!-- ai-cost {...} -->` line from comments and review bodies, and store it by
   comment or review ID. An edit replaces that comment's lines.
4. On the 1st, post a card to `Reports`: the total, the split by repository and by stage, and the
   five most expensive issues, with the full list as a CSV file.
5. In `ci`, delete `self-ai-cost-report.yml` and `docs/self/self-ai-cost-report.md`, and the
   links to them in `docs/ai/ai-costs.md` and `docs/workflows-and-actions.md`. Keep
   `bin/ai-cost-report.sh` for looking up costs by hand.

**Done when** the first monthly card and CSV are in `Reports`, and the supervisor can open them.

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
1. Fill in `people.json` for everybody who opens or reviews pull requests.

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
3. **Entra app.** Microsoft Entra admin centre, App registrations, **New registration**:
   - Name: `Comms standup reader`, this organisation only.
   - Redirect URI, Web: `https://<host>/auth/microsoft/callback`.
   - Note the Application (client) ID and Directory (tenant) ID. `MICROSOFT_CLIENT_ID`,
     `MICROSOFT_TENANT_ID`
   - Certificates & secrets, **New client secret**. 🔑 `MICROSOFT_CLIENT_SECRET`. Put a reminder in
     the calendar before it expires.
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
7. **After deploying,** open `https://<host>/auth/microsoft` once and sign in as `standup@`.

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
- **A Teams bot in place of the flow.** Messages come from a named bot, can be edited after sending
  ("checks failed" becomes "fixed"), and can carry buttons such as "Snooze".
- **A daily digest,** if messages to a person start piling up.

## Secrets and settings

| Name | Phase | From |
|---|---|---|
| `TEAMS_FLOW_URL` 🔑 | 1 | The flow's trigger |
| `GITHUB_APP_ID` | 2 | The GitHub App |
| `GITHUB_APP_PRIVATE_KEY` 🔑 | 2 | The GitHub App |
| `GITHUB_WEBHOOK_SECRET` 🔑 | 2 | Made up when creating the GitHub App |
| `CLICKUP_TOKEN` 🔑 | 4 | The ClickUp user's settings |
| `CLICKUP_TEAM_ID` | 4 | Any ClickUp address |
| `MICROSOFT_CLIENT_ID`, `MICROSOFT_TENANT_ID` | 5 | The Entra app |
| `MICROSOFT_CLIENT_SECRET` 🔑 | 5 | The Entra app |
| `ANTHROPIC_API_KEY` 🔑 | 5 | The Claude Console |
