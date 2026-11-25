---
name: "freedcamp-live-dashboard"
description: "Work with Freedcamp by plain names and open the live 'Your focus today' dashboard. Use when the user mentions a Freedcamp project, group or app by name (e.g. 'Add a task to Marketing Campaign', 'Create a wiki page in DevOps', 'Log an issue in Chat'), asks what is important, overdue or what they missed, asks to 'plan my day', or asks for a Freedcamp dashboard or 'my focus today'. Builds a name lookup from the live session so projects and apps never need IDs, and publishes an interactive artifact that reads Freedcamp live and can complete tasks, reply and draft with Claude."
---

# Freedcamp: work by name and the live dashboard

This skill covers everything Freedcamp. Pick the part that fits the request:

- **Dashboard, "my focus today", a visual daily overview:** go to "Dashboard" below. The page fetches its own data, so skip Step 1.
- **Anything else by name** (add or edit an item, a task report, "what did I miss"): start at Step 1.
- **"Plan my day", "what should I do today", "help me prioritize":** go to "Plan my day" below. You write the plan yourself in the chat.
- **The user asks in chat for help with one task** ("help me with task 73755437", "help with Write brief"): go to "Help with a task" below. On the dashboard, "Help with this" does this on the page itself.

## First run

Before anything else, check whether `./.freedcamp/heartbeat.md` exists in the working directory (the state folder the onboarding skill creates).

- **It exists:** carry on with the request below.
- **It is missing and the `onboarding` skill is installed** (from the `freedcamp-onboarding` plugin): say "Looks like this is your first time. Want me to get to know your work first? It takes a few minutes." On a yes, hand off to the `onboarding` skill by name (`/freedcamp-onboarding:onboarding`). On a no, carry on with the request.
- **It is missing and onboarding is not installed:** carry on with the request, then show this loop setup message once:

  > Want me to check in on a loop? Pick how often:
  > 1. Every 10 minutes: `/loop 10m /freedcamp-live-dashboard:freedcamp-live-dashboard`
  > 2. Every 15 minutes: `/loop 15m /freedcamp-live-dashboard:freedcamp-live-dashboard`
  > 3. Every hour: `/loop 1h /freedcamp-live-dashboard:freedcamp-live-dashboard`
  > 4. Every 3 hours: `/loop 3h /freedcamp-live-dashboard:freedcamp-live-dashboard`
  > 5. Custom: `/loop <period> /freedcamp-live-dashboard:freedcamp-live-dashboard`, for example `30m` or `2h`
  >
  > For check-ins that remember your goals and focus tasks, install the freedcamp-onboarding plugin from this marketplace.

## Working by name

Users talk in names ("Add a task to Marketing Campaign"). Freedcamp tools need IDs. This skill bridges the two with a lookup built once per conversation.

## Step 1: Build the lookup (once per conversation)

1. Call `fc_fetch_current_session`. Do not call it again unless the user asks to refresh, or after a project is created or deleted.
2. Read `data.groups`, `data.projects`, `data.users` from the result.
3. Build this pretty list in your head (or show it if the user asks "what projects do I have"):

```
GROUP: Main AI Group (group_id 1480995)
  - Marketing Campaign (project_id 3765761) — Tasks, Discussions, Milestones, Time, Files, Issue Tracker, Wikis, Calendar, Overview, Planner, Translations
  - Freedcamp Social Media Presence (project_id 3766892) — Tasks, Discussions, Files, Calendar, Overview
GROUP: Freedcamp (group_id 94882)
  - Chat (project_id 3093798) — ...
USERS: Angel G. (2), Bob D. (18849), ...
```

How to build it:

- **Projects per group:** match `project.group_id` to `group.group_id`. Ignore `group.projects` for matching: it lists project IDs that are often missing from `data.projects`, and you cannot act on those.
- **Apps per project:** map each ID in `project.applications` through the table below.
- **Skip archived projects** (`archived_ts` is not null) unless the user names one explicitly.
- **Users:** `data.users` gives `user_id`, `full_name`, `email`. Use it to resolve "assign to Igor".
- **Current user:** `data.user_id` is the ID of the person you are talking to. Find them in `data.users` for their name and `timezone`. Use it whenever the request says "me", "my", or "myself": "assign it to me" sets `assigned_to_id` to `data.user_id`, and "my tasks" filters by it. Never ask the user for their own ID. Use their `timezone` when they give a relative date or time ("tomorrow 3pm").

### Recent projects

Call `fc_fetch_recent_project_ids` (no parameters) when you need to know what the user has been working on. It returns a list of project IDs. Look each ID up in the session lookup above to get its name, group, and apps. Do not call it for every request, only when one of these applies:

- The user asks for "my recent projects" or "what was I working on".
- The user gives no project ("add a task to buy milk"). Offer the most recent project by name and ask for a yes or no, e.g. "Add it to *Marketing Campaign* (your most recent project)?"
- A name matches several projects. Use recency to order the candidates and put the most recent first.

IDs that are not in `data.projects` cannot be shown by name, so skip them. Treat the list order as most recent first.

## App ID → name → create tool

| App ID | Name | Key | Create tool |
|-------:|------|-----|-------------|
| 2 | Tasks | TODOS | `fc_add_task` |
| 3 | Discussions | DISCUSSIONS | `fc_add_discussion` |
| 4 | Milestones | MILESTONES | `fc_add_milestone` |
| 5 | Time | TIME | `fc_add_time` |
| 6 | Files | FILES | `fc_upload_file` |
| 7 | Invoices | INVOICES | removed app, do not use |
| 13 | Issue Tracker | BUGTRACKER | `fc_add_issue` |
| 14 | Wikis | WIKI | `fc_add_wiki` |
| 16 | CRM | CRM | `fc_add_crm_task` / `fc_add_crm_call` |
| 17 | Passwords | PASSMAN | no create tool |
| 19 | Calendar | CALENDAR | `fc_add_event` |
| 20 | Invoices | INVOICESPLUS | no create tool |
| 37 | Overview | PEOPLE | no create tool |
| 47 | Planner | PLANNER | no create tool |
| 48 | Translations | TRANSLATIONS | no create tool |

Tools may be deferred. If a tool schema is not loaded, load it with `ToolSearch` (`select:<tool name>`) before calling.

## Step 2: Resolve the request

For "Add a task to PROJECT_NAME":

1. **Find the app.** Words in the request map to apps: task/todo → Tasks, issue/bug → Issue Tracker, wiki/page/doc → Wikis, event/meeting → Calendar, discussion/thread → Discussions, milestone → Milestones, log time → Time. If the user names no app and the verb is "add/create" with a bare item, default to Tasks.
2. **Find the project.** Match the name against the lookup: exact (case-insensitive) first, then substring, then word overlap. Also accept `it_prefix` (e.g. "MAI") and `project_unique_name`.
3. **Narrow by group if given.** "in the DevOps group" or "DevOps / Support" filters matches to that group.
4. **Check the app exists in that project.** If the app ID is not in the project's `applications`, do not call the tool. Tell the user the project has no such app and list the apps it does have. Some projects are wiki/files only.
5. **Call the create tool** with `project_id` from the lookup plus the fields the user gave (title, due date, assignee, priority).
6. **Task lists:** if the user does not name a list, omit `list_id`. Freedcamp puts the task in the project's first list. Do not ask which list. Only pass `list_id` when the user names one, and get that ID from `fc_fetch_lists`.

## Ambiguity rules

- **One clear match:** proceed without asking.
- **Several matches:** ask one short question listing the candidates with their group, most recently used first (see Recent projects), e.g. "Two projects match 'Freedcamp Social Media Presence': in *Main AI Group* or in *AI tests*?" Duplicate project names across groups are common, and group names can repeat too (two groups are named "Enavu", distinguish them by `group_id` or by their projects).
- **No match:** say so and offer the 3 closest names. Before giving up, call `fc_get_groups_projects` once in case the session list is stale.
- **Missing required field** (a task or issue with no title): ask for it.
- **Never guess an ID.** Every `project_id`, `list_id`, and `assigned_to_id` must come from the lookup or from a tool result.

## Reports: important tasks

For "what's important", "what's due this week", "my overdue tasks", "what's happening with tasks I created", call `fc_fetch_tasks`. All filters go inside the `filters` object.

| Goal | Filter |
|------|--------|
| Tasks assigned to the user | `assigned_to_id: [data.user_id]` (array of strings, ID from the session) |
| Tasks the user created | `created_by_id: data.user_id` (a single string, **instead of** `assigned_to_id`) |
| Due in a window | `due_date_from` and/or `due_date_to`, format `YYYY-MM-DD`, both inclusive |
| Open work only | Do **not** send `status`: the enum filter returns HTTP 400 (verified live). Fetch without it and drop tasks whose `status` is 1 (completed) or 3 (invalid). |
| One project | top-level `project_id` from the lookup (omit for all projects) |
| Sort by priority | `order_priority: "desc"` (high first) or `"asc"` (low first) |
| Sort by due date | `order_due_date: "asc"` (soonest first) or `"desc"` (latest first) |

Rules:

- **Default to assigned, not created.** Use `assigned_to_id` unless the user asks about tasks they created or are tracking ("what's happening with the tasks I made"). Then use `created_by_id` and drop `assigned_to_id`.
- **Date windows.** Work out "today" in the user's timezone (from `data.users`). "This week" is Monday to Sunday of the current week. "This month" is the 1st to the last day. "Overdue" is `due_date_to` = yesterday, with the open-status filter. Set both bounds for a window.
- **"Important" means:** open tasks, `order_priority: "desc"`, `order_due_date: "asc"`. Send both sort fields.
- **Completed tasks** come back in the same list. Drop them (`status` 1) unless the user asks for finished work or "everything".
- **Paging.** Use `limit` 100 and `offset` for more. `meta.has_more` says whether another page exists. Do not report a total you have not seen. `meta.total_count` is not always present, so count the tasks you fetched.

**Response shape (verified live).** There is no `data` wrapper: the body is `{ "tasks": [...], "meta": { "has_more": bool } }`. Fields used: `id`, `title`, `project_id`, `list_title` (list name), `status` (0 not started, 1 completed, 2 in progress, 3 invalid, 4 review), `status_title`, `priority` (0 none, 1 low, 2 medium, 3 high), `priority_title`, `due_ts`, `start_ts` (Unix seconds or `null`), `h_parent_id` (non-empty for subtasks), `url`. Task `description` fields are long HTML. Never print them.

**Dates.** `due_ts` is midnight in the user's timezone, which is the previous day in UTC. For a user in Europe/Athens, `1792098000` is 2026-10-15T21:00Z, which is **Oct 16** for them. Convert with the user's timezone before showing a date or counting days overdue. Using the UTC date is one day off.

Present the report using the lookup, not raw fields:

1. Group by project name (and group name), most urgent project first.
2. One line per task: priority (0 none, 1 low, 2 medium, 3 high), title, due date, status in words (Not started, In progress, Review), and its `url` as a link when the response includes one.
3. Open with a one-line summary, e.g. "7 open tasks assigned to you, 2 overdue, 3 due this week."
4. Flag overdue tasks first.
5. End with one line: "Want this as an interactive page?" On a yes, build the dashboard below. The page is an extra view; the report in the chat stays the answer.

## Notifications and daily/hourly updates

For "what did I miss", "catch me up", or a scheduled update, call `fc_fetch_notifications` (no parameters; returns the last 60 days of notifications the user follows). Pair it with the task report above for a thorough update.

The response is cryptic. Decode it like this:

**Shape:** `data.notifications[]`, `data.properties` (label and type for each changed field), `data.meta.has_more`. If `has_more` is true, say the list is partial.

**Per notification:**

| Field | Meaning |
|-------|---------|
| `app_id`, `item_id`, `item_title` | Which item changed. App name comes from the app table above. |
| `project_id` | Look up the project and group name in the session lookup. |
| `section` | Why the user got it: `assigned` (assigned to you), `mentioned`, `response` (a reply received or awaited), `involved`, `other`. Show in that order. Treat any other value as `other`. |
| `f_never_seen` | `true` means the user has never opened this item. Mark it NEW. |
| `comments_added_count` | New comments on the item. |
| `changed_properties` | Net changes across all actions. |
| `actions[]` | Individual events, **oldest first**. Reverse them to show newest first. |

**Per action:** `action_ts` is Unix seconds. `user_id` is who did it (resolve through `data.users`). `action_type`:

| Type | Meaning | Where the content is |
|-----:|---------|----------------------|
| 1 | Created the item | nothing useful in `changed_properties` |
| 2 | Edited the item | `changed_properties` |
| 4 | Reassigned | `assigned_to_id`, with `old_value_human` and `new_value_human` as names |
| 9 | Comment | text is in `changed_properties[0].new_value`, as HTML (the property name says `title`, ignore it) |
| 19 | New wiki version | wiki only, skip the HTML in `changed_properties` |
| 21 | Status change | `status`, with human values like "No Progress → Completed" |
| 50 | Invite | not seen in sample data |

Types 4 and 21 were learned from real responses, not from the web app's constants.

**Change entries** have `property_name`, `old_value_human`, `new_value_human`. Look up `property_name` in `data.properties` for the label ("task_group_id" is "List", "date_end" is "Ends"). Properties whose `type` is `text` (title, description) hold raw HTML: say "Description updated", never print it. Use the `_human` values, not the raw ones. Write a change as "Label: old → new", or "Label: new" when there is no old value. An `assigned_to_id` of `0` or empty means no one. Strip HTML from comments and cut them to about 160 characters.

**Time windows.** The tool has no date filter, so filter yourself: keep a notification if any action has `action_ts` inside the window (hourly = last 3600 seconds, daily = last 86400), and show only the actions inside the window. Compare against the current time, not the newest notification.

**Links.** Notifications carry no `url`. For a task notification (`app_id` 2) use `https://freedcamp.com/view/<project_id>/tasks/<item_id>`. For every other app link to `https://freedcamp.com`; do not guess other URL patterns.

**Update layout** (daily or hourly):

1. One summary line: "5 updates since yesterday, 2 new to you, 1 task overdue."
2. Overdue and due-today tasks from `fc_fetch_tasks`.
3. Notifications grouped by section, newest first, one line each: project, item title, who did what ("Dima Y. changed Status: No Progress → Completed").
4. Say nothing about empty sections. If there is no activity in the window, say so in one line.
5. When there was activity, end with: "Want this as an interactive page?" On a yes, build the dashboard below.

For recurring updates, the user can schedule this with `/loop` or `/schedule` (for example "every morning at 9").

## Plan my day

When the user asks to plan their day, you write the plan in the chat yourself. Do not hand the answer to a page. The plan is the deliverable; the dashboard is an optional extra view.

**Data.** Build the lookup (Step 1), then `fc_fetch_tasks` assigned to the user with `order_priority: "desc"` and `order_due_date: "asc"`, `limit` 100 (same rules as "Reports" above, no `status` filter), and `fc_fetch_notifications` with `{}` for who is waiting on the user. If `./.freedcamp/heartbeat.md` exists, read its goals and main projects, and read `focus_task_ids` and `ignored_task_ids` from `./.freedcamp/memory.md`. Leave out ignored tasks unless they became overdue.

**Think before writing.** Work out today in the user's timezone. Weigh, in this order: someone waiting on the user (a `mentioned` or `response` notification), overdue tasks worth doing today (high priority, nearly done, or blocking someone), due today, in progress, then work tied to their goals. Keep the day honest: usually 3 to 5 focus tasks, fewer when the day is already full. Estimate effort per task from its title, list and subtasks, and say the estimates are rough.

**Write it like this** (Markdown, names not IDs, links on titles):

> **Your plan for Thursday, Nov 20**
> Heavy day: 6 overdue, 2 people waiting on you. Here is a realistic plan.
>
> **Focus today**
> 1. **[Reply to Dima on the launch brief](<url>)** (Marketing Campaign), about 15 min. He asked a direct question yesterday.
> 2. **[Write brief](<url>)** (Marketing Campaign), about 1.5 h. 3 days overdue, high priority, blocks the launch.
> 3. **[Fix login bug](<url>)** (Chat), about 1 h. Due today, already in progress.
>
> About 2 h 45 min of focused work. That leaves room for meetings.
>
> **Overdue triage**
> - Do today: Write brief (in the plan above)
> - Move: Draft newsletter to Mon, Nov 24 (low priority, nothing waits on it)
> - Still needed? Old landing page copy (40 days overdue, no activity)
>
> **Defer**: Q1 roadmap draft, to next week. Not due, no one waiting.
>
> **I could take**: research for "Write brief" (3 competitors), a clearer description for "Plan Q1".
>
> Want me to save these focus tasks, or open this as an interactive page?

Rules:

- Every overdue task appears once: in the plan, under Move, or under Still needed. More than 10 overdue: show the 10 most urgent and say how many more.
- Moving a date is a suggestion. Change due dates in Freedcamp only after an explicit yes to the exact dates, with `fc_update_task`.
- "I could take" lists at most 3 jobs an agent can do (research, drafting, tidying a vague task). Start nothing without a yes.
- No em dashes or en dashes.

**After the plan.** If the Claude Code question tool (`AskUserQuestion`) is available, ask one question, header "Next", with the options "Save focus tasks", "Interactive page", "Adjust the plan" (the user can also type their own answer). Without it, ask the same in one line.

- Save focus tasks: write the plan's task IDs as described in "Saving picks" (approved = the focus tasks).
- Interactive page: build the dashboard below, with the plan's task IDs as `focus_task_ids` in its session context.

## Dashboard: "Your focus today"

When the user asks for a dashboard, "my focus", or a visual daily overview, build the page from `dashboard-spec.md` in this folder. No page ships with this skill: you write it each time. Read the whole spec before writing anything. It fixes the layout, colours, copy and behaviour, so follow it instead of designing your own page.

Tell the user up front that building the page takes a few minutes.

### Live dashboard (the Artifact tool is available)

**Check for the tool first:** look in your tool list for a tool named exactly `Artifact` (built in, no `mcp__` prefix); if it is not there, run `ToolSearch` with `select:Artifact`. Only if both come up empty is it unavailable. Then say in one line: "The Artifact tool isn't in this session. Claude Code turns it off without a claude.ai login (`/login`), on Bedrock, Vertex or Foundry, in `-p` runs, and when `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` is set (check the `env` block in `~/.claude/settings.json`)." and use "No artifact" below.

The page reads Freedcamp itself when it opens and acts from the page: it can open and complete tasks, post comments, draft with Claude, apply suggested dates, help with a task (description, comment, subtasks, assignee, plan), run offers, and save picks by marking tasks In progress.

This is the same mechanism the page has always used: the Artifact tool publishes it to claude.ai, and inside the page `claude.use('mcp')` calls Freedcamp through the viewer's connector (`mcp.callTool('Freedcamp', tool, input, { cache: false })`) and `claude.use('sample')` asks Claude to draft and plan (`sample(...)`, `sample.json(...)`). The Artifact tool exists in the Claude Code CLI and the desktop app when the session is signed in to claude.ai with `/login`.

1. Do not fetch tasks or notifications in the conversation to bake into the page. The page fetches its own data.
2. Write the page to a file named `focus-today.html`, following sections 1 to 12 of `dashboard-spec.md`, including the picks controls in section 9a. Fill its `fc-session` block from `./.freedcamp/memory.md` when that file exists (focus and ignored IDs, offers, and `agent_activity` from its `## agent_activity` section when present: entries not `done` or updated in the last 24 hours, at most 8), else with empty values. Also fill `recommended` (spec section 9a): at most 8 `{ "id", "reason" }` entries, from today's plan if one was written in this conversation ("in today's plan"), overdue tasks triaged "do today" ("overdue, do today"), and tasks tied to pending offers ("I offered to help"). Use only IDs from tool results or memory.md; leave it empty when there is nothing to suggest.
3. Run the checks in section 13 of the spec.
4. Publish the file with the Artifact tool, `icon: "checklist"`, and exactly these capabilities:

```json
{"mcp": {"servers": [{"server": "Freedcamp", "tools": ["fc_fetch_current_session", "fc_fetch_tasks", "fc_fetch_task", "fc_fetch_notifications", "fc_update_status", "fc_update_task", "fc_add_comment", "fc_add_task"]}]}, "sample": {}}
```

5. Name the page "Your Focus Today". In the Claude Code terminal, give the user the link the Artifact tool returns (a `https://claude.ai/code/artifact/...` address; Claude Code also opens it in the browser) and say: "Open it in claude.ai to use the buttons." In an app that shows the artifact as a card, the card is enough; do not paste the URL there. Never make up a link: use only the URL the tool returned (section 15 of `dashboard-spec.md`).
6. Tell the user in two or three sentences: what the page does, that Claude will ask them to allow the Freedcamp connection and Claude drafting on first use, and that every button acts on the page itself, the way "Plan my day" does: completing a task, posting a comment, applying a date, "Help with this" (description, comment, subtasks, assignee, plan) and Confirm (marks picked tasks In progress) change their real Freedcamp account, each only after they click the button that names the change. Say it was not exercised in a browser unless it was.
7. If `./.freedcamp/` exists, save the artifact URL as `dashboard_artifact_url` in `./.freedcamp/memory.md`, so a later session can update the same page ("Update <url> ...") instead of creating a new one.

The page needs a connector named "Freedcamp" in the viewer's Claude account. If the viewer sees "No matching connector found", they add it in Claude Settings, Connectors.

To change a published page, edit the same file and publish it again from the same path with the full capabilities object, because a tool is not granted unless it is declared.

### Static dashboard (the Artifact tool is missing, but the client renders artifacts)

In a claude.ai, desktop or Cowork chat that renders artifacts but has no Artifact tool, follow section 14 of `dashboard-spec.md`: the same page with the data baked in, shown as an artifact. Its data is frozen when it is built and it has no action buttons, so say plainly: "This is a read-only copy. Tell me here what to do on any task and I'll do it in Freedcamp."

### No artifact

If the client can neither publish nor render an artifact (for example, Claude Code with an API key, or on Bedrock, Vertex or Foundry, or run with `-p`), do not write a local page. Give the answer in the chat as the spec describes, with no artifact (sections 14 and 15 of `dashboard-spec.md`). Say in one line that the interactive page needs a claude.ai login (`/login`), then give the answer in the chat: the plan from "Plan my day" for a focus request, or the report layout above. If `AskUserQuestion` is available, collect picks with it: one multi-select question, header "Focus", with up to 4 of the most urgent tasks as options (the user can type other task names or numbers as their own answer). Save the answer as in "Saving picks".

## Saving picks

The dashboard saves its own picks in Freedcamp: Confirm marks the picked tasks In progress (spec section 9a), so read them back as the user's assigned tasks with `status` 2. Its "Ignore" stays on the page only. In chat, picks come from an `AskUserQuestion` answer, and Claude saves them:

1. Keep an ID only if it was in a tool result this conversation or is already in `./.freedcamp/memory.md`; otherwise check it with `fc_fetch_task`. Never guess an ID.
2. In `./.freedcamp/memory.md`, replace the `## selected_tasks` section, or add it at the end, and leave other sections alone. If the file does not exist, create it with a `# memory.md` heading and this section only:
   ```
   ## selected_tasks
   picked: 2026-11-20T12:15:00+02:00
   approved_task_ids: [73755437, 73755440]
   ignored_task_ids: [73755441]
   offers_yes: [1]
   offers_no: [2]
   ```
3. If memory.md has the onboarding plugin's `## today` section, also add approved IDs to `focus_task_ids` (and remove them from `ignored_task_ids`), add ignored IDs to `ignored_task_ids` (and remove them from `focus_task_ids`), and set `plan_date` to today.
4. Reply in one line, e.g. "Saved: 2 to work on, 1 ignored." Saving a chat pick never changes the task in Freedcamp; any write still needs its own explicit yes.

## Work on it requests from the dashboard

The dashboard's "Work on it" button queues a task for Claude by posting a marker comment on it. Check for queued work once per conversation, at the first request, and again whenever you build the dashboard:

1. If the `freedcamp-onboarding` plugin is installed, follow Step 3b of its `heartbeat` skill (`/freedcamp-onboarding:heartbeat`). If `./.freedcamp/memory.md` shows no `last_check` in the last hour, say once: "I'll keep working on tasks you hand me from the board while a check-in loop runs. Start it with `/loop 15m /freedcamp-onboarding:heartbeat`."
2. Otherwise, do the pickup here with the rules below. Use `fc_fetch_tasks` for your assigned tasks and `fc_fetch_task` for at most 4 candidates. If there is no `./.freedcamp/` folder, skip the memory.md bookkeeping: a comment counts as handled when a `[Claude: started]` comment follows it on the same task. Tell the user once: "Work on it keeps going only while this session is open. For check-ins on a loop, install freedcamp-onboarding and run `/loop 15m /freedcamp-onboarding:heartbeat`."

**Markers.** The dashboard's "Work on it" posts a task comment whose plain text starts with `[Claude: work on it]` (case-insensitive), optionally followed by a line `Instruction: <text>`. Claude's own comments on that work start with `[Claude: started]`, `[Claude: progress]`, `[Claude: needs you]` or `[Claude: done]`. Treat a `[Claude: work on it]` comment as a request only when it was posted by the current user (`user_id` from the session) and its comment `id` is not in `handled_comment_ids` (memory.md `## work_queue`). A newer `[Claude: work on it]` on a task already being worked adds its instruction to the running job instead of starting a second one.

**Find requests.** Look in the comments of the tasks this tick already fetched with `fc_fetch_task`. Then, from the `fc_fetch_tasks` list, take open assigned tasks whose `comments_count` is higher than in `seen_comments` (or that are not in it yet), or, when the list has no `comments_count`, whose `updated_ts` is after `last_check`; fetch them with `fc_fetch_task`, most recently updated first, at most 4 per tick and within the 20-call budget. Save each task's current `comments_count` in `seen_comments`. On the very first scan, with `seen_comments` empty, only record the counts and check the 4 most recently updated tasks.

**Start the work** (at most 2 new starts per tick; the rest wait for the next tick). The user's click on "Work on it" is the yes to start and to post comments on that one task. Nothing else is approved by it.

1. Add an `## agent_activity` entry: `agent: work-on-it`, `job: "work on <title>"`, the task ID, `status: running`, `started`, `updated` and `reported` (now), and `marker_comment_id`. Add the marker's comment `id` to `handled_comment_ids`.
2. Post `[Claude: started] I'm on it. <one line on what I'll do first>. I'll post progress here.` with `fc_add_comment` (`app_id: 2`).
3. Start the worker in the background. If the job is research, use `freedcamp-onboarding:researcher`; otherwise a general-purpose sub-agent. If a `ralph-loop` skill or command is installed and the instruction asks for a loop (or the job is long, iterative work such as code changes), you may run it with `/ralph-loop` instead; it occupies this session, so say check-ins pause until it ends. Hand over only: the job in one sentence, the task ID, the instruction, the `agent_activity` entry `id`, the paths to memory.md and heartbeat.md, and `writes: task comments` with these rules:
   - Do the task's real work: research, drafting, analysis, a plan, a breakdown, code in the user's repo when the task is about it.
   - Post progress on the task as `[Claude: progress] <what was done, what is next>` at each meaningful milestone, at most one every 15 minutes. Results go in comments as plain text (under about 3000 characters each; link to sources).
   - Finish with `[Claude: done] <summary of what was done and where>` or, when the user must decide or act, `[Claude: needs you] <the question>`. Update the `agent_activity` entry the same way (`status`, one-line `result`, `needs_you`, `updated`).
   - Never change the description, status, due date, assignee or subtasks, never touch other tasks, and never delete anything. Propose those changes in a comment and in `needs_you`; the main conversation asks the user.
   - Write nothing to local files for this work (no notes or drafts in `./.freedcamp/` or elsewhere), except its own `agent_activity` entry and, for a code task, the code changes themselves.
4. On later ticks, for each running Work-on-it entry: if the worker finished or reported, make sure its last state is on the task (post the `[Claude: done]` or `[Claude: needs you]` comment if the worker did not), and report it under "Here's what I've been working on with the helpers you asked for:". If it asks for a change it may not make (a status change, a new description, subtasks, a reassignment, anything risky), ask the user with `AskUserQuestion` and make the change only on a yes.

## Help with a task

When the user asks in chat for help with one task (the dashboard's "Help with this" button runs its own in-page version, spec section 9a):

1. **Fetch.** Take the task ID from the request or a tool result (or find the task by name with `fc_fetch_tasks`) and call `fc_fetch_task` with `{ task_id }`. If it errors, say you could not find that task and stop. Never guess an ID.
2. **Summarize** in 3 to 5 lines: the title (linked to its `url`), project, status, due date, assignee, priority, subtask count, the gist of the latest comment (plain text, no HTML), and what looks missing (vague description, no assignee, overdue).
3. **Ask** with one `AskUserQuestion` call holding two questions:
   - Header "Help", "What help do you want on this task?", `multiSelect: true`, options "Update description", "Add a comment", "Create subtasks", "Assign it".
   - Header "Hand off", "Should a helper work on it?", options "Launch a sub-agent", "Run a Ralph loop", "Just plan it", "No helper".

   The built-in "Other" takes anything else. Without the tool, ask once in plain text with the same 8 choices numbered. Do nothing until the user picks.
4. **Carry it out in Freedcamp**, showing the exact content and getting a yes before every write:
   - Update description: draft plain text from the title, comments and subtasks, show it, then `fc_update_task` with `{ task_id, description }`.
   - Add a comment: ask what to say or draft it, show it, then `fc_add_comment` with `{ item_id: <task_id>, app_id: 2, description }`.
   - Create subtasks: propose up to 5 titles, let the user edit them, then `fc_add_task` once per title with the parent's `project_id` and `task_group_id` and `h_parent_id: <task_id>`. Give each new task's `url`.
   - Assign it: offer up to 4 likely people from the session's users (the built-in "Other" takes a name), then `fc_update_task` with `{ task_id, assigned_to_id }`. "Me" is the current user.
   - Launch a sub-agent: use `freedcamp-onboarding:researcher` for research or `freedcamp-onboarding:project-manager` for planning when the onboarding plugin is installed, else a general sub-agent. Hand over only the job in one sentence, the task ID and `writes: draft only`. Its result comes back to this chat; then offer to post it as a comment or to use it as the new description, and write it only after a yes to the exact text.
   - Run a Ralph loop: if a `/ralph-loop` command is installed, give the user the exact command to type (you cannot type it for them), for example `/ralph-loop "Work on Freedcamp task <id>: <job>. Read it with fc_fetch_task. Do not write any local files. Show the result as a draft comment and output DONE." --max-iterations 10 --completion-promise "DONE"`. When it finishes, post the draft to Freedcamp as a comment or description update only after a yes. If the command is not installed, say so and offer a sub-agent instead.
   - Just plan it: write a short plan in the chat (steps, rough time each), then offer to save it to Freedcamp as a comment or as subtasks.
5. **Nowhere but Freedcamp.** Never write help output, research, plans or drafts to files, in `./.freedcamp/` or anywhere else. Results live in Freedcamp (comments, descriptions, subtasks) or in the chat.

## Create tool fallback

If the specific create tool is unavailable, `fc_add_item_by_names` takes `project_name`, `app_name`, and `title` directly. It only creates a titled item, so use it only when no richer tool fits.

## After acting

Reply with what was created and where, in names: "Added task *Write brief* to *Marketing Campaign* (Main AI Group)." Include IDs only if the user asks.

**Always give the user the link.** `fc_add_task` returns the new task at `data.tasks[0]`, and that object has a `url`. Put that URL in the reply so the user can open the task:

> Added task *Write brief* to *Marketing Campaign* (Main AI Group): <data.tasks[0].url>

If the response has no `url`, say the task was created and do not invent a link.
