# Screen Map, Reports

> **Format:** Action-Map Schema v1. Source of truth; the HTML atlas is rendered from it.
> When code changes this screen, update this file in the same commit. Reality on disk wins.

---

## SCREEN

| Field | Value |
|---|---|
| `screen_id` | `reports` |
| `display_name` | Reports |
| `surfaces` | android, web |
| `route_android` | `reports` → `ReportsScreen` (ReportsScreen.kt, 168 lines) + `TimesheetReportScreen` |
| `route_web` | `/reports` → `Reports` (Reports.jsx, 597 lines) + actor pages `/reports/team/:userId` (TeamReport.jsx), `/reports/roster/:id` (RosterReport), `/reports/source/:id` (SourceReport) |
| `primary_actors` | owner, manager |
| `purpose` | Business reporting. **Divergent by surface:** web is a 4-tab analytics module (Revenue / Job Sources / Timesheets / Partners) with date-range controls, partner report send, and per-actor pay statements that can be sent as a shareable hosted report; Android is a single dashboard-style screen (revenue / jobs / calls / top-techs / sources cards) with three CSV exports and a timesheet shortcut. |
| `last_verified` | 2026-07-06 · P2.1h/F9: web `/reports` (+ `/reports/team|roster|source/:id`) now route-gated by `RequirePermission section=reports level=view` (mirrors the backend guard) — a technician (`reports:none`) hitting the URL directly gets a clean "Access denied" panel instead of the shell firing failing 403 fetches; Sidebar + mobile BottomNav hide the Reports item via `can(reports,view)`. Prior: 2026-06-07 · Granular permissions Phase 2 Batch 2c: all report reads now require `reports:view` (dashboard/revenue/jobs/calls/exports + actor reports tech/roster/source/partner + the `/*/send` distribution + network `/report[/send]`). Inline owner/admin/manager checks replaced by `hasPermission(reports,view)`. Carve-out: `GET /reports/tech/:userId` still allows a user to read their OWN report at `reports=none` (`req.userId===:userId`). `/earnings` + `/earnings/export` stay `accounting_earnings:view` (2a). **`/reports/self` is a COMPANY report (fetchSelfReportData by company_id), not per-user — now `reports:view` (was owner/admin).** Prior: 2026-05-31 Stage-1 audit, 79940c8. |

### load_sequence
**Web:** per-tab, Revenue `GET /reports/revenue?from&to`; Sources `GET /sources/report?date_from&date_to`; Timesheets `GET /timesheets/report?start_date&end_date&user_id`; Partners `GET /network/connections` then `GET /network/connections/:id/report`. Actor pages: `GET /reports/{tech|roster|source}/:id?from&to` → `{actor, summary, jobs, bonuses, deductions, all_time_balance}`. **Android:** `GET /reports/dashboard` + `GET /sources/report` on mount.

### entry_points
- Both: More/Settings → Reports. Web actor pages reached from Payroll drill-down (`/reports/team/:userId` etc.).

---

## ACTIONS

---

### `reports.revenue-report`
- **label:** Revenue
- **section:** report-types
- **actors:** owner, manager
- **purpose:** Revenue by period + payment-method breakdown.
- **visibility:** web Revenue tab; Android Revenue card.
- **precondition:** n/a
- **confirm:** n/a
- **route_chain:** web `GET /reports/revenue?from&to` (rows `{period, cash, check, card, online, total, payment_count}`); Android `GET /reports/dashboard` (revenue block: this_month / last_month / today)
- **request_body:** n/a
- **side_effects:** read-only.
- **end_state:** Revenue KPIs + per-period table (web) / 3 totals (Android).
- **failure_modes:** none.
- **parity:** DIVERGENT, web uses `/reports/revenue` with date range and a per-period table; Android reads the dashboard revenue block (no date range, no table).
- **status:** OK
- **status_note:** n/a
### `reports.sources-report`
- **label:** Job Sources
- **section:** report-types
- **actors:** owner, manager
- **purpose:** ROI by job source (network / source contacts / ad channels).
- **visibility:** web Sources tab; Android Sources card.
- **precondition:** n/a
- **confirm:** n/a
- **route_chain:** `GET /sources/report?date_from&date_to` → `{network, external_contacts, own_company}`
- **request_body:** n/a
- **side_effects:** read-only.
- **end_state:** Source rows with jobs / revenue / allocation %.
- **failure_modes:** none.
- **parity:** PARTIAL, same endpoint both surfaces; web adds a CSV export + date range, Android renders a grouped card (and ignores date range).
- **status:** OK
- **status_note:** n/a
### `reports.timesheets-report`
- **label:** Timesheets
- **section:** report-types
- **actors:** owner, manager
- **purpose:** Clock-in/out hours by technician.
- **visibility:** web Timesheets tab; Android "Timesheet Report" shortcut card → `TimesheetReportScreen`.
- **precondition:** n/a
- **confirm:** n/a
- **route_chain:** `GET /timesheets/report?start_date&end_date&user_id?`
- **request_body:** n/a
- **side_effects:** read-only.
- **end_state:** Per-tech summary + detail rows.
- **failure_modes:** none.
- **parity:** PARTIAL, web has it as a tab with a tech filter + CSV export; Android routes to a dedicated `TimesheetReportScreen`.
- **status:** OK
- **status_note:** n/a
### `reports.partners-report`
- **label:** Partners
- **section:** report-types
- **actors:** owner, manager
- **purpose:** Per-partner revenue/earnings over the period.
- **visibility:** web Partners tab only.
- **precondition:** active connections.
- **confirm:** n/a
- **route_chain:** `GET /network/connections` (list) → `GET /network/connections/:id/report?date_from&date_to` (`{summary, jobs}`)
- **request_body:** n/a
- **side_effects:** read-only.
- **end_state:** Partner summary + per-job earnings.
- **failure_modes:** none.
- **parity:** WEB-ONLY, Android surfaces partner reports in the Network module (`PartnerReportScreen`), not the Reports screen.
- **status:** OK
- **status_note:** n/a
### `reports.jobs-calls-toptechs`
- **label:** Jobs / Calls / Top Technicians cards
- **section:** report-types
- **actors:** owner, manager
- **purpose:** At-a-glance jobs, calls, and top earners.
- **visibility:** Android Reports screen only.
- **precondition:** n/a
- **confirm:** n/a
- **route_chain:** `GET /reports/dashboard` (jobs / calls / top_techs blocks)
- **request_body:** n/a
- **side_effects:** read-only.
- **end_state:** Jobs/Calls/Top-Techs cards.
- **failure_modes:** none.
- **parity:** ANDROID-ONLY, web shows these on the Dashboard, not in Reports.
- **status:** OK
- **status_note:** n/a
### `reports.date-range`
- **label:** Date range (chips + From/To)
- **section:** controls
- **actors:** owner, manager
- **purpose:** Scope every web report tab.
- **visibility:** web only (chips: This Week / This Month / Last Month / YTD / Custom + date inputs).
- **precondition:** n/a
- **confirm:** n/a
- **route_chain:** re-issues the active tab's GET with `from`/`to`
- **request_body:** n/a
- **side_effects:** `read-refresh`
- **end_state:** Reports rescoped.
- **failure_modes:** none.
- **parity:** WEB-ONLY, Android Reports has no date-range control (uses dashboard defaults); the period concept appears only on the web actor pages (their own chips).
- **status:** OK
- **status_note:** n/a
### `reports.csv-export`
- **label:** Export CSV
- **section:** controls
- **actors:** owner, manager
- **purpose:** Download a report as CSV.
- **visibility:** web per-tab buttons + actor-page Export menu; Android per-card download icons.
- **precondition:** n/a
- **confirm:** n/a
- **route_chain:** `GET /reports/revenue/export`, `GET /reports/jobs/export`, `GET /reports/earnings/export`, `GET /sources/report/export`, `GET /timesheets/report` (csv); partner CSV is client-built.
- **request_body:** n/a
- **side_effects:** file download.
- **end_state:** CSV saved (web download / Android Downloads).
- **failure_modes:** none.
- **parity:** MATCH, both export CSVs (web per-tab; Android per-card revenue/jobs/earnings).
- **status:** OK
- **status_note:** n/a
### `reports.actor-pay-statement`
- **label:** Actor pay statement (TeamReport / RosterReport / SourceReport)
- **section:** statements
- **actors:** owner, manager
- **purpose:** A per-tech/roster/source pay statement: jobs table, compensation summary (net pay = period tech profit + bonuses − deductions), all-time balance.
- **visibility:** web pages (`/reports/team/:userId` etc.), reached from Payroll drill-down.
- **precondition:** n/a
- **confirm:** n/a
- **route_chain:** `GET /reports/tech/:userId` | `/reports/roster/:id` | `/reports/source/:id` | `/reports/self` | `/reports/partner/:connectionId` (all with `from&to`)
- **request_body:** n/a
- **side_effects:** read-only over `tech_earnings` + bonuses/deductions.
- **end_state:** Pay statement.
- **failure_modes:** none.
- **parity:** WEB-ONLY, Android's per-tech report lives in the Payroll module (`/payroll/tech-report/:userId`), not these `/reports/*` actor pages.
- **status:** OK
- **status_note:** Period chips per page; jobs table is a fixed 7-column "essentials" set.

### `reports.actor-report-send`
- **label:** Send Report (actor pay statement)
- **section:** statements
- **actors:** owner, manager (or self)
- **purpose:** Email/SMS a shareable hosted pay statement to the actor.
- **visibility:** web actor pages (SendReportModal).
- **precondition:** `from`/`to` set.
- **confirm:** send modal (recipient email/phone).
- **route_chain:** `POST /reports/tech/:userId/send` (+ `/roster/:id/send`, `/source/:id/send`, `/self/send`, `/partner/:connectionId/send`)
- **request_body:** `{ from, to, ...recipients }`
- **side_effects:** role-gated (manager, or self for own tech report → 403 otherwise); `dispatchReport(...)` builds the report, mints a `report_share_tokens` hosted view, generates a PDF, and emails (office + optional recipient).
- **end_state:** Report dispatched.
- **failure_modes:** `400` when `from`/`to` missing; `403` for a non-manager sending another user's report.
- **parity:** WEB-ONLY, Android Reports has no actor-statement send (no `report_share_tokens` flow).
- **status:** OK
- **status_note:** n/a
### `reports.partner-send`
- **label:** Send Partner Report
- **section:** statements
- **actors:** owner, manager
- **purpose:** Email a partner their revenue report (PDF).
- **visibility:** web Partners tab (after loading a partner report).
- **precondition:** a partner report is loaded.
- **confirm:** send modal (optional partner email).
- **route_chain:** `POST /network/connections/:id/report/send`
- **request_body:** `{ date_from, date_to, recipient_email? }`
- **side_effects:** always emails a PDF to the office; optionally to the partner address.
- **end_state:** Partner report sent.
- **failure_modes:** none observed.
- **parity:** WEB-ONLY (on this screen), Android's partner reporting is in the Network module's `PartnerReportScreen`.
- **status:** OK
- **status_note:** n/a
---

## SCREEN-LEVEL DRIFT FLAGS

- **Reports is heavily divergent**, web is a 4-tab analytics module (date range, partner reports, per-actor pay statements with shareable hosted send via `report_share_tokens`); Android Reports is a single dashboard-style screen (revenue/jobs/calls/top-techs/sources cards) with three CSV exports and a timesheet shortcut.
- **Web-only:** date-range controls, Partners tab, actor pay statements (`/reports/{tech,roster,source,self,partner}`), and the actor-report send (`report_share_tokens`). **Android-only:** the jobs/calls/top-techs dashboard cards in Reports.
- **Two homes for per-tech reports**, web `/reports/team/:userId` (Reports module) vs Android `/payroll/tech-report/:userId` (Payroll module); different endpoints, different shapes.
- **`report_column_preferences` UI is UNVERIFIED**, the table + endpoints exist (per-actor-type visible_columns), and the actor jobs table is a fixed 7-column set, but no audited screen sets column preferences this pass (`SendReportModal`/`ExportReportMenu` internals not read). Likely read server-side for PDF/CSV column sets; the setter UI is unconfirmed.
- **UNVERIFIED:** `SendReportModal` / `ExportReportMenu` exact request bodies; whether `report_column_preferences` is settable anywhere; Android `TimesheetReportScreen` specifics.
