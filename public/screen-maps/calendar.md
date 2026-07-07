# Screen Map, Calendar

> **Format:** Action-Map Schema v1. Source of truth; the HTML atlas is rendered from it.
> When code changes this screen, update this file in the same commit. Reality on disk wins.

---

## SCREEN

| Field | Value |
|---|---|
| `screen_id` | `calendar` |
| `display_name` | Calendar |
| `surfaces` | android, web |
| `route_android` | `calendar` → `CalendarScreen` (CalendarScreen.kt, 57 lines) |
| `route_web` | `/calendar` → `Calendar` (Calendar.jsx, 171 lines) |
| `primary_actors` | office, owner, tech |
| `purpose` | See scheduled jobs on a calendar and jump into them. Web is a full-month grid with a per-day modal (open / edit / create); Android is a one-week strip + a single-day agenda list. Both are read-only views over the jobs data, there is no calendar/event store; the "calendar" is just `GET /jobs` filtered by date. |
| `last_verified` | 2026-05-31 · Stage-1 read-only audit · commit: 9366abe |

### load_sequence
**Web** (Calendar.jsx 29–31): `GET /jobs?from={monthStart}&to={monthEnd}&limit=200`, the whole visible month. **Android** (CalendarScreen.kt 17): `vm.load(from=selected, to=selected)` → `GET /jobs?from={day}&to={day}`, only the **selected day**. Both key off `scheduled_start` (web also falls back to `scheduled_date`/`date`/`start_date`).

### entry_points
- Both: from the More/Settings menu (web Settings → Calendar; Android Settings → Calendar) and direct route. Android also reached via Dashboard/JobDetail "onJob"-style nav is not calendar, calendar is its own route.

---

## ACTIONS

---

### `calendar.range-nav`
- **label:** Month prev/next + swipe (web) · Week strip + "Today" (Android)
- **section:** header
- **actors:** office, owner, tech
- **purpose:** Move the visible date range.
- **visibility:** always
- **precondition:** n/a
- **confirm:** n/a
- **route_chain:** changes the date range → re-issues `GET /jobs?from&to` (web `limit=200`, whole month; Android single day)
- **request_body:** n/a
- **side_effects:** `read-refresh`
- **end_state:** Jobs for the new range loaded.
- **failure_modes:** none.
- **parity:** DIVERGENT, web is a **month grid** with prev/next chevrons + horizontal swipe, loading the whole month (`limit=200`); Android is a **one-week strip** with a "Today" button, loading only the selected day (`from=to=day`).
- **status:** OK
- **status_note:** No month/week/day view toggle exists on either surface, the view model is fixed per platform.

### `calendar.day-select`
- **label:** Tap a day
- **section:** grid / week-strip
- **actors:** office, owner, tech
- **purpose:** Focus a single day's jobs.
- **visibility:** always
- **precondition:** n/a
- **confirm:** n/a
- **route_chain:** web: opens a day modal (local, no fetch, month data already loaded). Android: sets `selected` → re-fetches that day's jobs.
- **request_body:** n/a
- **side_effects:** web local state; Android `read-refresh`.
- **end_state:** web → day modal with that day's jobs; Android → day agenda list updates.
- **failure_modes:** none.
- **parity:** DIVERGENT, web shows a per-day **modal** (data already in memory from the month load); Android re-queries the day and renders an inline agenda.
- **status:** OK
- **status_note:** Day status dots (web, up to 3) are colored by `statusColor(job.status)`.

### `calendar.job-open`
- **label:** Job row/card
- **section:** day list
- **actors:** office, owner, tech
- **purpose:** Open a scheduled job.
- **visibility:** when the focused day has jobs.
- **precondition:** n/a
- **confirm:** n/a
- **route_chain:** navigate `/jobs/:id`
- **request_body:** n/a
- **side_effects:** `navigate`
- **end_state:** Job Detail.
- **failure_modes:** none.
- **parity:** MATCH, both route a calendar job to Job Detail.
- **status:** OK
- **status_note:** n/a
### `calendar.job-edit`
- **label:** "Edit" (per job, in the day modal)
- **section:** day modal
- **actors:** office, owner
- **purpose:** Jump straight to editing a scheduled job.
- **visibility:** web day modal only. Android has no edit shortcut on the calendar.
- **precondition:** n/a
- **confirm:** n/a
- **route_chain:** navigate `/jobs/:id/edit`
- **request_body:** n/a
- **side_effects:** `navigate`
- **end_state:** Job edit form.
- **failure_modes:** none.
- **parity:** WEB-ONLY, Android's day card only opens Job Detail (no inline edit).
- **status:** OK
- **status_note:** n/a
### `calendar.new-job-on-day`
- **label:** "+ New Job on This Day"
- **section:** day modal
- **actors:** office, owner
- **purpose:** Create a new job pre-scheduled to the tapped day.
- **visibility:** web day modal only. Android has no create-from-calendar.
- **precondition:** A day is selected.
- **confirm:** n/a
- **route_chain:** navigate `/jobs/new?date={yyyy-MM-dd}` (the New Job form reads the `?date=` query param to prefill `scheduled_date`)
- **request_body:** n/a
- **side_effects:** `navigate`
- **end_state:** New Job form, date prefilled.
- **failure_modes:** none.
- **parity:** WEB-ONLY, Android has no create button on the calendar (create happens from Jobs/Dashboard).
- **status:** OK
- **status_note:** Confirmed against the New Job audit: JobForm prefills from `?date=`.

---

## SCREEN-LEVEL DRIFT FLAGS

- **Different view models**, web = month grid (loads the whole month, `limit=200`); Android = one-week strip + single-day agenda (loads `from=to=day`). No view-toggle on either.
- **Edit + Create-on-day are web-only**, Android's calendar is open-only (tap a job → Job Detail); it has no inline Edit and no create-from-calendar.
- **No calendar/event store**, the "calendar" is purely `GET /jobs` filtered by date; there is no schedules/events endpoint behind this screen (the `schedules` table exists but is not what this screen reads).
- **UNVERIFIED:** none material, both surfaces' behavior is fully visible in the components read.

- **P2.19 — arrival window (2026-07-07).** Each calendar day-agenda job entry now shows its scheduled time, rendering the window ("8:00 AM – 10:00 AM") when `scheduled_end` is present and distinct from `scheduled_start` (Calendar.jsx). Calendar grouping/filtering remains by `scheduled_start` day (unchanged).
