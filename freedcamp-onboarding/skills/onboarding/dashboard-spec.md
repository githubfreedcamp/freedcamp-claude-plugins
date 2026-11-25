# "Your focus today" dashboard: build spec

No page ships with this skill. You write the page from this spec each time. The spec fixes the layout, colours, copy and behaviour so the result looks and works the same on every build. Follow it; do not invent a different design.

There are two modes:

- **Live** (sections 1 to 13): the Artifact tool is available. The page reads Freedcamp itself through the viewer's Freedcamp connector and can write back.
- **Static** (section 14): no Artifact tool. Same look, data baked in, read only: it has no action buttons, because a saved page cannot reach Freedcamp or Claude.

Live mode includes the picks controls in section 9a: a checkbox per task, Approve and Ignore, "Help with this", the "I can help with" offers, and a Confirm bar. Every control acts from the page itself, through `claude.use('mcp')` (Freedcamp) and `claude.use('sample')` (Claude drafting), exactly as "Plan my day" and "Suggest dates for my overdue tasks" do (section 10). No control produces text for the user to carry back to a Claude session.

Copy rule for both modes: page text never contains an em dash or en dash.

## 1. File shape (live)

Write one file named `focus-today.html`, in the shape the Artifact tool publishes:

1. a `title` element reading "Your Focus Today"
2. one `style` element
3. a `meta` element named `claude:viewport-fit-sides` with the content `true`
4. Google Fonts: a preconnect to `https://fonts.googleapis.com` and one stylesheet for Plus Jakarta Sans (weights 400, 500, 600, 700, 800) and IBM Plex Mono (weight 500), `display=swap`
5. the page markup
6. one `script` element with `type="application/json"` and `id="fc-session"` holding the session context (section 9a)
7. one inline `script` element, wrapped in an immediately invoked function with `'use strict'`

Do not write the `html`, `head` or `body` wrapper elements; the Artifact tool adds them. No external scripts and no other external stylesheets. No build step, no framework.

## 2. Design tokens

Define every colour as a custom property on `:root`. Repeat the dark values in two places: inside `@media (prefers-color-scheme:dark)` on `:root:not([data-theme="light"])`, and on `:root[data-theme="dark"]`.

| Token | Light | Dark |
|---|---|---|
| `--page` | `#ebeef2` | `#11151c` |
| `--surface` | `#fff` | `#1a202b` |
| `--sunken` | `#f7f8fa` | `#212836` |
| `--line` | `#e7eaf0` | `#2b3444` |
| `--line-strong` | `#aebacc` | `#46536a` |
| `--text` | `#252e3d` | `#e8ecf2` |
| `--muted` | `#5c7499` | `#9aa9c0` |
| `--accent` | `#1f6fdb` | `#6aa8ff` |
| `--accent-tint` | `#e8f1fe` | `#1c2c46` |
| `--red` | `#c8372b` | `#ff8277` |
| `--red-tint` | `#fdecea` | `#3a1f1f` |
| `--amber` | `#8a6a00` | `#f0c445` |
| `--amber-tint` | `#fbf3d9` | `#352d16` |
| `--green` | `#1e8a4c` | `#5fd08f` |
| `--green-tint` | `#e5f5ec` | `#16301f` |
| `--pink` | `#c41e5c` | `#ff6e9f` |
| `--pink-tint` | `#fce7ef` | `#3a1a27` |
| `--skel` | `#eef1f5` | `#263042` |
| `--backdrop` | `rgba(20,26,36,.45)` | `rgba(0,0,0,.6)` |
| `--shadow` | `0 20px 60px rgba(20,30,50,.25)` | `0 20px 60px rgba(0,0,0,.6)` |
| `--btn` | `#1f6fdb` | same |
| `--btn-text` | `#fff` | same |

Base styles: `box-sizing:border-box` on everything; `[hidden]{display:none!important}`; body has no margin, background `--page`, colour `--text`, font `15px/1.5 "Plus Jakarta Sans", system-ui, sans-serif`. Buttons, inputs and textareas inherit font and colour. Links use `--accent`. `:focus-visible` shows a 2px `--accent` outline with a 2px offset. Disabled buttons are 55% opaque.

## 3. Layout, top to bottom

A wrapper 760px wide at most, centred, padding 16px top, 32px bottom, side gutters `max(16px, env(safe-area-inset-left))` and the matching right inset. Inside it one card: `--surface`, 1px `--line` border, radius 14px, overflow hidden.

Inside the card, in this order:

1. **Header** (padding 20px 24px 18px, wraps on narrow screens). Left: a 40px square logo tile, radius 10px, background `#2780f8`, holding a white check-mark icon (an inline SVG stroke path, 22px). Next to it the `h1` "Your focus today" (20px, weight 800) and a subtitle line (13px, `--muted`) that reads "Loading your Freedcamp..." until data arrives. Right: an "Apply my day" button (primary, the first control on the page, section 9a), then a "Refresh" button.
2. **Banner**: hidden until needed, `role="alert"`, `--amber-tint` background, `--amber` text, weight 600, radius 10px, margin 0 24px 16px.
2a. **Check-in** (only when the session context has `nudges` or `checkin` lines), padding 0 24px 14px, 14px. A small heading "Check-in" (12px uppercase, weight 700, `--muted`). First the `nudges`, one line each, in the order given: the text, then, when the task is loaded, small row-size buttons: "Work on it" (primary, first; opens the task dialog with the "Help with this" panel and its "Work on it" choice open, section 9a), "Open" (ghost; opens the task dialog, section 9), "Mark done" (`fc_update_status` with `{ item_id, status: 1 }`, then the row is marked done as in section 9), "Mark in progress" (`fc_update_status` with `{ item_id, status: 2 }`; hidden when it already is), "Blocked" (opens the task dialog with the comment box filled with "Blocked: " and focused, so the user writes the reason and presses "Post comment"), and "Reschedule" (shows a date input with `min` set to tomorrow and an "Apply date" button that calls `fc_update_task` with `{ task_id, due_date }`, as in section 10 Apply). Each button shows "Saving..." while it runs, then a green "Saved" label or the error. Then the `checkin` lines as a short numbered list.
2b. **Helpers** (only when the session context has `agent_activity`), padding 0 24px 14px. A small heading "Helpers" styled like the Check-in heading, then one row per entry: the agent name ("Researcher", "Project manager", or the value as given) in weight 600, the job, and a status pill: `queued` default "Queued", `running` blue "Running", `needs_you` amber "Needs you", `done` green "Done", `failed` red "Failed". The agent `work-on-it` reads "Claude (Work on it)". Under it, in 13px `--muted`: the `result`, the task titles for `task_ids` (buttons that open the task dialog when the task is loaded, else "task <id>"), and "Updated HH:MM" from `updated`. When `needs_you` is set, add a line in `--amber`, weight 600: "Needs you: " plus the text. Helper rows are display only: helpers run in the Claude Code session, and their drafts are approved there.
3. **Tiles**: a `nav` with four link tiles in a 4 column grid (2 columns under 560px), gap 10px. Each tile is `--sunken` with a 1px `--line` border, radius 12px, a number (24px, weight 800) over a label (12px, `--muted`, weight 600). Each links to its section's anchor.

   | Tile label | Number colour |
   |---|---|
   | Overdue | `--red` |
   | Due next 7 days | `--accent` |
   | In progress | `--text` |
   | Waiting on you | `--pink` |

4. **Bands**. Each band has a 1px top border and a heading strip: `--sunken` background, padding 10px 24px, 12px uppercase, weight 700, letter spacing .06em, `--muted`, followed by the item count in IBM Plex Mono in `--text` (the Ask band has no count). Bands in order:
   1. "Ask Claude what is next" (section 10)
   1a. "I can help with" (section 9a; only when the session context has offers)
   2. "Overdue"
   3. "Due next 7 days"
   4. "In progress"
   5. "Waiting on you"
   6. "Recent updates"
5. **Footer** (12px, `--muted`, 1px top border): "Completing a task, posting a comment and applying a date change your real Freedcamp account." When the task call reported more pages, put "Showing your first 100 assigned tasks. " in front.

Directly under the tiles: the picks toolbar (section 9a). Outside the card: the Confirm bar (section 9a), the task dialog (section 9) and a toast (fixed, bottom centre, `--text` background with `--surface` text, `role="status"`, `aria-live="polite"`, clears itself after 5 seconds).

While data loads, each list shows two or three skeleton bars (14px tall, `--skel`, radius 6px, a gentle opacity pulse that is switched off under `prefers-reduced-motion`). Tiles show "-" until data arrives.

Mark the Apply my day button, the Refresh button, the tiles and the block of all six bands so they can be hidden together when the connector is missing (section 4). The header, banner and footer stay visible.

### Shared pieces

- **Button**: 1px `--line` border, `--surface` background, radius 9px, padding 7px 12px, 13px, weight 600. Hover darkens the border to `--line-strong`. A primary button uses `--btn` with `--btn-text`. A ghost button has a transparent background.
- **Pill**: radius 999px, padding 1px 8px, 11px, weight 700, `--sunken` with a `--line` border by default. Coloured pills use the matching tint as background and the colour as text with no border: red, amber, green, blue (accent), pink.
- **Tag**: IBM Plex Mono 11px, padding 1px 6px, radius 5px, `--accent-tint` background, `--accent` text.
- **Rows** (tasks and notifications): flex, gap 12px, padding 12px 24px, 1px `--line` between rows.
- **Text inputs**: full width, 1px `--line` border, radius 9px, padding 8px 10px, 14px. Textareas are at least 84px tall and resize vertically.
- **Status line**: 12px `--muted`, `aria-live="polite"`, turns `--red` for errors.
- **Empty state**: `--muted`, 14px, padding 14px 24px. Section errors use the same box in `--red`, weight 600.

## 4. Capabilities and start-up

The page uses two capabilities, declared when it is published (the skill gives the exact JSON): `mcp` for the Freedcamp connector and `sample` for Claude drafting.

- Get a capability with `await claude.use(name)`. It can be `null`, and `claude` may not exist at all, so guard it:

  ```js
  async function useCap(name) {
    try { return (typeof claude !== 'undefined' && claude && claude.use) ? (await claude.use(name)) || null : null; }
    catch (e) { return null; }
  }
  ```

- On start: attach the event listeners, then await `mcp`. Ask for `sample` without waiting for it.
- If `mcp` is `null`: show the banner "Open this page from claude.ai to load your Freedcamp tasks and updates.", hide the Refresh button, tiles and bands, set the subtitle to "Not connected", and stop.
- `sample` can arrive late or be `null` at start. Never hide the Claude buttons because of it. Ask for it again when a Claude button is clicked. If it is still `null`, show in that control's status line: "Claude drafting is not available. Allow it in the page permissions."
- Every Freedcamp call is `mcp.callTool('Freedcamp', tool, input, { cache: false })`. Read `result.payload`. If the payload is a string, parse it as JSON.
- Call only these eight tools: `fc_fetch_current_session`, `fc_fetch_tasks`, `fc_fetch_task`, `fc_fetch_notifications`, `fc_update_status`, `fc_update_task`, `fc_add_comment`, `fc_add_task`. A tool that is not in the published list is refused.

## 5. Loading data

Loading runs at start and on Refresh. Disable Refresh while it runs and clear the banner first.

1. `fc_fetch_current_session` with `{}`. The data is under `data` (fall back to the payload itself). Keep:
   - `user_id` as a string: the current user.
   - `users` (an array): index it by `user_id`. From the current user take `full_name` (else `first_name`, else "you"), `first_name` and `timezone`.
   - `projects` (an array): index it by `project_id` to get each `project_name`.
   - Timezone: the user's `timezone` if `Intl.DateTimeFormat` accepts it, else the browser's timezone, else `UTC`.

   If this call fails: show the error (section 11) in the banner, set the subtitle to "Could not load Freedcamp.", re-enable Refresh and stop.
2. Then, together with `Promise.allSettled` so one failure does not blank the other:
   - `fc_fetch_tasks` with `{ filters: { assigned_to_id: [userId], order_due_date: 'asc' }, limit: 100 }`. The payload is `{ tasks: [...], meta: { has_more } }` with no `data` wrapper. Never send a `status` filter (it returns HTTP 400). Drop tasks whose `status` is 1 (completed) or 3 (invalid) yourself. Remember `has_more` for the footer.
   - `fc_fetch_notifications` with `{}`. The list is at `data.notifications`.
3. A failed call puts its error text inside the sections it feeds, those tiles show "-" and those heading counts are empty. The other sections render normally.
4. Subtitle after loading: `<First name>, <Weekday>, <Month> <day> · Updated <HH:MM>`, for example "Angel, Thursday, November 19 · Updated 14:05". The time is 24 hour, in the user's timezone. Leave the first name out when it is unknown.

### Field names

These are the real field names in the Freedcamp responses. Use them exactly and do not guess alternatives. Ids arrive as strings or numbers, so compare them as strings.

**Session** (`fc_fetch_current_session`, under `data`):

| Field | Meaning |
|---|---|
| `user_id` | the current user's id |
| `users` | an array; each has `user_id`, `full_name`, `first_name`, `timezone` |
| `projects` | an array; each has `project_id`, `project_name` |

**Task in the list** (`fc_fetch_tasks`, each entry of `tasks`):

| Field | Meaning |
|---|---|
| `id` | the task id. Send it as `item_id` to `fc_update_status` and as `task_id` to `fc_fetch_task` and `fc_update_task` |
| `title` | may have several lines and a leading bracket tag |
| `project_id` | look the name up in the session projects |
| `status` | 0 not started, 1 completed, 2 in progress, 3 invalid, 4 review |
| `priority` | 0 none, 1 low, 2 medium, 3 high |
| `due_ts` | Unix seconds, or empty when there is no due date |
| `url` | the task's address on the Freedcamp site |

**Single task** (`fc_fetch_task`): the same fields, plus `list_title`, `status_title`, `assigned_to_fullname`, `description_processed` (HTML; fall back to `description`), `can_comment`, `can_progress`, and:

- `children`: the subtasks, each with `title` and `status`.
- `comments`: each with `user_full_name` (fall back to the session name for `user_id`), `created_ts` (Unix seconds) and `description_processed` (HTML; fall back to `description`).

**Notification** (`fc_fetch_notifications`, each entry of `data.notifications`):

| Field | Meaning |
|---|---|
| `uid` | a unique key for the row. If it is missing, use `app_id` and `item_id` joined with an underscore |
| `app_id` | which app the item belongs to (2 is Tasks) |
| `item_id` | the item's id. For a task this is the task id |
| `item_title` | the item's title |
| `project_id` | look the name up in the session projects |
| `f_can_add_comment` | `false` means the user cannot comment |
| `actions` | an array, oldest first |

Each action has `action_type` (a number), `action_ts` (Unix seconds), `user_id` (who did it) and `changed_properties`, an array whose entries have `property_name`, `old_value`, `new_value`, `old_value_human` and `new_value_human`. A notification has no `url`.

Action types: 1 created the item, 2 edited it, 4 reassigned it, 9 commented, 19 added a wiki version, 21 changed its status.

**Calls and answers.** A failed `callTool` rejects with an error that has a `code` and a `message`. `sample` is a function: `sample(prompt, options)` resolves to an object with `text`, and `sample.json(prompt, options)` resolves to the parsed value.

## 6. Dates

`due_ts` is Unix seconds at local midnight in the user's timezone, which is the previous day in UTC. Always convert to a `YYYY-MM-DD` string in the user's timezone before comparing or showing a day:

```js
new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(sec * 1000))
```

"Today" is that same conversion of the current time. Do day arithmetic on these strings (parse them as UTC midnight). Short dates read like "Aug 25".

Due label and pill colour for a task:

| Case | Text | Pill |
|---|---|---|
| no `due_ts` | No due date | default |
| past | "1 day overdue" or "N days overdue" | red |
| today | Due today | amber |
| tomorrow | Due tomorrow | blue |
| later | Due Aug 25 | default |

Relative time for activity: under an hour "12m ago" (at least 1m), under a day "5h ago", under 7 days "3d ago", otherwise the short date.

## 7. Task sections

Buckets, using the open tasks from section 5:

| Section | Rule | Order | Empty text |
|---|---|---|---|
| Overdue | due before today | most recently due first | Nothing overdue. Nice. |
| Due next 7 days | due today through today plus 7 | soonest first | Nothing else is due through Aug 26. (the last day of the window) |
| In progress | no due date and `status` 2 | as returned | Nothing in progress without a due date. |

A task due later than the window, or with no due date and not in progress, appears in no section.

Overdue shows 5 rows, then a full-width text button "Show N more overdue". Pressed, it shows all rows and reads "Show fewer overdue".

The heading count is the number of tasks in the section. The tile number leaves out tasks completed during this visit.

**Title handling.** Use only the first line of a title. If it starts with a bracketed word group of up to 40 characters, such as "[FRONTPAGE] Add cookies", show that group, without the brackets, as a tag and the rest as the title. The 40 characters are counted inside the brackets. If nothing follows the tag, use the tag text as the title too. An empty title reads "Untitled".

**Task row**, left to right:

1. A round check button, 22px, 2px `--line-strong` border, holding a small check icon that is invisible until hover (green). `aria-pressed` reflects the state. `aria-label` is "Complete: " or "Undo complete: " followed by the task title.
2. A body with two lines:
   - the tag if any, the title as a text button (weight 600; opens the task dialog), and a small "Freedcamp" link that opens the task on the real site in a new tab;
   - a meta line (12px, `--muted`): project name, the due pill, a priority pill ("Low" default, "Medium" amber, "High" red, nothing for none), and a blue "In progress" pill when `status` is 2.

A completed row has a filled green check and a struck-through muted title.

**Task link.** Use the task's `url` only if it is an `https://` address on `freedcamp.com` or a subdomain. Otherwise build `https://freedcamp.com/view/<project_id>/tasks/<task_id>`.

## 8. Notifications

Turn each notification into one row, or skip it.

**Prepare.** Drop empty edits (action type 2 with no `changed_properties`). Sort the remaining actions newest first. If none remain, skip the notification. A comment's HTML is the `new_value` of the changed property named `title` or `description` on a type 9 action.

**Nouns by `app_id`:** 2 "a task", 3 "a discussion", 4 "a milestone", 6 "a file", 13 "an issue", 14 "a wiki", 19 "a calendar event", anything else "an item".

**Classify.** Take the first rule that matches:

| # | Kind (pill) | When | Line after the actor's name | Reply offered |
|---|---|---|---|---|
| 1 | Needs you (pink) | the newest comment is by someone else and asks a question | asked a question on <noun> | yes |
| 2 | Mention (blue) | any comment by someone else mentions the user | mentioned you on <noun> | yes |
| 3 | Event (default) | `app_id` is 19 | "added a calendar event" if any action is type 1, else "updated a calendar event" | no |
| 4 | Completed (green) | any type 21 action has a changed property named `status` whose `new_value_human` is "Completed" or whose `new_value` is 1 | completed <noun> | no |
| 5 | Reassigned (amber) | the newest action is type 4 | see below | no |
| 6 | Comment (default) | the newest action is type 9 | commented on <noun> | yes |
| 7 | Edit (default) | anything else | see below | no |

- **Question test:** convert the comment to plain text, remove URLs, then look for a `?` that is followed by whitespace, a closing quote or bracket, or the end of the text. A `?` inside a link is not a question.
- **Mention test:** parse the comment HTML and look for an element with class `fc_mention` whose `data-id` equals the user's id.
- **Reassigned line:** read the `assigned_to_id` change. Old value is the user: "took over a task from you". New value is the user: "assigned a task to you". Otherwise "reassigned a task to <new_value_human>".
- **Edit line:** "updated the <label> of <noun>", from the first changed property of the newest action. Labels: `assigned_to_id` assignee, `assigned_ids` assignees, `due_date` due date, `start_date` and `date_start` start date, `date_end` end date, `task_group_id` list, `cs_id` status, `r_rule` and `r_rule_str` recurrence, `cf_tpl_id` custom fields, `f_all_day` all-day setting, `notify_users_str` watchers. For any other property use its name with underscores turned into spaces. With no property: "added <noun>" for a type 1 action, else "updated <noun>".
- **Actor and time** come from the action that matched (the completing action for rule 4, the mentioning comment for rule 2), otherwise the newest action.
- **Quote:** a comment as plain text on one line, cut to about 160 characters with an ellipsis. For Needs you, Mention and Comment it is the comment that matched the rule, so the quote and the actor belong together. For Completed, Reassigned and Edit it is the newest comment, if there is one. Event shows no quote. Keep the full text for drafting.
- **Can reply** also needs `f_can_add_comment` not to be `false`.

**Order and placement.** Needs you first, then newest first. "Waiting on you" holds the Needs you rows; its count is also the fourth tile. "Recent updates" holds the rest. Empty texts: "Nobody is waiting on an answer from you." and "No recent updates."

**Notification row:**

1. A 30px round avatar with the actor's initials (`--accent-tint` background, `--accent` text).
2. A body:
   - "**Actor name** line" followed by the kind pill. An unknown user reads "Someone".
   - the tag if any and the item title as a link: the task link for `app_id` 2, `https://freedcamp.com` for every other app. Do not guess other URL patterns.
   - a meta line: project name and the relative time.
   - the quote: `--sunken` background, a 3px `--line-strong` left border, 13px.
   - actions: "Open task" for `app_id` 2 (opens the task dialog); "Reply" and "Draft reply with Claude" when a reply is offered. "Draft reply with Claude" on the row opens the composer and starts drafting at once. After a successful post, a green "Reply posted" label replaces the reply buttons.

## 9. Interactions

Use one delegated click listener on the document. Rows are re-rendered often, so keep typed text and open state in page state, not only in the DOM.

**Complete a task.** The check button calls `fc_update_status` with `{ item_id, status: 1 }`. Mark the row done first and remember the task's original status. On failure, undo and show the error in the toast. Clicking a done row restores the original status with the same tool (not always 0); on failure, mark it done again and show the error.

**Reply to a notification.** "Reply" opens a composer under the row: a textarea, "Post reply" (primary), "Draft reply with Claude", "Cancel", and a status line. Posting calls `fc_add_comment` with `{ item_id, app_id, description }` as plain text. Empty text: "Write a reply first." While posting: "Posting...". On success: close the composer, show "Reply posted" and a toast "Reply posted." On failure: show the error plus " It may have gone through, so check the task before posting again." Never retry a write automatically.

**Task dialog.** Opened by a task title, an "Open task" button, or a title in an Ask card.

- Markup: a fixed full-screen layer holding a backdrop (`--backdrop`) and a panel with `role="dialog"`, `aria-modal="true"`, `aria-labelledby` pointing at the title, `tabindex="-1"`. Panel: `--surface`, 680px wide at most, radius 14px, `--shadow`, padding 22px 24px, with a 32px close button (×, `aria-label="Close"`) in the top right corner. Give the hidden layer an explicit `display:none` rule so its `display:flex` does not override `hidden`.
- Open: show "Loading task..." with skeleton bars, lock body scrolling, focus the panel, then call `fc_fetch_task` with `{ task_id }`. The task is the payload itself, or under `task` or `data.task`. If the dialog was closed or another task was opened meanwhile, ignore the late answer. On failure: title "Could not open this task" and the error text.
- Content, in order:
  1. tag, then the title;
  2. meta: project name, list name (`list_title`), an "Open in Freedcamp" link;
  3. pills: status (`status_title`; green when completed, blue when in progress), the due pill, "Assigned to <assigned_to_fullname>", "<Priority> priority";
  4. "Description": plain text with line breaks kept (`white-space:pre-wrap`), or "No description." Use `description_processed`, else `description`;
  5. "Subtasks" when `children` is not empty: one line each, a green ✓ for completed or ○, then the first line of the title;
  6. "Comments (N)": oldest first, each "**Author** · relative time" over the text, or "No comments yet.";
  7. "Add a comment": a one-line input with the placeholder "Optional instruction for Claude, e.g. say it ships Friday", a textarea, then "Post comment" (primary), "Draft reply with Claude", and "Mark complete".
- Hide the whole composer when `can_comment` is `false`. Hide "Mark complete" when `can_progress` is `false` or the task is already completed. If only "Mark complete" is allowed, show it alone.
- "Post comment" calls `fc_add_comment` with `{ item_id, app_id: 2, description }`. On success, add the comment to the list locally as the current user, "just now", clear the box and say "Comment posted." Failure reads as for replies.
- "Mark complete" calls `fc_update_status` with `{ item_id, status: 1 }`, says "Completing..." then "Task completed.", turns the status pill green, marks the matching row done and updates the tiles. Keep any text already typed in the comment box. On failure, show the error in the dialog's status line and re-enable the button.
- Close with Escape, the backdrop or the close button. Unlock scrolling and return focus to the control that opened it; if that row was re-rendered, find it again. Trap Tab and Shift+Tab inside the panel.

**Write rule (every control).** The page writes to Freedcamp only after the user clicks a button that names the change ("Post comment", "Save description", "Create 3 subtasks", "Assign to Dima", "Apply in Freedcamp", "Mark done"). Anything Claude drafted is shown first in an editable preview. Nothing writes on load, on a checkbox change, or after a draft finishes. Never retry a write automatically.

**Draft with Claude** (notification composer and dialog). Call `sample(prompt, { modelTier: 'quick', cache: false, onText })`. `onText` receives the whole answer so far (a string, or an object with `text`); put it in the textarea each time. While drafting, disable that composer's buttons and say "Claude is drafting...". When done, replace any em or en dash in the text with a comma and a space, then say "Edit the draft, then post it." or, if nothing came back, "Claude returned nothing. Try again." On failure, show the error and restore the earlier text if nothing was streamed. The user always edits and posts; never post a draft automatically.

Every drafting prompt includes this instruction, with the user's name filled in:

> Write in first person as <name>, 2 to 4 sentences, plain text, no greeting or sign-off, no em dashes. Do not invent facts, dates, numbers or promises that are not in the context; if something is unknown, say you will check. Reply with the message text only.

- Notification draft prompt: "Draft a reply to a Freedcamp comment for <name>.", the instruction above, then the item title, the project name, and "<actor> wrote:" followed by up to 1500 characters of the comment.
- Dialog draft prompt: "Draft a comment on a Freedcamp task for <name>.", the instruction above, then the task title, its status, the first 700 characters of the description, the last 5 comments oldest first as "Author: text" (600 characters each), and the optional instruction as "Instruction from <name>: ...".

**Refresh** reloads everything and forgets which rows were completed during the visit.

## 9a. Picks: select, approve, ignore, help, offers, confirm

The page lets the user pick what to work on today, get help on a task, and act on the session's offers, all from the page. Every action runs in the page through `mcp.callTool('Freedcamp', ...)` and `sample.json(...)`, the same mechanism as section 10, and follows the write rule in section 9. The page cannot reach the Claude session or the user's files, so it never writes `memory.md`; what it saves lives in Freedcamp (see "Confirm" below).

**Session context.** Claude fills the `fc-session` JSON block when it publishes, from `./.freedcamp/memory.md` when that file exists, else with empty values. Escape `<` as `\u003c` inside it.

```json
{"generated_at": "2026-11-20T12:15:00+02:00", "focus_task_ids": ["73755437"], "ignored_task_ids": [], "offers": [{"n": 1, "job": "Research 3 competitors for \"Write brief\"", "task_ids": ["73755437"]}], "checkin": ["Focus: 1 of 3 done.", "Write brief is now overdue (2 days)."], "nudges": [{"id": "73755437", "text": "Hey, how's Write brief going? It's 2 days overdue."}], "agent_activity": [{"agent": "researcher", "job": "research 3 competitors", "task_ids": ["73755437"], "status": "needs_you", "result": "compared 3 tools, draft comment ready", "needs_you": "approve the draft comment", "updated": "2026-11-20T14:25:00+02:00"}, {"agent": "work-on-it", "job": "work on Fix login bug", "task_ids": ["73755440"], "status": "running", "result": "reproduced the bug, testing a fix", "needs_you": "", "updated": "2026-11-20T15:10:00+02:00"}], "recommended": [{"id": "73755437", "reason": "in today's plan"}, {"id": "73755441", "reason": "overdue, do today"}, {"id": "73755440", "reason": "I offered to help"}]}
```

Read it with `JSON.parse` inside a try block; on failure use empty values. A missing field counts as empty. `nudges`, `checkin` and `agent_activity` are display only (section 3, items 2a and 2b): render their text with `textContent`, and they take no part in picks or Confirm (the nudge buttons in item 2a act on their task directly). IDs are strings. Ignore IDs that are not among the loaded tasks.

**Recommended tasks.** `recommended` is the agent's suggestion of what to check off today: at most 8 entries, each a task `id` and a short `reason` (40 characters at most, plain text). Claude fills it when it publishes, from three sources, in this order, without repeats: tasks in today's plan (`"in today's plan"`), overdue tasks triaged "do today" (`"overdue, do today"`), and tasks tied to its offers (`"I offered to help"`). An empty list means nothing is pre-checked.

**Task rows.** Every task row (sections 7 and 10 cards too) gets, before the round complete button, a square checkbox (18px, `accent-color: var(--accent)`, `aria-label` "Select: " plus the title). At the end of the row, two small toggle buttons, "Approve" and "Ignore" (`aria-pressed`, padding 3px 9px, 12px). Pressed Approve uses `--green-tint` with `--green` text and border; pressed Ignore uses `--red-tint` with `--red`. Pressing a pressed button clears it. An approved row has a light `--green-tint` background; an ignored row has a muted, struck-through title. IDs in `focus_task_ids` start approved and IDs in `ignored_task_ids` start ignored.

**"Help with this" button.** Every task row (sections 7 and 10 cards too) also gets, just before Approve, a button labeled exactly "Help with this": the primary style of "Apply my day" (`--btn` background, `--btn-text` text) in the row size (padding 3px 9px, 12px, radius 9px), `aria-label` "Help with this: " plus the title. It opens the task dialog (section 9) with a "Help with this" panel at the top of its content, above the description. It does not change checks, Approve, Ignore or the Confirm count.

The panel reads "What help do you want on this task?" over six choice buttons: "Work on it" (primary, first), then "Update description", "Add a comment", "Create subtasks", "Assign it", "Plan it" (secondary). One choice is open at a time, with a "Cancel" that closes it. Each choice uses the task the dialog fetched with `fc_fetch_task` (it carries `project_id`, `list_id` and `h_parent_id`). Drafting choices call `sample.json(prompt, { modelTier: 'default', cache: false })` with the help context below, show "Claude is drafting...", and disable the choice's buttons while it runs. Remove dashes from drafted text as in drafting. If `sample` is `null`, say "Claude drafting is not available. Allow it in the page permissions."

**Help context** (sent with every help prompt): today's date, the user's name, the task title, project, list, status, due label, assignee, the first 1500 characters of the description as plain text, the subtask titles, and the last 5 comments oldest first as "Author: text" (600 characters each). End every help prompt with: "Use only facts in the context; do not invent dates, numbers, people or promises. Plain text, no em dashes. Reply with JSON only, in exactly the shape given."

0. **Work on it** (no drafting). Shows the line "Claude will work on this task in your Claude Code session and post progress here as comments.", a one-line input labelled "Instruction for Claude (optional)" with the placeholder "e.g. focus on the pricing section", and "Start working" (primary). "Start working" calls `fc_add_comment` with `{ item_id: <task id>, app_id: 2, description }`, where the description is plain text in exactly this shape (the second line only when an instruction was typed; the instruction on one line, at most 500 characters):

   ```
   [Claude: work on it]
   Instruction: focus on the pricing section
   Queued from the Your Focus Today dashboard.
   ```

   While it posts: "Queuing..." with the button disabled. On success: replace the choice with "Queued. Claude picks this up on the next check-in.", add the comment to the dialog's list, and give the task's row (and its dialog pills) a blue pill "Claude working". On failure: the error plus " It may have gone through, so check the task before trying again." Never post the marker twice for the same task in one visit; while the pill shows, the choice reads "Claude is already on this task." with no button.
   The "Claude working" pill also shows on load for every task in an `agent_activity` entry whose `status` is `running` or `queued`.
1. **Update description.** Prompt: "Rewrite the description of this Freedcamp task so anyone on the team knows what it is about, what done looks like, and any open questions. At most 150 words, short paragraphs or lines starting with "- "." Shape `{"description":"..."}`. Show the draft in an editable textarea with the hint "This replaces the current description.", then "Save description" (primary). Save calls `fc_update_task` with `{ task_id, description }`; on success, update the dialog's description and say "Description saved."
2. **Add a comment.** Focus the dialog's existing "Add a comment" box and start its "Draft reply with Claude" at once (section 9). The user edits and presses "Post comment" as usual.
3. **Create subtasks.** Prompt: "Break this Freedcamp task into at most 5 concrete subtasks, each a short action title under 80 characters. Leave out any that already exist under Subtasks." Shape `{"subtasks":[{"title":"..."}]}`. Keep at most 5 non-empty titles. Show each as an editable text input with a checkbox (checked), then "Create N subtasks" (N is the number checked). It calls `fc_add_task` once per checked title, one at a time, with `{ project_id, list_id, title, h_parent_id: <task id> }`. Freedcamp does not allow a subtask under a subtask, so when the task has a non-empty `h_parent_id`, leave `h_parent_id` out, label the button "Create N tasks in the same list", and say so above it. Each line then shows "Created" (linked to the new task's `url` from `data.tasks[0]`, if it passes the task link rule) or its error, and the run carries on after a failure. Afterwards re-fetch the task so the Subtasks list updates.
4. **Assign it.** A `select` (labelled "Assign to") of the session users by `full_name`, the current user first as "Me (<name>)", with the current assignee preselected and marked "(current)". Then "Assign to <name>" (primary; disabled while the current assignee is selected). It calls `fc_update_task` with `{ task_id, assigned_to_id }` and, on success, updates the dialog's "Assigned to" pill and says "Assigned to <name>." If Freedcamp refuses (for example, the person is not in the project), show the error.
5. **Plan it.** Prompt: "Write a short step-by-step plan to finish this Freedcamp task, at most 8 steps, each with a rough time in minutes." Shape `{"summary":"one sentence","steps":[{"step":"...","minutes":30}]}`. Keep steps with a non-empty `step`; keep `minutes` only when it is a whole number from 5 to 480. Show the summary, the numbered steps with their times and the total ("About 2 h 15 min"), then two buttons: "Post plan as comment" (`fc_add_comment` with `{ item_id, app_id: 2, description }`, the summary and the numbered steps as plain text) and "Create steps as subtasks" (opens the Create subtasks list from choice 3, filled with the steps instead of asking Claude).

Under the choices, a muted line: "Work on it hands this task to Claude in your Claude Code session. Progress shows up here as comments."

**Pre-checked suggestions.** When the tasks first load, check the checkbox of every row whose ID is in `recommended`, unless that ID is in `ignored_task_ids`. Under the title of each suggested row, show a hint in the meta line: a blue pill (`--accent-tint`, `--accent`) reading "Suggested: " plus the reason, e.g. "Suggested: in today's plan". Keep the hint while the row stays checked; when the user unchecks it, keep the pill but dim it (55% opacity) so they can still see it was suggested. The user can uncheck any suggestion. Pre-checking happens once per page load: a Refresh keeps the user's current checks and does not re-check rows they unchecked. Suggested rows are not approved until the user presses Approve or Confirm; at Confirm a checked row with no decision counts as approved, as below.

**Suggestions from "Plan my day" on the page.** When the page's own "Plan my day" (section 10) returns items, check those rows too (unless the user unchecked them or they are ignored) and give them the hint "Suggested: in Claude's plan". Do not uncheck anything else.

**"Apply my day" button** (header, section 3). One click checks the tasks the agent thinks are best for today:

1. Build the suggestion list, without repeats, in this order: every `recommended` entry (with its own reason), then every item from the page's latest "Plan my day" result, if it ran during this visit (reason "in Claude's plan"). Keep only tasks that are loaded, still open, and not ignored in the current page state (an Ignore pressed on the page counts, as does `ignored_task_ids`).
2. If that list is empty because there were no suggestions at all (not because every suggestion was ignored or done), and there are open tasks, run the page's own "Plan my day" request exactly as in section 10 (same pool, prompt, validation and rendering into the "Ask Claude what is next" band). While it runs, the button reads "Planning..." and is disabled, and the band's two buttons are disabled too. Then build the list again from its items. If `sample` is `null`, the request fails, or no item survives validation, skip to step 4 with an empty list; the band shows its usual message.
3. Check every row in the list, including rows the user unchecked earlier (the click is an explicit request). Show the "Suggested: " pill with the reason on each one, at full opacity. Never uncheck a row, and never change an Approve or Ignore decision. Update the Confirm bar count.
4. Toast: "Checked N suggested tasks." ("Checked 1 suggested task."), counting rows that were not checked before the click. If all were already checked: "All N suggested tasks are already checked." If the list is empty: "No suggestions yet".

The button calls no Freedcamp tool and writes nothing; only Confirm writes picks to Freedcamp. It is disabled while the tasks are loading.

**Picks toolbar** (padding 10px 24px, wraps): "Select all shown", "Approve selected", "Ignore selected", "Clear". The last three are disabled while nothing is checked. Approve, Ignore and Clear apply to the checked rows, then uncheck them.

**Offers band** "I can help with": one row per offer, "<n>. <job>" and a muted "(task <titles>)", with two row-size buttons, "Start" (primary) and "Dismiss" (ghost).

- **Start** runs the offer on the page. Fetch each tied task with `fc_fetch_task` (at most 3), then call `sample.json` with: "Do this job for <name>: <job>.", the help context of each task, and "You cannot browse the web. If the job needs outside research, list what to look up and why instead of inventing facts." with the shape `{"summary":"one sentence","result":"plain text, at most 250 words"}`, plus the closing line of the help context. Show the summary and the result in an editable textarea under the offer, then "Post as comment on <first task title>" (primary; `fc_add_comment` with `{ item_id, app_id: 2, description }`) and "Discard". After posting, the offer shows a green "Posted" label.
- **Dismiss** hides the offer on this page. It writes nothing.

**Confirm bar.** Fixed to the bottom of the viewport, full width, `--surface`, 1px top `--line` border, inner width 760px. Add bottom padding to the page wrapper and `scroll-padding-bottom` to the root so the bar never hides a focused row. Left: a live count (`aria-live="polite"`), e.g. "3 to work on, 1 ignored." or "Nothing picked yet." A checked row with no decision counts as approved, and the count says so. When suggestions are pre-checked, add "N suggested tasks are checked. Uncheck any you don't want." until the user changes a check. Right: "Confirm" (primary).

**Confirm** saves the picks in Freedcamp, where the next check-in can see them. It opens a confirm panel just above the bar (`role="dialog"`, `aria-labelledby` its heading) that lists the exact changes:

- "Mark In progress in Freedcamp: <titles>": approved or checked tasks whose `status` is 0.
- "Already in progress or in review: <titles>": no change.
- "Ignored on this page only: <titles>": nothing is written to Freedcamp for these.

Buttons: "Apply in Freedcamp" (primary, shown only when there is at least one change) and "Cancel". Apply calls `fc_update_status` with `{ item_id, status: 2 }` for each task in the first list, one at a time, carrying on after a failure, and shows "Saving..." then a result line per task. Then toast "Saved: N marked In progress." (or "Saved: 1 marked In progress."; add " M could not be saved." when some failed), re-fetch only the tasks, and redraw. With no change to make, the panel says "Nothing to change in Freedcamp. Your picks stay on this page." and offers only "Close".

Keep picks in page state across re-renders and Refresh. Also keep the ignored IDs in `localStorage` under `fc-ignored-<user_id>-<YYYY-MM-DD>`, inside a try block (the viewer may block storage; then they stay in page state only), and treat them as ignored on the next load that day. Do not use a download link; the artifact viewer blocks page-started downloads.

## 10. Ask Claude what is next

The band holds two buttons, "Plan my day" (primary) and "Suggest dates for my overdue tasks", a status line, and an output area. Disable both buttons while a request runs and show "Claude is thinking...".

Plain streamed text looks unformatted, so ask for JSON with `sample.json(prompt, { modelTier: 'default', cache: false })` and render cards. The answer is the object itself, or under `data`.

**Pool.** Build a numbered list of open tasks (leave out tasks completed during the visit) and refer to tasks only by number.

- Plan my day: the Overdue section, then Due next 7 days, then In progress (each in its section order), then every other open task, without repeats, 60 at most. No tasks: "You have no open tasks to plan."
- Suggest dates: overdue tasks only, highest priority first, then most overdue, 12 at most. None: "You have no overdue tasks."

One line per task:

```
[3] [TAG] Title | Project | due Aug 25 (50 days overdue) | priority 2 | in progress
```

Write "(today)" for a task due today, "no due date" when there is none, "No project" for an unknown project. Replace any `|` in a title with `/`. Always write the priority number, 0 when there is none. A task due in the future gets the date with nothing in brackets. Add "| in progress" only for status 2.

**Prompts.** Use this wording, filling in the angle-bracket parts. The pool lines go where shown.

Plan my day:

```
Today is <Weekday>, <Month> <day> (<YYYY-MM-DD>). These are the open Freedcamp tasks assigned to <name>, each with a ref number:
<pool lines>

Pick at most 5 tasks to focus on today, most important first. Weigh how overdue each task is, its priority (3 is high), and work already in progress. Reply with JSON only, no prose, in exactly this shape:
{"summary":"one sentence","items":[{"ref":1,"why":"one sentence reason"}],"could_take":[{"ref":2,"job":"a short job Claude could draft from the task's own content"}]}
List at most 3 entries in could_take, or none. Use only ref numbers from the list. No em dashes.
```

Suggest dates:

```
Today is <Weekday>, <Month> <day> (<YYYY-MM-DD>). These overdue Freedcamp tasks belong to <name>, each with a ref number:
<pool lines>

Suggest a new due date for each task. Spread them from <tomorrow as YYYY-MM-DD> to <today plus 14 days as YYYY-MM-DD>, at most 3 tasks per day, prefer weekdays, and give higher priority and more overdue tasks earlier dates. Reply with JSON only, no prose, in exactly this shape:
{"summary":"one sentence","items":[{"ref":1,"date":"YYYY-MM-DD","why":"one sentence reason"}]}
Use only ref numbers from the list. No em dashes.
```

**Validate the answer.** `items` must be an array, otherwise treat it as an unreadable answer (section 11). Skip an item when its `ref` is not a whole number in the pool or repeats an earlier one. In dates mode also skip it when the date does not match `/^\d{4}-\d{2}-\d{2}$/`, is not a real date, or is before today. Keep at most 5 (plan) or 12 (dates). In plan mode, `could_take` is optional: keep at most 3 entries whose `ref` is in the pool and whose `job` is a non-empty string. Remove dashes from the summary and reasons as in drafting.

**Render.**

- The summary as one line (weight 600).
- A card per item: 1px `--line` border, radius 12px, padding 12px, with a 24px round number badge (`--accent-tint`), the tag and title (a button that opens the task dialog), the project, a due pill, and the reason (13px).
- Plan mode: each card also gets a row-size primary "Work on it" button (opens the task dialog with the "Work on it" choice open, section 9a) and a ghost "Defer" button. It shows a date input with `min` set to tomorrow and an "Apply date" button that works like Apply below. Under the cards, when `could_take` has entries, a small "I could take" list: "<job>" for "<title>", each with "Start" and "Dismiss" that work exactly like the offers band (section 9a).
- Dates mode: the due pill reads "Was due Aug 25". Under the reason, a date input (`type="date"`) with `min` set to today and the suggested date as its value, then an "Apply" button. Reading the input must update page state without re-rendering, so the field keeps focus.
- If some items were skipped: "N suggestions were skipped because the task or date was not valid." (singular: "1 suggestion was skipped ...").
- If no item survived: "Claude did not return any usable suggestions. Ask again."
- Dates mode, below the cards: a primary button "Apply all N dates in Freedcamp" (N is the number not yet applied; "1 date" in the singular) and the hint "Nothing changes in Freedcamp until you press Apply."

**Apply.** Check the date again (same pattern, not before today), otherwise show "Pick a date from today on." on the card. Call `fc_update_task` with `{ task_id, due_date: 'YYYY-MM-DD' }`. The button reads "Applying..." and is disabled, then is replaced by a green "Applied" label and the date field is disabled. On failure show the error on the card and leave the button usable. "Apply all" runs the cards that are not yet applied one at a time, in order, and carries on with the next card after a failure. Never retry automatically. After a single Apply succeeds, or once after "Apply all" finishes with at least one success, re-fetch only the tasks and redraw the sections and tiles.

## 11. Errors

Choose the message from `error.code`. Never show one generic message for everything.

| Code | Message |
|---|---|
| `server_not_connected`, `server_not_found` | Freedcamp is not connected. Add it in Claude Settings, Connectors. |
| `needs_reauth` | Freedcamp needs to be reconnected. Reconnect it in Claude Settings, Connectors. |
| `approval_required`, `not_in_manifest`, `consent_required` | This page needs permission. Allow it in the page permissions. |
| `server_unavailable`, `upstream_error` | Freedcamp did not respond. Try again shortly. |
| `not_granted` | Claude drafting was not allowed. Allow it in the page permissions. |
| `rate_limited` | Claude is busy right now. Wait a moment, then try again. |
| `invalid_json` | Claude sent an answer the page could not read. Ask again. |
| anything else | "Something went wrong: <error message>" or "Something went wrong." |

## 12. Safety and accessibility

- Escape every title, name, quote, error text and model answer before putting it into markup (`&`, `<`, `>`, `"`, `'`).
- Never insert HTML from Freedcamp. Convert descriptions and comments to plain text first: turn line-break tags and the ends of block elements into line breaks and list items into "• ", parse with `DOMParser`, read `textContent`, strip zero-width characters and non-breaking spaces, and collapse runs of blank lines.
- Links open in a new tab with `rel="noopener"`. Only `freedcamp.com` addresses are linked (see the task link rule).
- Status lines, the toast and the Ask status use `aria-live="polite"`. The banner uses `role="alert"`. Decorative icons and avatars are `aria-hidden`.
- Every input has a label or an `aria-label`. Everything works from the keyboard.

## 13. Check before publishing

1. If a shell is available, extract the script and run `node --check` on it.
2. Every tool name in the script is one of the eight in section 4, and every write sits behind a button that names it (section 9, write rule). The script has no clipboard code and no prompt meant to be pasted anywhere.
3. No sample or placeholder data is left in the file: no names, tasks or counts. The `fc-session` block holds only real values from memory.md and this conversation (including `recommended`), or empty values.
4. No em dash or en dash in the page copy.
5. Every token in section 2 is defined, and the 20 with a dark value are repeated in both dark blocks.
6. Re-read sections 5 to 11 against the script once. A missed rule is easier to fix now than after publishing.

To change a published page, edit the same file and publish it again from the same path with the full capabilities object. A tool the page calls is not granted unless it is declared.

## 14. Static mode (no Artifact tool)

Build the same page with the same tokens, layout, rows and copy, with these differences.

**File.** One complete, self-contained web page: a doctype, the `html` element with `lang="en"`, a `head` with charset and viewport metas, and a `body`. Leave out the `claude:viewport-fit-sides` meta. No `claude.use`, no connector calls.

**Data.** Fetch it yourself in the conversation, then bake it into the script as one JSON object:

1. The session lookup: the user's name, timezone, project names.
2. `fc_fetch_tasks` with `assigned_to_id: [user_id]`, `order_due_date: "asc"`, `limit: 100`, no `status` filter. Drop completed and invalid tasks.
3. `fc_fetch_notifications`, classified by section 8.

Bake in only the fields the page shows. Escape everything; it is user content.

**Behaviour.** A saved file cannot talk to Claude or Freedcamp, so it has no action buttons and no control may pretend to act.

- Task rows show no check button, no picks controls and no "Help with this". A task title is a link to the task in Freedcamp. There is no task dialog and no composer.
- "Reply" is a link that opens the item in Freedcamp in a new tab.
- Leave out Refresh, "Apply my day", the "Ask Claude what is next" band, the offers band and the Confirm bar.
- Subtitle: "<First name>, <Weekday>, <Month> <day> · Updated <HH:MM>", from the time you built it.
- Footer: "This is a read-only copy. Ask Claude in this chat to act on a task."

**Output.** Show the file as an artifact if the client can render one, and say plainly: "This is a read-only copy. Tell me here what to do on any task and I'll do it in Freedcamp." If the client can neither publish nor render an artifact (for example, Claude Code with an API key), do not write a local page. Give the answer in the chat as the spec describes, with no artifact.

## 15. Publish and give the link (end of every build)

At the end of a build, publish the page and hand the user the link, but only through the real publish step:

1. **Signed in to claude.ai** (the Artifact tool is available: Claude Code CLI or desktop app after `/login`): publish with the Artifact tool as `SKILL.md` says. Give the user the link the tool returns (a `https://claude.ai/code/artifact/...` address; Claude Code also opens it in the browser) and say: "Open it in claude.ai to use the buttons." In an app that shows the artifact as a card, the card is the link; do not paste the URL there.
2. **Not signed in** (no Artifact tool, for example an API key, Bedrock, Vertex, Foundry or `-p`): there is no link to give. Say in one line that the interactive page needs a claude.ai login (`/login`), then follow the **Output** rule above.
3. Never make up, guess or rebuild a link. Use only the URL the Artifact tool returned.
