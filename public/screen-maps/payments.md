# Screen Map — Payments (Collect + Receipt)

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
| `last_verified` | 2026-05-31 · Stage-1 read-only audit · commit: cca244c |

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
- **parity:** PARTIAL — same endpoint; web inline modal (5 methods), Android dedicated method-grid screen (6 methods incl. ScanPay).
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
- **parity:** ANDROID-ONLY — web has no QR generate path here (its only ScanPay button is the broken `scanpay/charge`).
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
- **status_note:** —

### `payments.scanpay-charge`
- **label:** "💳 Charge via ScanPay" (web)
- **section:** collect
- **actors:** office, owner
- **purpose:** Charge the remaining balance via ScanPay directly.
- **visibility:** web Invoice Detail, when `status != paid`.
- **precondition:** —
- **confirm:** —
- **route_chain:** `POST /payments/scanpay/charge` — **route does not exist** (payments.js has `scanpay-qr`, `scanpay-link`, `scanpay-status`, `scanpay-webhook`, `scanpay/webhook`, `:id/refund`, `summary`).
- **request_body:** `paymentsApi.scanpayCharge(id, amt, email)` → `{ invoice_id, amount, customer_email }`
- **side_effects:** none — 404 at the catch-all.
- **end_state:** error snackbar.
- **failure_modes:** `route-404`.
- **parity:** WEB-ONLY (and broken). Android uses the working `scanpay-qr`/`-link` flow instead.
- **status:** BROKEN
- **status_note:** The only ScanPay path that actually works is Android's QR/link; the web ScanPay button always 404s.

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
- **parity:** PARTIAL — same endpoint; web inline modal vs Android `ReceiptScreen`.
- **status:** OK
- **status_note:** Mirrors the invoice-detail `send-receipt` action.

### `payments.ledger`
- **label:** Payments list (date-range ledger + total collected)
- **section:** review
- **actors:** office, owner
- **purpose:** Review collected payments over a date range; tap through to the invoice.
- **visibility:** web `/payments` page (always). Android has a `PaymentsScreen` (not deep-read).
- **precondition:** —
- **confirm:** —
- **route_chain:** `GET /payments?from&to&page&limit`
- **request_body:** —
- **side_effects:** read-only; returns `{payments, total_collected, total}`.
- **end_state:** Ledger shown; rows link to `/invoices/:invoice_id`.
- **failure_modes:** none.
- **parity:** PARTIAL — web list verified; Android `PaymentsScreen` exists but was **not deep-read** (UNVERIFIED).
- **status:** OK
- **status_note:** Web page is read-only (no create/refund controls).

---

## SCREEN-LEVEL DRIFT FLAGS

- **Web ScanPay is broken (404)** — `POST /payments/scanpay/charge` is unregistered. The working ScanPay path is Android's `scanpay-qr` / `scanpay-link` + `scanpay-status` polling (3s / 5s).
- **ScanPay QR/link generate flow is Android-only** — web never surfaces it (and `GET /invoices/:id/scanpay-qr` is unused by the web Invoice Detail).
- **`POST /payments` (standalone create) has no audited consumer** — it validates method, applies to the invoice (`applyPaymentToInvoice`), and notifies the owner on payments ≥ $500, but `InvoiceDetail` and the `/payments` page both use `POST /invoices/:id/payment` / read-only `GET /payments` instead. `paymentsApi.create` is **UNVERIFIED** for a live caller.
- **Two payment-write paths** — `POST /invoices/:id/payment` (used by the UIs) and `POST /payments` (standalone); both insert a completed `payments` row and update the invoice, via slightly different code.
- **Method-set note:** Android offers Venmo/CashApp; these ride `/invoices/:id/payment` as `method='venmo'`. The final `payments_method_check` (per the data-model audit) includes `venmo`/`cashapp` but excludes `card`/`scanpay`/`paypal`.
- **UNVERIFIED:** Android `PaymentsScreen` (list) contents; the exact ScanPay request/response bodies beyond the ApiService signatures; whether any screen calls `POST /payments`.
