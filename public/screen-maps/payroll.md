# Screen Map, Payroll

> **Format:** Action-Map Schema v1. Source of truth; the HTML atlas is rendered from it.
> When code changes this screen, update this file in the same commit. Reality on disk wins.

---

## SCREEN

| Field | Value |
|---|---|
| `screen_id` | `payroll` |
| `display_name` | Payroll |
| `surfaces` | android, web |
| `route_android` | `payroll` → `PayrollScreen` (PayrollScreens.kt 302–400) + `TechReportScreen` (756), `TechPaySettingsScreen`, `ReimbursementsScreen`, `ProfitSimulatorScreen` |
| `route_web` | `/payroll` → `Payroll` (Payroll.jsx, 222 lines) |
| `primary_actors` | owner, manager |
| `purpose` | Pay the field team. **Highly asymmetric:** web is a thin read-only earnings list (by actor, drill into a report); Android is the full hub, company P&L overview, per-tech balance-owed with bonuses/deductions, pay settings, profit simulator, reimbursements, and a per-job report. Reads `tech_earnings` (the profit engine's output). |
| `last_verified` | 2026-05-31 · Stage-1 read-only audit · commit: 79940c8 |

### load_sequence
**Web:** `GET /reports/earnings?from=&to=` (+ `/users/technicians`, `/roster-techs`, `/sources/contacts` to resolve drill-down ids by name). **Android:** `vm.loadSummary(period)` → `GET /payroll/summary` (period = today/week/month/custom); Job-Report tab → `GET /payroll/job-report`.

**How earnings are read**, both aggregate `tech_earnings` in a three-branch UNION (user / roster / source):
- `/reports/earnings` (web): `total = SUM(te.amount)` (techs/roster) or `SUM(te.source_cost)` (sources), grouped by actor; returns `{earnings, from, to}`.
- `/payroll/summary` (Android): LATERAL aggregates `gross_earnings = SUM(tech_profit)`, `total_sales = SUM(gross_job_total)`, `total_material = SUM(material_cost)`, and `balance_owed = SUM(tech_profit WHERE NOT paid) + pending_bonuses − pending_deductions`.

### entry_points
- Both: More/Settings → Payroll.

---

## ACTIONS

---

### `payroll.date-range`
- **label:** Date range (web From/To) · Period chips (Android Today/Week/Month/Custom)
- **section:** header
- **actors:** owner, manager
- **purpose:** Scope the payroll window.
- **visibility:** always
- **precondition:** n/a
- **confirm:** n/a
- **route_chain:** web `GET /reports/earnings?from=&to=`; Android `GET /payroll/summary` (period → server-resolved dates)
- **request_body:** n/a
- **side_effects:** `read-refresh`
- **end_state:** Earnings recomputed for the window.
- **failure_modes:** none.
- **parity:** DIVERGENT, web exposes explicit From/To date inputs; Android uses preset period chips (today/week/month/custom) and a different endpoint.
- **status:** OK
- **status_note:** n/a
### `payroll.earnings-list`
- **label:** Earnings by actor (tech / roster / source)
- **section:** list
- **actors:** owner, manager
- **purpose:** Show each actor's earnings for the window.
- **visibility:** always
- **precondition:** n/a
- **confirm:** n/a
- **route_chain:** web `GET /reports/earnings`; Android `GET /payroll/summary`
- **request_body:** n/a
- **side_effects:** read-only over `tech_earnings`.
- **end_state:** Per-actor totals (web: a list + summary table; Android: tech pay cards).
- **failure_modes:** none.
- **parity:** DIVERGENT, same underlying table, different endpoints and richness. Web shows name/jobs/total; Android shows sales/material/earnings/bonuses/deductions/balance-owed per tech.
- **status:** OK
- **status_note:** Both UNION user + roster + source rows; roster `last_name='(Roster)'`, source `last_name='(Source)'`.

### `payroll.company-overview`
- **label:** Company P&L overview (Sales / Material / Source / Tech Payout / Company Profit / Jobs)
- **section:** overview
- **actors:** owner, manager
- **purpose:** Company-level profit summary for the window.
- **visibility:** Android Overview tab only.
- **precondition:** n/a
- **confirm:** n/a
- **route_chain:** `GET /payroll/summary` (totals block)
- **request_body:** n/a
- **side_effects:** read-only.
- **end_state:** Company financial summary.
- **failure_modes:** none.
- **parity:** ANDROID-ONLY, web has no company-profit overview (just per-actor earnings).
- **status:** OK
- **status_note:** n/a
### `payroll.actor-drilldown`
- **label:** Open actor report ("Full Report" / clickable card)
- **section:** list
- **actors:** owner, manager
- **purpose:** Drill into one actor's detailed report.
- **visibility:** when an id resolves (web) / always (Android).
- **precondition:** n/a
- **confirm:** n/a
- **route_chain:** web → `/reports/team/:userId` | `/reports/roster/:id` | `/reports/source/:id` (ids resolved by name from the directory endpoints); Android "Full Report" → `TechReportScreen` (`GET /payroll/tech-report/:userId`).
- **request_body:** n/a
- **side_effects:** `navigate`.
- **end_state:** Actor report screen.
- **failure_modes:** web drill-down silently disabled when the name→id lookup misses (no `targetPath`).
- **parity:** DIVERGENT, web routes to the Reports module's actor pages; Android opens its own `tech-report` endpoint/screen.
- **status:** OK
- **status_note:** Web resolves the actor id by matching first/last name against `/users/technicians`, `/roster-techs`, `/sources/contacts` (the earnings rows don't carry ids).

### `payroll.export-csv`
- **label:** Export CSV
- **section:** header
- **actors:** owner, manager
- **purpose:** Download the earnings as CSV.
- **visibility:** web only.
- **precondition:** n/a
- **confirm:** n/a
- **route_chain:** `GET /reports/earnings/export` (blob)
- **request_body:** n/a
- **side_effects:** file download.
- **end_state:** CSV saved.
- **failure_modes:** none.
- **parity:** WEB-ONLY, the Android hub has no CSV export.
- **status:** OK
- **status_note:** n/a
### `payroll.bonus-deduct`
- **label:** Add Bonus / Add Deduction (per tech)
- **section:** tech card
- **actors:** owner
- **purpose:** Add a one-off bonus or deduction to a tech's pay.
- **visibility:** Android tech cards.
- **precondition:** n/a
- **confirm:** amount + reason dialog.
- **route_chain:** `POST /payroll/bonuses` · `POST /payroll/deductions` (both ownerOrAdmin)
- **request_body:** bonus `{ user_id, amount, reason }`; deduction `{ user_id, amount, reason, deduction_type }`
- **side_effects:** inserts a `tech_bonuses` / `tech_deductions` row (counts toward `pending_bonuses`/`pending_deductions` until a period is paid).
- **end_state:** Balance-owed reflects the adjustment.
- **failure_modes:** none observed.
- **parity:** ANDROID-ONLY, web has no bonus/deduction UI.
- **status:** OK
- **status_note:** n/a
### `payroll.pay-settings`
- **label:** Pay Settings (gear, per tech)
- **section:** tech card
- **actors:** owner
- **purpose:** Edit a tech's pay model / rate / commission.
- **visibility:** Android tech cards.
- **precondition:** n/a
- **confirm:** n/a
- **route_chain:** `GET /payroll/tech-settings/:userId` (managerUp) · `PUT /payroll/tech-settings/:userId` (ownerOrAdmin) → `TechPaySettingsScreen`
- **request_body:** (settings form), UNVERIFIED exact body
- **side_effects:** updates the user's pay fields.
- **end_state:** Pay settings saved.
- **failure_modes:** none observed.
- **parity:** ANDROID-ONLY.
- **status:** OK
- **status_note:** n/a
### `payroll.simulator`
- **label:** Simulator
- **section:** quick-access
- **actors:** owner, manager
- **purpose:** Model a job's profit split before committing.
- **visibility:** Android quick-access.
- **precondition:** n/a
- **confirm:** n/a
- **route_chain:** `POST /payroll/simulate` → `ProfitSimulatorScreen`
- **request_body:** (job params), UNVERIFIED exact body
- **side_effects:** none (compute only).
- **end_state:** Simulated split shown.
- **failure_modes:** none.
- **parity:** ANDROID-ONLY.
- **status:** OK
- **status_note:** n/a
### `payroll.reimbursements`
- **label:** Reimburse
- **section:** quick-access
- **actors:** owner, manager
- **purpose:** Review/approve/pay material reimbursements owed to techs.
- **visibility:** Android quick-access.
- **precondition:** n/a
- **confirm:** n/a
- **route_chain:** `GET /payroll/reimbursements` → `ReimbursementsScreen`; approve `POST /payroll/reimbursements/:id/approve`; pay `POST /payroll/reimbursements/:id/pay`
- **request_body:** none
- **side_effects:** flips `material_reimbursements` status.
- **end_state:** Reimbursement approved/paid.
- **failure_modes:** none observed.
- **parity:** ANDROID-ONLY, web has no reimbursements screen.
- **status:** OK
- **status_note:** Reimbursement rows are created by the profit engine on completion (tech_reimbursed material policy).

### `payroll.job-report`
- **label:** Job Report tab
- **section:** tabs
- **actors:** owner, manager
- **purpose:** Per-job profit breakdown for the window.
- **visibility:** Android Job-Report tab.
- **precondition:** n/a
- **confirm:** n/a
- **route_chain:** `GET /payroll/job-report`
- **request_body:** n/a
- **side_effects:** read-only.
- **end_state:** Per-job rows.
- **failure_modes:** none.
- **parity:** ANDROID-ONLY.
- **status:** OK
- **status_note:** n/a
### `payroll.period-finalize`
- **label:** Lock / Mark-Paid a payroll period
- **section:** periods
- **actors:** owner
- **purpose:** Finalize a `payroll_periods` record: lock the window, then mark it paid.
- **visibility:** **no audited UI caller**, the hub's "period" is a date filter, not a `payroll_periods` record.
- **precondition:** lock requires `status='open'`.
- **confirm:** n/a
- **route_chain:** `POST /payroll/periods` (create), `POST /payroll/periods/:id/lock`, `POST /payroll/periods/:id/mark-paid` (all ownerOrAdmin)
- **request_body:** none for lock/mark-paid
- **side_effects:** **lock** (payroll.js 171–212): computes `total_payout = Σ tech_earnings.net_payout + Σ unpaid bonuses − Σ unapplied deductions`, links unpaid `tech_earnings` to the period (`payroll_period_id`), sets `status='locked'`, `locked_at`, `total_payout`. **mark-paid** (215–244, transaction): sets period `status='paid'`, and flips `tech_earnings.paid=true`, `tech_bonuses.paid=true`, `tech_deductions.applied=true`.
- **end_state:** Period locked → paid; earnings marked paid.
- **failure_modes:** `dead-feature`, the endpoints exist and are correct, but no screen read this pass calls them (web Payroll and the Android hub both treat "period" as a date range, not a `payroll_periods` lifecycle).
- **parity:** UNKNOWN, neither surface's audited code finalizes a period.
- **status:** DEAD
- **status_note:** The money-finalization endpoints are real but appear unwired. **UNVERIFIED** whether any sub-screen/VM not read this pass calls them.

---

## SCREEN-LEVEL DRIFT FLAGS

- **Massive surface asymmetry**, web Payroll is a read-only earnings list (`/reports/earnings`) with CSV export and drill-down to the Reports module; the entire hub (company P&L, balance-owed, bonuses, deductions, pay settings, simulator, reimbursements, job report) is **Android-only** via `/payroll/*`.
- **Two earnings endpoints**, web reads `/reports/earnings` (`SUM(amount)`); Android reads `/payroll/summary` (`SUM(tech_profit)` + bonuses/deductions → `balance_owed`). Same `tech_earnings` table, different math/columns.
- **Period finalize appears unwired**, `payroll_periods` lock/mark-paid endpoints exist (and correctly link earnings + flip paid flags) but no audited screen calls them; the UI "period" is just a date filter.
- **Web drill-down is name-matched**, `/reports/earnings` rows carry no ids, so web resolves actor ids by matching names against the directory endpoints; a name miss silently disables the drill-down.
- **UNVERIFIED:** Android `tech-settings` PUT body, `simulate` body; whether any unread sub-screen/VM finalizes a `payroll_periods` record; the Android `By Tech` tab specifics.
