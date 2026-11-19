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

For recurring updates, the user can schedule this with `/loop` or `/schedule` (for example "every morning at 9").

## Dashboard: "Your focus today"

When the user asks for a dashboard, "my focus", or a visual daily overview, build the page from `dashboard-spec.md` in this folder. No page ships with this skill: you write it each time. Read the whole spec before writing anything. It fixes the layout, colours, copy and behaviour, so follow it instead of designing your own page.

Tell the user up front that building the page takes a few minutes.

### Live dashboard (the Artifact tool is available)

The page reads Freedcamp itself when it opens and can open tasks, complete them, post comments, draft replies with Claude and apply suggested due dates.

1. Do not fetch tasks or notifications in the conversation to bake into the page. The page fetches its own data.
2. Write the page to a file named `focus-today.html`, following sections 1 to 12 of `dashboard-spec.md`.
3. Run the checks in section 13 of the spec.
4. Publish the file with the Artifact tool, `icon: "checklist"`, and exactly these capabilities:

```json
{"mcp": {"servers": [{"server": "Freedcamp", "tools": ["fc_fetch_current_session", "fc_fetch_tasks", "fc_fetch_task", "fc_fetch_notifications", "fc_update_status", "fc_update_task", "fc_add_comment"]}]}, "sample": {}}
```

5. Name the page "Your Focus Today". Do not paste the URL, the app shows a card.
6. Tell the user in two or three sentences: what the page does, that Claude will ask them to allow the Freedcamp connection and Claude drafting on first use, and that completing a task, posting a comment and applying a due date write to the real account. Say it was not exercised in a browser unless it was.

The page needs a connector named "Freedcamp" in the viewer's Claude account. If the viewer sees "No matching connector found", they add it in Claude Settings, Connectors.

To change a published page, edit the same file and publish it again from the same path with the full capabilities object, because a tool is not granted unless it is declared.

### Static dashboard (the Artifact tool is missing)

Follow section 14 of `dashboard-spec.md`: the same page with the data baked in. Its data is frozen when it is built and its buttons only copy prompts, so say that plainly.

## Create tool fallback

If the specific create tool is unavailable, `fc_add_item_by_names` takes `project_name`, `app_name`, and `title` directly. It only creates a titled item, so use it only when no richer tool fits.

## After acting

Reply with what was created and where, in names: "Added task *Write brief* to *Marketing Campaign* (Main AI Group)." Include IDs only if the user asks.

**Always give the user the link.** `fc_add_task` returns the new task at `data.tasks[0]`, and that object has a `url`. Put that URL in the reply so the user can open the task:

> Added task *Write brief* to *Marketing Campaign* (Main AI Group): <data.tasks[0].url>

If the response has no `url`, say the task was created and do not invent a link.
