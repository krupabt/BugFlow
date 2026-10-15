# BugFlow synthetic dataset bundle

This dataset is entirely synthetic and generated for project prototyping, coursework, analytics, and ML experimentation. Names and `example.org` email addresses are fictional placeholders; no real personal data is included. The generator uses a fixed seed for reproducibility. It is not production incident data and must not be used to infer real team performance.

## Files and relationships

- `issues.csv` — 750 issue records; primary key `issue_id`. `project_id` references `projects.csv`; `assigned_to` and `created_by` reference `users.csv` (blank `assigned_to` means unassigned); `status` matches a `state_name` in `workflow_states.csv`; `sprint_id` references `sprints.csv` when present; duplicate links reference an earlier issue.
- `users.csv` — fictional BugFlow accounts and roles: `ADMIN`, `PROJECT_MANAGER`, `DEVELOPER`, `TESTER`.
- `projects.csv` — eight fictional projects and their project managers.
- `workflow_states.csv` — the deck's ordered lifecycle: Open → In Progress → Testing → Resolved → Closed. Resolved and Closed are terminal for this snapshot.
- `resolution_suggestions.csv` — three ranked illustrative suggestions per issue. These are synthetic rule-based examples, not model predictions. `accepted` is a synthetic interaction label, not proof that an action caused resolution.
- `sprints.csv` — six two-week sprint records per project to support backlog/sprint analysis.

## Issue fields

| Field | Meaning |
|---|---|
| issue_id | Stable synthetic issue key (`BUG-00001` etc.). |
| title, description | Short summary and contextual report. |
| issue_type | Bug, Feature Request, Enhancement, Support Ticket, or Technical Debt. |
| severity | Critical, High, Medium, Low; describes technical/user impact. |
| priority | P0–P3; synthetic urgency derived from severity and business impact with noise. |
| status | Current workflow state. |
| project_id | Parent project key. |
| assigned_to, created_by | User keys; assignment can be blank for unassigned open issues. |
| created_date, updated_date, resolved_date | ISO dates. `resolved_date` is blank for unresolved issues. |
| component, environment | Affected subsystem and Development/QA/Staging/Production context. |
| steps_to_reproduce | Synthetic reproduction sequence. |
| expected_result, actual_result | Expected and observed behavior. |
| business_impact | Critical/High/Medium/Low business impact used in priority generation. |
| resolution_summary, root_cause | Filled only for Resolved/Closed records; blank for active records. |
| resolution_time_hours | Synthetic positive elapsed hours for Resolved/Closed records; blank otherwise. |
| reopen_count | Synthetic reopen count for Resolved/Closed records; blank otherwise. |
| is_duplicate, duplicate_of_issue_id | Duplicate marker and optional earlier issue key. |
| sprint_id | Optional assigned sprint key. |

## Example ML experiments

**Priority prediction:** use `issue_type`, `severity`, `business_impact`, component, environment, description, reproduction steps, expected/actual result, and project as input features; set `priority` as the target. Split by time or project to reduce leakage. Exclude issue ID, assignee, status, resolution fields, and any post-creation fields if predicting at intake. Report macro-F1 and per-class recall; the generated class balance and rules are artificial, so this demonstrates a pipeline rather than real-world accuracy.

**Resolution recommendation:** train a retrieval or ranking prototype over resolved issues using title, description, component, issue type, and root cause, then retrieve analogous resolved `resolution_summary` values. Alternatively, rank `resolution_suggestions.csv` and treat `accepted` only as a weak synthetic feedback signal. Evaluate with a held-out set and human review; do not treat the suggestions as verified fixes.

## CSV and dates

Files are UTF-8 with BOM for spreadsheet compatibility. Dates use `YYYY-MM-DD`; blank CSV cells mean unknown/not applicable. Snapshot and generation date: 2026-10-10. A few resolved dates are capped at the generation date, so resolution hours are a synthetic duration feature and may not exactly match date subtraction for those capped edge cases.
