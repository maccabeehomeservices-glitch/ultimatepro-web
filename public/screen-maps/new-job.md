# Screen Map — New Job (Job Form)

> **Format:** Action-Map Schema v1. Source of truth; the HTML atlas is rendered from it.
> When code changes this screen, update this file in the same commit. Reality on disk wins.

---

## SCREEN

| Field | Value |
|---|---|
| `screen_id` | `new-job` |
| `display_name` | New Job (Job Form) |
| `surfaces` | android, web |
| `route_android` | `jobs/new?ticket={ticket}` → `JobFormScreen` (JobScreens.kt 3197–3922) |
| `route_web` | `/jobs/new` (and `/jobs/:id/edit`) → `JobForm` (JobForm.jsx, 1015 lines) |
| `primary_actors` | office, owner |
| `purpose` | The front door of the whole system. Office/owner turn an incoming call, online booking, or pasted ticket into a job: pick or create the customer, set source/type/assignment/schedule, then Save (or Save & Send to notify the assignee). The Paste Ticket AI feature is the headline — it parses raw notes into a pre-filled form and looks up the customer. |
| `last_verified` | 2026-06-01 · Phase 1 New Job F2 + F2b + F3; TZ commit 1/3 backend foundation (jobs.job_timezone + tz-lookup in geocode + effective_timezone in responses). Issue 1 client write/display = commits 2/3. |

### load_sequence
Form loads local state; pulls dropdown data: users (team), roster techs, job sources, ad channels, network connections. In edit mode (`/jobs/:id/edit`) it first loads the job via `GET /jobs/:id`.

### entry_points
- **Android:** Jobs list "+", Dashboard (incl. `jobs/new?ticket={text}` deep link — note: the composable signature doesn't consume the ticket arg; whether VM reads it via SavedStateHandle is UNVERIFIED).
- **Web:** Jobs list "+ New Job" → `/jobs/new`; Job Detail edit pencil → `/jobs/:id/edit`.

---

## ACTIONS

The form's **fields** are inventoried at the bottom (they don't each call a route). The **actions** below are the things that actually do something — Paste Ticket, Save, Save & Send, Cancel, and the customer-resolution flows.

---

### `new-job.paste-ticket`
- **label:** Paste Ticket
- **section:** top-bar
- **actors:** office, owner
- **purpose:** Turn raw pasted notes (call notes, lead email, text) into a pre-filled job in one tap — the platform's signature time-saver.
- **visibility:** always (top of form)
- **precondition:** Clipboard / pasted text is non-empty.
- **confirm:** —
- **route_chain:** `POST /jobs/parse-ticket {text}` → Anthropic `claude-opus-4-5` parses → returns `customer_name, company_name, email, address, city, state, zip, job_title, job_description, scheduled_date, scheduled_time, source, source_review_link, leftover_notes, ticket_ref, phone_numbers[], phone, existing_customer_id, existing_customer, existing_jobs[]`
- **request_body:** `{text}`
- **side_effects:** `update-record` (form prefill, local), customer lookup (see customer-resolution)
- **end_state:** Form fields pre-filled; customer matched or staged for creation.
- **failure_modes:** none fatal — web maps `p.type||p.job_type` for the type chip but parse returns neither → type stays default (dead mapping, harmless).
- **parity:** PARTIAL — Web opens a modal with an editable textarea + "Parse with AI" button. Android reads the clipboard and parses **immediately**, no modal.
- **status:** PARTIAL
- **status_note:** Web = review-before-parse modal; Android = instant parse. Both call the same endpoint. Android deep-link ticket arg (`jobs/new?ticket=`) consumption is UNVERIFIED.

### `new-job.customer-resolution`
- **label:** Customer match / create (auto, during parse or at save)
- **section:** customer-card
- **actors:** office, owner
- **purpose:** Attach the right customer — link an existing one (returning customer) or create a new record — without manual searching.
- **visibility:** runs on parse (both) and at save when no customer is linked yet.
- **precondition:** A parsed/typed name or phone exists.
- **confirm:** Duplicate sheet/modal if a likely match is found.
- **route_chain:** `GET /customers?search=` (lookup) → `POST /customers` (create) ; Android save-time also calls `vm.checkDuplicateByPhone` (endpoint UNVERIFIED)
- **request_body:** create: `{first_name, last_name, phone, email, type:'residential'}`
- **side_effects:** `create-record` (customer), sets `linked_job_id` on Go-Back/Follow-Up (Android)
- **end_state:** Job is linked to a real customer; returning/go-back/follow-up tags applied.
- **failure_modes:** behavioral asymmetry (see parity) — not an error, but a real divergence.
- **parity:** DIVERGENT — Web requires a resolved `customer_id` before save (blocks with "Customer is required") and shows a 3-option duplicate modal (Returning / Create New / Go Back) only for parsed tickets. Android auto-creates a customer from the typed name (no hard requirement) and shows a richer 4-option sheet (Returning / Go-Back-Warranty / Follow-Up / Cancel) for both parsed and manual-phone entry, with prior-job linking on Go-Back & Follow-Up.
- **status:** PARTIAL
- **status_note:** Web blocks without a customer; Android silently creates one. Android captures `linked_job_id`; web never sends it.

### `new-job.save`
- **label:** Save Job / Save Changes
- **section:** footer (web) + top-bar (Android also has a top Save)
- **actors:** office, owner
- **purpose:** Create the job (or save edits). The core action.
- **visibility:** always
- **precondition:** Web: a customer must be resolved. Android: none (auto-creates customer).
- **confirm:** —
- **route_chain:** create `POST /jobs` ; edit `PUT /jobs/:id`
- **request_body:** **Web** `{customer_id, type, notes, description(=notes), address, city, state, zip, scheduled_start, assigned_to, assigned_roster_tech_id, source_type, job_source_id, ad_channel_id}` (+ `notify_*` only on Save & Send). **Android** `{type, address, city, state, zip, notes, scheduled_start, assigned_to, assigned_roster_tech_id, source(label), source_type, job_source_id, ad_channel_id, customer_id, linked_job_id, notify_sms/email/push(always), skip_duplicate_check:true}`.
- **side_effects:** `create-record` (job), `commission-resolve` (status set by assignment), optional auto-dispatch, `joby-trigger` (`job_assigned` if assigned), `push` to company, in-app notification, socket `job:created`, background geocode
- **end_state:** Job created at status `scheduled` (if assigned) or `unscheduled` (if not); navigate to the new job (web) / pop back (Android).
- **failure_modes:** `field-mismatch`/schema-noise — `notify_sms/email/push` are sent but are NOT jobs columns; `POST /jobs` never reads them → silently ignored (notification is driven separately by dispatch/notify-tech).
- **parity:** PARTIAL — Web sends `description` + omits `source` label / `linked_job_id` / `skip_duplicate_check`. Android sends `source` label + `linked_job_id` + `skip_duplicate_check`, omits `description`, sends `notify_*` always.
- **status:** PARTIAL
- **status_note:** Functional both sides; payload differs. Web loses the human "Source / Ticket #" label; Android carries it into `jobs.source`.

### `new-job.scheduled-start`
- **label:** Date + Time → scheduled_start
- **section:** schedule
- **actors:** office, owner
- **purpose:** Set when the job is scheduled.
- **visibility:** always
- **precondition:** —
- **confirm:** —
- **route_chain:** part of `POST /jobs` payload
- **request_body:** `scheduled_start` (ISO string or null)
- **side_effects:** `update-record`
- **end_state:** Job carries the chosen start time (or none).
- **failure_modes:** `divergent-logic` (timezone only, still open) — both surfaces are now null-safe: blank date → `null` on web AND Android (Phase 1 F2; Android's "now" fabrication removed). Date-only defaults to noon on both (web `scheduled_time || '12:00'`, Android `schedTime.ifBlank { "12:00" }`). **Still divergent on timezone:** web sends UTC ISO (`dt.toISOString()`), Android sends a naive-local string with no offset (`${date}T${time}:00`) — Issue 1, next commit.
- **parity:** PARTIAL — null/blank handling now matches; the same wall-clock can still persist as a different instant because of the UTC-vs-naive write divergence (Issue 1).
- **status:** PARTIAL
- **status_note:** Phase 1 F2 (2026-06-01): Android blank date no longer fabricates "now" — it sends `null` like web, killing the phantom-calendar bug; blank-date jobs are created `unscheduled` (findable via `created_at`). Backend PUT also flips `unscheduled → scheduled` when a date is added on edit (F2b). **Timezone backend foundation landed (TZ commit 1/3, 2026-06-01):** new `jobs.job_timezone` column, resolved from the address lat/lng via the local `tz-lookup` lib inside `geocodeAndStore` (no Google Time Zone API); job responses now carry `job_timezone` + a computed `effective_timezone` (`job_timezone → companies.timezone → 'America/New_York'`). **Remaining (Issue 1, commits 2/3):** the client write contract is unchanged this commit, and the read-back display is still split between Date-parse and string-slice, so a web-vs-Android job can still render at a different time until the client display fix.

### `new-job.assign`
- **label:** Assign (self / team / roster / partner)
- **section:** assignment
- **actors:** office, owner
- **purpose:** Choose who does the job.
- **visibility:** always
- **precondition:** —
- **confirm:** —
- **route_chain:** part of `POST /jobs` (`assigned_to` for self/team user, `assigned_roster_tech_id` for roster). Partner → neither field sent.
- **request_body:** `assigned_to` XOR `assigned_roster_tech_id`
- **side_effects:** `update-record`; backend sets status `scheduled` if assigned else `unscheduled`
- **end_state:** Job assigned to a user or roster tech; partner requires a later "Send To" from Job Detail.
- **failure_modes:** none — partner intentionally deferred to Job Detail.
- **parity:** PARTIAL — Web = inline tabs + dropdown; Android = button → AlertDialog. Web renders a Partner dropdown but (like Android) sends no partner field; both instruct partner-forwarding via Job Detail.
- **status:** OK
- **status_note:** "Self" = the owner user id (status still becomes `scheduled`).

### `new-job.send-via`
- **label:** Send Via — SMS / Email / Push (Save & Send)
- **section:** assignment / footer
- **actors:** office, owner
- **purpose:** Notify the assignee when saving.
- **visibility:** only when assignment is not "self" (Push only for team)
- **precondition:** Job is being assigned to someone other than self.
- **confirm:** —
- **route_chain:** Both: `POST /roster-techs/notify-tech` (Phase 1 F3 — web now mirrors Android; the endpoint serves both roster techs and app-user techs).
- **request_body:** `{job_id, tech_id, method}` — `method` is `'sms'` or `'email'` (`tech_id` ignored; backend derives the tech from the job).
- **side_effects:** `sms-tech`/`email-tech` (the assigned technician is notified). The customer en-route SMS is no longer fired here; it lives at Job Detail's dispatch/arrived actions.
- **end_state:** Assigned tech notified about the new job.
- **failure_modes:** none for the common case. Edge: backend `notify-tech` has no `'both'` branch, so selecting both SMS + email sends SMS only (web prefers SMS); a push-only selection sends nothing (matches Android, whose send path also fires only on sms||email).
- **parity:** MATCH — both surfaces notify the assigned tech via `/roster-techs/notify-tech`; web no longer fires the premature customer dispatch at creation.
- **status:** OK
- **status_note:** Phase 1 F3 (2026-06-01): web Save & Send now notifies the TECH (mirroring Android), not the customer. The customer "on the way" dispatch SMS stays available at Job Detail (dispatch/arrived), where it belongs. The web `rosterTechsApi.notifyTech` body key was corrected (`notify_method` → `method`).

### `new-job.cancel`
- **label:** Cancel / Back
- **section:** top-bar / footer
- **actors:** office, owner
- **purpose:** Leave without saving.
- **visibility:** always
- **precondition:** —
- **confirm:** —
- **route_chain:** none (navigate)
- **request_body:** —
- **side_effects:** `navigate`
- **end_state:** Returns to previous screen.
- **failure_modes:** none
- **parity:** PARTIAL — Web has both a top Back and a footer Cancel; Android has top-bar back only (and an extra top-bar Save).
- **status:** OK
- **status_note:** —

### `new-job.status-field`
- **label:** Status dropdown (edit mode)
- **section:** schedule (web edit only)
- **actors:** office, owner
- **purpose:** Intended to set job status while editing.
- **visibility:** web edit-mode only; Android has none on the form (status lives in JobEditScreen).
- **precondition:** —
- **confirm:** —
- **route_chain:** none — `buildPayload` never includes `status`; `PUT /jobs/:id` doesn't read it.
- **request_body:** not sent
- **side_effects:** none
- **end_state:** (intended) status changes — but nothing happens.
- **failure_modes:** `dead-code` — the field is collected but never saved.
- **parity:** WEB-ONLY (dead).
- **status:** DEAD-CODE
- **status_note:** Editing Status in the web form does nothing on save. Status changes only via `POST /jobs/:id/status` from Job Detail.

---

## FIELD INVENTORY (form inputs — reference, not actions)

| # | Field | Web | Android | Maps to | Notes |
|---|---|---|---|---|---|
| 1 | Job Source | select (My Company / Contacts / Ad Channels) | dropdown | `source_type` + `job_source_id`/`ad_channel_id` | default own_company |
| 2 | Job Type | chip group (9 labels) | chips (6 raw enums) | `type` | web maps synthetic labels; web has no "emergency" chip, Android does |
| 3 | Assign | tabs self/team/roster/partner | button→dialog | `assigned_to`/`assigned_roster_tech_id` | see `new-job.assign` |
| 3d | Send Via | checkboxes SMS/Email/Push | AppSwitch | `notify_*` (NOT job columns) | shown only when not-self |
| 4 | Customer | search + dropdown / pill | name text (✓ when matched) | `customer_id` | web required; Android auto-creates |
| 4a/b | Extra phones / emails | repeatable text | repeatable text | customer record (post-save) | persistence path UNVERIFIED |
| 5 | Street Address | text + Google Places | PlacesAddressField | `address` | |
| 5a | City / State / ZIP | text | text | `city`/`state`(→abbr)/`zip` | |
| 5b | Address-inaccurate warning | banner (edit + `address_verified===false`) | — | — | web-only |
| 6 | Job Notes | textarea | text (3 lines) | `notes` (web also `description`) | |
| 7 | Date | native date input | field → DatePicker dialog | part of `scheduled_start` | see `new-job.scheduled-start` |
| 7a | Time | native time input | field → TimePicker dialog | part of `scheduled_start` | |
| 8 | Status | select (edit only) | — (JobEditScreen) | not sent | DEAD on save (web) |

---

## SCREEN-LEVEL DRIFT FLAGS

- **scheduled_start timezone drift** (Issue 1, partially addressed — biggest risk): web sends UTC ISO, Android sends naive-local; same wall-clock → possibly different stored instant. Read-back is also split between Date-parse (converts) and string-slice (does not), so some surfaces render the wrong time. NULL/blank handling is fixed (Phase 1 F2). **Backend TZ foundation landed (commit 1/3):** `jobs.job_timezone` resolved from lat/lng via `tz-lookup` in `geocodeAndStore`; responses expose `job_timezone` + `effective_timezone` (job→company→`America/New_York`). Client write contract + display fixes are commits 2/3.
- **Status auto-flip on edit (Phase 1 F2b):** `PUT /jobs/:id` now promotes `unscheduled → scheduled` when a date is added on edit (previously it left a stale `unscheduled` badge on a dated job). The reverse (clearing a date) is not reachable through PUT — it COALESCEs `scheduled_start`, so a null payload means "keep" — deferred follow-up.
- **Customer-required asymmetry:** web blocks without a customer; Android auto-creates one.
- **"Save & Send" RESOLVED (Phase 1 F3):** both surfaces now notify the assigned tech via `/roster-techs/notify-tech`; the premature customer dispatch at creation was removed.
- **Web Status field is dead on save.**
- **notify_sms/email/push** sent by both but ignored by `POST /jobs` (not columns).
- **Android-only carried fields:** `source` label + ticket #, `linked_job_id`, `skip_duplicate_check`, richer duplicate sheet.
- **Web notify email-only path** is a no-op; unused `calls` array.
- **UNVERIFIED (needs Stage-2 read of JobViewModel/CrmRepository):** Android `vm.parseTicket` body, `vm.checkDuplicateByPhone` endpoint, extra-phones/emails persistence path, deep-link `ticket` arg consumption.
