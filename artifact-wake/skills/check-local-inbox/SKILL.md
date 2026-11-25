---
name: check-local-inbox
description: Reads and answers requests in the local markdown inbox (~/claude-inbox/inbox.md) that the Ask Claude dashboard writes through the ask-inbox server. Use when the user says "check", "check my inbox", "check inbox.md", or "answer my local requests".
---

# Check the local inbox file

The Ask Claude dashboard appends requests to a markdown file on the user's computer. Answer them in place so the dashboard shows the result.

## Where the file is

- Default: `~/claude-inbox/inbox.md`, or `$CLAUDE_INBOX_FILE` if set.
- From a cloud chat linked to the computer: use the device shell (`device_bash`). The folder must be connected; `ls $HOME/mnt/` shows connected folders. If `claude-inbox` is missing, ask for it once with `device_request_folder_access` on `~/claude-inbox`.
- In Claude Code on the computer: read the path directly.

## File format

Each request is one block:

```
## REQ-20261121-032530-ab12 | queued
- Sent: 2026-11-21 03:25:30

### Request
<text; lines starting with # or --- are escaped with a backslash>

### Answer
_waiting_

---
```

Statuses: `queued`, `working`, `done`, `needs-you`, `error`, `cancelled`.

## Steps

1. List queued requests:

   ```
   grep -n '^## REQ-.* | queued$' "$HOME/mnt/claude-inbox/inbox.md"
   ```

2. If none, reply `nothing new` and stop.
3. For each queued request, oldest first:
   1. **Lock:** change its header from `| queued` to `| working` (edit in place with python or sed on that exact header line, never by retyping the file).
   2. **Do the work** with this chat's context and tools.
   3. **Hold irreversible actions:** never delete, send messages or emails to other people, or pay. Draft instead, and use status `needs-you`.
   4. **Write the answer:** replace `_waiting_` in that block with the answer in markdown. Escape any answer line that starts with `#` or is `---` by prefixing a backslash.
   5. **Close:** set the header status to `done`, `needs-you` or `error`.
4. Reply with one line per request: id and outcome.

## Editing safely

Use a short python read-modify-write that touches only the target block:

```
python3 - "$FILE" "$ID" "$STATUS" "$ANSWER_FILE" <<'PY'
import sys, re
path, rid, status, ans_path = sys.argv[1:5]
s = open(path).read()
ans = open(ans_path).read().strip() if ans_path != '-' else None
head = re.compile(r'^## ' + re.escape(rid) + r' \| [\w-]+[ \t]*$', re.M)
m = head.search(s)
if not m: sys.exit('request not found')
s = s[:m.start()] + '## ' + rid + ' | ' + status + s[m.end():]
if ans is not None:
    ans = '\n'.join('\\' + l if re.match(r'\s*(#|---\s*$)', l) else l for l in ans.split('\n'))
    i = s.index('### Answer\n', m.start()) + len('### Answer\n')
    j = s.find('\n\n---', i)
    s = s[:i] + ans + s[j:]
open(path, 'w').write(s)
PY
```

Pass `-` as the answer file to change only the status (the lock step).
