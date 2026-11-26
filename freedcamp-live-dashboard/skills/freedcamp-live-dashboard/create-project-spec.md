# "Create project" tab: build spec

This file extends `dashboard-spec.md` (section 15 points here). It uses that spec's tokens, shared pieces, error table (section 11) and safety rules (section 12). Live mode only; in static mode the tab stays a placeholder (section 14).

The tab runs in three steps, each replacing the last inside the panel: **Questions**, **Outline**, **Create**. Keep every answer, the outline and the run in page state, so switching tabs or pressing Refresh never wipes them. The project picker does not affect this tab.

## Apps and people

`fc_add_project` takes `app_ids` (numbers) and `changed_users.added[]` (`email`, `name`, `context_role_id`). Always send them; do not probe the connector first (a `describeTool` probe can report an out-of-date schema, which left new projects on the default apps).

Freedcamp drops what it does not allow **without an error**: app ids the group owner's plan lacks (with none allowed, the project gets the default apps; Files is always added), unknown roles (the default role is used), and the group owner and admins (they already have access). So whatever was sent, the page:

- creates items only in the apps the new project actually has after creation;
- assigns items only to people who are members of the new project, and creates the rest unassigned;
- lists at the end the requested apps and people that did not land, without guessing why.

Never claim an app was turned on or a person was added unless the re-read session shows it.

## 1. Questions

Heading "Create a project" (15px, weight 700), then a short line (14px, `--muted`): "Answer a few questions. Claude drafts an outline, and nothing is created until you approve it."

If the session's `data.permissions.f_can_create_projects` is `false`, show only "Your account cannot create projects." Until the session loads, show skeleton bars.

Fields, each with a visible `label` and a stable `id`, in this order:

| Field | Control | Rule |
|---|---|---|
| Project name | text input | required, 1 to 100 characters after trimming |
| Project type | `select`: Software, Marketing campaign, Event, Client work, Operations, Other | required, default Software |
| Description | textarea | optional, up to 1000 characters |
| Anything specific? | textarea, placeholder "Goals, deliverables, deadlines, constraints" | optional, up to 1000 characters |
| Finish by | `type="date"`, `min` today | optional |
| Claude model for the outline | `select`: "Page setting (<current page choice>)", then the page's model options (`dashboard-spec.md` section 16) | default "Page setting"; shares a row with Finish by |
| Group | `select` of session `groups`, sorted by `name` | required, starts on "Choose a group". When two groups share a name, add the name of one of their projects in brackets, or "(empty)" |
| Apps to use | six checkboxes: Tasks, Discussions, Milestones, Calendar, Issue Tracker, Wikis, then "Let Claude suggest more" | Tasks starts checked. At least one box must be checked, counting "Let Claude suggest more" |
| Who is on the team | a filter input ("Filter people") over a scrollable checkbox list (max-height 220px) of session `users` by `full_name`, sorted | the current user is listed first as "<name> (you)", checked and disabled. Show "N selected" under the list |

Wrap the fields in a `form` with `autocomplete="off"` that never submits. Below them: a primary button "Draft outline with Claude" and a status line. On press, read every field from its control (not only from page state, in case the browser filled one in), check the rules and show the first problem in the status line ("Give the project a name.", "Choose a group.", "Pick at least one app."). Then go to step 2.

## 2. Outline

**Ask.** Call `sample.json(prompt, { modelTier, cache: false })`, with `modelTier` from the form's model field, or from the page setting for a plan when it says "Page setting" (`dashboard-spec.md` section 16), (the answer is the object itself, or under `data`). While it runs, disable the button and say "Claude is drafting the outline...". Errors use section 11; `sample` missing reads as in `dashboard-spec.md` section 4.

The team goes in as numbered refs: `1` is the current user, then the other selected people in list order. App keys are `tasks`, `discussions`, `milestones`, `calendar`, `issues`, `wikis`. Prompt wording, filling in the angle-bracket parts:

```
Today is <Weekday>, <Month> <day> (<YYYY-MM-DD>). Draft a starting outline for a new Freedcamp project.
Name: <name>
Type: <type>
Description: <description or "none">
Specifics: <specifics or "none">
Finish by: <YYYY-MM-DD or "no deadline">
Apps to use: <checked app keys, comma separated><" You may add other apps from: tasks, discussions, milestones, calendar, issues, wikis." when "Let Claude suggest more" is checked>
Team, by ref number:
1. <current user name> (project owner)
2. <name>

Reply with JSON only, no prose, in exactly this shape:
{"summary":"one sentence","apps":["tasks"],"lists":[{"title":"","tasks":[{"title":"","description":"","assignee":1,"due":"YYYY-MM-DD","priority":0}]}],"milestones":[{"title":"","description":"","due":"YYYY-MM-DD"}],"discussions":[{"title":"","body":""}],"events":[{"title":"","description":"","date":"YYYY-MM-DD"}],"issues":[{"title":"","description":"","priority":0}],"wikis":[{"title":"","body":""}]}
Fill only the apps you list in "apps". Use at most 5 task lists of at most 8 tasks each, 5 milestones, 3 discussions, 5 events, 5 issues and 3 wiki pages. Dates go from today to the finish date when there is one. Assignees are ref numbers from the team list, or 0 for nobody. Priority is 0 none, 1 low, 2 medium, 3 high. Plain text only, no em dashes.
```

**Validate.** Treat the answer as untrusted; keep what passes and drop the rest:

- **Apps:** the checked apps, plus, only when "Let Claude suggest more" is checked, any of the six keys in `apps`. Drop sections for any other app. An outline with no items reads "Claude did not return a usable outline. Draft again."
- **Text:** `title` is required, cut to 120 characters; `description` and `body` cut to 600 (wiki `body` to 2000). Remove HTML tags, any leftover `<` or `>`, and em or en dashes (as in drafting).
- **Caps:** as in the prompt, plus 30 tasks in total. A task list with no valid tasks is dropped.
- **Assignee:** a whole number that is a team ref, else none. **Priority:** 0 to 3, else 0.
- **Dates:** must match `YYYY-MM-DD`, be a real date, not before today, and not after the finish date. A bad date is dropped and the item stays, except a milestone or an event, which is dropped without a valid date (Freedcamp requires one).

**Show.** The summary (weight 600), then app pills for the final app set, then one block per app, in run order (Task lists with their tasks indented, Milestones, Discussions, Issue Tracker, Wikis, Calendar). Each item is a row with a checkbox (checked, `aria-label` "Include: <title>"), the title, and a meta line with the assignee name, due pill, priority pill and the first 140 characters of the description. Unchecking a list unchecks its tasks.

With teammates who have an email selected, add a line above the buttons: "Creating also adds <names> to the project. Freedcamp may notify them."

Buttons: primary "Create project with N items" (N counts the project, checked lists and checked items, and updates live), "Draft again", "Edit answers" (back to step 1 with answers kept). Hint: "Nothing is created in Freedcamp until you press Create."

## 3. Create

Disable Refresh while the run is going. Show a progress list: one line per write, in run order, each reading waiting, "Creating...", "Done", "Skipped: <reason>" or "Failed: <error>". Send writes one at a time. A failed item is marked and the run carries on. Never retry automatically.

1. **Project.** `fc_add_project` with `{ project_name, project_description, group_id }`. The description is the user's description, else Claude's summary. Also send `app_ids` (the outline's app ids, as numbers) and `changed_users: { added: [...] }` with one `{ email, name, context_role_id: 0 }` (Team Player) per selected teammate who has an `email` in the session; leave each out when empty. Emails never go into the Claude prompt. Before the call, keep the set of session project ids.
2. **Find it.** Whatever the answer, call `fc_fetch_current_session` and look for a project in `group_id` whose id is new and whose `project_name` equals the name sent. Never read ids from a create response.
   - Found: carry on with its `project_id`, its `applications` (app ids as strings) and its `user_ids`. If the call itself failed (Freedcamp can create the project and then reject the people), the project line reads "Done, Freedcamp also reported: <error>".
   - Not found after a failure: stop with the error and "Nothing was created." When the session read failed too, end with " Check Freedcamp before trying again." instead. Offer "Back to outline".
   - Not found after success: stop with "Freedcamp created the project but the page could not find it. Check Freedcamp before trying again."
   - Then refill the project picker from this session.
3. **Task lists**, when the project has app 2: `fc_add_list` with `{ project_id, app_id: 2, title }` for each checked list, then one `fc_fetch_lists` with `{ project_id, app_id: 2 }` (answer: `lists`, each with `id` and `title`). Match each list by title. A task whose list is missing goes to the project's default list (omit `list_id`).
4. **Items**, in this order, each only when the project has the app:

   | Item | App id | Tool and input |
   |---|---|---|
   | task | 2 | `fc_add_task`: `project_id`, `title`, `description`, `list_id`, `assigned_to_id`, `due_date`, `priority` |
   | milestone | 4 | `fc_add_milestone`: `project_id`, `title`, `description`, `due_date`, `priority` (always, 0 included) |
   | discussion | 3 | `fc_add_discussion`: `project_id`, `title`, `description` (the body), `list_id` |
   | issue | 13 | `fc_add_issue`: `project_id`, `title`, `description`, `priority` |
   | wiki page | 14 | `fc_add_wiki`: `project_id`, `title`, `description` (the body), `list_id` |
   | event | 19 | `fc_add_event`: `project_id`, `title`, `description`, `start_date`, `end_date` (the same day), `f_all_day: 1` |

   Freedcamp's validation (HTTP 400 "Validation failed") needs these beyond what the tool schemas mark as required: a milestone's `due_date` and `priority`, an event's `end_date`, and a list for discussions and wiki pages. For that list, once per app before its items: `fc_fetch_lists` with `{ project_id, app_id }` (3 or 14) and use the first list; with none, `fc_add_list` titled "General" and fetch again; if that still finds none, send `list_title: "General"` instead of `list_id`.

   Leave out other empty fields, and a priority of 0 except on milestones. An item in an app the project lacks is "Skipped: <App> is not turned on in this project." Send `assigned_to_id` only when that person is in the project's `user_ids`; otherwise create the item unassigned and its line reads "Done, unassigned, <name> is not on the project yet".
5. **Finish.** "Created N of M." Then, when they apply:
   - "These apps are not on in the project: <apps>. Turn them on in Freedcamp, then add the skipped items." (outline apps not in `applications`)
   - "These people are not on the project yet: <names>. They may have a pending invitation; otherwise add them in Freedcamp." (selected people not in `user_ids`)
   - "These people have no email in Freedcamp, so they were not added: <names>." (they are not repeated in the line above)
   - "Open Freedcamp" linking to `https://freedcamp.com`, and "Open the first task" linking to the first created task's `data.tasks[0].url` when it is a `freedcamp.com` address.
   - A button "Start another project" that clears the answers and returns to step 1.

A `server_unavailable` or `upstream_error` on any create may still have created the item. Step 2 covers the project; for other items the line reads the error plus " It may have been created. Check Freedcamp."
