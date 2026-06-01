# Screen Map — Complete Job

> **Format:** Action-Map Schema v1. Source of truth; the HTML atlas is rendered from it.
> When code changes this screen, update this file in the same commit. Reality on disk wins.

---

## SCREEN

| Field | Value |
|---|---|
| `screen_id` | `complete-job` |
| `display_name` | Complete Job |
| `surfaces` | android, web |
| `route_android` | `jobs/{jobId}/complete` → `CompleteJobScreen` (JobScreens.kt 2974–3192), dedicated screen |
| `route_web` | inline Complete modal in `JobDetail` (JobDetail.jsx ~1495–1605); partner-split form + live calc render when `agreement_id != null` |
| `primary_actors` | tech-user (submit), owner (review/confirm) |
| `purpose` | The money spine's terminal action. Locks the job outcome, runs profit allocation, and writes earnings. For partner jobs it captures the parts/CC inputs that drive the sender/receiver split and routes the result through a confirm step. |
| `last_verified` | 2026-05-31 · Phase 1 Complete Job money fix (web partner-split form + live calc + Status-completed reroute) |

### load_sequence
Android: dedicated screen loads job summary + (partner jobs) builds a live split calculator. Job Detail's completion banner separately calls `GET /jobs/:id/completion`. Web: modal opens; for partner jobs it renders the same parts/CC form + a live split calculator using the already-loaded `jobInvoice.total` as gross (mirrors Android's `getInvoices().firstOrNull()`). Web still never calls `GET /completion`.

### entry_points
- **Android:** Job Detail status sheet "completed" → `onComplete()` navigates to `CompleteJobScreen` (never hits `/status?completed`).
- **Web:** Job Detail "Completed" button → opens the inline modal. Web's Status modal "Completed" now also routes here (opens the Complete modal) instead of `POST /status`, mirroring Android.

---

## ACTIONS

---

### `complete-job.submit`
- **label:** Complete Job & Submit Split / Mark as Complete / Complete Job (web)
- **section:** submit
- **actors:** tech-user, owner
- **purpose:** Lock the job, run profit allocation, write earnings.
- **visibility:** always
- **precondition:** Backend runs the >100% profit guard first; over-allocation blocks (HTTP 400).
- **confirm:** —
- **route_chain:** `POST /jobs/:id/complete`
- **request_body:** **partner job (both surfaces):** `{parts_paid_by, parts_amount, payment_collected_by, cc_fee_amount, cc_fee_paid_by, notes?}` (parts_amount 0 when "none", cc_fee_amount 0 when toggle off). **non-partner (both surfaces):** `{notes?}` only. Web now builds the same body as Android (Phase 1); the dead `payment_method` was removed.
- **side_effects:** `profit-calc`, `earnings-write` (`tech_earnings`, user XOR roster), `update-record` (`job_completion_details` upsert, status `pending`), `reimbursement-write` (if tech_reimbursement>0), `status-change` (job → `completed`), `commission-resolve`
- **end_state:** Job `completed`; `job_completion_details` written (status `pending`); `tech_earnings` row(s) written; profit split across source/tech/company (or sender/receiver for partner).
- **failure_modes:** `validation-reject` (400 "Profit allocation conflict" when source%+tech%>100).
- **parity:** MATCH — web now captures parts/CC for partner jobs and sends the identical body; non-partner sends notes only.
- **status:** OK
- **status_note:** Phase 1 (2026-05-31): web partner jobs now send parts/CC, so web-completed partner jobs produce the same `job_completion_details` numbers as Android. `divergent-logic` cleared.

### `complete-job.partner-split`
- **label:** Parts / CC-fee / payment-collected inputs (partner jobs)
- **section:** partner-split
- **actors:** tech-user, owner
- **purpose:** Capture the deductions that drive the sender/receiver split: who supplied parts, parts amount, who collected payment, CC fee + who absorbs it.
- **visibility:** both surfaces, only when `job.agreement_id != null` (partner job). Web now renders the same form inside the Complete modal (Phase 1).
- **precondition:** Partner job (`agreement_id` set).
- **confirm:** —
- **route_chain:** part of `POST /jobs/:id/complete`
- **request_body:** `parts_paid_by` (sender/receiver/none), `parts_amount`, `payment_collected_by` (sender/receiver), `cc_fee_amount`, `cc_fee_paid_by` (sender/receiver/split)
- **side_effects:** `profit-calc` — `net = gross − parts − cc`; `sender_earns = net·senderPct%`, `receiver_earns = net·receiverPct%`; CC absorption subtracted per `cc_fee_paid_by`.
- **end_state:** `job_completion_details` carries correct net + split.
- **failure_modes:** none — web sends the same inputs as Android; if no invoice is loaded the web live-calc hides (display only) but the form still submits and the backend computes authoritatively.
- **parity:** MATCH.
- **status:** OK
- **status_note:** Phase 1 (2026-05-31): web renders parts FilterChips (Company/Technician/No Parts), parts amount, payment-collected chips, a CC-fee toggle + amount + absorbed-by chips (Sender/Receiver/Split 50/50), and a live split calculator. Values sent are `sender/receiver/none/split` exactly as Android. Web-completed partner jobs now match Android's `job_completion_details`.

### `complete-job.payment-method`
- **label:** Payment Collected dropdown (web) — REMOVED
- **section:** web modal
- **actors:** office, owner
- **purpose:** (Former) record how payment was collected. The control was dead (backend never read `payment_method`).
- **visibility:** removed from the web modal (Phase 1). For partner jobs, who-collected is now captured by `payment_collected_by` (see `complete-job.partner-split`).
- **precondition:** —
- **confirm:** —
- **route_chain:** n/a — no longer sent.
- **request_body:** n/a (web body no longer includes `payment_method`).
- **side_effects:** none.
- **end_state:** n/a.
- **failure_modes:** none — the dead field was removed.
- **parity:** n/a.
- **status:** REMOVED
- **status_note:** Phase 1 (2026-05-31): the dead `payment_method` select was deleted from the web Complete modal; the web body no longer sends it. Real who-collected intent now rides `payment_collected_by` on partner jobs.

### `complete-job.notes`
- **label:** Completion Notes
- **section:** both
- **actors:** tech-user, owner
- **purpose:** Free-text note saved with the completion.
- **visibility:** always (both surfaces)
- **precondition:** —
- **confirm:** —
- **route_chain:** part of `POST /jobs/:id/complete`
- **request_body:** `notes`
- **side_effects:** `update-record` (`job_completion_details.notes`)
- **end_state:** Note saved with the completion record.
- **failure_modes:** none
- **parity:** MATCH — the only shared input.
- **status:** OK
- **status_note:** —

### `complete-job.confirm`
- **label:** Confirm Completion (partner split review)
- **section:** confirm
- **actors:** owner (sender/owning company only)
- **purpose:** The sending company reviews and confirms the partner split a receiver submitted.
- **visibility:** Android completion sheet, when `completion.status == pending && isSender && isPartnerJob`. Web: no UI.
- **precondition:** A pending partner completion exists; caller is the sender/owning company.
- **confirm:** —
- **route_chain:** `GET /jobs/:id/completion` (load) → `POST /jobs/:id/completion/confirm`
- **request_body:** —
- **side_effects:** `update-record` (`confirmed_by`, `confirmed_at`, status → `confirmed`)
- **end_state:** Partner completion confirmed.
- **failure_modes:** `permission-403` (non-sender). Web: `dead-code` — web never calls either endpoint, so a sender on web can't confirm.
- **parity:** ANDROID-ONLY.
- **status:** PARTIAL
- **status_note:** Web orphans `GET /jobs/:id/completion` and `POST /jobs/:id/completion/confirm` — no confirm surface on web.

### `complete-job.cancel`
- **label:** Cancel / Back
- **section:** nav
- **actors:** tech-user, owner
- **purpose:** Leave without completing.
- **visibility:** always
- **precondition:** —
- **confirm:** —
- **route_chain:** none (navigate)
- **request_body:** —
- **side_effects:** `navigate`
- **end_state:** Returns to Job Detail.
- **failure_modes:** none
- **parity:** MATCH
- **status:** OK
- **status_note:** —

---

## THE MONEY MATH (reference)

- **Guard:** `source% + effectiveTechPct > 100` → HTTP 400 "Profit allocation conflict". Runs only on `/complete` (NOT on the `/status?completed` legacy path).
- **Partner split:** `net = gross − parts_amount − cc_fee_amount`; `sender_earns = net·senderPct%`, `receiver_earns = net·receiverPct%`; then CC absorption subtracted per `cc_fee_paid_by` (sender / receiver / split 50-50).
- **Tech three-slice:** `netProfit = gross − material_cost` (material_cost from `job_line_items`, *not* the complete-body parts); `source = netProfit·sourcePct%`, `tech = netProfit·techPct%` (owner/admin → techPct=0), `company = remainder`.
- **4 actors:** owner self → techPct 0; roster tech → `roster_techs.commission_pct`, writes `roster_tech_id`; app-user tech → full material-policy branching; partner-received → sender/receiver split + the receiver's assigned actor also gets a `tech_earnings` row.
- **Writes (in order):** `job_completion_details` (status `pending`) → `jobs` (status `completed`, actual_end) → `tech_earnings` (DELETE then INSERT) → `material_reimbursements` (if any).

---

## SCREEN-LEVEL DRIFT FLAGS

- **Partner-split money gap (web): RESOLVED (Phase 1, 2026-05-31).** Web now renders the parts/CC form for partner jobs and sends the same body as Android, so web-completed partner jobs produce the same `job_completion_details` numbers. No more overstated earnings.
- **Web payment_method: RESOLVED (Phase 1)** — the dead select was removed; web no longer sends `payment_method`.
- **No web confirm surface** — `GET/POST /completion[/confirm]` orphaned on web. (Unchanged — Phase 1 did not add a confirm UI.)
- **Two completion paths — web side closed (Phase 1):** web's Status modal "Completed" now opens the Complete modal instead of `POST /status?completed`, so web completion always runs the `/complete` path (guard + partner split + `job_completion_details`), mirroring Android. The legacy backend `/status?completed` branch still EXISTS but web no longer uses it for completion. **Honest caveat:** the `/status?completed` branch also runs three side-effects that `/complete` does NOT — source-contact notify, truck inventory deduction, membership `next_job_date` advance (jobs.js 879-934). Android completes via `/complete` only, so it already skips these; web now matches Android. Porting those three into `/complete` is a recommended **backend follow-up** (out of this web-only scope).
- **`tip_amount` column** exists on `job_completion_details` but neither surface captures a tip → always 0 (dead column).
- **`/complete` is not transactional** — a post-hook failure can leave the job `completed` with no `tech_earnings` row (silent partial state).
- **Gross source differs:** partner split reads gross from the latest invoice; the tech slice derives subtotal from line items (fallback invoice.total → amount_paid). A job where these differ values the two off different numbers.
