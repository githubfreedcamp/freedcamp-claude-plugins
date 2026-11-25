# memory.md
updated: {{YYYY-MM-DDTHH:MM+HH:MM}}

## today
plan_date: {{YYYY-MM-DD}}
focus_task_ids: []
ignored_task_ids: []
nudged: {}
<!-- Focus tasks the heartbeat nudged, so it does not ask again within 2 hours. Example:
nudged: { 73755437: { at: 2026-11-20T14:30+02:00, answer: in_progress } }
-->

## projects
<!-- One block per project the user asked for help with. Example:
- project_id: 3782629
  assist: yes
  needs: "research competitors, draft first 10 tasks"
  agent_tasks: [73710001, 73710002]
-->

## offers
<!-- Offers made by the heartbeat, so the same one is not repeated every tick.
- offered: 2026-11-20T12:15+02:00
  job: "research 3 competitors"
  task_ids: [73755437]
  answer: pending | yes | no
-->

## selected_tasks
<!-- The user's latest picks made in chat: "Save focus tasks" after a plan, or a question answer. The dashboard saves its picks in Freedcamp instead (tasks marked In progress).
picked: 2026-11-20T12:15:00+02:00
approved_task_ids: [73755437, 73755440]
ignored_task_ids: [73755441]
offers_yes: [1]
offers_no: []
-->
picked: ""
approved_task_ids: []
ignored_task_ids: []
offers_yes: []
offers_no: []

## agent_activity
<!-- Helper agent progress. The heartbeat adds an entry when it starts a job; the agent updates its own entry (status, result, needs_you, updated). Keep the last 20. Short phrases only. Example:
- id: a1
  agent: researcher | project-manager | work-on-it
  job: "research 3 competitors"
  task_ids: [73755437]
  started: 2026-11-20T14:05+02:00
  updated: 2026-11-20T14:25+02:00
  status: running | needs_you | done | failed
  result: "compared 3 tools, draft comment ready"
  needs_you: "approve the draft comment"
  reported: 2026-11-20T14:15+02:00
  marker_comment_id: ""   (work-on-it only: the "[Claude: work on it]" comment that started it)
-->

## work_queue
<!-- "Work on it" requests from the dashboard (marker comments "[Claude: work on it]"). IDs and counts only.
handled_comment_ids: [30090420]
seen_comments: { 73755437: 2 }
-->
handled_comment_ids: []
seen_comments: {}

## dashboard
dashboard_artifact_url: ""

## last_check
last_check: {{YYYY-MM-DDTHH:MM+HH:MM}}
last_notification_ts: 0
last_notification_id: ""
last_checkin: {{YYYY-MM-DDTHH:MM+HH:MM}}
last_digest: ""
