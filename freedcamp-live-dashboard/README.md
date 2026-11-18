# Freedcamp for Claude

Use Freedcamp from Claude by plain names. Say "Add a task to Marketing Campaign" or "What did I miss in DevOps?" and Claude finds the right project, app and people for you. No IDs needed.

## Install

In Claude on the web or desktop: open **Customize → Plugins**, click **Add → Add marketplace**, enter `githubfreedcamp/freedcamp-claude-plugins`, then add **Freedcamp**.

In Claude Code:

```
/plugin install freedcamp --marketplace githubfreedcamp/freedcamp-claude-plugins
```

## What is included

- **Freedcamp connector**: connects Claude to your Freedcamp account at `https://mcp.freedcamp.com/mcp`. You sign in to Freedcamp the first time you use it.
- **freedcamp-live-dashboard skill**: one skill that does two things.
  - **Work by name**: builds a name lookup of your groups, projects, apps and teammates once per conversation, then creates and updates tasks, discussions, issues, wikis, milestones and time entries. It also explains notifications and builds task reports.
  - **Live dashboard**: ask "show my focus today" and Claude opens an interactive page with your overdue tasks, tasks due in the next 7 days, work in progress, and comments waiting on you.

## The live dashboard

The page loads your data from Freedcamp each time it opens. From the page you can:

- complete a task, or undo it
- open a task with its description, subtasks and comments
- post a comment or reply, and ask Claude to draft one for you
- ask Claude to plan your day or suggest new due dates for overdue tasks

The first time you open it, Claude asks you to allow the Freedcamp connection and Claude drafting.

## What it sends and changes

- All data comes from and goes to Freedcamp through the connector above. Nothing is sent anywhere else.
- Drafts and plans are written by Claude from the task text you are looking at.
- Completing a task, posting a comment and applying a due date change your real Freedcamp account. Due dates change only when you press Apply.

## Support

Visit https://freedcamp.com or contact Freedcamp support.
