---
name: n8n-wake-route
description: Sets up the instant n8n route that wakes Claude the moment an artifact button is pressed. Use when asked to "set up the n8n route", "make the wake button instant", "connect n8n to the Claude Inbox", or "trigger Claude from n8n".
---

# n8n instant wake route

Flow: the artifact creates the inbox task, calls an n8n workflow through the n8n connector with the task id, and n8n runs `artifact-wake <task_id>` on the user's machine. Claude processes that one request in seconds and writes the result to Freedcamp. The loop stays on as a backup.

## Steps

1. **Find where n8n runs.** Ask whether n8n is self-hosted on the same machine as Claude Code, or n8n cloud.
   - Self-hosted on the same machine: continue.
   - n8n cloud, or a different machine: n8n cannot run the local CLI. Tell the user the loop route covers them, or to point the webhook at a machine that has Claude Code. Stop here.
2. **Install the script** (give the exact command):

   ```
   sudo cp "${CLAUDE_PLUGIN_ROOT}/scripts/wake.sh" /usr/local/bin/artifact-wake && sudo chmod +x /usr/local/bin/artifact-wake
   ```

3. **Check that n8n can run commands.** Recent n8n versions disable the Execute Command node by default. If it is missing, the user must enable it in the n8n settings or environment (for example, remove `n8n-nodes-base.executeCommand` from `NODES_EXCLUDE`) and restart n8n.
4. **Import the workflow** from `references/n8n-workflow.json` (n8n: Workflows, Import from File). It has two nodes:
   - Webhook: `POST /artifact-wake`, reads `body.task_id`.
   - Execute Command: `/usr/local/bin/artifact-wake {{ $json.body.task_id }}`.
5. **Expose it to the connector.** Activate the workflow and turn on its MCP availability in the workflow settings, so the n8n connector can list and run it.
6. **Get the workflow id.** Use the n8n connector (`search_workflows` for "Artifact Wake", then `get_workflow_details`) and give the user the id. The artifact needs it.
7. **Test** once with the connector:

   ```json
   {"workflowId":"<id>","inputs":{"type":"webhook","webhookData":{"method":"POST","body":{"task_id":"<a real inbox task id>"}}}}
   ```

   Confirm that the task moves to completed and gets a `[claude-result]` comment.

## Notes

- The script accepts digits only and holds a lock, so a bad payload or a double fire cannot cause harm.
- The process user that n8n runs as must be logged in to Claude Code (`claude` run once as that user) and have the Freedcamp MCP server configured.
