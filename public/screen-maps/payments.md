# Screen Map, Payments (Collect + Receipt)

> **Format:** Action-Map Schema v1. Source of truth; the HTML atlas is rendered from it.
> When code changes this screen, update this file in the same commit. Reality on disk wins.

---

## SCREEN

| Field | Value |
|---|---|
| `screen_id` | `payments` |
| `display_name` | Payments (Collect + Receipt) |
| `surfaces` | android, web |
| `route_android` | `invoices/{id}/payment` → `PaymentScreen` (InvoiceScreens.kt 604–767); `invoices/{id}/receipt` → `ReceiptScreen` (929+); `payments` → `PaymentsScreen` (ui/payments/PaymentsScreen.kt, **not deep-read**) |
| `route_web` | `/payments` → `Payments` (Payments.jsx, read-only list) + the payment/receipt **modals inside** `InvoiceDetail` |
| `primary_actors` | office, owner, tech |
| `purpose` | Take the money and confirm it: record a manual payment (cash / card / check / etc.), run a ScanPay QR or payment-link charge with live polling, send a receipt, and review the payments ledger. Web collects payment in an Invoice-Detail modal and shows a read-only payments list; Android has a dedicated method-grid PaymentScreen + ScanPay dialogs + ReceiptScreen. |
| `last_verified` | 2026-06-02 · ScanPay webhook schema-write bug fixed (payments.transaction_id/receipt_url do not exist; aborted every ScanPay payment) · backend 8953689. Prior: Money Commit B earnings trigger (clear-day) + refund clawback · 2269f85. |

### load_sequence
Android PaymentScreen `vm.loadInv(id)`, prefills the amount with `balance_due`. Web payment modal lives on the already-loaded invoice. Web Payments list: `GET /payments?from&to&page&limit` → `{payments, total_collected}`.

### entry_points
- **Android:** Invoice Detail "Charge Payment" (status `signed`) → PaymentScreen; "Send Receipt"/"Send Partial Receipt" → ReceiptScreen; bottom-nav/Settings → PaymentsScreen list.
- **Web:** Invoice Detail "Charge Payment" / "Charge via ScanPay" / "Send Receipt" modals; `/payments` ledger page.

---

## ACTIONS

---

### `payments.record-payment`
- **label:** Record Payment (cash / credit_card / check / ach / venmo …)
- **section:** collect
- **actors:** office, owner, tech
- **purpose:** Record a manually-collected payment against the invoice.
- **visibility:** Web: Invoice-Detail "Charge Payment" modal whenever `status != paid`. Android: PaymentScreen 6-method grid (ScanPay QR, ScanPay Link, Cash, Credit Card, Check, Venmo/CashApp), amount editable + prefilled to `balance_due`.
- **precondition:** Invoice not fully paid; amount > 0.
- **confirm:** the modal/screen itself.
- **route_chain:** `POST /invoices/:id/payment`
- **request_body:** web `{ amount, method, notes }`; Android `vm.recordPayment(id, method, amount, notes)` → `{ method, amount, notes }`
- **side_effects:** inserts a `payments` row (`completed`), recomputes `amount_paid`/`balance_due`, sets `status` paid (≤0) else partial, sets `payment_method`+`paid_at`, fires Joby `invoice_paid` when fully paid.
- **end_state:** Payment recorded; Android → ReceiptScreen (`onPaid`).
- **failure_modes:** none (both payloads match the handler).
- **parity:** PARTIAL, same endpoint; web inline modal (5 methods), Android dedicated method-grid screen (6 methods incl. ScanPay).
- **status:** OK
- **status_note:** Both record manual methods through `/invoices/:id/payment` (not the standalone `POST /payments`).

### `payments.scanpay-qr`
- **label:** ScanPay QR → "Generate QR"
- **section:** collect
- **actors:** office, owner, tech
- **purpose:** Show a ScanPay QR code the customer scans to pay, and watch for completion.
- **visibility:** Android PaymentScreen (method `scanpay_qr`). Web does not surface a ScanPay QR generate flow on the invoice.
- **precondition:** amount > 0.
- **confirm:** QR dialog.
- **route_chain:** `POST /payments/scanpay-qr` → dialog polls `GET /payments/scanpay-status/:invoiceId` every **3 s** until paid.
- **request_body:** `vm.createScanPayQr(id, amount)` → `{ invoice_id, amount }` (exact keys per ApiService `createScanPayQr`)
- **side_effects:** creates a ScanPay order; on paid → `onPaid` (→ ReceiptScreen).
- **end_state:** Payment captured via processor.
- **failure_modes:** none observed (route exists).
- **parity:** ANDROID-ONLY, web has no QR generate path here (its only ScanPay button is the broken `scanpay/charge`).
- **status:** OK
- **status_note:** `GET /invoices/:id/scanpay-qr` also exists but is not surfaced by the web Invoice Detail.

### `payments.scanpay-link`
- **label:** ScanPay Link → "Send Payment Link"
- **section:** collect
- **actors:** office, owner, tech
- **purpose:** Text the customer a ScanPay payment link, then watch for completion.
- **visibility:** Android PaymentScreen (method `scanpay_link`). Not surfaced on web here.
- **precondition:** amount > 0.
- **confirm:** link dialog (shows whether the SMS sent + phone used).
- **route_chain:** `POST /payments/scanpay-link` → dialog polls `GET /payments/scanpay-status/:invoiceId` every **5 s**.
- **request_body:** `vm.createScanPayLink(id, amount, cust_phone)` → `{ invoice_id, amount, customer_phone }`
- **side_effects:** creates a ScanPay order + SMS link; on paid → `onPaid`.
- **end_state:** Payment captured.
- **failure_modes:** none observed (route exists).
- **parity:** ANDROID-ONLY.
- **status:** OK
- **status_note:** n/a
### `payments.scanpay-charge`
- **label:** "📲 ScanPay QR / 🔗 ScanPay Link"
- **section:** collect
- **actors:** office, owner
- **purpose:** Collect the balance via ScanPay (QR scan or texted payment link), polling until paid.
- **visibility:** web + Android Invoice Detail, when `status != paid`.
- **precondition:** balance > 0.
- **confirm:** the QR / link dialog.
- **route_chain:** QR `POST /payments/scanpay-qr` → `{ qr_data_url, payment_url, order_id }`; Link `POST /payments/scanpay-link` → `{ payment_url, sms_sent, phone_used }`; both poll `GET /payments/scanpay-status/:invoiceId` (QR 3 s, Link 5 s) until `status === 'paid'`.
- **request_body:** QR `{ invoice_id, amount }`; Link `{ invoice_id, amount, customer_phone }`
- **side_effects:** creates a ScanPay order (`createScanPayInvoice`); Link SMS-texts the checkout URL; on paid, refetches the invoice.
- **end_state:** Payment captured via the ScanPay checkout URL.
- **failure_modes:** none observed.
- **parity:** MATCH, web now mirrors Android's QR/link dialogs + polling (Phase 0 [SCANPAY-404] fix, 2026-05-31). The dead `POST /payments/scanpay/charge` button was removed; that route never existed. The leftover `scanpayCharge` method is an unused remnant on both clients.
- **status:** OK
- **status_note:** Phase 0 [SCANPAY-404] (2026-05-31): the only working ScanPay path was always Android's QR/link; web now uses the same. Direct charge is not part of this ScanPay integration.

### `payments.send-receipt`
- **label:** Send Receipt / Send Partial Receipt
- **section:** confirm
- **actors:** office, owner
- **purpose:** Send the customer a payment receipt (optionally with a review link).
- **visibility:** Web: Invoice-Detail receipt modal (`paid`/`partial`). Android: ReceiptScreen (`paid` if not already `receipt_sent`, and `partial`).
- **precondition:** Invoice has a paid/partial state and a customer.
- **confirm:** recipient picker (web modal / Android screen).
- **route_chain:** `POST /invoices/:id/send-receipt`
- **request_body:** `{ emails, phones, send_email, send_sms, send_review_request }`
- **side_effects:** builds a receipt SMS (`amount_paid`, invoice #, company) + optional default `review_platforms` link; sends SMS + email.
- **end_state:** Receipt sent.
- **failure_modes:** none observed.
- **parity:** PARTIAL, same endpoint; web inline modal vs Android `ReceiptScreen`.
- **status:** OK
- **status_note:** Mirrors the invoice-detail `send-receipt` action.

### `payments.ledger`
- **label:** Payments list (date-range ledger + total collected)
- **section:** review
- **actors:** office, owner
- **purpose:** Review collected payments over a date range; tap through to the invoice.
- **visibility:** web `/payments` page (always). Android has a `PaymentsScreen` (not deep-read).
- **precondition:** n/a
- **confirm:** n/a
- **route_chain:** `GET /payments?from&to&page&limit`
- **request_body:** n/a
- **side_effects:** read-only; returns `{payments, total_collected, total}`.
- **end_state:** Ledger shown; rows link to `/invoices/:invoice_id`.
- **failure_modes:** none.
- **parity:** PARTIAL, web list verified; Android `PaymentsScreen` exists but was **not deep-read** (UNVERIFIED).
- **status:** OK
- **status_note:** Web page is read-only (no create/refund controls).

### `payments.money-trigger` (server-side, no UI)
- **label:** Earnings fire on the clear-day (Money Commit B)
- **section:** money model
- **actors:** system
- **purpose:** Make earnings track REAL kept money. When a payment / ScanPay charge / refund changes a job's invoice balance, `reconcileJobEarnings(jobId, companyId)` (`backend/utils/profit.js`) reconciles the job's money.
- **route_chain:** fired AFTER the balance update inside `POST /invoices/:id/payment`, `POST /payments/:id/refund`, and the ScanPay webhook (`handleScanPayWebhook`).
- **side_effects (the rule):**
  - Acts ONLY on **work-done** jobs (`actual_end` set). A payment on a not-yet-completed job or a deposit-holding job (`actual_end` null) does NOT auto-complete it; the tech still marks the work done, and `/complete` then fires earnings (it sees the balance already cleared).
  - **Balance clears to 0** on a work-done holding job → status `holding` → `completed`; writes `tech_earnings` on `getJobGross` (collected money) dated **NOW = the clear-day**, and recomputes the partner split in `job_completion_details` (kept `pending` for the sender to confirm).
  - **Refund** lowers collected money → `getJobGross` nets `refund_amount`, so `tech_earnings` recomputes DOWN; if the refund reopened a balance, the job flips `completed` → `holding` and a previously `confirmed` partner split resets to `pending`.
- **end_state:** Earnings = real collected money, dated to the day the money actually moved; payroll/reports pick them up in that day's period.
- **parity:** BACKEND-ONLY (no Android/web UI surface). Mirrors and completes the `/complete` money branch from Commit A.
- **status:** OK
- **status_note:** Money Commit B (2026-06-01). REPLACES the ScanPay webhook's old bare `UPDATE jobs SET status='completed'` that completed the job WITHOUT writing earnings (the no-earnings gap is fixed). Idempotent (`saveJobEarnings` DELETE+INSERT; split recompute+upsert) so it cannot double-fire vs the `/complete` path. The full money model (collect → settle → clawback) is now complete (Commit A + B). NOTE (2026-06-02, backend 8953689): on the ScanPay path this trigger was unreachable until the webhook schema-write bug was fixed, the `UPDATE payments` referenced non-existent `transaction_id`/`receipt_url` columns and aborted the transaction before `reconcileJobEarnings` ran. Now reachable.

---

## SCREEN-LEVEL DRIFT FLAGS

- **Permissions (Phase 2a, 2026-06-07):** the **Refund** API (`POST /payments/:id/refund`) is HARD-gated `payments_refunds:full` (owner/admin only); collect/charge a payment = `payments_refunds:edit_self`. Neither platform exposes a refund control today (the web Payments page is read-only), so there's no see-then-403, but the route is fully enforced server-side. 3a hides the Payments nav for `payments_refunds:none` (dispatcher).
- **Web ScanPay now works** (Phase 0 [SCANPAY-404] fix, 2026-05-31), web has ScanPay QR + Link buttons using `POST /payments/scanpay-qr` / `/scanpay-link` + `GET /scanpay-status/:invoiceId` polling (3 s / 5 s), mirroring Android. The non-existent `POST /payments/scanpay/charge` was removed; it was never a real route (a stale backend test for it was also removed).
- **ScanPay QR/link generate flow is now on both surfaces**, web mirrors Android's QR-image + texted-link dialogs. (`GET /invoices/:id/scanpay-qr` returns only a portal URL, not a ScanPay order, so neither surface uses it for the charge flow.)
- **`POST /payments` (standalone create) has no audited consumer**, it validates method, applies to the invoice (`applyPaymentToInvoice`), and notifies the owner on payments ≥ $500, but `InvoiceDetail` and the `/payments` page both use `POST /invoices/:id/payment` / read-only `GET /payments` instead. `paymentsApi.create` is **UNVERIFIED** for a live caller.
- **Two payment-write paths**, `POST /invoices/:id/payment` (used by the UIs) and `POST /payments` (standalone); both insert a completed `payments` row and update the invoice, via slightly different code.
- **Method-set note:** Android offers Venmo/CashApp; these ride `/invoices/:id/payment` as `method='venmo'`. The final `payments_method_check` (per the data-model audit) includes `venmo`/`cashapp` but excludes `card`/`scanpay`/`paypal`.
- **ScanPay earnings-gap FIXED** (Money Commit B, 2026-06-01): the webhook previously force-completed the linked job with a bare `UPDATE status='completed'` and wrote NO earnings. It now calls `reconcileJobEarnings`, which completes the job AND fires earnings on collected money dated to the ScanPay clear-day. A job paid via ScanPay *before* the work was marked done (`actual_end` null) is NOT auto-completed (Decision 3a: payment alone does not imply the work is finished).
- **Refund clawback** (Money Commit B): `getJobGross` nets `refund_amount`; the refund handler calls `reconcileJobEarnings`, so a refund drops `tech_earnings` to the now-lower kept amount, reopens `completed` → `holding` if a balance reopens, and resets a confirmed partner split to `pending`. The collections report (`routes/reports.js`) was also netted to `SUM(amount - refund_amount)` so it agrees with `getJobGross`.
- **ScanPay webhook schema-write bug FIXED (2026-06-02, backend 8953689):** the webhook `UPDATE payments` wrote `transaction_id` + `receipt_url`, columns that do not exist in the `payments` table. Postgres aborted the whole transaction (`column "transaction_id" ... does not exist`), so the payment never recorded, the invoice never updated, and the app polled `scanpay-status` forever (the real field symptom; the `processor_id = eventData.invoiceId` match was working). Fix writes only existing columns (`status`, `processed_at`) and keeps the ScanPay transaction ref + receipt in `notes`. This was the actual blocker in front of the Commit B earnings trigger on ScanPay: once the write succeeds, `applyPaymentToInvoice` runs and `reconcileJobEarnings` fires. Confirmed real payload: `eventName:"payment.complete"`, `eventData.invoiceId` (ScanPay id, matches `processor_id`), `eventData.amount`, `eventData.paymentDetails.transactionId` (nested), `eventData.receiptUrl`; the handler reads all of these at the correct paths.
- **UNVERIFIED:** Android `PaymentsScreen` (list) contents; the exact ScanPay request/response bodies beyond the ApiService signatures; whether any screen calls `POST /payments`.
