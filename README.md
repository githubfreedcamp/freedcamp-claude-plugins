# Freedcamp Live Dashboard for Claude

Use Claude to work with Freedcamp projects by name, get task and notification updates, and open an interactive dashboard for your day. The plugin connects to your account through Freedcamp's MCP service; it does not require you to look up project or user IDs.

## Install

### Claude on the web or desktop

1. Open **Customize → Plugins**.
2. Choose **Add → Add marketplace** and enter `githubfreedcamp/freedcamp-claude-plugins`.
3. Install **Freedcamp Live Dashboard**.
4. Connect to Freedcamp when Claude prompts you on first use.

### Claude Code

```text
/plugin install freedcamp --marketplace githubfreedcamp/freedcamp-claude-plugins
```

The plugin registers the Freedcamp MCP server at `https://mcp.freedcamp.com/mcp`. You must authenticate with Freedcamp and approve the requested tool or page permissions when prompted.

## What the plugin does

### Work with Freedcamp by name

The `freedcamp-live-dashboard` skill builds a lookup of your groups, projects, applications, and teammates from the current Freedcamp session. Ask using names, for example:

- “Add a task to Marketing Campaign: Draft launch email, due Friday, assigned to me.”
- “Create a wiki page in DevOps called On-call guide.”
- “Log an issue in Chat: Search is timing out.”
- “What are my overdue tasks?”
- “What did I miss in the last day?”

It can create tasks, discussions, milestones, time entries, files, issues, wiki pages, calendar events, and CRM tasks or calls when the relevant app is available in the project. It can also fetch task details and lists, update tasks, add comments, and report on tasks and notifications. It checks which applications are enabled for a project before acting.

For names that match more than one project, Claude asks which one you mean. If no project is named for a new item, it offers your most recent project. It resolves “me” from your account and uses your Freedcamp time zone for relative dates. It does not guess project, list, or user IDs.

### Open the live “Your Focus Today” dashboard

In Claude on the web or desktop, run `/freedcamp-live-dashboard` and ask for “Your Focus Today” to open the live dashboard. You can also ask in plain language for “my focus today,” “a Freedcamp dashboard,” or a visual overview of your work. The live page reads Freedcamp when opened and shows:

- Overdue tasks and tasks due in the next seven days
- In-progress tasks without due dates
- Notifications that may need your reply
- Task details, subtasks, comments, assignees, status, and priority

From the dashboard, you can complete or restore a task, open it in Freedcamp, post a comment, draft a reply with Claude, plan your day, and suggest new due dates for overdue work. Suggested dates are only written to Freedcamp after you press **Apply**. The page refreshes task and notification data when requested and shows the time of its last update in your time zone.

Claude asks you to allow the Freedcamp connection and Claude drafting in the page permissions the first time those capabilities are used. Completing a task, posting a comment, or applying a due date changes your Freedcamp account. Review drafted text and date suggestions before posting or applying them.

If the interactive Artifact page is unavailable, the skill can use a static dashboard fallback. That page has a snapshot of the data from when it was built; its prompt buttons copy text for you to paste into Claude, and its task check controls only change the display.

## Data and permissions

- Freedcamp data is read and written through the configured Freedcamp MCP server. The plugin does not send account data to another service.
- Claude may use task text and recent comments to draft replies or day plans. Draft text is generated only when you ask for it and is not posted automatically.
- Writes such as task creation or updates, comments, task completion, and applied due dates affect your real Freedcamp account.
- The dashboard requests only the tools it needs: current session, tasks, task details, notifications, status and task updates, and comments.

## Repository contents

- `freedcamp-live-dashboard/.claude-plugin/plugin.json` — plugin name, version, description, and marketplace metadata.
- `freedcamp-live-dashboard/.mcp.json` — Freedcamp MCP server configuration.
- `freedcamp-live-dashboard/skills/freedcamp-live-dashboard/SKILL.md` — instructions for name-based actions, reports, notifications, and dashboard behavior.
- `freedcamp-live-dashboard/skills/freedcamp-live-dashboard/dashboard-spec.md` — the written spec Claude builds the dashboard page from. No prebuilt page or script ships with the plugin.

## License and support

The plugin is distributed under the MIT License. For Freedcamp account or product support, visit [freedcamp.com](https://freedcamp.com).
