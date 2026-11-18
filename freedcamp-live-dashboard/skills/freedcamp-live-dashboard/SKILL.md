---
name: "freedcamp-live-dashboard"
description: "Work with Freedcamp by plain names and open the live 'Your focus today' dashboard. Use when the user mentions a Freedcamp project, group or app by name (e.g. 'Add a task to Marketing Campaign', 'Create a wiki page in DevOps', 'Log an issue in Chat'), asks what is important, overdue or what they missed, or asks for a Freedcamp dashboard or 'my focus today'. Builds a name lookup from the live session so projects and apps never need IDs, and publishes an interactive artifact that reads Freedcamp live and can complete tasks, reply and draft with Claude."
---

# Freedcamp: work by name and the live dashboard

This skill covers everything Freedcamp. Pick the part that fits the request:

- **Dashboard, "my focus today", a visual daily overview:** go to "Dashboard" below. The page fetches its own data, so skip Step 1.
- **Anything else by name** (add or edit an item, a task report, "what did I miss"): start at Step 1.

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

Same logic as `unify_session.js` in this folder, which writes the same lookup as JSON from a saved session dump.

## App ID → name → create tool

Source of truth: `constants.js` (`id_to_name`). Mirrored here so you do not need to read the file.

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

## Notifications and daily/hourly updates

For "what did I miss", "catch me up", or a scheduled update, call `fc_fetch_notifications` (no parameters; returns the last 60 days of notifications the user follows). Pair it with the task report above for a thorough update.

The response is cryptic. Decode it like this (code for all of it is in `notification_helpers.js`):

**Shape:** `data.notifications[]`, `data.properties` (label and type for each changed field), `data.meta.has_more`. If `has_more` is true, say the list is partial.

**Per notification:**

| Field | Meaning |
|-------|---------|
| `app_id`, `item_id`, `item_title` | Which item changed. App name comes from the app table above. |
| `project_id` | Look up the project and group name in the session lookup. |
| `section` | Why the user got it: `assigned` (assigned to you), `mentioned`, `response` (a reply received or awaited), `involved`, `other`. Show in that order. |
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

**Change entries** have `property_name`, `old_value_human`, `new_value_human`. Look up `property_name` in `data.properties` for the label ("task_group_id" is "List", "date_end" is "Ends"). Properties whose `type` is `text` (title, description) hold raw HTML: say "Description updated", never print it. Use the `_human` values, not the raw ones. Strip HTML from comments and cut them to about 160 characters.

**Time windows.** The tool has no date filter, so filter yourself: keep a notification if any action has `action_ts` inside the window (hourly = last 3600 seconds, daily = last 86400), and show only the actions inside the window. Compare against the current time, not the newest notification.

**Links.** Notifications carry no `url`. For a task notification (`app_id` 2) use `https://freedcamp.com/view/<project_id>/tasks/<item_id>`. For every other app link to `https://freedcamp.com`; do not guess other URL patterns.

**Update layout** (daily or hourly):

1. One summary line: "5 updates since yesterday, 2 new to you, 1 task overdue."
2. Overdue and due-today tasks from `fc_fetch_tasks`.
3. Notifications grouped by section, newest first, one line each: project, item title, who did what ("Dima Y. changed Status: No Progress → Completed").
4. Say nothing about empty sections. If there is no activity in the window, say so in one line.

For recurring updates, the user can schedule this with `/loop` or `/schedule` (for example "every morning at 9").

## Dashboard: "Your focus today"

When the user asks for a dashboard, "my focus", or a visual daily overview, build the live dashboard if the Artifact tool is available. It publishes an interactive artifact that reads Freedcamp live and can open tasks, complete them, post comments, draft replies with Claude and apply suggested due dates.

The static `Dashboard.html` in this folder is a picture: its buttons do nothing and its data is frozen when it is built. Use the static dashboard (the section after the live ones) only when the Artifact tool is missing, and then say plainly that the buttons are not wired.

## Live dashboard: do this the first time

1. Do not fetch tasks or notifications in the conversation to bake into the page. The page fetches its own data when it opens.
2. Do not write or edit the page. The finished page ships with this skill as `focus-today.html` in this folder. Read it and publish its contents unchanged.
3. Publish `focus-today.html` with the Artifact tool, `icon: "checklist"`, and exactly these capabilities:

```json
{"mcp": {"servers": [{"server": "Freedcamp", "tools": ["fc_fetch_current_session", "fc_fetch_tasks", "fc_fetch_task", "fc_fetch_notifications", "fc_update_status", "fc_update_task", "fc_add_comment"]}]}, "sample": {}}
```

4. Name the page "Your Focus Today". Do not paste the URL, the app shows a card.
5. Tell the user in two or three sentences: what the page does, that Claude will ask them to allow the Freedcamp connection and Claude drafting on first use, and that completing a task, posting a comment and applying a due date write to the real account. Say it was not exercised in a browser unless it was.

## Live dashboard: what the page does

Reference only: this describes how `focus-today.html` works. Use it to explain the page or to debug it if the user asks for a change. Do not rebuild the page from it.

On load it calls `claude.use("mcp")` and `claude.use("sample")`. Either can be null: show a banner ("Open this page from claude.ai") and hide the dependent controls. Because `sample` can resolve late or null at boot, never hide the Claude buttons on it. Keep a `getSample()` helper that retries `claude.use("sample")` on click, and when it is still null show a line saying Claude drafting is not available and to allow it in the page permissions. Calls use `mcp.callTool("Freedcamp", tool, input, {cache:false})` and read `result.payload`.

- `fc_fetch_current_session` with `{}`: payload is `{data:{user_id, users, projects}}`. Take the user's name and `timezone` from `data.users`, project names from `data.projects`.
- `fc_fetch_tasks` with `{filters:{assigned_to_id:[user_id], order_due_date:"asc"}, limit:100}`: payload is `{tasks:[...], meta:{has_more}}` with no data wrapper. Never send a `status` filter, it returns HTTP 400. Drop status 1 and 3 yourself.
- `fc_fetch_task` with `{task_id}`: payload is the task itself with no wrapper. Useful fields: `title`, `description_processed` (HTML), `status`, `status_title`, `priority_title`, `due_ts`, `assigned_to_fullname`, `list_title`, `children` (subtasks), `url`, `can_comment`, `can_progress`, and `comments` (each with `description_processed`, `user_full_name`, `created_ts`).
- `fc_fetch_notifications` with `{}`: payload is `{data:{notifications, properties, meta}}`.
- Run the tasks and notifications calls with `Promise.allSettled` so one failing section does not blank the other.

### Buckets (all dates in the user's timezone)

`due_ts` is local midnight, so convert with `Intl.DateTimeFormat('en-CA',{timeZone})` before comparing days. Using the UTC date is one day off.

- Overdue: open and due before today, most recently due first. Show 5, then a "Show N more overdue" toggle.
- Due next 7 days: due today through today plus 7. Empty state: "Nothing else is due through <date>."
- In progress: status 2 with no due date.
- Waiting on you: notifications in the Needs you group.
- Split leading bracket words off a title into a mono tag ("[FRONTPAGE] Add cookies" becomes tag FRONTPAGE).
- Priority shows Low, Medium or High, nothing for none.

### Notification classification

Ignore empty edits (action type 2 with no `changed_properties`). Pick the first match:

1. Needs you: newest comment (type 9) is by someone else and has a `?` at the end of a sentence after URLs are removed. Group `needs`.
2. Mention: a comment by someone else contains `class="fc_mention"` with `data-id` equal to the user's id.
3. Event: app 19. "added a calendar event" if there is an action type 1, else "updated a calendar event".
4. Complete: any type 21 action whose new value is Completed. Use that action's user and time.
5. Reassign: newest meaningful action is type 4. "took over a task from you" if the old assignee is the user.
6. Comment: newest action is type 9.
7. Edit: anything else, e.g. "updated the description of a discussion".

Strip HTML and zero-width characters from comment text, cut to about 160 characters, and show it as the quote (not for events). Sort Needs you first, then newest first. Task links are `https://freedcamp.com/view/<project_id>/tasks/<item_id>`, other apps link to `https://freedcamp.com`.

### Interactions

- Complete a task: the circle calls `fc_update_status` with `{item_id, status:1}`. Mark the row done optimistically, restore on failure. Clicking again restores the task's original status, not always 0.
- Open a task in the page: the task title is a button (data attribute holding bucket and index), with a small "Freedcamp" link beside it for the real site. It opens a modal dialog (`role="dialog"`, `aria-modal`, Escape and backdrop close, focus trapped and returned to the opener) that shows a skeleton, then calls `fc_fetch_task`. Show tag, project, list, status pill, due date, assignee, priority, the description (convert HTML to plain text with line breaks, render with `white-space:pre-wrap`, never inject HTML), subtasks, and comments oldest first. Notifications for tasks (app id 2) get an "Open task" button that opens the same modal.
- In the modal, a comment box with an optional one-line instruction field, "Post comment" (`fc_add_comment` with `{item_id, app_id:2, description}`), "Draft reply with Claude", and "Mark complete" (`fc_update_status` with `{item_id, status:1}`, then mark the matching row done and re-render). Hide the composer when `can_comment` is false and Mark complete when `can_progress` is false. After posting, append the comment locally.
- Reply on a notification: opens a text box, "Post reply" calls `fc_add_comment` with `{item_id, app_id, description}` (plain text). Offer Reply and Draft on every comment and mention notification, not only Needs you. On failure say it may have gone through and to check the task before posting again.
- Draft reply with Claude (notification and modal): `sample(prompt, {modelTier:"quick", cache:false, onText})` streams into the text box. Tell the model to write in first person, 2 to 4 sentences, no em dashes, and not to invent facts. In the modal, include the task title, status, the first 700 characters of the description, the last 5 comments with authors, and the optional instruction. The user edits, then posts.
- Refresh button reloads everything. Show "Updated HH:MM" in the user's timezone.

### Ask next (structured, never a text blob)

Plain streamed text looks unformatted. Use `sample.json(prompt, {modelTier:"default", cache:false})` and render cards. Build a numbered pool of open tasks, send lines like `[3] [TAG] Title | Project | due Aug 25 (50 days overdue) | priority 2`, and ask for JSON only, referencing tasks by `ref` number. Validate every `ref` against the pool and every date against `/^\d{4}-\d{2}-\d{2}$/` and not before today. Disable the Ask buttons while running and show "Claude is thinking...".

- Plan my day: reply `{summary, items:[{ref, why}]}`, at most 5 items. Render a one-line summary and numbered cards: title button (opens the task modal), project, due status, one-sentence reason.
- Suggest dates for my overdue tasks: use the 12 highest priority and most overdue tasks. Reply `{summary, items:[{ref, date, why}]}`, spread over the next 14 days starting tomorrow, at most 3 per day, prefer weekdays. Render cards with the old due date, an editable `<input type="date">` (min today), the reason, and a per-card Apply button. Add a primary "Apply all N dates in Freedcamp" button and the hint "Nothing changes in Freedcamp until you press Apply."
- Apply calls `fc_update_task` with `{task_id, due_date:"YYYY-MM-DD"}` one task at a time, in sequence for Apply all. Show Applying, then a green Applied tag, or the error on the card. Never auto-retry. After any success re-fetch tasks (only the tasks call) and re-render the buckets and tiles. Reading the date input must update state without re-rendering, so focus is not lost.

### Errors

Branch on `error.code`, never one generic message. `server_not_connected` or `server_not_found`: add Freedcamp in Claude Settings, Connectors. `needs_reauth`: reconnect it. `approval_required`, `not_in_manifest`, `consent_required`: allow the page in its permissions. `server_unavailable`, `upstream_error`: try again shortly. Sample errors: `not_granted` means drafting was not allowed, `rate_limited` means wait, `invalid_json` means ask again. Never auto-retry a write.

## Live dashboard: design

Keep the Freedcamp look of the static template: Plus Jakarta Sans and IBM Plex Mono from Google Fonts, accent `#1f6fdb`, one 760px card on a grey page, four count tiles, section bands, round check buttons, pill badges. Define every color as a token on `:root` with dark values under `prefers-color-scheme` (guarded by `:root:not([data-theme="light"])`) and `:root[data-theme="dark"]`. Side gutter `max(16px, env(safe-area-inset-left))`, add the `claude:viewport-fit-sides` meta. Escape every title, name, quote and model answer before inserting it. Give `.modal[hidden]` an explicit `display:none` so it is not overridden by `display:flex`. Never use em dashes in page copy.

## Live dashboard: check

Run `node --check` on the extracted script, confirm the HTML has no leftover sample names or counts, confirm every tool the script calls is in the declared `tools` list, then publish. To update an existing page, republish the same file path with the full capabilities object, because a new tool is not granted unless it is declared. If the Artifact tool is unavailable, fall back to the static template and say the buttons are display only.

## Static dashboard (fallback when the Artifact tool is missing)

Generate one HTML file modelled on `Dashboard.html` (same folder). That file is the spec for layout, styles, and behaviour. Copy its structure, `<helmet>` styles, runtime script tags, and `renderVals` logic. Replace every piece of sample data with real data. Its data is frozen when built and its buttons only copy prompts (see Output below), so say that plainly.

### 1. Gather (in parallel where possible)

1. Session lookup (build it with Step 1 if you have not yet): current user name, timezone, project and group names.
2. `fc_fetch_tasks` with `assigned_to_id: [data.user_id]`, `order_due_date: "asc"`, `limit: 100`, and no `status` filter (see Reports). Drop completed tasks yourself.
3. `fc_fetch_notifications`, decoded as described above.

### 2. Compute (today = today in the user's timezone)

| Bucket | Rule |
|--------|------|
| Overdue | open, due before today. List the most recently due first, as in the template. |
| Due next 7 days | open, due from today through today + 7 days |
| In progress, no due date | status in progress and no due date |
| Waiting on you | notifications in the "Needs you" group (below) |

### 3. Fill the template

| Template part | Source |
|---------------|--------|
| Header subtitle ("Assigned to … · Saturday, Oct 17") | user's full name from `data.users`, today's date |
| Four stat tiles | counts of the four buckets above |
| Task row | `tag`, `title`, `project`, `list`, `priority`, `dueLabel` ("9 days overdue"), `dueDate` ("Oct 8"), `url` |
| "View all N open tasks" | number of open tasks fetched. If the page was full, write "View all open tasks" without a number. |
| Footer "Updated 11:58" | current time in the user's timezone |

Row rules:

- **Tag.** If the title starts with bracketed words, move them into `tag` and strip them from the title: "[FRONTPAGE] Add accept cookies" becomes tag `FRONTPAGE`, title "Add accept cookies". Join several with " · ". No brackets means an empty tag.
- **Priority.** Show Low, Medium, or High. Show nothing for priority none.
- **List** is the task list name.
- **Link.** Use the task's `url` if the response has one, otherwise `https://freedcamp.com/view/<project_id>/tasks/<task_id>`.
- The check button in the template only toggles locally. Leave it as is.

Template parts that are hard-coded and must become dynamic:

- The "Due next 7 days" block only contains the empty message. When tasks exist, render them with the same row markup as the overdue block, and show the empty message ("Nothing else is due through Sat, Oct 24.") only when there are none.
- The tile numbers for Due next 7 days, In progress, and Waiting on you, the "In progress · no due date · 2" label, "View all 39 open tasks", and the footer time.
- Show the first 5 overdue tasks, then a "Show N more overdue" button, as the template does.

### 4. Notifications block

Chips are All, Needs you, FYI, each with a count.

- **Needs you:** the newest comment on the item is by someone else and contains a question: a `?` at the end of a sentence, after removing URLs (a `?` inside a link such as `...?f_test=1` is not a question). This is not the same as section `response`, which only means a reply was received. They get the "No reply yet" label and the Reply and "Draft reply with Claude" buttons.
- **FYI:** everything else.

Before choosing a type, ignore empty edits (action 2 with no `changed_properties`): they are untracked changes and hide real ones.

Choose the row type in this order (inferred from the template and real data):

| Order | Type | When | Verb text |
|------:|------|------|-----------|
| 1 | comment (Needs you) | question rule above | "asked a question on a task"; quote = comment text |
| 2 | mention | a comment by someone else contains `class="fc_mention"` with `data-id` equal to the user's id | "mentioned you" |
| 3 | event | calendar app (19) | "added a calendar event" if the item has an action 1, otherwise "updated a calendar event" |
| 4 | complete | any action 21 whose new status is Completed. Use that action's user and time, not the newest action's. | "completed a task assigned to you" if the section is `assigned`, otherwise "completed a task" |
| 5 | reassign | newest meaningful action is 4 | "took over a task from you" if the old assignee is the user, otherwise "reassigned a task to <new name>" |
| 6 | comment | newest action is 9 | "commented on a task" |
| 7 | edit | anything else | "updated the description of a discussion", "moved a task to <list>" and similar |

The template has no `edit` row type. Add one: an `edit` entry in the `tone` map (accent colours), an `isEdit` flag in the `inbox` mapping, and a pencil icon `sc-if` block next to the other icons. Do not use an unknown type, because `tone[n.type]` would throw and blank the whole page.

For any type except event, show the newest comment as the quote when the item has one, even on a "completed" row (for example a "Rocky Linux" migration comment on a completed task). Strip zero-width characters from the text.

Row text: `who` is the acting user's name, `item` is the item title, `project` is the project name, `when` is a short date such as "Sep 4" in the user's timezone. Link per the Links rule above. Sort Needs you first, then newest first. Show all notifications unless the user asks for fewer.

There is no `due` row type for notifications: the template's sample "added a due date" row did not exist in real data.

### 5. Output

- Produce a single HTML file. Show it as an artifact if the client can render one. Otherwise save it as `freedcamp-focus.html` in the working directory and tell the user to run `open freedcamp-focus.html` (macOS) or open the file in any browser. Give the full path.
- **Buttons.** A saved file is a plain web page: it cannot message Claude, so no button may pretend to. Keep the template's behaviour:
  - Refresh, "Draft reply with Claude" and the three "Ask next" chips copy a ready-to-paste prompt to the clipboard and show the toast "Prompt copied. Paste it into Claude." Keep the `copyPrompt` helper and the `toast` state.
  - Reply is a link that opens the item in Freedcamp in a new tab.
  - Tell the user this in your reply: "To use a button, click it, then paste into Claude."
  - Do not add a button without a handler.
- Escape all task titles, names, and quotes before inserting them. They are user content.
- Leave no sample data behind (Aug/Sep sample tasks, "Angel Grablev", fixed counts).
- Keep the `dark` prop and both colour themes intact.
- If there are no overdue tasks, no tasks due, or no notifications, show the template's empty states instead of blank blocks.

## Create tool fallback

If the specific create tool is unavailable, `fc_add_item_by_names` takes `project_name`, `app_name`, and `title` directly. It only creates a titled item, so use it only when no richer tool fits.

## After acting

Reply with what was created and where, in names: "Added task *Write brief* to *Marketing Campaign* (Main AI Group)." Include IDs only if the user asks.

**Always give the user the link.** `fc_add_task` returns the new task at `data.tasks[0]`, and that object has a `url`. Put that URL in the reply so the user can open the task:

> Added task *Write brief* to *Marketing Campaign* (Main AI Group): <data.tasks[0].url>

If the response has no `url`, say the task was created and do not invent a link.
