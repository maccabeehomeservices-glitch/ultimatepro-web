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
| `route_web` | inline Complete modal in `JobDetail` (JobDetail.jsx 1450–1478) |
| `primary_actors` | tech-user (submit), owner (review/confirm) |
| `purpose` | The money spine's terminal action. Locks the job outcome, runs profit allocation, and writes earnings. For partner jobs it captures the parts/CC inputs that drive the sender/receiver split and routes the result through a confirm step. |
| `last_verified` | 2026-05-31 · Stage-1 read-only audit · commit: cca244c |

### load_sequence
Android: dedicated screen loads job summary + (partner jobs) builds a live split calculator. Job Detail's completion banner separately calls `GET /jobs/:id/completion`. Web: modal opens with two fields; web never calls `GET /completion`.

### entry_points
- **Android:** Job Detail status sheet "completed" or the "Completed" final-action → navigates to `CompleteJobScreen`.
- **Web:** Job Detail "✅ Completed" button → opens the inline modal.

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
- **request_body:** **Android partner job:** `{parts_paid_by, parts_amount, payment_collected_by, cc_fee_amount, cc_fee_paid_by, notes?}`. **Android non-partner:** `{notes?}` only. **Web (always):** `{notes, payment_method}` — `payment_method` is **ignored** by the backend.
- **side_effects:** `profit-calc`, `earnings-write` (`tech_earnings`, user XOR roster), `update-record` (`job_completion_details` upsert, status `pending`), `reimbursement-write` (if tech_reimbursement>0), `status-change` (job → `completed`), `commission-resolve`
- **end_state:** Job `completed`; `job_completion_details` written (status `pending`); `tech_earnings` row(s) written; profit split across source/tech/company (or sender/receiver for partner).
- **failure_modes:** `validation-reject` (400 "Profit allocation conflict" when source%+tech%>100). `divergent-logic` — web omits all parts/CC inputs.
- **parity:** PARTIAL — Android captures parts/CC for partner jobs; web sends only notes (+ ignored payment_method).
- **status:** PARTIAL
- **status_note:** For normal (non-partner) jobs the surfaces converge — parts/CC don't enter the tech three-slice (that uses `material_cost` from line items). The divergence bites **partner jobs**: see `complete-job.partner-split`.

### `complete-job.partner-split`
- **label:** Parts / CC-fee / payment-collected inputs (partner jobs)
- **section:** partner-split
- **actors:** tech-user, owner
- **purpose:** Capture the deductions that drive the sender/receiver split: who supplied parts, parts amount, who collected payment, CC fee + who absorbs it.
- **visibility:** Android: only when `job.agreement_id != null` (partner job). Web: never rendered.
- **precondition:** Partner job (`agreement_id` set).
- **confirm:** —
- **route_chain:** part of `POST /jobs/:id/complete`
- **request_body:** `parts_paid_by` (sender/receiver/none), `parts_amount`, `payment_collected_by` (sender/receiver), `cc_fee_amount`, `cc_fee_paid_by` (sender/receiver/split)
- **side_effects:** `profit-calc` — `net = gross − parts − cc`; `sender_earns = net·senderPct%`, `receiver_earns = net·receiverPct%`; CC absorption subtracted per `cc_fee_paid_by`.
- **end_state:** `job_completion_details` carries correct net + split.
- **failure_modes:** `schema-gap`/`divergent-logic` (web) — web never sends these, so on a web-completed partner job `parts_amount`/`cc_fee_amount` default to 0 → `net = gross` → both partners' earnings overstated by the omitted parts + CC; `cc_fee_paid_by` and `payment_collected_by` stored NULL.
- **parity:** ANDROID-ONLY.
- **status:** BROKEN
- **status_note:** Partner job completed from web records inflated earnings for both companies (no parts/CC deduction) and loses who-collected/who-absorbs. Same job completed on Android vs web yields different `job_completion_details` numbers. This is the financially material gap on this screen.

### `complete-job.payment-method`
- **label:** Payment Collected dropdown (web)
- **section:** web modal
- **actors:** office, owner
- **purpose:** (Intended) record how payment was collected.
- **visibility:** web modal only (No payment / Cash / Check / Credit Card / ACH / Other)
- **precondition:** —
- **confirm:** —
- **route_chain:** sent as `payment_method` to `POST /jobs/:id/complete`
- **request_body:** `payment_method`
- **side_effects:** none — backend never destructures `payment_method`.
- **end_state:** (intended) payment recorded — but nothing happens.
- **failure_modes:** `dead-code` — sent but ignored; records no payment and sets no `payment_collected_by`.
- **parity:** WEB-ONLY (dead).
- **status:** DEAD-CODE
- **status_note:** The web modal's only money-ish control does nothing on the backend.

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

- **Partner-split money gap (web):** web completes partner jobs with no parts/CC → overstated earnings for both companies, lost CC-absorption + who-collected. The material correctness bug on this screen.
- **Web payment_method is dead** — sent, never read.
- **No web confirm surface** — `GET/POST /completion[/confirm]` orphaned on web.
- **Two completion paths:** `/complete` (this screen, three-slice + guard) vs `/status?completed` (legacy simple calc, no guard, no `job_completion_details`). Web's *status modal* can hit the legacy path; the *complete modal* hits this one. Different earnings math depending on which the user used.
- **`tip_amount` column** exists on `job_completion_details` but neither surface captures a tip → always 0 (dead column).
- **`/complete` is not transactional** — a post-hook failure can leave the job `completed` with no `tech_earnings` row (silent partial state).
- **Gross source differs:** partner split reads gross from the latest invoice; the tech slice derives subtotal from line items (fallback invoice.total → amount_paid). A job where these differ values the two off different numbers.
