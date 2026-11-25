---
name: "onboarding"
description: "First-run wizard for the Freedcamp plugins. Use when ./.freedcamp/heartbeat.md does not exist yet, when the heartbeat or dashboard skill hands off here, or when the user says 'set me up', 'onboard me', 'get to know me', 'redo onboarding' or 'start the Freedcamp agent'. Reads as much of the user's Freedcamp account as a fixed call budget allows, works out who they are and what they work on, checks those assumptions and asks what help they want with interactive multiple-choice questions (AskUserQuestion), writes heartbeat.md and memory.md, has the user pick a check-in interval and start the /loop now, then offers to plan their day."
---

# Freedcamp onboarding (first run)

This skill runs once per working folder. It learns who the user is from Freedcamp, asks about their goals, and leaves two small files behind so every later loop tick knows what to do.

Flow: (a) deep dive into Freedcamp, (b) interview that checks your assumptions, (c) ask if they want help and with what, then save heartbeat.md and memory.md, (d) pick the check-in interval, (e) start the loop now, (f) publish the dashboard artifact and give the claude.ai link (in-chat fallback when the Artifact tool is missing), then offer to plan the day.

Posture: offer, never take over. Nothing is written to Freedcamp in this skill. Files are written only to the local state folder, and only after the user confirms.

## State location

All state lives in the folder Claude Code was started in (the user's working directory):

```
./.freedcamp/heartbeat.md   the agent's long-lived role: who this is, goals, how I help
./.freedcamp/memory.md      today's state: focus task IDs, offers, picks, last check
```

- Create `./.freedcamp/` if it is missing.
- If the working folder is a git repo, offer once to add `.freedcamp/` to its `.gitignore`. Do it only on a yes.
- The files hold IDs, names and short sentences. Never store task descriptions, comment text, emails or any token in them.

## Step 0: First run check

1. Look for `./.freedcamp/heartbeat.md`.
2. **Missing:** this is a first run. Continue with Step 1.
3. **Present:** onboarding already happened. Say "You're already set up. Want me to redo onboarding, or just run a check-in?" On "check-in", hand off to the `heartbeat` skill. On "redo", keep the old file as `./.freedcamp/heartbeat.prev.md` and continue with Step 1.

## Step 1: Greet

Say exactly this, then one line on what happens next:

> Hey, let me get a better understanding of things.
> I'll read your Freedcamp account for a minute (projects, people, your tasks and recent updates). I won't change anything.

Tools may be deferred. If a tool schema is not loaded, load it with `ToolSearch` (`select:<tool name>`) before calling.

## Step 2: Deep dive (budget: 50 calls)

Keep a running count of Freedcamp calls. **Hard stop at 50.** If a step would go over, skip the rest of it and say in the summary what was skipped. Never retry a failed call more than once.

Every call goes to the MCP server named `Freedcamp`. Never print raw HTML descriptions or comments. Ids arrive as strings or numbers, so compare them as strings.

| # | Call | Budget | Keep |
|---|------|-------:|------|
| 1 | `fc_fetch_current_session` with `{}` | 1 | `data.user_id` (the user), `data.users` (`user_id`, `full_name`, `first_name`, `email`, `timezone`), `data.groups`, `data.projects` (`project_id`, `project_name`, `group_id`, `applications`, `archived_ts`). Skip archived projects. |
| 2 | `fc_fetch_recent_project_ids` with `{}` | 1 | Project IDs, most recent first. Drop IDs not in `data.projects`. Keep the top 5. |
| 3 | `fc_fetch_tasks` assigned to the user | up to 5 | `{ filters: { assigned_to_id: [userId], order_priority: "desc", order_due_date: "asc" }, limit: 100, offset: 0 }`, then `offset` 100, 200 while `meta.has_more` is true. Stop at 5 pages (500 tasks). Never send a `status` filter (HTTP 400). Drop `status` 1 (completed) and 3 (invalid) yourself. |
| 4 | `fc_fetch_tasks` created by the user | up to 2 | `{ filters: { created_by_id: userId, order_due_date: "asc" }, limit: 100 }`. Same open-status rule. Shows what they delegate. |
| 5 | `fc_fetch_tasks` per recent project | up to 5 | One call per top-5 recent project: `{ project_id, limit: 100 }`. Count open tasks per assignee to see who works where. |
| 6 | `fc_fetch_task` for the top tasks | up to 15 | `{ task_id }` for the 15 most urgent open tasks (overdue first, then high priority, then soonest due). Keep `description_processed` only long enough to judge clarity, plus `comments` (author, `created_ts`), `children`, `assigned_to_fullname`, `list_title`. |
| 7 | `fc_fetch_notifications` with `{}` | 1 | `data.notifications` (last 60 days the user follows). This is the task history: each entry's `actions[]` (oldest first) has `action_type`, `action_ts`, `user_id`, `changed_properties`. Note the newest `action_ts`. |
| 8 | `fc_fetch_notifications_by_project` | up to 5 | Optional. `{ project_id }` for each top-5 recent project, for history on items the user does not follow. Skip if the budget is tight. |
| 9 | `fc_fetch_overview` | up to 5 | Optional. `{ project_id }` for each top-5 recent project. If it errors or returns nothing useful, skip the rest of this row. |

Total planned: at most 40, leaving 10 for one retry each on failures and for the dashboard handoff.

Fallbacks:
- If `fc_fetch_current_session` fails, try `fc_get_groups_projects` with `{}` for projects and `fc_fetch_current_user` for the user. If both fail, stop and say: "I can't reach Freedcamp. Check that the Freedcamp connector is added in Claude Settings, Connectors, then run this again."
- If a later call fails, note it and continue. Do not stop the wizard for one failed call.

Dates: `due_ts` is midnight in the user's timezone. Convert with the user's `timezone` before counting days overdue. Using the UTC date is one day off.

When the dive ends, tell the user in one line: "Done. I looked at N tasks across M projects and K recent updates." Add one more line only if something was skipped.

## Step 3: Work out who the user is (no questions yet)

Work this out from the data. Do not show it as a wall of text; Step 4 turns it into questions.

1. **Role.** From the kinds of tasks they own and create, and who they assign to. Examples: founder or CEO (creates many tasks for others, plan and strategy lists), developer (build, bug, PR wording), marketer (content, social, campaign, SEO), support, operations.
2. **Active projects.** Top 3 to 5 by a mix of recency (step 2) and open tasks assigned to them. Use project names, never bare IDs.
3. **Kinds of work.** Group open task titles and list names into 2 to 5 themes, e.g. marketing content, development, planning, hiring, support. Count tasks per theme.
4. **Collaborators.** The people who appear most in their notifications (`user_id` on actions) and comments, and the people they assign tasks to. Top 5 by name.
5. **Load.** Open tasks assigned, overdue count, due in the next 7 days, in progress, review.
6. **Vague tasks.** A task is vague when its title is short (about 5 words or fewer) and its description is empty or unclear, and nothing in its comments or history explains it. Keep up to 5 task IDs.
7. **Where help fits.** For each theme, one plain sentence on how an agent could help. Example: "This person does a lot of marketing, so I can help with research, finding new topics and competitor research."

## How to ask questions in this skill

Use Claude Code's question tool, `AskUserQuestion`, for every question from Step 4 on. It shows multiple-choice questions in the CLI and the desktop app, and the user can always type their own answer through "Other" or the notes field, so never add your own "Other" option.

Limits (from the Claude Code docs):

- 1 to 4 questions per call. Questions in one call are answered together, so put questions in the same call only when they do not depend on each other.
- 2 to 4 options per question. Each option has a short `label` and a `description`.
- `header`: a short label shown with the question, 12 characters at most (for example "Your role", "Projects", "Check-ins").
- `multiSelect: true` lets the user pick several options.
- The tool needs no permission, and none of this plugin's skills restrict tools with `allowed-tools`, so it is always allowed here. A sub-agent with a `tools` list must include `AskUserQuestion` to use it.

Write each question as a statement of what you inferred plus a check, using names and numbers from the data. Option labels are short; put detail in the description.

**Fallback.** If `AskUserQuestion` is not available (for example on claude.ai, or in a run with no one to answer), ask the same questions as plain text, **one per message**, with the options as a numbered list, and wait for each answer.

If the user picks "Other" or types a correction, use their words. Ask at most one follow-up per question. If they say "skip" or "that's enough", stop asking and use what you have.

## Step 4: Check your assumptions (interview)

One `AskUserQuestion` call with these four questions:

1. header "Your role": "It looks like you mostly do {theme} work across {project A} and {project B}. Is that right?"
   - "Yes, that's right": "{theme}, mainly in {A} and {B}"
   - "Mostly {theme 2}": "{theme 2} is the bigger part ({n} tasks)"
   - "A mix": "{theme} and {theme 2} about equally"
2. header "Projects", `multiSelect: true`: "These look like your main projects right now. Which ones matter most?" Options: the top 3 or 4 active projects by name, each with a description like "{n} open, {n} overdue".
3. header "Workload": "You have {n} open tasks: {n} overdue and {n} due this week. How does that feel?"
   - "About right": "That's my real plate"
   - "Too much": "Help me cut it down"
   - "Some aren't mine": "Old or stale tasks need cleaning up"
4. header "Goals", `multiSelect: true`: "What are you aiming for in the next few weeks?" Options: 3 or 4 goals inferred from the themes and due dates, e.g. "Ship {milestone}", "Grow {channel}", "Clear the overdue pile". The user can type their own.

Then ask "Who do you work with most?" only if the collaborators are unclear, in a second call with header "People" and up to 4 names as options (`multiSelect: true`).

Fix anything they correct. Then say in one line what you now understand, e.g. "Got it: marketing lead, focused on Marketing Campaign and Social, aiming to ship the launch."

## Step 5: Ask if they want help, and with what

One `AskUserQuestion` call:

1. header "Help": "Want me to keep an eye on your work and offer help?"
   - "Yes, check in": "Regular check-ins with offers I can take on"
   - "Only on request": "I'll ask when I need something"
   - "Not now": "Skip the agent for now"
2. header "Help with", `multiSelect: true`: "Where would help save you the most time?" Up to 4 options tied to their themes, for example "Research" ("competitors and topics for {project}"), "Drafting" ("briefs, replies, descriptions"), "Tidy tasks" ("{n} vague tasks need clearer descriptions"), "Chase updates" ("{n} people are waiting on replies").
3. header "Never do": "Anything I should never do? I already never change Freedcamp or start work without your yes."
   - "Nothing else": "The defaults are fine"
   - "Quiet hours": "No check-ins outside work hours"
   - "Leave a project": "Don't touch a specific project (type which)"

If they pick "Not now", still write the files in Steps 6 and 7 (so later runs know them), skip Steps 8 and 9, and go to Step 10.

## Step 6: Write heartbeat.md (confirm first)

1. Fill `templates/heartbeat.md` from this folder with what you learned in Steps 3 to 5.
2. "how I help" is plain sentences, one kind of work per line, tied to what they actually do. Examples:
   - "Marketing: research new topics, research competitors, draft the content calendar."
   - "Development: summarize review threads, flag stale tasks."
   - "Planning: ask about vague tasks and offer to rewrite the description."
3. "offer each tick" is at most 5 standing offers the heartbeat checks against current work.
4. Show the full draft, then ask with `AskUserQuestion`, header "Save", "Should I save this as .freedcamp/heartbeat.md?", options "Save it" and "Change something".
5. Write the file only on "Save it". On changes, apply them and ask again.

## Step 7: Create memory.md

If `./.freedcamp/memory.md` does not exist, create it from `templates/memory.md`:

- `plan_date`: today in the user's timezone.
- `focus_task_ids`: empty for now. Step 10 fills it if the user saves a plan or picks tasks.
- `last_check` and `last_checkin`: now, ISO 8601 with the user's UTC offset.
- `last_notification_ts`: the newest `action_ts` seen in Step 2, so the first tick only reports new activity.
- `last_notification_id`: the `uid` of that newest notification (or `app_id` and `item_id` joined with an underscore when `uid` is missing). It is a marker, not an ordered number; the heartbeat compares timestamps.

If memory.md already exists, leave it and say so. Do not overwrite it.

## Step 8: Pick how often to check in

Never hardcode an interval. Ask with `AskUserQuestion`, header "Check-ins":

"How often should I check in on your Freedcamp work?"

| Label | Description |
|---|---|
| Every 10 minutes | Fast moving days |
| Every 15 minutes | A good default |
| Every hour | Light touch |
| Every 3 hours | A few times a day |

For a custom period the user types it through "Other", for example "30m" or "2h". Turn it into minutes (`m`) or hours (`h`).

Fallback without the tool: the same five choices as a numbered list, with "Custom (tell me the period, like 30m or 2h)" as number 5.

## Step 9: Start the loop now

Give the exact command for their choice and ask them to run it **right now**, as their next message, so check-ins keep coming after onboarding ends:

| Choice | Command |
|---|---|
| 10 minutes | `/loop 10m /freedcamp-onboarding:heartbeat` |
| 15 minutes | `/loop 15m /freedcamp-onboarding:heartbeat` |
| 1 hour | `/loop 1h /freedcamp-onboarding:heartbeat` |
| 3 hours | `/loop 3h /freedcamp-onboarding:heartbeat` |
| Custom | `/loop <period> /freedcamp-onboarding:heartbeat`, with their period |

Say it like this, filled in:

> Run this now so I keep checking in after we're done here:
> `/loop 15m /freedcamp-onboarding:heartbeat`
> Each check-in reads .freedcamp/heartbeat.md and .freedcamp/memory.md, looks at your focus tasks and new updates, refreshes your board and gives you its link. When nothing changed it posts one line: "No new updates. Board: <link>". The loop runs while this Claude Code session is open (or backgrounded) and stops after 7 days; run the command again to restart it.

`/loop` is a command the user types; you cannot start it for them. If the user does not want a loop, say they can run `/freedcamp-onboarding:heartbeat` by hand whenever they like.

## Step 10: Publish the dashboard, then offer to plan the day

This step always runs, right after Step 9. It does not wait for a choice.

1. **Publish the dashboard.** Follow "Publish the dashboard artifact" below. When the Artifact tool is available, publish and give the user the claude.ai link. When it is not, say so in one line (the notice in that section) and continue in the chat.
2. **Offer the plan.** Ask with `AskUserQuestion`, header "Today": "Want me to plan your day now?"
   - "Plan my day": "A realistic plan for today, here in the chat"
   - "Not now": "Finish onboarding"

- **Plan my day:** write the plan in the chat as "Plan my day" in the `heartbeat` skill describes (`../heartbeat/SKILL.md`), using the data from Step 2. Do not make new Freedcamp calls for it unless a task needs a fresh look and the 50-call budget allows. If the dashboard was published, end with: "Your dashboard has the same tasks with buttons: <url>."
- **Not now:** finish with one line: "You're set. Say 'plan my day' any time." Add the dashboard link again if there is one.

If the user saves focus tasks from the plan, write them to memory.md as "Saving picks" in the `heartbeat` skill describes. If they ask in chat for help with one task, follow "Help with a task" in the `heartbeat` skill. The dashboard does both on the page itself.

## Publish the dashboard artifact

This section is self-contained, so onboarding works without the `freedcamp-live-dashboard` plugin.

**What it is.** A claude.ai artifact, "Your Focus Today". Claude Code's Artifact tool publishes it to a private page on claude.ai and returns its URL. Inside the page, `claude.use('mcp')` reads and writes Freedcamp through the viewer's claude.ai connector (`mcp.callTool('Freedcamp', tool, input, { cache: false })`), and `claude.use('sample')` lets the page ask Claude to draft replies and suggest a plan or dates. Every button acts on the page itself: checkboxes, Approve and Ignore are picks, Confirm marks the picked tasks In progress in Freedcamp, "Help with this" drafts and saves descriptions, comments, subtasks and assignees, and offers draft their job and post it as a comment, each after the user clicks the button that names the change.

**Is the Artifact tool available?** Check it this way, every time, before deciding:

1. Look in your tool list for a tool named exactly `Artifact`. It is a built-in Claude Code tool, not an MCP tool, so it has no `mcp__` prefix.
2. If it is not in the list, run `ToolSearch` with `select:Artifact` in case it is deferred.
3. Only if both come up empty is it unavailable. Do not guess from the environment, and do not skip the publish because the page takes a while to build.

When it is unavailable, tell the user in one line, then use the in-chat fallback: "I can't publish the interactive page here: the Artifact tool isn't in this session. Claude Code turns it off without a claude.ai login (`/login`), on Bedrock, Vertex or Foundry, in `-p` runs, and when `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` is set (check the `env` block in `~/.claude/settings.json`)."

**When it is available:**

1. Say "Building your dashboard, this takes a few minutes."
2. Read `${CLAUDE_PLUGIN_ROOT}/skills/onboarding/dashboard-spec.md` in full. Write `focus-today.html` following sections 1 to 12, including the picks controls in section 9a. Do not fetch tasks to bake in; the page loads its own data. Fill its `fc-session` block from `./.freedcamp/memory.md`: `focus_task_ids`, `ignored_task_ids`, pending `offers` (`n`, `job`, `task_ids`), and `checkin` lines if any (else empty values). Also fill `recommended` (spec section 9a), at most 8 `{ "id", "reason" }` entries, worked out from the Step 2 data with no extra calls: the 3 to 5 tasks you would put in today's plan, chosen as "Plan my day" in the `heartbeat` skill does ("in today's plan"), overdue tasks worth doing today ("overdue, do today"), and tasks tied to your offers, such as vague tasks you offered to clarify ("I offered to help"). If the user later picks "Plan my day", republish with the plan's tasks first in `recommended`.
3. Run the checks in section 13 of the spec.
4. Publish `focus-today.html` with the Artifact tool, `icon: "checklist"`, title "Your Focus Today", and exactly these capabilities:

   ```json
   {"mcp": {"servers": [{"server": "Freedcamp", "tools": ["fc_fetch_current_session", "fc_fetch_tasks", "fc_fetch_task", "fc_fetch_notifications", "fc_update_status", "fc_update_task", "fc_add_comment", "fc_add_task"]}]}, "sample": {}}
   ```

   `server` is the name of the user's claude.ai connector (Claude Settings, Connectors), not this plugin's `.mcp.json` key; the published page cannot call local MCP servers. The repo's dashboard has always used "Freedcamp". If the publish warns that the declared tools do not match the connector, ask the user for the connector's exact name and publish again with it. Never drop a tool the page calls: a tool that is not declared is refused.
5. Give the user the link the Artifact tool returned (a `https://claude.ai/code/artifact/...` address; Claude Code also opens it in the browser): "Your dashboard: <url>. Open it in claude.ai to use the buttons." In an app that shows the artifact as a card, the card is the link. Never make up a link.
6. Save the URL as `dashboard_artifact_url` in `./.freedcamp/memory.md`.
7. Add two sentences: claude.ai asks them to allow the Freedcamp connector and Claude drafting on first use; every button acts on the page itself, the way "Plan my day" does: completing a task, posting a comment, applying a date, "Help with this" (description, comment, subtasks, assignee, plan) and Confirm (marks picked tasks In progress) change their real Freedcamp account, each only after they click the button that names the change.

**When it is unavailable:** after the one-line notice above, do not write a local page. Give the answer in the chat as the spec describes, with no artifact: the plan from "Plan my day" in the `heartbeat` skill, then collect focus picks with `AskUserQuestion` (one multi-select question, header "Focus", the 4 most urgent tasks as options; the user can type others) and save them as "Saving picks" in the `heartbeat` skill describes.

## Rules

- **Offer, don't take over.** Every action beyond reading is an offer. Wait for a yes.
- **No Freedcamp writes in this skill.** No `fc_add_*`, `fc_update_*`, `fc_edit_*`, `fc_delete_*` or `fc_batch_*` calls. If the user asks for a change during onboarding, confirm the exact change, then do it only after an explicit yes, as a separate step.
- **Budget.** Never more than 50 Freedcamp calls in one onboarding run.
- **Privacy.** Never print task descriptions or comment HTML. Summarize. Never write descriptions, comments, emails or tokens into the state files.
- **Never guess an ID.** Every ID comes from a tool result.
- **Questions.** Use `AskUserQuestion` from Step 4 on (1 to 4 questions per call, 2 to 4 options each, headers of 12 characters or fewer). Plain text, one question per message, only where the tool is missing.
- **Copy style.** Short sentences. No em dashes or en dashes in anything shown to the user.
