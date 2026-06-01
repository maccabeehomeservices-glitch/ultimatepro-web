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
| `last_verified` | 2026-06-01 · backend 2269f85 · Commit A + B: earnings = real collected money. A: gross unified to getJobGross (summed completed payments, net of refunds); /complete branches fully-paid→completed+earnings vs balance→holding+no-earnings. B: reconcileJobEarnings payment-event trigger (payment/refund/ScanPay) auto-settles holding jobs on clear-day + refund clawback + ScanPay earnings-gap fixed. |

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
- **side_effects:** `profit-calc`, `update-record` (`job_completion_details` upsert, status `pending`, always, persists the parts/CC inputs), `status-change` (→ `completed` if fully paid, else `holding`), and **only when fully paid:** `earnings-write` (`tech_earnings`, user XOR roster), `reimbursement-write` (if tech_reimbursement>0), `commission-resolve`. `actual_end` set in both cases.
- **end_state:** **Branches on the invoice balance (Commit A, 2026-06-01).** If `SUM(invoice.balance_due) = 0` (fully paid, or no invoice → $0): status `completed`, earnings written on **gross = collected payments** (`getJobGross`), dated to today. If a balance remains: status `holding` + `actual_end` (work done) + `job_completion_details` saved (status `pending`, persists parts/CC) but **NO earnings yet**: those fire when the balance later clears (Commit B). Gross for the split = `getJobGross` (summed completed payments), not the billed invoice total.
- **failure_modes:** `validation-reject` (400 "Profit allocation conflict" when source%+tech%>100, runs before any mutation, before the holding/completed branch).
- **parity:** MATCH: both surfaces send the same body; the holding/earnings-on-paid logic is backend-side (no client change).
- **status:** OK
- **status_note:** Commit A (2026-06-01): earnings = real collected money. Gross unified to `getJobGross` = `SUM(payments.amount WHERE status='completed')` joined to the job's invoices (one source of truth, mirrors the collections report). Completion now branches: fully paid → `completed` + earnings (dated today); balance remaining → `holding` + `actual_end` + completion record saved, no earnings. **Commit B pending:** the payment/refund/ScanPay trigger that fires a holding job's earnings when its balance later clears (today a holding job does NOT auto-complete on later payment yet).

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

- **Gross (Commit A, 2026-06-01):** `gross = getJobGross(jobId)` = `SUM(payments.amount WHERE status='completed')` joined to the job's invoices: **real collected money**, one source of truth (utils/profit.js, mirrors the collections report). Replaced the old billed sources (latest-invoice / line-items / amount_paid). Earnings fire **only when fully paid** (`SUM(invoice.balance_due)=0`); a completion with a balance → `holding` + `actual_end`, no earnings yet.
- **Guard:** `source% + effectiveTechPct > 100` → HTTP 400 "Profit allocation conflict". Runs before any mutation (before the holding/completed branch).
- **Partner split:** `net = gross − parts_amount − cc_fee_amount`; `sender_earns = net·senderPct%`, `receiver_earns = net·receiverPct%`; then CC absorption subtracted per `cc_fee_paid_by` (sender / receiver / split 50-50). Gross now = collected payments.
- **Tech three-slice:** `netProfit = gross − material_cost` (`gross` = collected payments; material_cost from `job_line_items`); `source = netProfit·sourcePct%`, `tech = netProfit·techPct%` (owner/admin → techPct=0), `company = remainder`.
- **4 actors:** owner self → techPct 0; roster tech → `roster_techs.commission_pct`, writes `roster_tech_id`; app-user tech → full material-policy branching; partner-received → sender/receiver split + the receiver's assigned actor also gets a `tech_earnings` row.
- **Writes (fully-paid):** `job_completion_details` (status `pending`) → `jobs` (status `completed`, actual_end) → `tech_earnings` (DELETE then INSERT, dated `created_at=NOW()` = clear-day) → `material_reimbursements` (if any). **Writes (holding):** `job_completion_details` (status `pending`, persists parts/CC) → `jobs` (status `holding`, actual_end). No `tech_earnings`.

---

## SCREEN-LEVEL DRIFT FLAGS

- **Partner-split money gap (web): RESOLVED (Phase 1, 2026-05-31).** Web now renders the parts/CC form for partner jobs and sends the same body as Android, so web-completed partner jobs produce the same `job_completion_details` numbers. No more overstated earnings.
- **Web payment_method: RESOLVED (Phase 1)** — the dead select was removed; web no longer sends `payment_method`.
- **No web confirm surface** — `GET/POST /completion[/confirm]` orphaned on web. (Unchanged — Phase 1 did not add a confirm UI.)
- **Two completion paths — web side closed (Phase 1):** web's Status modal "Completed" now opens the Complete modal instead of `POST /status?completed`, so web completion always runs the `/complete` path (guard + partner split + `job_completion_details`), mirroring Android. The legacy backend `/status?completed` branch still EXISTS but web no longer uses it for completion. **Honest caveat:** the `/status?completed` branch also runs three side-effects that `/complete` does NOT — source-contact notify, truck inventory deduction, membership `next_job_date` advance (jobs.js 879-934). Android completes via `/complete` only, so it already skips these; web now matches Android. Porting those three into `/complete` is a recommended **backend follow-up** (out of this web-only scope).
- **`tip_amount` column** exists on `job_completion_details` but neither surface captures a tip → always 0 (dead column).
- **`/complete` is not transactional:** a post-hook failure can leave the job `completed` with no `tech_earnings` row (silent partial state).
- **Gross sources UNIFIED (Commit A, 2026-06-01):** all earnings/profit gross now flows through one helper `getJobGross` = summed completed payments. Replaced the prior 3 drifted sources: partner-split latest-invoice (jobs.js), three-slice line-items→invoice→amount_paid (profit.js `saveJobEarnings`), and legacy `calculateTechEarnings` line-items SUM (jobs.js). (Note: `sources.js` "revenue by source" report intentionally stays **billed** revenue, a distinct concept from collected earnings; not changed.)
- **Earnings = real collected money (Commit A):** earnings fire only when an invoice's balance is fully paid; partial → `holding` + `actual_end`, no earnings. The completion record (parts/CC) is persisted at holding (status `pending`) so the split can be finalized later. **Commit B BUILT (2026-06-01):** `reconcileJobEarnings(jobId, companyId)` (`backend/utils/profit.js`) is the payment-event trigger, wired into `POST /invoices/:id/payment`, `POST /payments/:id/refund`, and the ScanPay webhook. When a later payment clears a work-done holding job's balance, it auto-completes the job and fires earnings on `getJobGross` dated to the clear-day (`tech_earnings.created_at=NOW()`) + recomputes the partner split (kept `pending` for sender confirm). Refunds claw back: `getJobGross` nets `refund_amount`, earnings recompute down, and a reopened balance flips `completed` → `holding`. Deposit-holding (`actual_end` null) is never auto-completed. The full money model (collect → settle → clawback) is complete.
- **`$0`-collected completion:** a fully-paid job with `getJobGross=0` (no payments / no invoice) → `completed` with $0 earnings (intended: only real money pays out).
- **Holding now has two meanings:** estimate-deposit holding (`actual_end` null, deposit taken, work pending) vs work-done holding (`actual_end` set, balance owed). Distinguish by `actual_end`.
