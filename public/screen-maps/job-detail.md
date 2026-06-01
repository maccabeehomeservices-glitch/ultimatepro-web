# Screen Map — Job Detail

> **Format:** Action-Map Schema v1. This file is the source of truth. The HTML atlas is rendered from it.
> When code changes this screen, update this file in the same commit and re-emit it. Reality on disk wins.

---

## SCREEN

| Field | Value |
|---|---|
| `screen_id` | `job-detail` |
| `display_name` | Job Detail |
| `surfaces` | android, web |
| `route_android` | `jobs/{id}` → `JobDetailScreen` (JobScreens.kt 1259–2396) |
| `route_web` | `/jobs/:id` → `JobDetail` (JobDetail.jsx, 1565 lines) |
| `primary_actors` | owner, office, tech-user (partner for shared jobs) |
| `purpose` | The operational hub for a single job — the busiest intersection of all four spines (lifecycle, money, communication, identity). Field techs execute the job (dispatch → arrive → photos → parts → charge → complete); office manages it (status, estimates, invoices, receipts, customer); owner reviews completion and profit allocation. |
| `last_verified` | 2026-06-01 · Phase 2 Commit 1: notes/reminder/restore verb+key+route fixes (BROKEN→OK); permissions verb fixed (still BROKEN, UI pending) |

### load_sequence

**Web** (order effects fire):
1. `GET /jobs/:id`
2. `GET /jobs/:id/parts`
3. `GET /invoices?job_id=&limit=1`
4. `GET /estimates?job_id=`
5. (Messages tab) `GET /sms/job/:id/messages`
6. (History expand) `GET /customers/:customer_id/history?exclude_job_id=`

**Android** (`loadJob` on RESUME — exact calls in JobViewModel, not yet read):
implied `GET /jobs/:id`, `GET /estimates?job_id=`, `GET /invoices?job_id=`, `GET /uploads?purpose=before_photo|after_photo`, `GET /jobs/:id/parts`, `GET /jobs/:id/completion`, `GET /roster-techs`; (tab=1) `loadCustomerHistory`; (tab=2) `loadJobMessages`.

### entry_points

- **Android:** Dashboard, Notifications, JobList, CustomerDetail (job + linked), Calendar, LiveMap, JobDetail self (linked job), push deep link `job/$id`.
- **Web:** Jobs list, Dashboard, CustomerDetail, Calendar, LiveMap, History tab (past jobs), direct URL.

---

## ACTIONS

Each action carries: label · section · actors · purpose · visibility · precondition · confirm · route_chain · request_body · side_effects · end_state · failure_modes · parity · status · status_note.

---

### `job-detail.back`
- **label:** Back (arrow)
- **section:** top-bar
- **actors:** owner, office, tech-user, partner
- **purpose:** Return to wherever the user came from.
- **visibility:** always
- **precondition:** —
- **confirm:** —
- **route_chain:** none (navigate)
- **request_body:** —
- **side_effects:** `navigate`
- **end_state:** Previous screen restored.
- **failure_modes:** none
- **parity:** MATCH
- **status:** OK
- **status_note:** —

### `job-detail.dispatch`
- **label:** Navigation icon ("Dispatch")
- **section:** top-bar
- **actors:** tech-user, owner, office
- **purpose:** Tell the customer the tech is on the way; move job to en_route. The "I'm leaving now" tap.
- **visibility:** Android: `status in [unscheduled, scheduled] && cust_phone != null`. Web: `status in [unscheduled, scheduled]` (no phone check).
- **precondition:** Customer has a phone number (enforced backend-side: 400 if missing).
- **confirm:** Android: "Dispatch to {customer}? This will notify the customer you're on your way and update the job status to En Route." Web: "Dispatch tech to {customer}? They will receive an ETA notification."
- **route_chain:** `POST /jobs/:id/dispatch` (jobs.js 1512)
- **request_body:** Android: real device `{tech_lat, tech_lng}`. Web: hardcoded `{tech_lat:0, tech_lng:0}`.
- **side_effects:** `status-change` (→en_route), `sms-customer` (ETA), `joby-trigger`
- **end_state:** Status badge shows En Route; customer receives ETA SMS.
- **failure_modes:** `validation-reject` (400 "Customer has no phone number" — web only, since it skips the gate)
- **parity:** PARTIAL — web omits the phone-presence gate; web hardcodes location 0,0 so ETA always falls back to "shortly."
- **status:** PARTIAL
- **status_note:** Web sends 0,0 location → ETA degraded; web opens dialog even with no phone → backend 400.

### `job-detail.arrived`
- **label:** CheckCircle / LocationOn icon ("Arrived")
- **section:** top-bar
- **actors:** tech-user, owner, office
- **purpose:** Tell the customer the tech has arrived; move job to in_progress. Starts the work clock (`actual_start`).
- **visibility:** `status == en_route` (both surfaces)
- **precondition:** Job is en_route.
- **confirm:** Android: "This will notify {customer} that you have arrived and update the job status to In Progress." Web: none.
- **route_chain:** `POST /jobs/:id/arrived` (jobs.js 1599)
- **request_body:** —
- **side_effects:** `status-change` (→in_progress), `update-record` (actual_start=NOW), `sms-customer` ("has arrived")
- **end_state:** Status In Progress; customer receives arrival SMS.
- **failure_modes:** none functional
- **parity:** PARTIAL — web lacks the confirmation dialog.
- **status:** PARTIAL
- **status_note:** Web fires immediately with no confirm; Android confirms first.

### `job-detail.edit`
- **label:** Pencil
- **section:** top-bar
- **actors:** owner, office
- **purpose:** Open the job form to edit fields.
- **visibility:** always
- **precondition:** —
- **confirm:** —
- **route_chain:** none (navigate to `jobs/:id/edit` | `/jobs/:id/edit`)
- **request_body:** —
- **side_effects:** `navigate`
- **end_state:** Job edit form open.
- **failure_modes:** none
- **parity:** MATCH
- **status:** OK
- **status_note:** —

### `job-detail.delete`
- **label:** Trash ("Archive")
- **section:** top-bar
- **actors:** owner, office (backend: managerUp)
- **purpose:** Soft-archive the job (recoverable from search). Estimates/invoices kept.
- **visibility:** `status != deleted` (web); always (android)
- **precondition:** —
- **confirm:** "Archive this job? The job will be moved to deleted jobs and can be retrieved from job search. Estimates and invoices will be kept." (both)
- **route_chain:** `DELETE /jobs/:id` (jobs.js 1027, managerUp)
- **request_body:** —
- **side_effects:** `soft-delete` (status→deleted), `navigate` (web → /jobs)
- **end_state:** Job archived; list updated.
- **failure_modes:** `permission-403` (technician hitting it — neither UI hides it by role)
- **parity:** MATCH
- **status:** PARTIAL
- **status_note:** Button not role-gated client-side; a technician sees it and gets a 403.

### `job-detail.status`
- **label:** Status badge / chip (Android also has a top-bar status icon)
- **section:** top-bar / status-chip
- **actors:** owner, office, tech-user
- **purpose:** Change job lifecycle state. The spine of the whole screen.
- **visibility:** always (clickable badge)
- **precondition:** —
- **confirm:** —
- **route_chain:** `POST /jobs/:id/status` (jobs.js 796) for non-completed statuses. **Both surfaces now route `completed` → the Complete flow → `POST /jobs/:id/complete` (Path B):** Android navigates to `CompleteJobScreen`; web (Phase 1) opens the Complete modal. Web no longer posts `completed` to `/status`.
- **request_body:** `{status}` (non-completed only)
- **side_effects:** `status-change` for non-completed transitions. Completion always runs Path B (`profit-calc` three-slice + >100% guard, `earnings-write`, `job_completion_details`, `reimbursement-write`). The legacy Path A completion side-effects (`inventory-deduct`, `membership-advance`, source `sms`) only fire if `completed` is posted directly to `/status` — which neither surface now does.
- **end_state:** New status reflected; side effects per transition fire.
- **failure_modes:** none — web completion no longer bypasses the >100% guard or the parts/CC inputs; it routes through Path B exactly like Android.
- **parity:** MATCH (Phase 1) — both surfaces route completion through `/complete` (guard + parts/CC); non-completed transitions share `/status`.
- **status:** OK
- **status_note:** Phase 1 (2026-05-31): web's Status modal "Completed" opens the Complete modal (Path B) instead of posting to `/status`, so web vs Android now produce the same profit numbers. Caveat: Path A's `inventory-deduct`/`membership-advance`/source-`sms` are not replicated in Path B on either surface (backend follow-up).

### `job-detail.banner-received`
- **label:** "Received from {company}" banner
- **section:** banners
- **actors:** owner, office (partner-received job)
- **purpose:** Show this job was sent to you by a network partner.
- **visibility:** `sent_by_company_name|id != null`
- **precondition:** —
- **confirm:** —
- **route_chain:** none (informational)
- **request_body:** —
- **side_effects:** none
- **end_state:** Banner visible.
- **failure_modes:** none
- **parity:** MATCH
- **status:** OK
- **status_note:** —

### `job-detail.banner-sent-confirm`
- **label:** "Sent to {company}" banner + Confirm / Dispute
- **section:** banners
- **actors:** owner, office (partner-sender)
- **purpose:** When a partner changes a shared job's status, the sender confirms or disputes it.
- **visibility:** `sent_to_company_*` present with a pending partner_status
- **precondition:** Job has a partner status awaiting confirmation.
- **confirm:** —
- **route_chain:** `POST /jobs/:id/confirm-partner-status` (jobs.js 1444)
- **request_body:** `{action: 'confirm'|'dispute'}`
- **side_effects:** `update-record` (partner_status resolved), `push`
- **end_state:** Partner status confirmed or disputed.
- **failure_modes:** none
- **parity:** MATCH
- **status:** OK
- **status_note:** —

### `job-detail.badge-source`
- **label:** Source badge (icon + label + commission line)
- **section:** banners
- **actors:** owner, office (commission line hidden from tech)
- **purpose:** Show where the job came from (network / contact / ad channel) and, for non-techs, the resolved commission %.
- **visibility:** when source present; commission line gated `!isTech`
- **precondition:** —
- **confirm:** —
- **route_chain:** none (informational, data from job row)
- **request_body:** —
- **side_effects:** `permission-gate` (commission line)
- **end_state:** Source shown; commission shown to owner/office only.
- **failure_modes:** none
- **parity:** PARTIAL — Android shows resolved commission %; web does not.
- **status:** PARTIAL
- **status_note:** Web omits the commission line entirely.

### `job-detail.banner-membership`
- **label:** Membership banner
- **section:** banners
- **actors:** owner, office
- **purpose:** Flag that this customer has an active membership.
- **visibility:** membership present
- **precondition:** —
- **confirm:** —
- **route_chain:** none
- **request_body:** —
- **side_effects:** none
- **end_state:** Banner visible.
- **failure_modes:** none
- **parity:** MATCH
- **status:** OK
- **status_note:** —

### `job-detail.banner-completion`
- **label:** Completion-status banner (confirmed / pending-review) → opens completion sheet
- **section:** banners
- **actors:** owner, office
- **purpose:** Show completion/confirmation state and let owner open the profit-split detail sheet.
- **visibility:** completion record exists
- **precondition:** Job has a `job_completion_details` row.
- **confirm:** —
- **route_chain:** `GET /jobs/:id/completion` (jobs.js); confirm via `POST /jobs/:id/completion/confirm`
- **request_body:** confirm: sender/owner-company only
- **side_effects:** `update-record` (confirmed_at, status=confirmed)
- **end_state:** Completion detail visible; owner can confirm.
- **failure_modes:** none on Android
- **parity:** ANDROID-ONLY — web has no completion banner/sheet and never calls these endpoints.
- **status:** PARTIAL
- **status_note:** Web orphans `GET /jobs/:id/completion` and `POST /jobs/:id/completion/confirm`.

### `job-detail.reminder-method`
- **label:** Reminder method selector (dropdown)
- **section:** reminder-row
- **actors:** owner, office
- **purpose:** Choose how the customer reminder is sent for a scheduled job (default/email/sms/both/none).
- **visibility:** Android: `scheduled_start != null && reminder_sent_at == null`. Web: always shown in details.
- **precondition:** Backend validates value ∈ [default, email, sms, both, none].
- **confirm:** —
- **route_chain:** `PATCH /jobs/:id/reminder-method` (jobs.js 1545)
- **request_body:** `{reminder_method}` ∈ [default,email,sms,both,none]. Both surfaces now send the correct key; web maps its `''` Default option → `'default'`.
- **side_effects:** `update-record`
- **end_state:** Reminder method saved.
- **failure_modes:** none
- **parity:** MATCH
- **status:** OK
- **status_note:** Phase 2 (2026-06-01): web now sends `{reminder_method: value || 'default'}` (JobDetail.jsx:513), fixing the wrong key + the `''` value. Minor remaining (not a defect): web shows the selector even without a scheduled date.

### `job-detail.scheduled-display`
- **label:** Scheduled date/time
- **section:** reminder-row
- **actors:** owner, office, tech-user
- **purpose:** Show when the job is scheduled.
- **visibility:** always (display only)
- **precondition:** —
- **confirm:** —
- **route_chain:** none
- **request_body:** —
- **side_effects:** none
- **end_state:** Date/time shown.
- **failure_modes:** none
- **parity:** MATCH
- **status:** OK
- **status_note:** —

### `job-detail.source-type-assigned`
- **label:** Source / Type / Assigned (3-column row, each tappable)
- **section:** info-row
- **actors:** owner, office
- **purpose:** At-a-glance job attributes; tap any to edit.
- **visibility:** always
- **precondition:** —
- **confirm:** —
- **route_chain:** none (navigate to edit)
- **request_body:** —
- **side_effects:** `navigate`
- **end_state:** Job edit form open.
- **failure_modes:** none
- **parity:** MATCH — minor: web falls back to ad_channel_name/"My Company"/"Unassigned"; Android shows "—".
- **status:** OK
- **status_note:** —

### `job-detail.customer-card`
- **label:** View customer / call / email / address
- **section:** customer-card
- **actors:** owner, office, tech-user
- **purpose:** Reach the customer record, dial, email, or read the address.
- **visibility:** always
- **precondition:** —
- **confirm:** —
- **route_chain:** none (navigate + `external-intent` dial/mailto)
- **request_body:** —
- **side_effects:** `navigate`, `external-intent`
- **end_state:** Customer detail / dialer / mail composer opens.
- **failure_modes:** none
- **parity:** MATCH
- **status:** OK
- **status_note:** —

### `job-detail.linked-job`
- **label:** Linked Job card → View
- **section:** linked-job
- **actors:** owner, office, tech-user
- **purpose:** Jump to a linked job (go-back/warranty/follow-up).
- **visibility:** `linked_job_id != null`
- **precondition:** —
- **confirm:** —
- **route_chain:** none (navigate)
- **request_body:** —
- **side_effects:** `navigate`
- **end_state:** Linked job opens.
- **failure_modes:** none
- **parity:** ANDROID-ONLY — web has no linked-job card (web `linked_job_*` fields unused).
- **status:** PARTIAL
- **status_note:** Web missing this card.

### `job-detail.navigate-site`
- **label:** Navigate (Job Site)
- **section:** job-site
- **actors:** tech-user, owner
- **purpose:** Open turn-by-turn navigation to the job address.
- **visibility:** address non-blank
- **precondition:** —
- **confirm:** —
- **route_chain:** none (`external-intent`: google.navigation/geo on Android, maps.google.com on web)
- **request_body:** —
- **side_effects:** `external-intent`
- **end_state:** Maps app/tab opens to address.
- **failure_modes:** none
- **parity:** PARTIAL — web shows an "Address may be inaccurate" amber warning when `address_verified === false`; Android does not.
- **status:** OK
- **status_note:** Web-only address-verification warning is an extra, not a defect.

### `job-detail.line-items-card`
- **label:** Line Items card (job line_items + total)
- **section:** line-items
- **actors:** owner, office, tech-user
- **purpose:** Show line items recorded on the job.
- **visibility:** when job.line_items present (android)
- **precondition:** —
- **confirm:** —
- **route_chain:** none (display from job)
- **request_body:** —
- **side_effects:** none
- **end_state:** Items + total shown.
- **failure_modes:** none
- **parity:** PARTIAL — Android renders job line_items here; web shows line items inside the Invoice card instead (different data source).
- **status:** PARTIAL
- **status_note:** Job line_items vs invoice line_items are different sets; surfaces show different things.

### `job-detail.notes`
- **label:** Notes editor (auto-save)
- **section:** notes
- **actors:** owner, office, tech-user
- **purpose:** Free-text job notes; save on focus-lost.
- **visibility:** always
- **precondition:** —
- **confirm:** —
- **route_chain:** Both: `PUT /jobs/:id` (Phase 2 — web now uses `jobsApi.update`, mirroring Android `updateJob`).
- **request_body:** `{notes}`
- **side_effects:** `update-record`
- **end_state:** Notes saved.
- **failure_modes:** none
- **parity:** MATCH
- **status:** OK
- **status_note:** Phase 2 (2026-06-01): web notes auto-save switched from `PATCH /jobs/:id` (404) to `PUT /jobs/:id {notes}` via `jobsApi.update` (JobDetail.jsx:520).

### `job-detail.permissions`
- **label:** Tech / Partner permissions (read-only "Your Permissions" or editable "Partner Permissions")
- **section:** permissions
- **actors:** owner, office (editor); partner (read-only view)
- **purpose:** On a shared job, control which actions the receiving tech may perform (notes/payments/photos/parts/edit/cancel/history).
- **visibility:** Android: read-only card when `sent_by_company_id != null`; editable when `sent_to_company_id != null && sent_by_company_id == null`. Web: handler exists but no JSX renders a toggle.
- **precondition:** Partner-shared job.
- **confirm:** —
- **route_chain:** Both: `PUT /jobs/:id` (updateJob, `{tech_permissions}`). (Phase 2 corrected the web verb; Android editable card unchanged.)
- **request_body:** `{tech_permissions}`
- **side_effects:** `update-record`, `permission-gate`
- **end_state:** Permissions saved on the shared job.
- **failure_modes:** Web: `dead-code` — `handleTechPermToggle` now posts the correct `PUT /jobs/:id` via `jobsApi.update` (verb fixed), but **no JSX renders a toggle** that calls it.
- **parity:** PARTIAL — Android has a working editor; web handler is correct but has no UI.
- **status:** BROKEN
- **status_note:** Phase 2 (2026-06-01): verb corrected (`handleTechPermToggle` → `jobsApi.update` PUT, JobDetail.jsx:350), so the handler will work once wired. Toggle UI still pending — separate later commit. Stays BROKEN until the UI lands.

### `job-detail.send-to-tech`
- **label:** "Send To" / "📤 Send to Tech"
- **section:** send-to-tech
- **actors:** owner, office
- **purpose:** Notify a recipient about the job — roster tech, app-user tech, or network partner.
- **visibility:** hidden when status deleted/cancelled
- **precondition:** A recipient exists.
- **confirm:** —
- **route_chain:** Android (3 paths): roster → `notifyRosterTech`; app-user → `notifyAppUserTech`; partner → `POST /jobs/:id/send-to-partner`. Web: partner → `POST /jobs/:id/send-to-partner`; else → `POST /roster-techs/notify-tech` (roster-techs.js 71).
- **request_body:** Web notify-tech: `{job_id, tech_id, method}` — **backend ignores `tech_id`**, derives tech from job.assigned_*.
- **side_effects:** `sms-tech`/`email`/`push`; partner path: `partner-visibility`, `ownership-transfer`
- **end_state:** Recipient notified; partner path shares the job.
- **failure_modes:** none fatal — web can't notify an *unassigned* roster tech the way Android's picker can.
- **parity:** PARTIAL — Android distinguishes 3 recipient types; web treats assigned tech as a roster_tech and always hits notify-tech.
- **status:** PARTIAL
- **status_note:** `tech_id` accepted but ignored by `notify-tech`; recipient is always the job's currently-assigned actor.

### `job-detail.estimates`
- **label:** Create Estimate / + Add Another / estimate cards
- **section:** estimates
- **actors:** owner, office, tech-user
- **purpose:** Build estimates from the job; view existing ones.
- **visibility:** "Create" when none; cards + "Add Another" when ≥1
- **precondition:** —
- **confirm:** —
- **route_chain:** load `GET /estimates?job_id=`; create = navigate (Android `estimates/build/{jobId}`, web `/estimates/new?job_id=`)
- **request_body:** —
- **side_effects:** `navigate`
- **end_state:** Estimate builder opens / estimate detail opens.
- **failure_modes:** none
- **parity:** MATCH
- **status:** OK
- **status_note:** —

### `job-detail.invoice`
- **label:** Add to Invoice / View Invoice (+ web inline Add Charge)
- **section:** invoice
- **actors:** owner, office, tech-user
- **purpose:** Create-or-open the job's invoice; web also adds line items inline.
- **visibility:** label toggles by whether an invoice exists
- **precondition:** —
- **confirm:** —
- **route_chain:** load `GET /invoices?job_id=`; create `POST /invoices {customer_id, job_id, line_items:[]}` → navigate. Web Add Charge: `PUT /invoices/:id {line_items}`.
- **request_body:** as above
- **side_effects:** `create-record` (invoice), `navigate`, `update-record` (line items)
- **end_state:** Invoice created/opened; charge added.
- **failure_modes:** none
- **parity:** PARTIAL — web has an inline Add-Charge line-item modal; Android adds items on the invoice screen instead.
- **status:** OK
- **status_note:** —

### `job-detail.profit-override`
- **label:** Profit Allocation Edit (Source% / Tech%)
- **section:** profit-allocation
- **actors:** owner
- **purpose:** Override the per-job profit split when the default source%+tech% conflict; live >100% guard.
- **visibility:** web only; renders default/custom split card
- **precondition:** —
- **confirm:** —
- **route_chain:** `PUT /jobs/:id {profit_override, override_source_pct, override_tech_pct}`
- **request_body:** `{profit_override, override_source_pct, override_tech_pct}`
- **side_effects:** `update-record`
- **end_state:** Override saved; completion uses it.
- **failure_modes:** none (uses PUT, which exists)
- **parity:** WEB-ONLY — Android Job Detail has no override card (override may live in profit simulator / pay settings, not on this screen).
- **status:** OK
- **status_note:** Functional on web; Android lacks the on-screen equivalent.

### `job-detail.photos`
- **label:** Before / After photos (capture / view / delete)
- **section:** photos
- **actors:** tech-user, owner, office
- **purpose:** Document the job with categorized before/after photos.
- **visibility:** always
- **precondition:** —
- **confirm:** —
- **route_chain:** Android: `POST /uploads?purpose=before_photo|after_photo&entity_type=job&entity_id=` → read via `GET /uploads`. Web: `POST /uploads` (entity/purpose in **body**) → `POST /jobs/:id/photos {photo_url}`.
- **request_body:** Android query params; web body params (ignored by query-param backend).
- **side_effects:** `photo-attach`
- **end_state:** Photos appear in Before/After columns.
- **failure_modes:** Web: `schema-gap` (binds to non-existent `jobs.before_photos`/`after_photos`) + `field-mismatch` (upload params in body, backend reads query → entity_id null).
- **parity:** PARTIAL — Android works (purpose-tagged file_uploads, read back correctly); web fully broken.
- **status:** BROKEN
- **status_note:** Web before/after never display: (a) binds to columns that don't exist on `jobs` (only `photos[]` exists); (b) upload params ignored → file lands with entity_id=null; then `/jobs/:id/photos` writes URL into `jobs.photos[]` (never shown). No per-photo delete on web.

### `job-detail.parts`
- **label:** Add Part / parts list / per-part delete
- **section:** parts
- **actors:** tech-user, owner, office
- **purpose:** Record parts used and who paid (company/tech) — the data the profit math depends on.
- **visibility:** always
- **precondition:** —
- **confirm:** —
- **route_chain:** `GET/POST/DELETE /jobs/:id/parts[/:partId]` (jobs.js 1642–1695)
- **request_body:** `{name, cost, provider}`
- **side_effects:** `create-record` / `delete-record`
- **end_state:** Parts list updated.
- **failure_modes:** none
- **parity:** MATCH
- **status:** OK
- **status_note:** Web appends locally without refetch (optimistic-leaning) but functionally correct.

### `job-detail.charge-payment`
- **label:** Charge Payment / 💳 Charge Payment
- **section:** parts
- **actors:** tech-user, owner, office
- **purpose:** Collect payment on the job's invoice.
- **visibility:** Android: `invoice != null && invoice.status != paid`. Web: button present.
- **precondition:** An invoice exists and is unpaid.
- **confirm:** —
- **route_chain:** Android: navigate to PaymentScreen (invoice payment flow). **Web: `POST /estimates/{estimate_id}/collect-deposit {method, amount}`.**
- **request_body:** Web posts `{method, amount}`; endpoint wants `{amount_collected, payment_method}`.
- **side_effects:** Android: `payment-record`. Web: intended `deposit-collect`.
- **end_state:** Payment recorded against the invoice.
- **failure_modes:** Web: `schema-gap` (`jobData.estimate_id` doesn't exist on jobs row → "No estimate found") + `field-mismatch` (wrong body keys → 400 "Invalid deposit amount").
- **parity:** DIVERGENT — Android opens invoice payment; web opens an estimate deposit modal that always fails.
- **status:** BROKEN
- **status_note:** Web "Charge Payment" cannot succeed: reads a non-existent field and posts wrong keys to the wrong (deposit) endpoint.

### `job-detail.send-receipt`
- **label:** Send Receipt / 📧 Send Receipt
- **section:** final-actions
- **actors:** owner, office
- **purpose:** Send the customer a receipt (with optional review request).
- **visibility:** hidden when status deleted/cancelled/completed (android); enabled iff invoice exists
- **precondition:** Invoice exists.
- **confirm:** —
- **route_chain:** navigate to invoice (Android opens invoice; web opens invoice with `openReceipt` flag → invoice send-receipt modal `POST /invoices/:id/send-receipt`)
- **request_body:** on invoice screen
- **side_effects:** `email`/`sms-customer`, `pdf-generate`
- **end_state:** Receipt sent; review link included if toggled.
- **failure_modes:** none here (the receipt modal itself works — review-request alias bug fixed in commit 6a67c97)
- **parity:** PARTIAL — web auto-opens the receipt modal via route state; Android just opens the invoice.
- **status:** OK
- **status_note:** —

### `job-detail.cancel`
- **label:** Cancel Job
- **section:** final-actions
- **actors:** owner, office
- **purpose:** Cancel the job; remove from tech view, keep editable by office.
- **visibility:** when status not deleted/cancelled
- **precondition:** —
- **confirm:** Android: status sheet path. Web: direct.
- **route_chain:** `POST /jobs/:id/status {status:'cancelled'}`
- **request_body:** `{status:'cancelled'}`
- **side_effects:** `status-change` (→cancelled), `joby-trigger` (job_cancelled)
- **end_state:** Job cancelled.
- **failure_modes:** none
- **parity:** MATCH
- **status:** OK
- **status_note:** —

### `job-detail.restore`
- **label:** ♻️ Restore
- **section:** final-actions
- **actors:** owner, office
- **purpose:** Restore an archived (deleted) job.
- **visibility:** `status === deleted` (web)
- **precondition:** Job is archived.
- **confirm:** —
- **route_chain:** `POST /jobs/:id/status {status:'unscheduled'}` (Phase 2 — web now mirrors Android).
- **request_body:** `{status:'unscheduled'}`
- **side_effects:** `status-change` (deleted → unscheduled)
- **end_state:** Job restored to active (unscheduled).
- **failure_modes:** none
- **parity:** MATCH — both flip status back to `unscheduled` via `/status`.
- **status:** OK
- **status_note:** Phase 2 (2026-06-01): `jobsApi.restore` (api.js:192) now posts `/jobs/:id/status {status:'unscheduled'}` instead of the non-existent `/jobs/:id/restore` (was 404). **DRIFT corrected:** Android's restore is `restoreJob` → `repo.updateJobStatus(id,"unscheduled")` (JobScreens.kt:212), wired via `JobListCard onRestore` — the prior "mechanism not yet read" note was stale.

### `job-detail.complete`
- **label:** ✅ Completed
- **section:** final-actions
- **actors:** tech-user (submit), owner (review/approve)
- **purpose:** Lock in the job outcome and trigger profit allocation. The money spine's terminal action.
- **visibility:** hidden when status deleted/cancelled/completed (android)
- **precondition:** Backend runs profit pre-check; over-allocation blocks.
- **confirm:** —
- **route_chain:** Android: navigate `CompleteJobScreen` → `POST /jobs/:id/complete`. Web (Phase 1): Complete modal — for partner jobs renders the same parts/CC form → `POST /jobs/:id/complete` with the full split body; non-partner sends `{notes?}`.
- **request_body:** both surfaces — partner: `{parts_paid_by, parts_amount, payment_collected_by, cc_fee_amount, cc_fee_paid_by, notes?}`; non-partner: `{notes?}`. The dead `payment_method` was removed from the web body.
- **side_effects:** `profit-calc` (three-slice), `earnings-write` (`tech_earnings`, user XOR roster), `update-record` (`job_completion_details` upsert), `reimbursement-write` (if tech_reimbursement>0), `status-change` (→completed/holding/pending-review per paid+actor), `joby-trigger`, `push`
- **end_state:** Status completed (paid+owner) / pending-review (paid+non-owner) / holding (unpaid); profit allocated across source/tech/company.
- **failure_modes:** `validation-reject` (400 "Profit allocation conflict" when source%+tech%>100 — pre-check guard, jobs.js 1203–1216).
- **parity:** MATCH (Phase 1) — web captures parts/CC for partner jobs and sends the same body as Android; the three-slice engine sees identical inputs.
- **status:** OK
- **status_note:** Phase 1 (2026-05-31): web Complete modal now renders the partner parts/CC form + live split calc; money math from web matches Android. The >100% guard runs in `/complete` (Path B); web's Status modal "Completed" now also routes to Path B (see `job-detail.status`).

### `job-detail.signature`
- **label:** Signature pad (web)
- **section:** (web, unreferenced)
- **actors:** owner, office, customer
- **purpose:** Capture a signature on the job.
- **visibility:** web modal exists but `setShowSignature(true)` is never called; Android has no job-signature UI either (feature unsurfaced on both surfaces).
- **precondition:** —
- **confirm:** —
- **route_chain:** web `POST /jobs/:id/signature {signature_url}` — key matches backend jobs.js:1011 and Android repo (CrmRepository.kt:262). Remaining gap: no trigger opens the modal.
- **request_body:** `{signature_url}` (key now correct; backend jobs.js:1011 reads `signature_url`)
- **side_effects:** intended `update-record`
- **end_state:** Signature saved on job (when a trigger eventually opens the modal).
- **failure_modes:** `dead-code` (no trigger on either surface — feature unsurfaced on web AND Android; key mismatch resolved 2026-05-31).
- **parity:** both surfaces lack the UI trigger — web's modal is never opened; Android has the `saveJobSignature` repo method (CrmRepository.kt:262) but no screen calls it. Not web-only; unbuilt on both.
- **status:** DEAD-CODE
- **status_note:** Phase 0 [SIG] (2026-05-31): body key now `signature_url`, matching backend jobs.js:1011 and the Android repo. The remaining gap is product-level, not a bug: no trigger wires the modal on web, and Android has no job-signature UI at all. Wiring is a roadmap decision. Do not re-investigate the key.

### `job-detail.tabs`
- **label:** Details / History / Messages tabs
- **section:** tabs
- **actors:** owner, office, tech-user (History gated)
- **purpose:** Switch between job details, customer history, and the SMS thread.
- **visibility:** History gated `canViewHistory` on Android; not role-gated on web.
- **precondition:** —
- **confirm:** —
- **route_chain:** History: `GET /customers/:id/history?exclude_job_id=`. Messages: `GET /sms/job/:jobId/messages`; send `POST /sms/conversations/:id/send`.
- **request_body:** message send `{message}`
- **side_effects:** `sms-customer` (on send)
- **end_state:** Tab content shown; message sent.
- **failure_modes:** Web Messages send **fixed** (2026-05-31): web now derives `convId` from the first message object (`msgs[0]?.conversation_id`), mirroring Android `jobMessages.firstOrNull()?.conversationId`, so the composer enables and send works once a thread exists. Starting a brand-new conversation (zero prior messages) is disabled on both web AND Android (parity-matched, pre-existing). Remaining divergence: the History tab is not role-gated on web (`canViewHistory` enforced only on Android).
- **parity:** PARTIAL — messaging now matches Android (convId derived from message objects); History still not role-gated on web.
- **status:** PARTIAL
- **status_note:** Phase 0 [SMS-CONV] (2026-05-31): web Messages send fixed (convId from first message object, like Android). Row stays PARTIAL only for the separate History role-gating divergence; the messaging concern is resolved. Empty-thread start disabled on both surfaces (parity-matched).

---

## SCREEN-LEVEL DRIFT FLAGS (from Stage-1 audit)

- **Route-404 class (web): RESOLVED (Phase 2).** Notes + tech-permissions now use `PUT /jobs/:id` (via `jobsApi.update`), and Restore now posts `/jobs/:id/status {unscheduled}` (mirroring Android) — the non-existent `PATCH /jobs/:id` and `POST /jobs/:id/restore` are no longer called. (Reminder-method was a wrong-key, not a 404, also fixed.) System-wide `POST /payments/scanpay/charge` was resolved earlier ([SCANPAY-404]).
- **Two earnings paths — web side closed (Phase 1):** `/status?completed` (Path A, simple calc, no >100% guard) vs `/complete` (Path B, three-slice + guard). Web now routes completion consistently to Path B: the Status modal "Completed" opens the Complete modal (no longer posts to Path A), and the Complete modal renders parts/CC for partner jobs. Path A still exists on the backend but no web surface posts `completed` to it. Caveat: Path A's `inventory-deduct`/`membership-advance`/source-`sms` are not in Path B on either surface (backend follow-up).
- **Two `job_completion_details` models vs `tech_earnings`:** completion details still carries only 2-party `sender_earns`/`receiver_earns`; the three-slice truth lives in `tech_earnings`. Reconciliation happens in the complete handler.
- **payments.method CHECK contradiction:** two boot migrations (server.js 558–561 vs 785); the later one drops `card`/`scanpay`/`paypal`.
- **Schema-gather scatter:** live schema = union of schema.sql + migrate_*.sql + server.js IIFE + jobs.js top-level ALTERs (≥3 places).

## CORRECTIONS TO PRIOR "KNOWN FACTS" (verified against production)

- `customer_memberships` **DOES** have `plan_name`, `plan_frequency`, `plan_price` (server.js 296–298) — the old rule was wrong. It also has `plan_id` (+ `custom_name/frequency/price`).
- `pricebook_categories.taxable` **DOES** exist (migrate_pricebook_taxable.sql:2). `pricebook_items.taxable` also exists.
- `payments.job_id` confirmed **absent** — rule holds.
- `review_platforms` uses `platform_name` not `name` — rule holds.
- `jobs.title` is **NOT NULL** at DB level — UI hides it but backend must supply `type || "Job"`.
- `tech_earnings` has the `(user_id IS NOT NULL) <> (roster_tech_id IS NOT NULL)` CHECK — confirmed.
