# Screen Map — Roster Technicians

> **Format:** Action-Map Schema v1. Source of truth; the HTML atlas is rendered from it.
> When code changes this screen, update this file in the same commit. Reality on disk wins.

---

## SCREEN

| Field | Value |
|---|---|
| `screen_id` | `roster-techs` |
| `display_name` | Roster Technicians |
| `surfaces` | android, web |
| `route_android` | `RosterTechsScreen` + `RosterTechsViewModel` (RosterTechsScreen.kt) — titled "Technicians" |
| `route_web` | `/settings/technicians` → `RosterTechs` (RosterTechs.jsx, 118 lines) |
| `manages_table` | `roster_techs` (field techs **without** app logins — distinct from `users`) |
| `primary_actors` | owner, admin |
| `purpose` | A lightweight CRUD for field technicians who don't have app accounts: name, phone, email, commission %, and CC-fee %. These can be assigned to jobs (`jobs.assigned_roster_tech_id`) and feed the profit/payroll engines. A clean, well-matched screen on both surfaces. |
| `last_verified` | 2026-05-31 · Stage-1 read-only audit · commit: 6147cd1 |

### load_sequence
Both: `GET /roster-techs` → `SELECT * FROM roster_techs WHERE company_id = $1 AND is_active = true ORDER BY name` (bare array).

### gating
`GET /roster-techs` = any authenticated user. **Create / update / delete each inline-check `req.userRole.match(/owner|admin/)` → 403** for manager/technician/dispatcher.

### entry_points
- Web: Settings → "Roster Technicians" (`/settings/technicians`).
- Android: "More" → Business → "Technicians".

---

## ACTIONS

---

### `roster-techs.list`
- **label:** List roster techs
- **section:** list
- **actors:** owner, admin
- **purpose:** Show active roster technicians with commission/CC-fee.
- **visibility:** on open.
- **route_chain:** `GET /roster-techs` (active only, ordered by name)
- **request_body:** —
- **side_effects:** read-only.
- **end_state:** Tech cards (name, phone·email, commission% · CC-fee%).
- **failure_modes:** none.
- **parity:** MATCH — web `useGet('/roster-techs')` (`data?.techs || data?.technicians || data` → bare array); Android `repo.getRosterTechs()`. Same fields shown.
- **status:** OK
- **status_note:** Deactivated techs are excluded server-side (`is_active = true`), so neither surface shows them.

### `roster-techs.create`
- **label:** Add technician
- **section:** write
- **actors:** owner, admin
- **purpose:** Add a roster tech.
- **visibility:** "Add" (web) / FAB (Android).
- **precondition:** owner/admin; name non-blank.
- **confirm:** —
- **route_chain:** `POST /roster-techs` → `INSERT INTO roster_techs (company_id, name, phone, email, commission_pct, cc_fee_pct)`
- **request_body:** `{name, phone, email, commission_pct, cc_fee_pct}` (web coerces the two pcts with `Number(...)||0`; Android sends Doubles)
- **side_effects:** inserts a `roster_techs` row.
- **end_state:** New tech in list.
- **failure_modes:** 400 if name missing; **403 if not owner/admin**.
- **parity:** MATCH — same endpoint + same body keys. Validation: both require a name client-side; backend also requires `name`.
- **status:** OK
- **status_note:** —

### `roster-techs.edit`
- **label:** Edit technician
- **section:** write
- **actors:** owner, admin
- **purpose:** Update a roster tech's fields.
- **visibility:** edit icon per row.
- **precondition:** owner/admin.
- **confirm:** —
- **route_chain:** `PUT /roster-techs/:id` → COALESCE update of name, phone, email, commission_pct, cc_fee_pct, is_active
- **request_body:** `{name, phone, email, commission_pct, cc_fee_pct}`
- **side_effects:** updates the row.
- **end_state:** Updated card.
- **failure_modes:** 403 if not owner/admin; 404 if not found.
- **parity:** MATCH — same endpoint + body keys on both.
- **status:** OK
- **status_note:** —

### `roster-techs.delete`
- **label:** Delete technician
- **section:** write
- **actors:** owner, admin
- **purpose:** Remove a roster tech and unassign them from open jobs.
- **visibility:** trash icon per row.
- **precondition:** owner/admin.
- **confirm:** confirm modal/dialog.
- **route_chain:** `DELETE /roster-techs/:id` → `UPDATE roster_techs SET is_active = false` **+** `UPDATE jobs SET assigned_roster_tech_id = NULL` for that tech's non-completed/cancelled/deleted jobs
- **request_body:** —
- **side_effects:** soft delete (`is_active=false`) **and** unassigns the tech from open jobs.
- **end_state:** Tech removed from the (active) list.
- **failure_modes:** 403 if not owner/admin.
- **parity:** MATCH — both call `DELETE /roster-techs/:id`. Android's dialog accurately says "removed and unassigned from any open jobs"; web says "This cannot be undone" (it's a soft delete, but the job-unassign is real).
- **status:** OK
- **status_note:** Soft delete + job-unassign is a genuine side effect — worth the confirm step on both.

### `roster-techs.back`
- **label:** Back
- **section:** nav
- **actors:** owner, admin
- **purpose:** Return to Settings.
- **visibility:** top-left.
- **route_chain:** web `navigate('/settings')`; Android `onBack`
- **request_body:** —
- **side_effects:** none.
- **end_state:** Settings landing.
- **failure_modes:** none.
- **parity:** MATCH.
- **status:** OK
- **status_note:** —

---

## SCREEN-LEVEL DRIFT FLAGS

- **`roster_techs` table DDL is not in committed SQL.** The table is used across `roster-techs.js`, `jobs.js`, `payroll.js`, `profit.js`, `reports.js`, and `cron.js`, but no `CREATE TABLE roster_techs` exists in `db/schema.sql` or any `db/migrate_*.sql`. **UNVERIFIED** column types/constraints; the columns `name, phone, email, commission_pct, cc_fee_pct, is_active, company_id` are nonetheless used consistently by the handler and both clients.
- **Input bounds differ.** Android uses steppers clamped to commission 0–100 % and CC-fee 0–10 %; web uses free `type="number"` inputs (no min/max), so web could submit out-of-range or negative percentages (the backend stores whatever is sent).
- **CC-fee % is roster-only.** Unlike `users` (which has `commission_pct` but no `cc_fee_pct`), roster techs carry a `cc_fee_pct` — this screen is the only place it's edited.
- **Title mismatch:** web "Roster Technicians" vs Android "Technicians" (cosmetic). Both manage the same `roster_techs` table.
- **Gating is inline regex** (`req.userRole.match(/owner|admin/)`), not the shared `ownerOrAdmin` middleware used elsewhere — behaviourally equivalent here, but a different pattern.
