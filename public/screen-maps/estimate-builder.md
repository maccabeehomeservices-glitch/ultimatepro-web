# Screen Map, Estimate Builder / Detail

> **Format:** Action-Map Schema v1. Source of truth; the HTML atlas is rendered from it.
> When code changes this screen, update this file in the same commit. Reality on disk wins.

---

## SCREEN

| Field | Value |
|---|---|
| `screen_id` | `estimate-builder` |
| `display_name` | Estimate Builder / Detail |
| `surfaces` | android, web |
| `route_android` | `estimates/{id}` → `EstimateDetailScreen` (EstimateScreens.kt 657–1021); builder `estimates/build/{jobId}` etc. → `EstimateBuildScreen` (1076+) |
| `route_web` | `/estimates/:id` → `EstimateDetail` (EstimateDetail.jsx, 758 lines); builder `/estimates/new` & `/estimates/:id/edit` → `EstimateBuilder` |
| `primary_actors` | office, owner, tech |
| `purpose` | Author and close an estimate: review line items (or Good/Better/Best tiers), send it for signature, capture a signature, collect a deposit, then convert it to an invoice. Web does the actions inline (modals + a 10s poll while waiting for a remote signature); Android routes sign / send / present-tiers / deposit to dedicated screens. |
| `last_verified` | 2026-06-07 · Web estimate fixes (2645a04): **Attach Photo** now uses the 2-step (upload to `/uploads` → POST `{url}` to add-photo) — was a raw multipart file → 400; **Present GBB** now presents selectable tiers → `select-tier {tier_id}` (sets the estimate total) → sign — was mis-wired to the signature modal (signed with an unset total). Both mirror the backend contract + Android. Prior: 2026-05-31 Phase 0 [SIG] fix, f942dcf. |

### load_sequence
`GET /estimates/:id` returns the estimate + flattened `cust_*`. For GBB estimates the web detail also pulls `GET /estimates/:id/tiers`. While `status === 'sent'`, web polls `refetch()` every **10 s** to catch a remote signature.

### entry_points
- **Android:** Estimate list, Job Detail "Create/View Estimate", estimate sub-flows (sign/send/present/deposit `popUpTo`).
- **Web:** Estimate list, Job Detail "+ Create Estimate" → `/estimates/new?job_id=&customer_id=`, "Edit Estimate" → `/estimates/:id/edit`.

> **NOTE:** The `EstimateBuilder`/`EstimateBuildScreen` internals (line-item editing, GBB tier authoring, the `POST /estimates` / `PUT /estimates/:id` save payload) were **not deep-read** this pass, marked UNVERIFIED. The actions below are the fully-audited Estimate **Detail** actions.

---

## ACTIONS

---

### `estimate-builder.back`
- **label:** Back
- **section:** top-bar
- **actors:** office, owner, tech
- **purpose:** Leave the estimate (web returns to the linked job if any, else the estimates list).
- **visibility:** always
- **precondition:** n/a
- **confirm:** n/a
- **route_chain:** none (navigate)
- **request_body:** n/a
- **side_effects:** `navigate`
- **end_state:** Previous screen.
- **failure_modes:** none
- **parity:** MATCH
- **status:** OK
- **status_note:** n/a
### `estimate-builder.send-for-signature`
- **label:** Send for Signature / "Send for Remote Signature"
- **section:** actions
- **actors:** office, owner
- **purpose:** Email/SMS the estimate so the customer can sign remotely.
- **visibility:** web: when `!isSigned`. Android: unsigned (button varies by GBB/non-GBB).
- **precondition:** Estimate has a customer.
- **confirm:** web recipient-picker modal (email/phone + add-new + save-to-profile).
- **route_chain:** `POST /estimates/:id/send`
- **request_body:** web `estimatesApi.send(id, {emails, phones, send_email, send_sms})`
- **side_effects:** sends the estimate; sets status `sent` (web then polls every 10 s for the remote signature).
- **end_state:** Estimate sent; awaiting signature.
- **failure_modes:** none observed.
- **parity:** PARTIAL, same endpoint; web inline modal + 10s poll, Android dedicated `EstimateSendScreen`.
- **status:** OK
- **status_note:** Web persists newly-typed recipients to the customer profile after a successful send.

### `estimate-builder.get-signature`
- **label:** "✍️ Get Signature"
- **section:** actions
- **actors:** office, owner, tech
- **purpose:** Capture an in-person customer signature (moves the estimate to `approved`).
- **visibility:** web: always (button) + the signature modal. Android: non-GBB "Get Signature" → dedicated `EstimateSignScreen`.
- **precondition:** n/a
- **confirm:** signature pad modal (web), with a signer-name field.
- **route_chain:** `POST /estimates/:id/sign`
- **request_body:** web `estimatesApi.captureSignature(id, base64, signerName)` → `{ signature, signer_name }`. Backend (estimates.js 597–598) reads `{ signature, signer_name }`. Keys now match.
- **side_effects:** sets `customer_signature`, `status='approved'`, `approved_at`; fires Joby `estimate_approved`; emails the office; pushes "Estimate Signed".
- **end_state:** web → signature saved, estimate status → `approved`.
- **failure_modes:** none observed.
- **parity:** MATCH, web posts `{ signature, signer_name }` inline; Android signs on `EstimateSignScreen` (`signEstimate` → `{ signature, signer_name }`, CrmRepository.kt:334). Same key both surfaces.
- **status:** OK
- **status_note:** Phase 0 [SIG] fix (2026-05-31): web now sends `{ signature, signer_name }` matching backend estimates.js:597. Web estimate signing works; on success the backend emails `OFFICE_EMAIL` and pushes to the company.

### `estimate-builder.present-gbb`
- **label:** "📊 Present GBB Options"
- **section:** actions
- **actors:** office, owner
- **purpose:** (Intended) present the Good/Better/Best tier options to the customer for selection.
- **visibility:** web: GBB estimate, not signed, status != sent.
- **precondition:** GBB presentation mode.
- **confirm:** n/a
- **route_chain:** web button → selectable tier picker → **Confirm Selection & Sign** → `POST /estimates/:id/select-tier {tier_id}` (copies the tier's totals onto the estimate) → opens the signature modal → `POST /estimates/:id/sign`. Mirrors Android's `PresentTiersScreen`.
- **request_body:** select-tier `{ tier_id }`; then sign `{ signature, signer_name }`.
- **side_effects:** select-tier sets `selected_tier_id` + the estimate's `line_items`/`subtotal`/`tax_total`/`discount_total`/`total` to the chosen tier; signing then captures against that total.
- **end_state:** tier chosen, estimate signed at the selected tier's amount.
- **failure_modes:** signing is blocked until a tier is selected (the money guard).
- **parity:** MATCH _(web fixed 2026-06-07, 2645a04)_ — present → select-tier → sign, mirroring Android. Pre-fix: web's button opened the signature modal directly, signing with an unset total.
- **status:** OK _(FIXED 2026-06-07)_
- **status_note:** Reuses the existing TierCard + signature modal + `estimatesApi.selectTier`. Non-GBB estimates sign unchanged.

### `estimate-builder.convert-to-invoice`
- **label:** Convert to Invoice / "→ Invoice"
- **section:** actions
- **actors:** office, owner
- **purpose:** Turn a signed estimate into an invoice.
- **visibility:** web: when `isSigned`. Android: non-GBB row button.
- **precondition:** Signed estimate (web), else available on the row.
- **confirm:** web: a post-signature "Add to Invoice?" prompt, plus a "Keep & Add / Replace" modal when the job already has an invoice with items.
- **route_chain:** `POST /estimates/:id/convert-to-invoice`
- **request_body:** none
- **side_effects:** creates an invoice from the estimate; web optionally merges existing job-invoice items (`PUT /invoices/:id` with `[...new, ...old]`).
- **end_state:** Navigate to the new/updated invoice.
- **failure_modes:** none observed.
- **parity:** PARTIAL, same endpoint; web adds a keep/replace merge step, Android just converts (`vm.convert`).
- **status:** OK
- **status_note:** Web's convert is also auto-offered right after a (would-be) successful signature.

### `estimate-builder.collect-deposit`
- **label:** Collect Deposit
- **section:** actions
- **actors:** office, owner
- **purpose:** Record a deposit payment against a signed, deposit-required estimate.
- **visibility:** web: `isSigned && deposit_required && !deposit_collected`. Android: signed + deposit-required + not collected.
- **precondition:** Deposit required and not yet collected.
- **confirm:** web modal (method + amount).
- **route_chain:** `POST /estimates/:id/collect-deposit`
- **request_body:** web `estimatesApi.collectDeposit(id, Number(amount), method)` → `{ amount_collected, payment_method }`, **correct keys** (matches the handler, estimates.js 700–702).
- **side_effects:** inserts a `payments` row (`completed`), sets `deposit_collected`/`deposit_collected_at`/`deposit_payment_id`, and **moves the linked job to status `holding`**; returns `remaining_balance`.
- **end_state:** Deposit recorded; job → holding.
- **failure_modes:** none, unlike the Job-Detail "Charge Payment" deposit path, this screen sends the correct keys.
- **parity:** PARTIAL, same endpoint; web inline modal vs Android dedicated `DepositCollectionScreen`.
- **status:** OK
- **status_note:** This is the *correct* deposit path; contrast the Job-Detail deposit (wrong keys + non-existent estimate_id).

### `estimate-builder.deposit-settings`
- **label:** Deposit settings (require + amount + type)
- **section:** deposit dialog
- **actors:** office, owner
- **purpose:** Configure whether a deposit is required and how much.
- **visibility:** Android: `DepositSettingsDialog` on the detail screen. Web sets deposit options in the builder, not on the detail.
- **precondition:** n/a
- **confirm:** dialog.
- **route_chain:** `PUT /estimates/:id/deposit-settings`
- **request_body:** `vm.saveDepositSettings(id, required, amount, type)` → `{ deposit_required, deposit_amount, deposit_type }`
- **side_effects:** updates the estimate's deposit columns.
- **end_state:** Deposit config saved.
- **failure_modes:** none observed.
- **parity:** ANDROID-ONLY (on the detail screen), web configures deposits inside the builder.
- **status:** OK
- **status_note:** n/a
### `estimate-builder.edit`
- **label:** Edit Estimate
- **section:** actions
- **actors:** office, owner
- **purpose:** Open the builder to change the estimate.
- **visibility:** always (both).
- **precondition:** n/a
- **confirm:** Android shows a "Editing will require a new signature. Continue?" dialog when the estimate is already signed; web navigates directly.
- **route_chain:** none (navigate to builder) → builder saves via `POST /estimates` / `PUT /estimates/:id` (**UNVERIFIED** body).
- **request_body:** UNVERIFIED (builder not deep-read)
- **side_effects:** `navigate`
- **end_state:** Builder open.
- **failure_modes:** none observed.
- **parity:** PARTIAL, Android guards a signed estimate with a re-sign warning; web does not.
- **status:** OK
- **status_note:** Builder save payload is UNVERIFIED this pass.

### `estimate-builder.delete`
- **label:** Delete Estimate
- **section:** actions
- **actors:** office, owner
- **purpose:** Delete the estimate.
- **visibility:** web: only when `!isSigned`. Android: always (confirm dialog).
- **precondition:** n/a
- **confirm:** confirm modal/dialog both.
- **route_chain:** `DELETE /estimates/:id`
- **request_body:** n/a
- **side_effects:** deletes the estimate row.
- **end_state:** web navigates to the linked job or back; Android pops back.
- **failure_modes:** none observed.
- **parity:** PARTIAL, web hides delete once signed; Android allows it with a confirm.
- **status:** OK
- **status_note:** n/a
### `estimate-builder.attach-photo`
- **label:** "📎 Attach Photo"
- **section:** attachments
- **actors:** office, owner, tech
- **purpose:** Attach a photo to the estimate.
- **visibility:** web: always. Android: attaches via the upload flow (sends a URL).
- **precondition:** n/a
- **confirm:** file picker.
- **route_chain:** `POST /uploads` (cloudinary) → `POST /estimates/:id/add-photo {url, photo_type}`.
- **request_body:** web now uploads the file to `/uploads` → gets `{url}` → `estimatesApi.addPhoto(id, {url, photo_type:'before'})` (JSON). Backend appends the url to `before_photos`/`after_photos`.
- **side_effects:** appends the url to `before_photos[]` (or `after_photos[]`).
- **end_state:** photo attached.
- **failure_modes:** none (the 5-step ZIP/contract mismatch is resolved).
- **parity:** MATCH _(web fixed 2026-06-07, 2645a04)_ — both upload-then-send-url; mirrors the web job-photo flow. Pre-fix: web posted a raw multipart file → 400 "Photo URL required".
- **status:** OK _(FIXED 2026-06-07)_
- **status_note:** Reuses the existing `uploadsApi.upload` helper (the same /uploads 2-step web jobs use).

---

## SCREEN-LEVEL DRIFT FLAGS

- **Web estimate signature now works**, Phase 0 [SIG] fix (2026-05-31): `captureSignature` sends `{ signature, signer_name }` matching `/estimates/:id/sign` (estimates.js:597) and Android. (The Job-Detail signature, separate route reading `signature_url`, remains a follow-up.)
- **Web "Present GBB Options" is mis-wired**, it opens the (broken) signature modal instead of presenting tiers; Android has a real `PresentTiersScreen` + `POST /estimates/:id/select-tier`. Web reads `/tiers` for display but never calls select-tier.
- **Web "Attach Photo" is broken**, posts a multipart file to an endpoint that expects a JSON `{url}` and has no multer → 400. Android sends `{url}` → works.
- **`collect-deposit` here is the CORRECT path** (sends `{amount_collected, payment_method}`), unlike the Job-Detail deposit (wrong keys + non-existent `estimate_id`).
- **Structural divergence:** web inline modals + a 10s remote-signature poll; Android routes sign/send/present/deposit to dedicated screens and guards edit-after-signed with a re-sign warning.
- **`deposit-settings` is Android-only on the detail screen** (web configures deposits in the builder).
- **UNVERIFIED:** the `EstimateBuilder`/`EstimateBuildScreen` save payload (`POST /estimates` / `PUT /estimates/:id`), GBB tier authoring, and the `select-tier` request body beyond `{tier_id}`.
