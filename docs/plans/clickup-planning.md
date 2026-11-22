# ClickUp planning plan

Plan work in the ClickUp task it belongs to, then hand it to the AI to build. People already work in
ClickUp, so the GitHub issue stops being something they have to open.

Planning happens in ClickUp. Pull request work stays in the pull request. A new app,
`harness-gateway` in `infra-apps`, takes commands from ClickUp and starts the workflows. It is kept
apart from `comms-api`: it holds a GitHub token that can start AI runs, so it stays small and does
one job. It reads the same people folder as `comms-api`.

The rules from the harness hold here too. The workflows hold the keys and do all reading from and
posting to ClickUp and GitHub. The agent only reads the files it is given and writes its answer to a
file. No MCP.

Each phase lists what a person sets up by hand (**Set up**), what we write (**Build**), and how we
know it works (**Done when**). Values marked 🔑 are secrets: they go to the deployment in
`devops-infra`, never into a repository.

## Phase 1: Plan in ClickUp, one repository

**Set up**
1. **System Bot** with access to every space whose tasks get planned, and its API token. Shared with
   phase 4 of the [communication plan](communication.md). 🔑 `CLICKUP_TOKEN`
2. **One webhook** for the workspace, for task comments, registered through the ClickUp API. The
   gateway can make the call; a ClickUp admin agrees to it first. 🔑 `CLICKUP_WEBHOOK_SECRET`
3. **Two optional custom fields:** Main repo (dropdown) and Acceptance criteria (text).
4. **Hosting** for `harness-gateway` in `devops-infra`, and a GitHub token that can start
   `ai-plan` in the mapped repositories. 🔑 `GITHUB_TOKEN`

**Build**
1. `harness-gateway`: one endpoint for the ClickUp webhook. It checks the signature, maps the
   ClickUp person to a GitHub login with write access, and reacts to `/ai-plan` comments. Status
   triggers and ClickUp Automations are not used.
2. Before planning, the gateway checks without AI:
   1. The description is not empty.
   2. A repository can be worked out: the Main repo field, else the space-to-repo mapping in the
      gateway config. If neither gives one, it replies "Set Main repo, this space has no default".
   Anything missing gets a reply on the task, and no run starts. Rules such as "acceptance criteria
   required" can be added to the config later.
3. The gateway starts `ai-plan` with `workflow_dispatch` and the task ID.
4. `ai-plan.yml` gets a `clickup_task` input. A step fetches the task, its comments, its parent and
   linked tasks into files through the ClickUp API. A step posts the plan, or a revised plan, back
   as a task comment. The agent never sees a token. The issue mode keeps working.
5. The planner can stand down and post questions on the task instead of a plan, when the task is
   too unclear to plan.
6. In ClickUp mode the plan's `qa` list is acceptance criteria, shown when the plan is agreed. It is
   not copied to the pull request (`ai-qa-criteria`).

**Done when** a `/ai-plan` comment on a real task gives a plan on that task, and a task with
nothing to go on gets a reply saying what to fill in.

## Phase 2: Plans in rounds, across repositories

Some work needs a library changed and released before the main repository can use it.

**Build**
1. The planner reads the main repository and the source of its dependencies, which `ai-plan`
   already installs. Work in a library becomes its own round. A repository that is not a dependency
   (another app, an infra repository) is named in the plan for a person to confirm.
2. The plan is a list of ordered rounds. Each round has one repository, its part of the plan, and
   what it waits on. For example: round 1 changes `sentry-lib`; round 2 waits for that release,
   updates `sentry-lib` in `officio`, and does the rest.
3. Each round says whether its release should be major, minor or patch, and why. A person picks the
   version when releasing. A major release is flagged early, because the next round then has to
   change the version constraint, and other repositories may break.

**Done when** a task that needs a library change gives a plan with a round for the library and a
round for the main repository.

## Phase 3: Build one round at a time

**Build**
1. `/ai-implement round=N` on the task. The gateway checks the round's dependency is met: the
   earlier round's pull request is merged and released. If not, it says so on the task.
2. Before writing code, the round checks its part of the plan against the released library and the
   current main repository, and revises it on the task if they no longer match. Review in an
   earlier round may have changed the library.
3. The round uses the version that was actually released, read when it starts.
4. One pull request per round. Each pull request links the task and the pull requests of the other
   rounds. The plan comment on the task gets each round's pull request link as it opens. ClickUp
   holds the state, so the gateway needs no database.
5. The harness does not release anything. Releases stay the normal release flow.

**Done when** a two-round task ends with both pull requests merged, the second using the library
version the first released.

## Phase 4: QA steps for testers

**Build**
1. A new workflow, `ai-qa-steps`. The gateway starts it when the last round's pull request merges,
   and `/ai-qa` on the task runs it again.
2. It reads the plan, the acceptance criteria and the merged pull requests of every round, and
   posts steps for a tester on the task.

**Done when** testers get steps on the task before the release reaches the QA environment.

## Later

1. **A read-only lookup for the agent,** such as `clickup-task <id>`, limited to allowed spaces. Only
   if `ai-retro` shows plans regularly missing context the fetch step did not give them.
2. **Start the next round on its own** once the release it waits on is out.
3. **Require acceptance criteria** through the gateway config.
