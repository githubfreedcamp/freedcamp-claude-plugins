# Claude Inbox protocol

One Freedcamp project (default name `Claude Inbox`), private to the owner. Every request is one task.

## Request (written by the artifact or any tool)

- **Title:** `[claude] <action>`, e.g. `[claude] plan_my_day`
- **Description:** a plain-language request, optionally followed by a JSON block:

  ````
  Plan my day from these tasks.

  ```json
  {"date":"2026-11-21","tasks":[{"ref":1,"id":"123","title":"...","due":"2026-11-20","priority":3}]}
  ```
  ````

- **Status:** 0 (not started)

## Status lifecycle

| Status | Meaning |
|--------|---------|
| 0 not started | Queued, waiting for Claude |
| 2 in progress | Claude picked it up (lock) |
| 1 completed | Done, result comment posted |
| 4 review | Error, or needs the owner's confirmation |
| 3 invalid | Rejected (not created by the owner) |

## Result (written by Claude as a task comment)

The first line is exactly `[claude-result]`, then a one-line human summary, then a JSON block:

````
[claude-result]
Picked 4 tasks for today, starting with the overdue invoice.

```json
{"status":"ok","action":"plan_my_day","summary":"Picked 4 tasks for today, starting with the overdue invoice.","data":{}}
```
````

`status` is one of `ok`, `error`, `needs_confirmation`, `rejected`.

Artifacts find the newest comment whose text starts with `[claude-result]` and parse the JSON block. Freedcamp may store comments as HTML, so artifacts strip tags before parsing.
