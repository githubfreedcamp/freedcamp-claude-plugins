---
name: start-inbox-loop
description: Starts or explains the polling loop that checks the Freedcamp Claude Inbox every few minutes. Use when asked to "start the inbox loop", "poll the Claude Inbox", "keep checking Freedcamp for requests", or "set up /loop for the inbox".
---

# Start the inbox loop

The loop is the backup route: it catches every request even when the instant n8n route is not set up or failed. It runs only inside a Claude Code terminal session that stays open.

## Steps

1. Confirm the session has Freedcamp tools. If none are available, tell the user to add the Freedcamp MCP server to Claude Code first, and stop.
2. Give the user this exact command to start the loop (2 minutes by default; use the interval they ask for):

   ```
   /loop 2m Use the process-claude-inbox skill to process open [claude] tasks in the Freedcamp project "Claude Inbox". If there are none, reply "nothing new" and stop.
   ```

3. Explain in one line each:
   - It runs while this terminal stays open. Closing it stops the loop.
   - An empty check is one Freedcamp call, so idle cost stays low.
   - Requests the n8n route already picked up are skipped, because they are no longer "not started".

## Running without an open terminal

For a loop that survives closing the terminal, give the user a cron line that calls the plugin's script every 2 minutes (replace the path with where they saved the script):

```
*/2 * * * * /usr/local/bin/artifact-wake >> ~/artifact-wake.log 2>&1
```

The script is `scripts/wake.sh` in this plugin. Install it with:

```
sudo cp "${CLAUDE_PLUGIN_ROOT}/scripts/wake.sh" /usr/local/bin/artifact-wake && sudo chmod +x /usr/local/bin/artifact-wake
```
