# Screen Map, Automation (Ailot)

> **Format:** Action-Map Schema v1. Source of truth; the HTML atlas is rendered from it.
> When code changes this screen, update this file in the same commit. Reality on disk wins.

---

## SCREEN

| Field | Value |
|---|---|
| `screen_id` | `automation` |
| `display_name` | Automation Rules (Ailot) |
| `surfaces` | android, web |
| `route_android` | `/settings/ailot` → `AilotScreen` + `AilotViewModel` (AilotScreen.kt) |
| `route_web` | `/settings/automation` → `AutomationRules` (AutomationRules.jsx, 182 lines) |
| `manages_table` | `joby_rules` (the "Joby"/Ailot automation engine rules) |
| `primary_actors` | owner, admin |
| `purpose` | View the automation rules ("Ailot") that fire when workflow events happen (job completed, invoice sent, etc.) and toggle each on/off. **Both surfaces are view + toggle only, neither can create, edit, or delete a rule** (the backend CRUD endpoints exist but no UI wires them; rules are seeded server-side). |
| `last_verified` | 2026-06-07 · Re-verified vs live code (Tier-4 audit): the rule **ENGINE is fully wired + firing** — `fireJobyRules` called on real events (jobs.js job_assigned/status-map/holding→completed, estimates.js estimate_approved, invoices.js invoice_sent/invoice_paid), immediate + cron-delayed, real Twilio/SendGrid. **Correction:** the fix-list previously implied "dead" — only the **CRUD/authoring is client-unreachable** (no create/edit/delete UI on either platform; rules seeded server-side). Engine = OK; authoring-UI = the only gap. Prior: 2026-05-31 Stage-1 audit, 6147cd1. |

### schema (confirmed, schema.sql:359–378)
`joby_rules(id, company_id, name, type CHECK('auto_dispatch','alert','reminder','cancel_flow'), trigger_event TEXT, delay_minutes, notify_customer, notify_tech, notify_owner, sms_template, email_subject, email_template, dispatch_logic CHECK('nearest','round_robin','manual','least_busy'), active, created_at)`.

### load_sequence
Both: `GET /company/joby-rules` → `SELECT * FROM joby_rules WHERE company_id ORDER BY trigger_event, delay_minutes`.

### gating
`GET /company/joby-rules` = any authenticated user. **POST / PUT / DELETE are `ownerOrAdmin`** (company.js), but only the `active`-toggle PUT is reached from any UI.

### trigger events (confirmed fire sites)
`fireJobyRules(trigger, …)` is called with: **`estimate_approved`** (estimates.js:612), **`job_assigned`** (jobs.js:430, 767), **`job_completed`** (jobs.js:1282), and via the status map (jobs.js:833) **`job_en_route` / `job_started` / `job_completed` / `job_cancelled`**, plus **`invoice_sent`** (invoices.js:463) and **`invoice_paid`** (invoices.js:593). `trigger_event` is a free-text column matched by exact string.

### entry_points
- Web: Settings → "⚡ Ailot" (`/settings/automation`).
- Android: "More" → Business → "⚡ Ailot" (`/settings/ailot`).

---

## ACTIONS

---

### `automation.list`
- **label:** List rules
- **section:** view
- **actors:** owner, admin
- **purpose:** Show all automation rules with their on/off state.
- **visibility:** on open.
- **route_chain:** `GET /company/joby-rules`
- **request_body:** n/a
- **side_effects:** read-only.
- **end_state:** Rule cards (name, trigger, action/type, active toggle).
- **failure_modes:** none.
- **parity:** MATCH, web `companyApi.getJobyRules()`; Android `repo.getJobyRules()`. Android adds a Refresh button; web auto-loads.
- **status:** OK
- **status_note:** Rules are seeded server-side (no create UI), so the list is whatever exists for the company.

### `automation.view-detail`
- **label:** Expand rule detail
- **section:** view
- **actors:** owner, admin
- **purpose:** Inspect a rule's configuration.
- **visibility:** web, chevron expands a detail panel; Android, inline summary.
- **route_chain:**, (renders already-loaded fields)
- **request_body:** n/a
- **side_effects:** none.
- **end_state:** Detail shown.
- **failure_modes:** none.
- **parity:** PARTIAL, **web's expandable panel shows the most:** delay, notify_customer/tech/owner, dispatch_logic, and the full SMS + email templates. **Android shows only a summary** (trigger label, action label, delay), no notify flags, no dispatch logic, no templates.
- **status:** OK
- **status_note:** Both read-only; web exposes more of the rule than Android.

### `automation.toggle-active`
- **label:** Toggle rule on/off
- **section:** control
- **actors:** owner, admin
- **purpose:** Enable/disable a rule.
- **visibility:** switch per rule.
- **precondition:** owner/admin.
- **confirm:** n/a
- **route_chain:** `PUT /company/joby-rules/:id` with `{ active }`
- **request_body:** `{ active: true|false }`
- **side_effects:** updates `joby_rules.active`; an inactive rule is skipped by `fireJobyRules` (`WHERE active = true`).
- **end_state:** Rule enabled/disabled.
- **failure_modes:** 403 if not owner/admin → both surfaces revert the optimistic toggle.
- **parity:** MATCH, both do an optimistic toggle + `PUT {active}` and revert on failure. This is **the only write either surface performs.**
- **status:** OK
- **status_note:** n/a
### `automation.rule-firing`
- **label:** Rule engine (fireJobyRules)
- **section:** engine
- **actors:** system
- **purpose:** Execute matching rules when a trigger event occurs.
- **visibility:** server-side (not user-facing on this screen).
- **route_chain:** trigger site → `fireJobyRules(event, job, companyId)` → `SELECT … WHERE trigger_event = event AND active = true` → per rule: `delay_minutes>0` queues a `notifications` row (`type 'joby_pending'`, processed by cron); else `executeRule` now
- **request_body:** n/a
- **side_effects:** `executeRule` sends SMS/email to **customer** (if `notify_customer` + phone + `sms_template`), **tech** (`notify_tech`), and **owner** (`notify_owner`), filling `{{job_number}}/{{customer_name}}/{{tech_name}}/…` templates.
- **end_state:** Notifications sent (or queued).
- **failure_modes:** errors are caught/logged, not surfaced; `Promise.allSettled` prevents one send from blocking others.
- **parity:** MATCH (server, surface-agnostic).
- **status:** OK
- **status_note:** **`executeRule` ignores `rule.type`**, it only acts on the `notify_*` flags + templates. So a `type:'auto_dispatch'` rule fired through here just sends notifications; the real `autoDispatch()` is a separate function invoked elsewhere, not by `executeRule`. `dispatch_logic` is likewise unused by this path.

### `automation.manage-crud`
- **label:** Add / edit / delete rule
- **section:** control
- **actors:** owner, admin
- **purpose:** Create, fully edit, or remove a rule.
- **visibility:** **none, no button on either surface.**
- **precondition:** n/a
- **confirm:** n/a
- **route_chain:** backend exists: `POST /company/joby-rules`, `PUT /company/joby-rules/:id` (full field set), `DELETE /company/joby-rules/:id` (all `ownerOrAdmin`)
- **request_body:** POST `{name, type, trigger_event, delay_minutes, notify_*, sms_template, email_subject, email_template, dispatch_logic}`
- **side_effects:** would insert/update/delete a rule.
- **end_state:** n/a
- **failure_modes:** **unreachable from the app**, neither web nor Android renders an add/edit/delete control; only the `active` toggle is wired.
- **parity:** dead, the CRUD endpoints are functional but **no audited client calls them**. Rules are seeded server-side (`db/setup.js`); users can only toggle them. Android's empty-state hint "Configure rules on the web app" is misleading, the web page can't create rules either.
- **status:** DEAD
- **status_note:** Backend CRUD present but UI-orphaned on both surfaces. (UNVERIFIED whether an unaudited admin tool/seed path creates them beyond `setup.js`.)

### `automation.back`
- **label:** Back
- **section:** nav
- **actors:** owner, admin
- **purpose:** Return to Settings.
- **visibility:** top-left.
- **route_chain:** web `navigate('/settings')`; Android `onBack`
- **request_body:** n/a
- **side_effects:** none.
- **end_state:** Settings landing.
- **failure_modes:** none.
- **parity:** MATCH.
- **status:** OK
- **status_note:** n/a
---

## SCREEN-LEVEL DRIFT FLAGS

- **No create/edit/delete UI on either surface.** Both web and Android are list + active-toggle only. The backend `POST`/full-`PUT`/`DELETE` for `joby_rules` exist (ownerOrAdmin) but are unreachable from the app, rules are seeded server-side (`db/setup.js`). Android's "Configure rules on the web app" empty-state hint is inaccurate.
- **Trigger-label maps are cosmetic and partly wrong.** The actually-fired events are `estimate_approved, job_assigned, job_en_route, job_started, job_completed, job_cancelled, invoice_sent, invoice_paid`. **Web's `TRIGGER_LABELS` uses `estimate_signed`** (never fired; the real event is `estimate_approved`) and `invoice_overdue`/`booking_received`/`job_status_changed` (not fired by any audited route), and it has no label for `job_started`/`job_en_route`/`estimate_approved`/`invoice_paid` → those render as raw strings. **Android's labels align better** (correct `estimate_approved`, `invoice_paid`, `job_cancelled`) but lack `job_assigned`/`job_en_route`/`job_started`. Labels don't affect firing, rules match on the stored `trigger_event` string.
- **`executeRule` ignores `type` and `dispatch_logic`.** Firing a rule only sends notifications per the `notify_*` flags + templates. A `type:'auto_dispatch'` rule does **not** auto-dispatch through `fireJobyRules`; `autoDispatch()` is a separate engine function called from the jobs route, not by `executeRule`.
- **Web's `ACTION_LABELS` don't match the `type` enum.** Web maps `create_invoice/notify_office/notify_team/schedule_followup/send_email/send_sms/auto_dispatch/notification`, but `joby_rules.type` is CHECK-constrained to `auto_dispatch/alert/reminder/cancel_flow`. Only `auto_dispatch` overlaps, so most rules show their raw `type` string. (Android's `ACTION_LABELS` are a different non-matching set too.)
- **Delayed rules depend on cron.** `delay_minutes>0` writes a `joby_pending` notification row to be processed later (`utils/cron.js`); immediate rules fire inline. The toggle/list screens don't surface pending/queued state.
