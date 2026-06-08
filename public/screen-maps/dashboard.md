# Screen Map, Dashboard

> **Format:** Action-Map Schema v1. Source of truth; the HTML atlas is rendered from it.
> When code changes this screen, update this file in the same commit. Reality on disk wins.

---

## SCREEN

| Field | Value |
|---|---|
| `screen_id` | `dashboard` |
| `display_name` | Dashboard |
| `surfaces` | android, web |
| `route_android` | `dashboard` → `DashboardScreen` (DashboardScreen.kt, 414 lines) |
| `route_web` | `/dashboard` → `Dashboard` (Dashboard.jsx, 545 lines) |
| `primary_actors` | office, owner, tech |
| `purpose` | The home screen / morning briefing: KPI tiles (revenue, jobs, calls, 2nd-chance), a 2nd-chance follow-up nudge, memberships-due-soon, a live job/tech map, the active-jobs list (web), clock in/out, and the Paste-Ticket fast path to a new job. |
| `last_verified` | 2026-06-07 · "View all" on the **Memberships Due Soon** card now navigates to `/settings/membership-plans` (was `/memberships` → 404 redirect). NOTE: no dedicated enrolled/due-soon memberships list page exists — it lands on plan management. Prior: 2026-05-31 Stage-1 audit, 9366abe. |

### load_sequence
**Web** (Dashboard.jsx 183–194): `GET /reports/dashboard`, `GET /jobs?status=scheduled,en_route,in_progress,unscheduled&page=1&limit=50`, `GET /gps/live`, `GET /memberships/due-soon`, `GET /timesheets/status`. Auto-refresh all every **60 s**. **Android**: `DashboardViewModel.load()` → `GET /reports/dashboard`; `MapViewModel` job/tech pins; `MembershipViewModel.loadDueSoon()` → `GET /memberships/due-soon`; `TimesheetViewModel.loadStatus()` → `GET /timesheets/status`; `getNotificationUnreadCount()` → `GET /notifications/unread-count` (poll **30 s**); map + due-soon + timesheet refresh on `ON_RESUME`.

### entry_points
- Both: app launch / bottom-nav "Dashboard" tab (start destination).

---

## ACTIONS

---

### `dashboard.refresh`
- **label:** Refresh
- **section:** top-bar
- **actors:** office, owner, tech
- **purpose:** Re-pull dashboard data on demand.
- **visibility:** always
- **precondition:** n/a
- **confirm:** n/a
- **route_chain:** re-issues the load_sequence GETs (no new endpoint)
- **request_body:** n/a
- **side_effects:** `read-refresh` (no writes)
- **end_state:** Fresh data.
- **failure_modes:** none
- **parity:** PARTIAL, web auto-refreshes every 60 s + a manual button; Android refreshes on `ON_RESUME` + a manual `vm.load()` + a 30 s notification-count poll.
- **status:** OK
- **status_note:** n/a
### `dashboard.clock-toggle`
- **label:** Clock In / Clock Out (🕐 / AccessTime chip)
- **section:** top-bar
- **actors:** tech, owner
- **purpose:** Start/stop the technician's work-hours timesheet.
- **visibility:** always
- **precondition:** n/a
- **confirm:** Android shows a Clock-In / Clock-Out confirm dialog (Clock-Out shows elapsed time); web toggles directly (no confirm).
- **route_chain:** `POST /timesheets/clock-in` · `POST /timesheets/clock-out` (status from `GET /timesheets/status`)
- **request_body:** none
- **side_effects:** opens/closes a `timesheets` row; sets `clock_in_at`/`clock_out_at`.
- **end_state:** Clocked in/out; snackbar.
- **failure_modes:** none observed.
- **parity:** PARTIAL, Android adds confirm dialogs + a live elapsed-minutes counter; web is a one-tap toggle.
- **status:** OK
- **status_note:** n/a
### `dashboard.notifications`
- **label:** Notifications bell (unread badge)
- **section:** top-bar
- **actors:** office, owner, tech
- **purpose:** Open the notifications screen; badge shows unread count.
- **visibility:** Android top bar (always). On web the bell lives in the shared `Layout` top bar, **not** in the Dashboard page itself.
- **precondition:** n/a
- **confirm:** n/a
- **route_chain:** `GET /notifications/unread-count` (badge, poll 30 s) → navigate `notifications`
- **request_body:** n/a
- **side_effects:** `navigate`
- **end_state:** Notifications screen.
- **failure_modes:** none.
- **parity:** ANDROID-ONLY (on this screen), web surfaces notifications via the Layout shell, not the Dashboard component.
- **status:** OK
- **status_note:** n/a
### `dashboard.kpi-cards`
- **label:** KPI tiles
- **section:** stats
- **actors:** office, owner
- **purpose:** At-a-glance business metrics.
- **visibility:** always.
- **precondition:** n/a
- **confirm:** n/a
- **route_chain:** web: "Missed Calls" + "2nd Chance" tiles navigate `/phone`; the other tiles are static. Android: all KPI tiles are display-only (no tap).
- **request_body:** n/a
- **side_effects:** `navigate` (web, 2 tiles only) / none.
- **end_state:** web → Phone screen (those 2 tiles).
- **failure_modes:** none.
- **parity:** DIVERGENT, different metric sets (web: Total Jobs / This Month / Completion Rate / Scheduled Today / Missed Calls / 2nd Chance; Android: Month Revenue / Jobs Today / Completed / In Progress / Missed Calls / 2nd Chance) and only web makes 2 tiles tappable.
- **status:** PARTIAL
- **status_note:** Both read from `GET /reports/dashboard`; the tile labels and tap behavior differ.

### `dashboard.second-chance`
- **label:** 2nd-Chance Leads banner
- **section:** widgets
- **actors:** office, owner
- **purpose:** Nudge to follow up unbooked/missed callers.
- **visibility:** when `second_chance > 0`.
- **precondition:** n/a
- **confirm:** n/a
- **route_chain:** navigate `/phone`
- **request_body:** n/a
- **side_effects:** `navigate`
- **end_state:** Phone screen.
- **failure_modes:** none.
- **parity:** MATCH, both show the banner and route to Phone. (web uses `second_chance.total`; Android uses `second_chance.new_count`.)
- **status:** OK
- **status_note:** n/a
### `dashboard.membership-row`
- **label:** Memberships-due-soon rows
- **section:** widgets
- **actors:** office, owner
- **purpose:** Jump to a customer whose membership service is due.
- **visibility:** when `dueSoon.length > 0` (shows up to 3).
- **precondition:** n/a
- **confirm:** n/a
- **route_chain:** navigate `/customers/:customer_id`
- **request_body:** n/a
- **side_effects:** `navigate`
- **end_state:** Customer Detail.
- **failure_modes:** none.
- **parity:** MATCH, both route a due-soon row to the customer.
- **status:** OK
- **status_note:** Data from `GET /memberships/due-soon`.

### `dashboard.membership-viewall`
- **label:** "View all" (memberships)
- **section:** widgets
- **actors:** office, owner
- **purpose:** (Intended) open the full memberships list.
- **visibility:** web only, when `dueSoon.length > 0`.
- **precondition:** n/a
- **confirm:** n/a
- **route_chain:** `navigate('/memberships')`, **no such route in App.jsx**; the `*` fallback redirects to `/dashboard`.
- **request_body:** n/a
- **side_effects:** `navigate` → redirect to `/dashboard`.
- **end_state:** Bounces back to the dashboard (goes nowhere useful).
- **failure_modes:** `route-missing`, App.jsx registers `/settings/membership-plans`, not `/memberships`.
- **parity:** WEB-ONLY (broken), Android has no "View all" (it shows "+N more" text, not a nav).
- **status:** BROKEN
- **status_note:** The membership *rows* work; only the "View all" target is missing.

### `dashboard.active-jobs-list`
- **label:** Active Jobs list ("View all" + job cards)
- **section:** jobs
- **actors:** office, owner, tech
- **purpose:** Scan and open active jobs from the home screen.
- **visibility:** web: always (list section); empty-state when none. Android has no separate active-jobs list, jobs appear only as map pins.
- **precondition:** n/a
- **confirm:** n/a
- **route_chain:** "View all" → `/jobs`; a job card → `/jobs/:id`. (list data from `GET /jobs?status=…&limit=50`)
- **request_body:** n/a
- **side_effects:** `navigate`
- **end_state:** Jobs list / Job Detail.
- **failure_modes:** none.
- **parity:** WEB-ONLY, Android relies on the full-screen map + the bottom-nav Jobs tab instead of an on-dashboard list.
- **status:** OK
- **status_note:** Web also renders an "Active Techs" strip from `GET /gps/live` (display-only).

### `dashboard.job-map`
- **label:** Job/Tech Map + "Full Map"
- **section:** map
- **actors:** office, owner
- **purpose:** See active jobs and live techs geographically.
- **visibility:** web: when Maps SDK ready and there are active jobs. Android: always (map fills remaining space).
- **precondition:** n/a
- **confirm:** n/a
- **route_chain:** marker / InfoWindow "Open Job" → `/jobs/:id`; "Full Map" → `/live-map`. Tech pins from `GET /gps/live`.
- **request_body:** n/a
- **side_effects:** `navigate`
- **end_state:** Job Detail / Live Map.
- **failure_modes:** none.
- **parity:** MATCH, both plot job + tech markers and link to Job Detail / Live Map. (web geocodes missing coords client-side; Android uses stored pins.)
- **status:** OK
- **status_note:** Web caps job markers at 20.

### `dashboard.paste-ticket`
- **label:** Paste Ticket (FAB)
- **section:** fab
- **actors:** office, owner
- **purpose:** Turn pasted ticket text into a pre-filled new job, the headline fast path.
- **visibility:** always (floating button).
- **precondition:** clipboard / pasted text non-empty.
- **confirm:** web opens a modal with an editable textarea + "Parse with AI"; Android reads the clipboard and parses immediately.
- **route_chain:** `POST /jobs/parse-ticket {text}` → navigate `/jobs/new` with `state.parsedData` (web) / `jobs/new?ticket=` (Android).
- **request_body:** `{ text }`
- **side_effects:** AI parse only (no DB write here); job is created later on the New Job screen.
- **end_state:** New Job form, pre-filled.
- **failure_modes:** none fatal, all-null parse shows an error and stays put.
- **parity:** PARTIAL, same endpoint; web review-modal vs Android instant clipboard parse (same divergence as the New Job screen).
- **status:** OK
- **status_note:** n/a
---

## SCREEN-LEVEL DRIFT FLAGS

- **Web "View all" memberships is broken**, `/memberships` is not a registered web route; the `*` fallback redirects to `/dashboard`. The membership rows themselves work.
- **KPI tiles diverge**, different metric sets per surface, and only web makes the Missed-Calls / 2nd-Chance tiles tappable (→ Phone).
- **Active Jobs list + Active Techs strip are web-only**, Android shows jobs only as map pins and techs as map markers (no on-dashboard list/strip).
- **Notifications bell is Android-only on this screen**, web's bell lives in the shared Layout shell, not the Dashboard component.
- **Refresh cadence differs**, web 60 s auto-refresh; Android `ON_RESUME` + a 30 s notification-count poll.
- **Clock toggle**, Android confirms with a dialog + elapsed time; web toggles directly.
- **UNVERIFIED:** the exact `MapViewModel`/`DashboardViewModel` request bodies (job/tech pin source); `second_chance` field name differs (`total` web vs `new_count` Android), both read from `GET /reports/dashboard`.
