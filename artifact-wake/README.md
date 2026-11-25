# artifact-wake

Wake Claude from an artifact button. A click queues a request as a Freedcamp task, Claude processes it with your tools, and the result comes back to the page.

## How it fits together

```
Artifact button
   |  creates task "[claude] <action>" in Freedcamp project "Claude Inbox"
   |
   +--> instant: n8n workflow --> artifact-wake <task_id> --> Claude (seconds)
   +--> backup:  /loop or cron every 2 min --> artifact-wake --> Claude
   |
Claude posts a "[claude-result]" comment and completes the task
Artifact polls the task and shows the result
```

## Local inbox.md route (desktop app)

The plugin bundles **ask-inbox**, a tiny local server (Node, no dependencies). An artifact that declares the `host:ask-inbox` server can:

- `add_request {text}`: append a request block to `~/claude-inbox/inbox.md` (override with `CLAUDE_INBOX_FILE`)
- `list_requests {limit}`: read requests back with status and Claude's answer

Say **check** in your Claude chat and the check-local-inbox skill answers queued requests in the file. Works only in the Claude desktop app on the computer that has the file; elsewhere the dashboard falls back to Freedcamp.

## Skills

| Skill | What it does |
|-------|--------------|
| process-claude-inbox | Picks up `[claude]` tasks, locks, does the work, posts the result, closes. Holds irreversible actions for confirmation. |
| start-inbox-loop | Gives the `/loop` command (and a cron alternative) for 2-minute polling. |
| n8n-wake-route | Sets up the instant route: webhook to `artifact-wake <task_id>`. |
| check-local-inbox | Answers queued requests in the local inbox.md and writes the answers back in place. |
| add-wake-button | Wires a button in an artifact to queue a request and show the result. |

## Files

- `server/ask-inbox-server.mjs`: the local inbox server (stdio MCP).
- `.mcp.json`: registers it as `ask-inbox`.

- `scripts/wake.sh`: headless runner (`claude -p`), numeric-id check, lock against double runs.
- `skills/n8n-wake-route/references/n8n-workflow.json`: importable n8n workflow.
- `skills/add-wake-button/references/wake-snippet.js`: page code.

## Setup

1. Create a private Freedcamp project named `Claude Inbox`.
2. Make sure Claude Code on your machine has the Freedcamp MCP server.
3. Install the script:
   ```
   sudo cp scripts/wake.sh /usr/local/bin/artifact-wake && sudo chmod +x /usr/local/bin/artifact-wake
   ```
4. Start the backup loop in Claude Code:
   ```
   /loop 2m Use the process-claude-inbox skill to process open [claude] tasks in the Freedcamp project "Claude Inbox". If there are none, reply "nothing new" and stop.
   ```
5. Optional instant route: ask Claude to "set up the n8n route".
6. Ask Claude to "wire Plan my day to the inbox" (or any other button).

## Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `CLAUDE_INBOX_PROJECT` | `Claude Inbox` | Inbox project name |
| `CLAUDE_WAKE_ALLOWED_TOOLS` | `mcp__freedcamp` | Tools allowed without prompts; match your Freedcamp MCP server name |
| `CLAUDE_BIN` | `claude` | Path to the Claude Code CLI |

## Safety

- Only tasks created by your own Freedcamp user are processed. Others are marked invalid.
- Deletes, outgoing emails or messages, and payments are drafted and held for your approval (status Review), never done automatically.
- Keep the inbox project private: anything in it is treated as a request from you.

## To verify on first use

- The response shapes of `fc_fetch_projects`, `fc_add_task` and `fc_fetch_task` (the snippet handles common shapes; check that `fc_fetch_task` returns comments).
- The n8n node type versions against your n8n version.
