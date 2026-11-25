# Freedcamp plugin architecture

Status: draft, from a voice session on Nov 20, 2026. Nothing here is built yet beyond the current `freedcamp-live-dashboard` plugin.

## Phase 1: Onboarding skill and first run

The first time the plugin runs, it starts a short interactive wizard through a separate `onboarding` skill.

1. **Open.** "Hey, let me get a better understanding of things."
2. **Deep dive.** Pull as much as the Freedcamp MCP allows and analyze it for context: the session, groups, projects, team members, the user's tasks and their history and comments, notifications and recent activity.
3. **Understand the user.** Work out who they are, what they do, which projects they're active in, and who they work with.
4. **Show the dashboard** ("Your focus today").
5. **Keep talking.** "Let's keep talking it through. What are your current goals? What are the main projects you're working on? What are the main things you're trying to achieve?"
6. **Write `heartbeat.md`.** The agent's own standing notes on how it can help this person, in plain sentences. For example: "I'm the agent. This person does a lot of marketing, so I should help with research, finding new topics and competitor research."
7. **Hook it into the loop.** Every loop run (section 2) triggers the heartbeat first.

Each heartbeat:

1. Read `heartbeat.md` for what the agent should be doing.
2. Read `memory.md` (section 6) for what the person is working on right now.
3. Ask the user whether to start the sub-agents that fit ("Want me to research 3 competitors for the Q1 campaign?"). Nothing starts without a yes.

Suggested shape:

```markdown
# heartbeat.md
updated: 2026-11-20

## who this is
Angel G., CEO. Active in: Freedcamp Development, FC PLAN MAIN!, Social Media Presence.

## goals (from onboarding)
- Ship the January 12 launch
- Grow social content

## how I help
- Marketing: research new topics, research competitors, draft the content calendar
- Development: summarize PRs and review threads, flag stale tasks

## offer each tick
- Research for anything due this week tagged marketing
```

The difference between the two files: `heartbeat.md` holds the agent's long-lived role and goals, and `memory.md` holds today's IDs and state.

## 1. Principles

- The main plugin stays simple and reliable. It looks, summarizes, plans and offers help. It does not do specialist work.
- Specialist work lives in separate skills and plugins that the main plugin calls by name.
- Offer help, never take over. A wizard or sub-agent runs only after the user says yes.
- Plugins hand work to each other as Freedcamp IDs, not copied content. Freedcamp stays the source of truth.

## 2. Main plugin (the loop)

Runs on a loop, every 15 minutes (for example `/loop 15m /live-freedcamp-dashboard` in Claude Code).

Each tick:

1. Read `memory.md` (see section 6).
2. Fetch the important data through the Freedcamp MCP: the session, the user's tasks and notifications.
3. Check the items whose IDs are stored in `memory.md` and see what changed.
4. Check new notifications (mentions, replies, assignments).
5. Summarize what matters now and check in with the user on progress.
6. Offer help (section 8). Trigger a sub-plugin only after a yes.

Actions available to the user: plan my day, review what's important, and ask Claude to write comments and updates on items.

Tools the main plugin uses: `fc_fetch_current_session`, `fc_fetch_tasks`, `fc_fetch_task`, `fc_fetch_notifications`, `fc_update_status`, `fc_update_task`, `fc_add_comment`.

## 3. Sub-plugins (skills by name)

- Each skill is its own plugin with its own SKILL.md.
- The main plugin triggers one by name and passes it Freedcamp IDs plus a pointer to `memory.md`.
- A sub-plugin can spawn sub-agents (research, drafting, staffing).

Examples:

| Skill | Trigger | Output |
|---|---|---|
| `project-wizard` | "I'm starting a new project" | Project, initial tasks, suggested people |
| `assist-onboarding` | User says yes to "Do you want some assistance?" | A help profile saved in `memory.md` |
| `team-finder` | Called by `project-wizard` | Who is best suited, and why |
| `task-agent` | A task marked as agent-able | The task done, or a draft for review |

## 4. Example flow: new project wizard

1. The user says "I'm starting a new project."
2. The main plugin offers help. On yes, it triggers `project-wizard`.
3. The wizard asks short questions: goal, deadline, scope, constraints.
4. The wizard creates the project in Freedcamp.
5. It spawns sub-agents:
   - research: background and similar work, used to fill in the project description
   - planning: an initial task list
   - staffing: `team-finder` (section 5)
6. It writes back the project ID, task IDs and suggested assignees, and asks the user to confirm before anyone is assigned.

## 5. Who can help (team awareness)

- Use the Freedcamp MCP to list every team member and what they're working on right now (open tasks, projects, recent activity).
- Build a picture of each person's current load and skills, based on the kinds of tasks they've done.
- Suggest who can help with a new project or task, with the reason ("Dima: 3 open tasks, did the last 5 build-system tasks").
- Suggest only. A person is assigned only after the user confirms.

## 6. Handoff format: Freedcamp IDs in memory.md

The plugins hand work to each other through a plain text file, `memory.md`, that holds Freedcamp IDs.

Plan my day example:

1. The user clicks "Plan my day."
2. The system picks about 10 tasks and shows them with checkboxes.
3. The user confirms 6 and ignores the rest.
4. The 6 task IDs are written to `memory.md`.
5. On the next tick, the loop pulls those IDs, checks those items, checks in with the user on progress, and checks new notifications.

Suggested shape:

```markdown
# memory.md
updated: 2026-11-20T12:30+02:00

## today
plan_date: 2026-11-20
focus_task_ids: [73755437, 73755581, 73755282, 72902974, 73652869, 73700001]
ignored_task_ids: [73700002, 73700003, 73700004]

## projects
- project_id: 3782629
  assist: yes
  needs: "research competitors, draft first 10 tasks"
  agent_tasks: [73710001, 73710002]

## last_check
last_notification_id: 99812345
last_checkin: 2026-11-20T12:15+02:00
```

Rules:
- Store only IDs and short preferences. Read the item details fresh from Freedcamp on every tick.
- The main plugin writes to the file, and sub-plugins add to it under their own section.

## 7. Agent-launchable tasks

- A task can carry a flag saying an agent can do it, for example a tag such as `AGENT` or a line in the description.
- At check-in, the main plugin lists flagged tasks and offers to launch an agent for each one.
- The agent posts its result as a comment or an update on the task. The user reviews it before the task is marked complete.

## 8. Assistance posture and onboarding

Default behavior on every check-in:

1. Look at the person's task list.
2. Say what could be done or helped with: "I can do these 3 for you and help with these 2."
3. Wait. Nothing runs without a yes.

When the user says they're going to work on a project:

1. Ask "Do you want some assistance?"
2. On yes, run the onboarding wizard to learn what they need and how to help.
3. Save the answers in `memory.md` under that project.
4. At the next check-in, offer to spawn sub-agents to complete the tasks or at least help with them.

## 9. Task review: full context, clarify vague tasks, ask for agent tasks

When the main plugin reviews the user's tasks, it pulls everything the MCP gives it for each task: the details, history, comments and related notifications (for example with `fc_fetch_task`, comments and `fc_fetch_notifications`). It doesn't stop at the title and due date.

1. **Find vague tasks.** A task is vague when its title is short and its description is empty or unclear, and nothing in its comments or history explains it.
2. **Ask to clarify.** "Hey, can you tell me a little more about this task? I'll update the description to make it easier for everyone involved to know what it's about."
3. **Update the description** with the answer, only after the user confirms the new text (`fc_update_task`).
4. **Use the context.** With clearer tasks, the agent knows better what's actually going on, and it can offer specific help: "I can help you set up this and that."
5. **Ask for tasks for itself.** It asks the user to create a few tasks it can go ahead and do (flagged as agent tasks, section 7). Their IDs go in `memory.md` so the next tick picks them up.

Same posture as section 8: it asks and offers, and nothing changes without a yes.

## 10. Ralph loop for task execution

When the main plugin or a sub-agent takes on a task (after the user says yes), it says "Hey, I'll help you with this task" and starts a sub-agent that runs a Ralph loop. The loop repeats the same prompt until the task is finished or it runs out of iterations.

Command pattern (Claude Code):

```
/ralph-loop "your prompt here" --max-iterations 10 --completion-promise "DONE"
```

- `--max-iterations` and `--completion-promise` can be set per task. Use a small cap (for example 10) by default and a larger one only for long jobs.
- The prompt carries only the Freedcamp task ID, pointers to `memory.md` and `heartbeat.md`, and what counts as done. For example: `"Complete Freedcamp task 73755437 per its description and comments. Read ./.freedcamp/memory.md. Post progress as a comment. Output DONE when the acceptance criteria are met."`
- It works for subtasks too: one loop per subtask ID.
- Every iteration reads the task fresh from Freedcamp and posts a short progress comment.
- At the end, the result goes on the task for the user to review. It doesn't mark the task complete without a yes (sections 7 and 8).
- If it hits the cap without outputting DONE, it stops, reports what's left, and asks the user how to continue.

## 11. Open decisions

1. Where `memory.md` lives: in the plugin's working folder, per user, or synced to Freedcamp (for example as a private wiki page).
2. How an agent-able task is marked: a tag, a custom field or a line in the description.
3. Which sub-plugins to build first.
4. Whether Claude may assign people directly or only suggest.
5. Whether 15 minutes is the right loop interval, given MCP rate limits and cost.
6. Whether to support user-set values in `plugin.json` (`userConfig`, for example a Freedcamp API key and secret) so the plugin can call the Freedcamp API directly instead of going through the MCP server. Upside: less MCP overhead and more control over rate limits. Trade-offs: Claude Code only (claude.ai uses the remote connector), keys must be marked sensitive and never logged, and a bundled script or local server would be needed to make the calls.
