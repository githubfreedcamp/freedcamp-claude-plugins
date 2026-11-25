---
name: "heartbeat"
description: "One Freedcamp check-in, run on every loop tick (for example '/loop 15m /freedcamp-onboarding:heartbeat') or by hand. Use when the user runs the heartbeat, asks for a check-in, 'anything new?', 'how am I doing on today's tasks', wants the agent to offer help with current work, asks to 'plan my day', or asks for help with one task. Reads ./.freedcamp/heartbeat.md and ./.freedcamp/memory.md, checks the focus tasks and new notifications, offers at most 3 sub-agent jobs tied to Freedcamp task IDs, writes a Claude-generated plan for the day on request, pushes a fresh claude.ai dashboard artifact on every tick and gives its link, updates memory.md, and keeps a tick with nothing new to one short line."
---

# Freedcamp heartbeat (one loop tick)

The heartbeat is the main plugin's tick. It stays simple: look, summarize, check in, offer. It never does specialist work itself and never writes to Freedcamp without an explicit yes.

State lives in the user's working directory (see the `onboarding` skill):

```
./.freedcamp/heartbeat.md   who this is, goals, how I help, standing offers, never do
./.freedcamp/memory.md      focus_task_ids, projects, offers, selected_tasks, dashboard_artifact_url, last_check
```

Other requests this skill handles:

- **"Plan my day"** (or "what should I do today"): go to "Plan my day" below.
- **"Show my dashboard" / "open it as a page":** go to "Dashboard page" below.
- **Help with one task, asked in chat:** go to "Help with a task" below. On the dashboard, "Help with this" does this on the page itself.

Tools may be deferred. If a tool schema is not loaded, load it with `ToolSearch` (`select:<tool name>`) before calling. All calls go to the MCP server named `Freedcamp`.

**Budget per tick: 20 Freedcamp calls.** Stop there and say what was skipped. Publishing the dashboard (Step 5a) is not a Freedcamp call: the page fetches its own data in the viewer's browser through their claude.ai connector, and its `fc-session` block is filled only from memory.md and what this tick already fetched. So the board adds no calls to the cap.

## Step 1: Route

1. If `./.freedcamp/heartbeat.md` is missing, say "Looks like we haven't been set up yet. Want to run onboarding first?" On a yes, hand off to the `onboarding` skill (`/freedcamp-onboarding:onboarding`). On a no, stop. Do not do a check-in without a heartbeat.
2. If `./.freedcamp/memory.md` is missing, create it from `../onboarding/templates/memory.md` with empty IDs, `last_notification_ts` 0 and today's `plan_date`, and say so in one line.

## Step 2: Read the files

1. Read `heartbeat.md`: goals, main projects, "how I help", "offer each tick", "never do".
2. Read `memory.md`: `plan_date`, `focus_task_ids`, `ignored_task_ids`, `projects` (with `agent_tasks`), `offers`, `selected_tasks`, `dashboard_artifact_url`, `last_notification_ts`, `last_notification_id`, `last_checkin`. If a section from the template is missing, add it with empty values.
3. **New day:** if `plan_date` is before today (user's timezone), move yesterday's unfinished focus IDs into the check-in as "carried over" and ask "Want me to plan your day?" On a yes, follow "Plan my day" below. Do not clear the IDs until the user picks new ones.

## Step 3: Fetch

1. `fc_fetch_current_session` with `{}` once, for `user_id`, the user's `timezone`, and project and user names. Reuse it for the whole tick.
2. `fc_fetch_task` with `{ task_id }` for each ID in `focus_task_ids` plus `agent_tasks`, at most 10. Keep `status`, `status_title`, `due_ts`, `title`, `comments` (count and newest `created_ts`), `children` statuses. A task that errors or is gone: note it, and offer to drop the ID.
3. `fc_fetch_notifications` with `{}`. Keep only notifications with at least one action whose `action_ts` is greater than `last_notification_ts`, and only those actions. Order by section: `assigned`, `mentioned`, `response`, `involved`, `other`. Use `uid` (or `app_id` and `item_id` joined with an underscore) only to avoid listing the same item twice.
4. On the first tick of the day, and on any tick when `dashboard_artifact_url` is set (the board may have saved picks), if budget allows: `fc_fetch_tasks` with `{ filters: { assigned_to_id: [userId], order_due_date: "asc" }, limit: 100 }` to catch newly overdue work and board picks. Never send a `status` filter. Drop `status` 1 and 3. **Board picks:** the board's Confirm marks picked tasks In progress in Freedcamp (spec section 9a). Add assigned tasks with `status` 2 that are not in `focus_task_ids` or `ignored_task_ids` to `focus_task_ids`, and say once: "Added from your board: <titles>." The board's Ignore is not saved anywhere Claude can read.

Dates: `due_ts` is midnight in the user's timezone. Convert before counting days overdue.

## Step 3b: Pick up "Work on it" requests

Run this every tick, right after Step 3. It uses the Step 3 results and at most 4 extra `fc_fetch_task` calls, inside the 20-call budget. Step 3.4's task list is needed here, so run it on every tick that has budget for it.

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

## Step 4: Decide how much to say

Every tick posts something and pushes the board (Step 5a). This step decides between a friendly check-in (Step 5) and one short line.

Give the friendly check-in when at least one is true:

- There are open focus tasks (`focus_task_ids` with status other than 1).
- `## agent_activity` in memory.md has an entry that is `running` or `needs_you`, or was updated after its `reported` time (Step 5.2), or Step 3b started new work.
- A focus or agent task changed status, got a new comment, or became overdue since `last_checkin`.
- There is a new `assigned`, `mentioned` or `response` notification.
- It is a new day (Step 2.3).
- An offer in Step 6 matches work that was not offered in the last 24 hours (check `offers` in memory.md).

**Only when none is true is it a quiet tick.** Skip Steps 5 and 6, still do Step 5a, and post exactly one line: "No new updates. Board: <url>". Without the Artifact tool the line is just "No new updates." Then update memory.md (Step 7).

## Step 5: Check in (friendly)

Talk like a helpful teammate: short, warm, the point first, no wall of text. About 12 lines at most before any offers. Use only data from Steps 2 and 3 and memory.md; this step makes no extra Freedcamp calls.

**1. Nudges (at most 3).** Pick open focus tasks in this order: overdue, due today, stale (no status change or new comment for more than 24 hours), then the rest. Skip a task nudged in the last 2 hours (`nudged` in memory.md) unless it became overdue since. One line each, with a short reason:

> Hey, how's **[Write brief](<url>)** going? It's 2 days overdue.
> **[Fix login bug](<url>)** is due today. Still on track?

**2. Helpers.** If `## agent_activity` has entries that are `running`, `needs_you`, or updated after their `reported` time, write:

> Here's what I've been working on with the helpers you asked for:
> 1. Researcher, "research 3 competitors" for Write brief: done. Compared 3 tools, draft comment ready. Needs you: approve the comment.
> 2. Project manager, "overdue triage": still running (started 14:05).
> 3. Work on it, Fix login bug: started 15:02 from your board. Reproduced the bug, testing a fix. Progress is on the task.

One line per entry: the agent, the job, the task title, the status, the `result`, and "Needs you: ..." when `needs_you` is set. Also fold in any background agent result that arrived in this conversation since the last tick: if its entry in memory.md was not updated, update it first (status, one-line result). Never paste the full research here; offer to show it.

**3. What's new.** Then the updates, numbered, only when there are any:

> New since 14:15:
> 1. Write brief is now overdue (2 days).
> 2. Dima mentioned you on Launch plan (Marketing Campaign).
> 3. Ana moved Fix header to Completed.

**4. Offers** (Step 6), then end with "Board: <url>" from Step 5a.

**5. Quick status question.** After the message, if any nudge was posted, ask with `AskUserQuestion`: one question per nudged task (at most 3 in one call), header "Status", question "How's <title> going?", single choice, options "Done", "In progress", "Blocked", "Reschedule" (the built-in "Other" lets them type). Without the tool, end with one line: "Reply like 1 done, 2 blocked: 1 Done, 2 In progress, 3 Blocked, 4 Reschedule." Handle the answers:

- Done: "Want me to mark <title> Completed in Freedcamp?" Change it with `fc_update_status` only on a yes.
- In progress: note it, nothing else.
- Blocked: "What's blocking it?" Offer to draft a comment or a helper job (Step 6). Post nothing without approval of the exact text.
- Reschedule: suggest a date and change it with `fc_update_task` only on a yes to that exact date.

These follow-up calls count toward the 20-call budget.

Rules for the whole check-in:

- Names, not IDs. Link tasks as the task's `url`, or `https://freedcamp.com/view/<project_id>/tasks/<task_id>`.
- Never print description or comment HTML. Strip HTML and cut a comment to about 160 characters if you quote it.
- If a mention is a direct question, offer: "Want me to draft a reply?" Post nothing without a yes and the user's approval of the exact text.

## Step 5a: Push the board (every tick)

Every tick, quiet or not, after Steps 2 and 3 (and Steps 5 and 6 when they run), refresh the dashboard artifact and give the link. This overrides any older "no republish on a quiet tick" rule.

1. **Check the Artifact tool** as "Dashboard page" describes. If it is unavailable, skip to step 5 below.
2. **Refresh the `fc-session` values:** `generated_at` now; `checkin` the "What's new" lines you posted this tick (on a quiet tick, one line: "No new updates since <HH:MM of last_check>."); `nudges` the nudges you posted, as `{ "id", "text" }`; `agent_activity` the `## agent_activity` entries that are not `done`, or were updated in the last 24 hours (newest first, at most 8), as `{ "agent", "job", "task_ids", "status", "result", "needs_you", "updated" }`; `focus_task_ids` and `ignored_task_ids` from memory.md; `offers` the latest pending ones; `recommended` rebuilt as "Dashboard page" step 1 says, using this tick's fetch (open focus tasks when `plan_date` is today get "in today's plan", focus or agent tasks now overdue get "overdue, do today", tasks tied to pending offers get "I offered to help"). Use no other data, and make no extra Freedcamp calls for it.
3. **Publish a fresh board.** Write `focus-today.html` from the spec (sections 1 to 13) with these values and publish it as a new artifact, as "Dashboard page" steps 2 and 3 describe. Do this every check-in; it is fine if the link changes. Save the URL the tool returns as `dashboard_artifact_url` in memory.md, replacing the old one. Never make up a link.
4. **Give the link:** end the tick's message with "Board: <url>" (the quiet line in Step 4 already has it). Where the app shows the artifact as a card, the card is the link.
5. **No Artifact tool:** follow the spec's Output rule. Do not write a local page; keep the user posted in the chat every tick (the friendly check-in, or the one-line quiet message from Step 4). Say why there is no board (the one-line notice in "Dashboard page") once per conversation, not on every tick.

## Step 6: Offer help (max 3)

Match the "how I help" and "offer each tick" lines in heartbeat.md against current work: open focus tasks, `agent_tasks`, tasks due this week, new assignments, vague tasks.

1. Pick **at most 3** specific jobs. Each one names the work and the Freedcamp task IDs it is tied to:
   > I can help with these:
   > 1. Research 3 competitors for "{task title}" (task {id}).
   > 2. Draft the content brief for "{task title}" (task {id}).
   > 3. "{task title}" (task {id}) is a bit vague. Tell me more and I'll suggest a clearer description.
   >
   > Want me to start any? Reply with the numbers.

   The same offers show on the dashboard with "Start" and "Dismiss". Start drafts the job on the page and posts it as a Freedcamp comment only after the user clicks to post; it cannot launch a sub-agent, so a yes to a sub-agent job still comes from the chat.
2. Skip any job offered in the last 24 hours that got a no or no answer.
3. A vague task (short title, empty or unclear description, nothing in comments) gets the clarifying offer: "Hey, can you tell me a little more about this task? I'll update the description to make it easier for everyone involved to know what it's about." Update the description with `fc_update_task` only after the user approves the exact new text.
4. If heartbeat.md has goals but there are no tasks the agent can do, ask once a day: "Want to create a few tasks I can take on? I'll keep their IDs and pick them up next check-in."

### Spawning a sub-agent (only on a yes)

- Start only the jobs the user said yes to (in chat).
- Hand approved jobs to this plugin's agents by name: `freedcamp-onboarding:researcher` for research, and `freedcamp-onboarding:project-manager` for a workload check, overdue triage and a realistic plan for today.
- Before starting it, add an entry to `## agent_activity` in memory.md: a short `id` (a1, a2, ...), `agent`, `job`, `task_ids`, `started` and `updated` (now), `status: running`, empty `result` and `needs_you`, and `reported` (now).
- Pass the sub-agent **only**: the job in one sentence, the Freedcamp task IDs, its `## agent_activity` entry `id`, and the paths `./.freedcamp/memory.md` and `./.freedcamp/heartbeat.md`. Tell it to record progress in that entry (its agent file says how). Do not paste task content; the sub-agent reads it fresh from Freedcamp.
- Tell the sub-agent: read only, unless the user approved a specific write. Results go back to the user for review first. A comment or update on the task is posted only after the user approves the exact text.
- If a matching specialist skill is installed (for example a research or project wizard skill), hand off to it by name with the same IDs. Otherwise use a general sub-agent.

## Plan my day

When the user asks to plan their day (or says yes to the new-day offer, or picks it at the end of onboarding), write the plan in the chat yourself. It is the answer, not a pointer to a page.

**Data.** Use what this tick or onboarding already fetched when it is fresh. Otherwise: `fc_fetch_current_session`, `fc_fetch_tasks` with `{ filters: { assigned_to_id: [userId], order_priority: "desc", order_due_date: "asc" }, limit: 100 }` (no `status` filter, drop `status` 1 and 3), and `fc_fetch_notifications` for who is waiting on the user. These count toward the 20-call budget. Read goals and main projects from heartbeat.md and `focus_task_ids`, `ignored_task_ids` and `agent_tasks` from memory.md. Leave out ignored tasks unless they became overdue.

For a bigger review (many projects, a large overdue pile), you may hand the job to `freedcamp-onboarding:project-manager` with the paths to memory.md and heartbeat.md, then present its result in the format below.

**Think before writing.** Work out today in the user's timezone. Weigh, in this order: someone waiting on the user (a `mentioned` or `response` notification), overdue tasks worth doing today (high priority, nearly done, or blocking someone), due today, in progress, then work tied to the goals in heartbeat.md. Keep the day honest: usually 3 to 5 focus tasks, fewer when the day is already full. Estimate effort per task from its title, list and subtasks, and say the estimates are rough.

**Write it like this** (Markdown, names not IDs, links on titles):

> **Your plan for Thursday, Nov 20**
> Heavy day: 6 overdue, 2 people waiting on you. Here is a realistic plan.
>
> **Focus today**
> 1. **[Reply to Dima on the launch brief](<url>)** (Marketing Campaign), about 15 min. He asked a direct question yesterday.
> 2. **[Write brief](<url>)** (Marketing Campaign), about 1.5 h. 3 days overdue, high priority, supports your launch goal.
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

Rules:

- Every overdue task appears once: in the plan, under Move, or under Still needed. More than 10 overdue: show the 10 most urgent and say how many more.
- Moving a date is a suggestion. Change due dates only after an explicit yes to the exact dates.
- "I could take" lists at most 3 jobs tied to task IDs, matched to "how I help" in heartbeat.md. They are offers (Step 6 rules), so record them under `offers`.
- No em dashes or en dashes.

**After the plan**, ask with `AskUserQuestion` (header "Next"): "Save focus tasks", "Interactive page", "Adjust the plan". Without the tool, ask in one line.

- Save focus tasks: set `focus_task_ids` to the plan's tasks, set `plan_date` to today, and fill `selected_tasks` as in "Saving picks".
- Interactive page: follow "Dashboard page" below, with the plan's tasks as `focus_task_ids`.

## Dashboard page

The dashboard is an interactive claude.ai artifact, refreshed on every tick (Step 5a) and on request. It never replaces the plan, report or check-in in the chat.

**Mechanism** (the same one the `freedcamp-live-dashboard` page uses): Claude writes `focus-today.html` from `${CLAUDE_PLUGIN_ROOT}/skills/onboarding/dashboard-spec.md` and publishes it with the Artifact tool. Inside the page, `claude.use('mcp')` reads and writes Freedcamp through the viewer's claude.ai connector (`mcp.callTool('Freedcamp', tool, input, { cache: false })`), and `claude.use('sample')` lets the page ask Claude to draft replies and suggest a plan or dates (`sample(...)`, `sample.json(...)`).

1. Write the page following sections 1 to 12 of the spec, including the picks controls in section 9a. Fill its `fc-session` block from memory.md: `focus_task_ids`, `ignored_task_ids`, the latest pending `offers` (`n`, `job`, `task_ids`) and, from a tick, the check-in lines and `nudges`. Fill `agent_activity` from `## agent_activity` as Step 5a says. Also fill `recommended` (spec section 9a): at most 8 `{ "id", "reason" }` entries, from today's plan if one was written in this conversation ("in today's plan"), overdue tasks triaged "do today" ("overdue, do today"), and tasks tied to pending offers ("I offered to help"). Use only IDs from tool results or memory.md; leave it empty when there is nothing to suggest. After "Plan my day", republish with the plan's tasks first in `recommended`.
2. Run the checks in section 13.
3. Publish with the Artifact tool (check it is available first, see below), `icon: "checklist"`, title "Your Focus Today", and exactly these capabilities. `server` is the name of the user's claude.ai connector, not this plugin's `.mcp.json` key; if the publish warns the declared tools do not match, ask for the connector's exact name and publish again:

   ```json
   {"mcp": {"servers": [{"server": "Freedcamp", "tools": ["fc_fetch_current_session", "fc_fetch_tasks", "fc_fetch_task", "fc_fetch_notifications", "fc_update_status", "fc_update_task", "fc_add_comment", "fc_add_task"]}]}, "sample": {}}
   ```

4. In the Claude Code terminal, give the user the link the Artifact tool returns (a `https://claude.ai/code/artifact/...` address) and say: "Open it in claude.ai to use the buttons." Where the app shows a card, the card is enough. Never make up a link (spec section 15). Save the artifact URL as `dashboard_artifact_url` in memory.md. A later session updates the same page by giving that URL to the Artifact tool instead of creating a new one.
5. Tell the user in two or three sentences: the page loads their tasks live, claude.ai asks them to allow the Freedcamp connector and Claude drafting on first use, and every button acts on the page itself, the way "Plan my day" does: completing a task, posting a comment, applying a date, "Help with this" (description, comment, subtasks, assignee, plan) and Confirm (marks picked tasks In progress) change their real Freedcamp account, each only after they click the button that names the change.

The page needs a claude.ai connector named "Freedcamp" (Claude Settings, Connectors); the plugin's own `.mcp.json` server feeds this session only, not the published page.

**Is the Artifact tool available?** Check it this way, every time, before deciding:

1. Look in your tool list for a tool named exactly `Artifact`. It is a built-in Claude Code tool, not an MCP tool, so it has no `mcp__` prefix.
2. If it is not in the list, run `ToolSearch` with `select:Artifact` in case it is deferred.
3. Only if both come up empty is it unavailable. Do not guess from the environment, and do not skip the publish because the page takes a while to build.

When it is unavailable, tell the user in one line, then use the in-chat fallback: "I can't publish the interactive page here: the Artifact tool isn't in this session. Claude Code turns it off without a claude.ai login (`/login`), on Bedrock, Vertex or Foundry, in `-p` runs, and when `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` is set (check the `env` block in `~/.claude/settings.json`)."

**Where it cannot be published.** The Artifact tool needs a claude.ai login (`/login`) in the Claude Code CLI or desktop app; it is missing with an API key, on Bedrock, Vertex or Foundry, and with `-p`. In a claude.ai, desktop or Cowork chat that renders artifacts but has no Artifact tool, show the read-only page from section 14 of the spec as an artifact and say plainly: "This is a read-only copy. Tell me here what to do on any task and I'll do it in Freedcamp." If the client can neither publish nor render an artifact (for example, Claude Code with an API key), do not write a local page. Give the answer in the chat as the spec describes, with no artifact (sections 14 and 15 of the spec), and collect picks with `AskUserQuestion` (one multi-select question, header "Focus", the 4 most urgent tasks as options; the user can type others).

## Saving picks

The dashboard saves its own picks in Freedcamp: Confirm marks the picked tasks In progress, and Step 3.4 adds them to `focus_task_ids`. In chat, picks come from "Save focus tasks" after a plan or from an `AskUserQuestion` answer, and you save them:

1. Keep an ID only if it is in memory.md or came from a tool result in this conversation; otherwise check it with `fc_fetch_task`. Never guess an ID.
2. Replace the `## selected_tasks` section of memory.md with `picked`, `approved_task_ids`, `ignored_task_ids`, `offers_yes` and `offers_no`. Leave other sections alone.
3. In `## today`: add approved IDs to `focus_task_ids` and remove them from `ignored_task_ids`; add ignored IDs to `ignored_task_ids` and remove them from `focus_task_ids`; set `plan_date` to today.
4. In `## offers`: set `answer` to `yes` or `no` for the offers the user answered, then start the yes jobs as in "Spawning a sub-agent".
5. Reply in one line: "Saved: 2 to work on, 1 ignored, 1 job started." Saving a chat pick never changes the task in Freedcamp; any write still needs its own explicit yes.

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
   - Launch a sub-agent: start `freedcamp-onboarding:researcher` for research or `freedcamp-onboarding:project-manager` for planning, as "Spawning a sub-agent" describes (including its `## agent_activity` entry, which holds only a status line, never the result). Hand over only the job in one sentence, the task ID and `writes: draft only`. Its result comes back to this chat; then offer to post it as a comment or to use it as the new description, and write it only after a yes to the exact text.
   - Run a Ralph loop: if a `/ralph-loop` command is installed, give the user the exact command to type (you cannot type it for them), for example `/ralph-loop "Work on Freedcamp task <id>: <job>. Read it with fc_fetch_task. Do not write any local files. Show the result as a draft comment and output DONE." --max-iterations 10 --completion-promise "DONE"`. When it finishes, post the draft to Freedcamp as a comment or description update only after a yes. If the command is not installed, say so and offer a sub-agent instead.
   - Just plan it: write a short plan in the chat (steps, rough time each), then offer to save it to Freedcamp as a comment or as subtasks.
5. **Nowhere but Freedcamp.** Never write help output, research, plans or drafts to files, in `./.freedcamp/` or anywhere else. Results live in Freedcamp (comments, descriptions, subtasks) or in the chat.

## Step 7: Update memory.md

Every tick, even a quiet one:

- `last_check`: now, ISO 8601 with the user's UTC offset.
- `last_notification_ts`: the newest `action_ts` seen this tick (never lower it).
- `last_notification_id`: the `uid` of that newest notification.
- `updated`: now.
- `dashboard_artifact_url`: the URL the Artifact tool returned this tick, if any (Step 5a).
- `nudged` in `## today`: set `<task_id>: <now>` for each task nudged this tick; record any status answer as a short phrase under `answers` in the same map entry, for example `73755437: { at: <now>, answer: blocked }`.
- `## agent_activity`: set `reported` to now on each entry shown this tick. Keep the last 20 entries.
- `## work_queue`: add handled marker comment IDs to `handled_comment_ids` (keep the last 50) and update `seen_comments` (`<task_id>: <comments_count>`) for the tasks seen this tick.

When you spoke:

- `last_checkin`: now.
- Add each offer under `offers` with `offered`, `job`, `task_ids` and `answer` (`pending`, then `yes` or `no`). Keep only the last 20 offers.
- On a yes to a sub-agent job, add its task IDs to that project's `agent_tasks`.
- Remove IDs of tasks that are completed (status 1) from `focus_task_ids` only after telling the user they are done.

Store only IDs, short phrases and timestamps. Never descriptions, comment text or tokens.

## Loop setup (if the user asks how to run this on a loop)

Never hardcode an interval. Ask how often, then give the exact command:

> How often should I check in?
> 1. Every 10 minutes: `/loop 10m /freedcamp-onboarding:heartbeat`
> 2. Every 15 minutes: `/loop 15m /freedcamp-onboarding:heartbeat`
> 3. Every hour: `/loop 1h /freedcamp-onboarding:heartbeat`
> 4. Every 3 hours: `/loop 3h /freedcamp-onboarding:heartbeat`
> 5. Custom: `/loop <period> /freedcamp-onboarding:heartbeat`, for example `30m` or `2h`

## Rules

- **Offer, don't take over.** At most 3 offers per tick. Nothing starts without a yes.
- **No Freedcamp writes without an explicit yes** to the exact change: no `fc_update_status`, `fc_update_task`, `fc_add_comment` or any other write. One exception: a "Work on it" request (Step 3b) is the user's yes to post `[Claude: ...]` comments on that one task, and nothing more.
- **Short when nothing changed.** A quiet tick is one line, "No new updates. Board: <url>". Never skip the tick's message or the board refresh.
- **Chat first, board every tick.** Check-ins, plans and offers are written in the chat. Every tick also pushes a fresh board and ends with its link (Step 5a).
- **Budget.** At most 20 Freedcamp calls per tick.
- **Never guess an ID.** Every ID comes from memory.md or a tool result.
- **Copy style.** Short sentences. No em dashes or en dashes in anything shown to the user.
