#!/usr/bin/env bash
# artifact-wake: run Claude Code headless to process the Freedcamp Claude Inbox.
#   artifact-wake            process every open [claude] request
#   artifact-wake 12345      process one request by task id (used by the n8n route)
#
# Env:
#   CLAUDE_INBOX_PROJECT        inbox project name (default: Claude Inbox)
#   CLAUDE_WAKE_ALLOWED_TOOLS   tools Claude may use without asking
#                               (default: mcp__freedcamp, your Freedcamp MCP server name)
#   CLAUDE_BIN                  path to the claude CLI (default: claude)
set -euo pipefail

TASK_ID="${1:-}"
PROJECT="${CLAUDE_INBOX_PROJECT:-Claude Inbox}"
ALLOWED="${CLAUDE_WAKE_ALLOWED_TOOLS:-mcp__freedcamp}"
CLAUDE_BIN="${CLAUDE_BIN:-claude}"

# The id can arrive from a webhook, so accept digits only.
if [[ -n "$TASK_ID" && ! "$TASK_ID" =~ ^[0-9]+$ ]]; then
  echo "artifact-wake: task id must be numeric, got: $TASK_ID" >&2
  exit 2
fi

# Avoid two runs at once (cron + n8n firing together).
LOCK="${TMPDIR:-/tmp}/artifact-wake.lock"
exec 9>"$LOCK"
if command -v flock >/dev/null 2>&1; then
  flock -n 9 || { echo "artifact-wake: another run is active, skipping"; exit 0; }
fi

if [[ -n "$TASK_ID" ]]; then
  PROMPT="Use the process-claude-inbox skill to process Freedcamp inbox task $TASK_ID in the project \"$PROJECT\"."
else
  PROMPT="Use the process-claude-inbox skill to process open [claude] tasks in the Freedcamp project \"$PROJECT\". If there are none, reply \"nothing new\" and stop."
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] artifact-wake ${TASK_ID:-all}"
"$CLAUDE_BIN" -p "$PROMPT" --allowedTools "$ALLOWED" --output-format text
