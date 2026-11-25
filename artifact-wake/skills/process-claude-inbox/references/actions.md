# Known actions

## plan_my_day

Input JSON: `{"date":"YYYY-MM-DD","tasks":[{"ref":1,"id":"...","title":"...","due":"YYYY-MM-DD","priority":0-3,"status":"..."}]}`

Pick at most 5 tasks to focus on today, most important first. Weigh how overdue each one is, priority (3 is high), and work already in progress. If a calendar connector is available, check today's meetings and say how much focus time is left.

`data`:

```json
{"items":[{"ref":1,"task_id":"123","why":"one sentence"}],"focus_time":"optional, e.g. 3h between meetings"}
```

## reschedule_overdue

Input JSON: same task list, overdue tasks only.

Spread new due dates from tomorrow to 14 days out, at most 3 per day, weekdays preferred, higher priority and more overdue first. Do NOT change the dates. Return suggestions only; the artifact applies them when the owner approves.

`data`:

```json
{"items":[{"ref":1,"task_id":"123","date":"YYYY-MM-DD","why":"one sentence"}]}
```

## Anything else

Do what the description asks. Return a `data` object that fits the result, and keep `summary` readable on its own.
