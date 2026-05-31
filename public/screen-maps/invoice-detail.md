# Screen Map — Invoice Detail

> **Format:** Action-Map Schema v1. Source of truth; the HTML atlas is rendered from it.
> When code changes this screen, update this file in the same commit. Reality on disk wins.

---

## SCREEN

| Field | Value |
|---|---|
| `screen_id` | `invoice-detail` |
| `display_name` | Invoice Detail |
| `surfaces` | android, web |
| `route_android` | `invoices/{id}` → `InvoiceDetailScreen` (InvoiceScreens.kt 305–497) |
| `route_web` | `/invoices/:id` → `InvoiceDetail` (InvoiceDetail.jsx, 783 lines) |
| `primary_actors` | office, owner, tech |
| `purpose` | The collect-the-money screen for one invoice: review line items + totals, send the invoice (with a payment link + PDF), record a payment, capture a signature, send a receipt, and manage follow-up reminders. Web does every action inline (modals); Android routes the heavy actions (sign / pay / receipt / send) to dedicated screens. |
| `last_verified` | 2026-05-31 · Phase 0 [SIG] fix · commit: f942dcf |

### load_sequence
`GET /invoices/:id` returns `invoice.*` + flattened `cust_first/last/email/phone/address/city/state/zip` (JOIN customers) + `payments[]` (all rows for the invoice). Android `vm.loadInv(id)`; web `useGet('/invoices/:id')`.

### entry_points
- **Android:** Invoice list, Job Detail "View Invoice", post-payment Receipt flow `popUpTo`.
- **Web:** Invoice list, Job Detail "Add to / View Invoice", Job Detail "Send Receipt" passes `state.openReceipt` (auto-opens the receipt modal).

---

## ACTIONS

---

### `invoice-detail.back`
- **label:** Back
- **section:** top-bar
- **actors:** office, owner, tech
- **purpose:** Leave the invoice.
- **visibility:** always
- **precondition:** —
- **confirm:** —
- **route_chain:** none (navigate)
- **request_body:** —
- **side_effects:** `navigate`
- **end_state:** Previous screen.
- **failure_modes:** none
- **parity:** MATCH
- **status:** OK
- **status_note:** —

### `invoice-detail.send-invoice`
- **label:** Send Invoice (web) / "Send Invoice + Payment Link" + top-bar Send (Android)
- **section:** actions
- **actors:** office, owner
- **purpose:** Email/SMS the invoice with a hosted payment link + PDF.
- **visibility:** Web: status `draft`|`sent`. Android: `draft`|`sent` button, plus a top-bar Send icon whenever status != `paid`.
- **precondition:** Invoice has a customer.
- **confirm:** Web opens a recipient-picker modal (email/phone checkboxes + add-new + save-to-profile).
- **route_chain:** `POST /invoices/:id/send`
- **request_body:** web `invoicesApi.send(id, {emails, phones, send_email: emails.length>0, send_sms: phones.length>0})`
- **side_effects:** inserts a `payment_links` row (random token, 90-day expiry), sets `invoices.payment_link = {baseUrl}/pay/{token}`, fetches job before/after photos from `file_uploads`, generates a PDF, then sends SMS + email. (Explicit `status='sent'` UPDATE not seen in the read range — **UNVERIFIED**.)
- **end_state:** Invoice sent; payment link attached.
- **failure_modes:** the generated link path `/pay/:token` does not match any registered route I saw (`/api/payments/link/:token` is the registered one, and no web `/pay` route exists) — **UNVERIFIED** whether `/pay/:token` resolves.
- **parity:** PARTIAL — same endpoint; web = inline recipient modal, Android = dedicated `InvoiceSendScreen`.
- **status:** OK
- **status_note:** Web persists newly-typed recipients to the customer profile via `POST /customers/:id/contacts` after a successful send.

### `invoice-detail.charge-payment`
- **label:** Charge Payment (web modal) / Charge Payment (Android → options sheet)
- **section:** actions
- **actors:** office, owner, tech
- **purpose:** Record a payment against the invoice.
- **visibility:** Web: any time `status != paid`. Android: only at status `signed` (opens a sheet: "Charge on site" → PaymentScreen, "Send payment link" → InvoiceSendScreen).
- **precondition:** Invoice not fully paid.
- **confirm:** Web modal collects amount / method / notes.
- **route_chain:** web `POST /invoices/:id/payment`; Android routes to PaymentScreen (see `payments` map).
- **request_body:** web (InvoiceDetail.jsx 74–78) `{ amount: Number(paymentForm.amount), method: paymentForm.method, notes: paymentForm.notes }`
- **side_effects:** backend (invoices.js 554–604) inserts a `payments` row (`status='completed'`), recomputes `amount_paid` / `balance_due`, sets `status` = `paid` (balance ≤ 0) else `partial`, sets `payment_method` + `paid_at`, fires Joby `invoice_paid` when fully paid.
- **end_state:** Payment recorded; invoice status advances.
- **failure_modes:** none (web payload matches the handler; `reference` is optional and web omits it).
- **parity:** DIVERGENT — web records the payment inline at any unpaid status; Android exposes it only at `signed` and defers to a dedicated PaymentScreen / payment-link flow.
- **status:** OK
- **status_note:** Functional both surfaces; the *when* and *how* differ.

### `invoice-detail.scanpay-charge`
- **label:** "💳 Charge via ScanPay"
- **section:** actions
- **actors:** office, owner
- **purpose:** Charge the remaining balance via the ScanPay processor.
- **visibility:** web only, when `status != paid`. Android Invoice Detail has no ScanPay-charge button.
- **precondition:** —
- **confirm:** —
- **route_chain:** `POST /payments/scanpay/charge` — **route does not exist** in `payments.js` (registered: `/scanpay-qr`, `/scanpay-link`, `/scanpay-status/:invoiceId`, `/scanpay-webhook`, `/scanpay/webhook`, `/:id/refund`, `/summary`).
- **request_body:** `paymentsApi.scanpayCharge(id, amt, email)` → `{ invoice_id, amount, customer_email }`
- **side_effects:** none — request 404s at the catch-all (`{error:'Route not found'}`).
- **end_state:** error snackbar; nothing charged.
- **failure_modes:** `route-404` — `/payments/scanpay/charge` is unregistered. (Android `ApiService.scanpayCharge` targets the same missing path.)
- **parity:** WEB-ONLY
- **status:** BROKEN
- **status_note:** The button is reachable on any unpaid invoice and always fails with 404.

### `invoice-detail.capture-signature`
- **label:** "✍️ Capture Signature"
- **section:** actions
- **actors:** office, owner, tech
- **purpose:** Capture an on-screen customer signature on the invoice.
- **visibility:** web: always. Android: signs via the dedicated `InvoiceSignScreen` ("Get Signature", status `draft`|`sent`).
- **precondition:** —
- **confirm:** signature pad modal (web).
- **route_chain:** `POST /invoices/:id/sign`
- **request_body:** web `invoicesApi.captureSignature(id, base64)` → `{ signature }`. Backend (invoices.js 532–535) reads `{ signature }`. Keys now match.
- **side_effects:** sets `customer_signature`, `customer_signature_date`, `status='signed'`.
- **end_state:** web → signature saved, invoice status → `signed`.
- **failure_modes:** none observed.
- **parity:** MATCH — web posts `{ signature }` inline; Android signs on a separate `InvoiceSignScreen` (`signInvoice` → `{ signature }`, CrmRepository.kt:361). Same key both surfaces.
- **status:** OK
- **status_note:** Phase 0 [SIG] fix (2026-05-31): web now sends `{ signature }` matching backend invoices.js:534. Web invoice signing works.

### `invoice-detail.send-receipt`
- **label:** Send Receipt / Send Partial Receipt
- **section:** actions
- **actors:** office, owner
- **purpose:** Send a paid/partial receipt (optionally with a review-request link).
- **visibility:** web: status `paid`|`partial`|`partially_paid`. Android: `paid` (if not already `receipt_sent`) and `partial`/`partially_paid`.
- **precondition:** Invoice has a customer.
- **confirm:** web recipient-picker modal (email/phone + review-request toggle + save-to-profile).
- **route_chain:** `POST /invoices/:id/send-receipt`
- **request_body:** web `invoicesApi.sendReceipt(id, {emails, phones, send_email, send_sms, send_review_request})`
- **side_effects:** backend (607+) builds a receipt SMS (`amount_paid`, invoice #, company name), optionally appends the default `review_platforms` link, and sends SMS (and email) to all recipients.
- **end_state:** Receipt sent.
- **failure_modes:** none observed.
- **parity:** PARTIAL — same endpoint; web inline modal vs Android dedicated `ReceiptScreen`.
- **status:** OK
- **status_note:** Web auto-opens this modal when arriving from Job Detail with `state.openReceipt`.

### `invoice-detail.add-item`
- **label:** Add Item
- **section:** line-items
- **actors:** office, owner, tech
- **purpose:** Append pricebook items to the invoice from the detail screen.
- **visibility:** Android: always (button under the line-items). Web Invoice Detail has no add-item control.
- **precondition:** —
- **confirm:** pricebook picker (activity-scoped).
- **route_chain:** Android `vm.addLineItems(id, picked)` → `PUT /invoices/:id` (line-items update). (Exact repo body **UNVERIFIED** — VM/repo not read.)
- **request_body:** UNVERIFIED (picked pricebook entries → invoice line_items)
- **side_effects:** invoice line_items + totals updated.
- **end_state:** Items added.
- **failure_modes:** none observed.
- **parity:** ANDROID-ONLY — web edits invoice items elsewhere (InvoiceForm), not on the detail screen.
- **status:** OK
- **status_note:** Android can build up the invoice directly from the detail screen.

### `invoice-detail.followup-stop-resume`
- **label:** Stop Reminders / Resume Reminders
- **section:** follow-up card
- **actors:** office, owner
- **purpose:** Pause or resume automatic unpaid-invoice follow-up reminders.
- **visibility:** Web: when `followup_count != null` and not paid (Stop if not stopped, else Resume). Android: status `sent`|`overdue`.
- **precondition:** —
- **confirm:** modal/dialog both surfaces.
- **route_chain:** Stop `PATCH /invoices/:id/stop-followup`; Resume `PATCH /invoices/:id/reset-followup`
- **request_body:** none
- **side_effects:** toggles `followup_stopped` (reset also clears the count).
- **end_state:** Reminders paused/resumed.
- **failure_modes:** none
- **parity:** MATCH — same two PATCH endpoints on both surfaces.
- **status:** OK
- **status_note:** —

---

## SCREEN-LEVEL DRIFT FLAGS

- **`scanpay-charge` → `POST /payments/scanpay/charge` is a 404** (route never registered). Web "Charge via ScanPay" always fails; Android's `scanpayCharge` targets the same missing path.
- **`capture-signature` now sends `{ signature }`** (Phase 0 [SIG] fix, 2026-05-31) matching backend invoices.js:534 and Android. Web invoice signing works. (The Job-Detail signature — separate route reading `signature_url` — remains a follow-up.)
- **Structural divergence:** web does send / pay / sign / receipt **inline** (modals); Android routes each to a dedicated screen (`InvoiceSendScreen`, `PaymentScreen`, `InvoiceSignScreen`, `ReceiptScreen`).
- **`charge-payment` visibility differs:** web allows it at any unpaid status; Android only at `signed`.
- **`add-item` is Android-only** on the detail screen.
- **UNVERIFIED:** `/send` explicit `status='sent'` write (not seen in the read range); the generated payment-link path `/pay/:token` vs the registered `/api/payments/link/:token`; Android `vm.addLineItems` repo body.
