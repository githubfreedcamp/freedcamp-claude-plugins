---
name: add-wake-button
description: Adds a "wake Claude" button to an artifact page so a click queues a request in the Freedcamp Claude Inbox, optionally fires the instant n8n route, and shows the result when Claude finishes. Use when asked to "make this button trigger Claude", "add a wake button", "send this to the Claude Inbox from the page", or "wire Plan my day to the inbox".
---

# Add a wake button to an artifact

## Steps

1. **Read the artifact** and find the button and the data it should send. Reuse the page's existing Freedcamp call helper if it has one.
2. **Check capabilities** with `read_declaration`. The page needs the `mcp` capability with the Freedcamp server, plus the n8n server if the instant route is used. Declare any missing server with `declare_capabilities` BEFORE publishing code that uses it (use `describe_capabilities` with `mcp` for the exact shape).
3. **Add the code** from `references/wake-snippet.js`. Set:
   - `INBOX_PROJECT` (default `Claude Inbox`)
   - `N8N_WORKFLOW_ID` (from the n8n-wake-route skill), or `''` to skip the instant route and rely on the loop
4. **Wire the button:** `wakeClaude(action, requestText, payload, onUpdate)`. Show states in the page:
   - `queued`: "Sent to Claude"
   - `running`: "Claude is working"
   - `done`: render `result.summary` and `result.data`
   - `needs_confirmation`: show the draft with an Approve button
   - `error` or `timeout`: show the message and a link to the inbox task
5. **Keep any direct `sample` call** as the fast path if the page already has one. Use the inbox for work that needs tools, or when the user wants a record in Freedcamp.
6. **Publish** with edit_version, then tell the user what the button now does in one line.

## Rules

- Never put secrets in the page.
- Stop polling after 10 minutes and say so in the page; the request stays queued for the loop.
- Follow the result format in the process-claude-inbox skill's protocol: newest comment starting with `[claude-result]`, JSON block inside.
