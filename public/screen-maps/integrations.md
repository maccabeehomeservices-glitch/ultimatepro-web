# Screen Map, Integrations (QuickBooks Online)

> **Format:** Action-Map Schema v1. Source of truth; the HTML atlas is rendered from it.
> When code changes this screen, update this file in the same commit. Reality on disk wins.

---

## SCREEN

| Field | Value |
|---|---|
| `screen_id` | `integrations` |
| `display_name` | Integrations (QuickBooks Online) |
| `surfaces` | android, web |
| `route_android` | `/settings/integrations` → `QuickBooksScreen` + `QuickBooksViewModel` (QuickBooksScreen.kt) |
| `route_web` | `/settings/integrations` → `Integrations` (Integrations.jsx, 223 lines) |
| `manages_table` | `qbo_connections` (per-company QBO OAuth tokens + realm), **not** the schema's generic `integration_tokens` (see drift) |
| `backend` | `routes/quickbooks.js`, mounted at `/api/integrations/quickbooks` (server.js:92) |
| `primary_actors` | owner, admin |
| `purpose` | Connect QuickBooks Online via OAuth2, then **push** customers / invoices / payments into QBO. Shows connection status, runs sync (all or per-entity), and disconnects. Web and Android are functionally identical; only the OAuth return differs. |
| `last_verified` | 2026-05-31 · Stage-1 read-only audit · commit: 6147cd1 |

### OAuth flow (confirmed, readable)
1. `GET /connect` builds the Intuit authorize URL (`appcenter.intuit.com/connect/oauth2`, scope `com.intuit.quickbooks.accounting`, `state = base64({company_id, user_id})`) → returns `{url}`.
2. Client opens it (web `window.location.href`; Android `Intent.ACTION_VIEW`).
3. Intuit redirects to `GET /callback` (**public, no auth**) with `code, realmId, state` → exchanges the code for tokens at `oauth.platform.intuit.com/.../tokens/bearer`, fetches the QBO company name, **UPSERTs `qbo_connections`** (ON CONFLICT company_id), then **redirects to `${FRONTEND_URL}/settings/integrations?qbo=connected`** (or `?qbo=error&msg=`).
4. The web Integrations page reads `?qbo=` on mount and snackbars the result.

### token refresh (confirmed, readable)
`getToken(companyId)` loads `qbo_connections`; if `token_expires_at - now < 5 min`, it POSTs `grant_type=refresh_token` and **UPDATEs `access_token/refresh_token/token_expires_at`** before returning. Every sync route calls `getToken` first, so tokens self-heal.

### gating
All routes `auth` except `GET /callback` (must be public for Intuit's redirect). No explicit owner/admin gate.

### entry_points
- Web: Settings → "Integrations" (`/settings/integrations`).
- Android: "More" → Business → "Integrations".

---

## ACTIONS

---

### `integrations.status`
- **label:** Load connection status
- **section:** connection
- **actors:** owner, admin
- **purpose:** Show connected / not-connected (+ QBO company name).
- **visibility:** on open.
- **route_chain:** `GET /integrations/quickbooks/status` → `{connected:false}` or `{connected:true, realm_id, company_name, environment, …}`
- **request_body:** n/a
- **side_effects:** read-only.
- **end_state:** Connected badge or Connect button.
- **failure_modes:** error → treated as not connected.
- **parity:** MATCH, web `quickbooksApi.getStatus()`; Android `repo.getQboStatus()`.
- **status:** OK
- **status_note:** n/a
### `integrations.connect`
- **label:** Connect QuickBooks (OAuth)
- **section:** connection
- **actors:** owner, admin
- **purpose:** Start the OAuth2 authorize flow.
- **visibility:** "Connect QuickBooks Online" when not connected.
- **precondition:** n/a
- **confirm:** n/a
- **route_chain:** `GET /integrations/quickbooks/connect` → `{url}` → open Intuit → `GET /callback` → UPSERT `qbo_connections` → redirect to web `/settings/integrations?qbo=connected`
- **request_body:** n/a
- **side_effects:** on completion, stores tokens + realm + company name in `qbo_connections`.
- **end_state:** Connected (after the redirect/reload).
- **failure_modes:** callback errors redirect to `?qbo=error&msg=…`.
- **parity:** DIVERGENT (return UX), both fetch the same URL and open Intuit, but **the callback `redirect_uri` is hard-wired to `FRONTEND_URL` (the website)**. Web redirects in-page and reads `?qbo=connected`. **Android opens an external browser and the post-auth redirect lands on the website, not back in the app**, the Android screen only reflects "Connected" on its next status load (no deep-link return).
- **status:** OK
- **status_note:** The connection itself succeeds on both; Android just doesn't get a deep-link back, so the user must return to the app to see the updated state.

### `integrations.oauth-callback`
- **label:** OAuth callback (token exchange)
- **section:** connection
- **actors:** system
- **purpose:** Exchange the auth code for tokens and persist the connection.
- **visibility:** server-side (Intuit redirect target).
- **route_chain:** `GET /integrations/quickbooks/callback` (public) → token exchange → companyinfo fetch → `INSERT … ON CONFLICT (company_id) DO UPDATE` on `qbo_connections` → redirect
- **request_body:** query `code, realmId, state`
- **side_effects:** writes/updates the `qbo_connections` row (`environment` fixed to `'production'`).
- **end_state:** Connection row stored; user redirected to the web settings page.
- **failure_modes:** missing params → 400; bad `state` → 400; token/exchange error → redirect with `?qbo=error`.
- **parity:** MATCH (server, surface-agnostic), single callback used by both.
- **status:** OK
- **status_note:** State carries `{company_id, user_id}` (base64), that's how the callback knows which company to attach despite being unauthenticated.

### `integrations.token-refresh`
- **label:** Auto token refresh
- **section:** connection
- **actors:** system
- **purpose:** Keep the access token valid before each sync.
- **visibility:** server-side.
- **route_chain:** `getToken()` → if `<5 min` to expiry: POST `grant_type=refresh_token` → UPDATE `qbo_connections`
- **request_body:** n/a
- **side_effects:** rotates `access_token`/`refresh_token`, extends `token_expires_at`.
- **end_state:** Fresh token used for the sync.
- **failure_modes:** a failed refresh throws → the calling sync returns 500 (`error`); no auto-disconnect.
- **parity:** MATCH (server), every sync route calls `getToken` first.
- **status:** OK
- **status_note:** Fully readable (not UNVERIFIED): 5-minute pre-expiry refresh window.

### `integrations.sync-all`
- **label:** Sync All to QuickBooks
- **section:** sync
- **actors:** owner, admin
- **purpose:** Push customers, invoices, and payments in one go.
- **visibility:** "Sync All" when connected.
- **precondition:** connected.
- **confirm:** n/a
- **route_chain:** `POST /integrations/quickbooks/sync/all` → `getToken` → `Promise.all([syncCustomers, syncInvoices, syncPayments])`
- **request_body:** n/a
- **side_effects:** creates QBO Customers/Invoices/Payments; back-fills `qbo_customer_id` / `qbo_invoice_id` / `qbo_synced` locally.
- **end_state:** `{customers, invoices, payments}` each `{synced, errors, total}`; results shown.
- **failure_modes:** token/refresh failure → 500; per-record failures counted as `errors` (not fatal).
- **parity:** MATCH, web `syncAll()`; Android `syncQboAll()`. Both render per-entity synced/errors.
- **status:** OK
- **status_note:** n/a
### `integrations.sync-customers`
- **label:** Sync Customers
- **section:** sync
- **actors:** owner, admin
- **purpose:** Push new customers to QBO.
- **visibility:** "Customers" button when connected.
- **route_chain:** `POST /integrations/quickbooks/sync/customers` → for active customers with `qbo_customer_id IS NULL` (LIMIT 100) → QBO `POST /customer` → store `qbo_customer_id`
- **request_body:** n/a
- **side_effects:** creates QBO customers; sets `customers.qbo_customer_id`.
- **end_state:** `{synced, errors, total}`.
- **failure_modes:** per-customer errors counted; **one-way push** (no pull from QBO).
- **parity:** MATCH.
- **status:** OK
- **status_note:** Only **un-synced** customers (qbo_customer_id NULL), capped at 100 per run.

### `integrations.sync-invoices`
- **label:** Sync Invoices
- **section:** sync
- **actors:** owner, admin
- **purpose:** Push invoices to QBO.
- **visibility:** "Invoices" button when connected.
- **route_chain:** `POST /integrations/quickbooks/sync/invoices` → invoices with `qbo_invoice_id NULL` whose customer has `qbo_customer_id` (LIMIT 100) → QBO `POST /invoice` → store `qbo_invoice_id`
- **request_body:** n/a
- **side_effects:** creates QBO invoices; sets `invoices.qbo_invoice_id`.
- **end_state:** `{synced, errors, total}`.
- **failure_modes:** invoices for not-yet-synced customers are skipped (the JOIN requires `qbo_customer_id`). **Line items use a hard-coded `ItemRef {value:'1', name:'Services'}`**, products/items are NOT synced as QBO items.
- **parity:** MATCH.
- **status:** OK
- **status_note:** Customer must be synced first; every line maps to the generic QBO "Services" item.

### `integrations.sync-payments`
- **label:** Sync Payments
- **section:** sync
- **actors:** owner, admin
- **purpose:** Push completed payments to QBO.
- **visibility:** "Payments" button when connected.
- **route_chain:** `POST /integrations/quickbooks/sync/payments` → payments `qbo_synced=false, status='completed'` whose customer has `qbo_customer_id` (LIMIT 100) → QBO `POST /payment` → set `qbo_synced=true`
- **request_body:** n/a
- **side_effects:** creates QBO payments; sets `payments.qbo_synced`.
- **end_state:** `{synced, errors, total}`.
- **failure_modes:** **`PaymentMethodRef` is hard-coded to `'1'`**, and payments aren't linked to a specific QBO invoice (just `CustomerRef` + `TotalAmt`), so QBO receives an unapplied customer payment.
- **parity:** MATCH.
- **status:** OK
- **status_note:** Payment is recorded against the customer, not applied to the synced invoice.

### `integrations.disconnect`
- **label:** Disconnect QuickBooks
- **section:** manage
- **actors:** owner, admin
- **purpose:** Remove the QBO connection.
- **visibility:** "Disconnect" when connected, with confirm.
- **precondition:** connected.
- **confirm:** web `window.confirm`; Android AlertDialog.
- **route_chain:** `DELETE /integrations/quickbooks/disconnect` → `DELETE FROM qbo_connections WHERE company_id`
- **request_body:** n/a
- **side_effects:** deletes the connection row (tokens gone). Local `qbo_*_id` back-references on customers/invoices/payments are **kept** (so re-connecting won't re-push already-synced records).
- **end_state:** Not connected.
- **failure_modes:** none surfaced.
- **parity:** MATCH, both DELETE the connection and reset to not-connected. Copy matches ("data remains in QBO, no longer syncs").
- **status:** OK
- **status_note:** No token revocation call to Intuit, just drops the local row.

### `integrations.stripe-placeholder`
- **label:** Stripe (coming soon)
- **section:** manage
- **actors:** owner, admin
- **purpose:** Placeholder for a future Stripe integration.
- **visibility:** greyed-out card on both surfaces.
- **route_chain:**, (no handler; not clickable)
- **request_body:** n/a
- **side_effects:** none.
- **end_state:** n/a
- **failure_modes:** none, it does nothing.
- **parity:** dead, purely a "Coming soon" disabled card on web and Android; no backend, no action.
- **status:** DEAD
- **status_note:** Visual placeholder only.

### `integrations.back`
- **label:** Back
- **section:** nav
- **actors:** owner, admin
- **purpose:** Leave Integrations.
- **visibility:** top-left.
- **route_chain:** web `navigate(-1)`; Android `onBack`
- **request_body:** n/a
- **side_effects:** none.
- **end_state:** Previous screen.
- **failure_modes:** none.
- **parity:** MATCH, note web uses `navigate(-1)` (history back) here, not a hard `/settings` route like the other sub-pages.
- **status:** OK
- **status_note:** n/a
---

## SCREEN-LEVEL DRIFT FLAGS

- **Two token tables; the code uses the out-of-band one.** `schema.sql:499` defines a generic `integration_tokens(company_id, service, access_token, refresh_token, realm_id, expires_at, metadata, active)`, but `quickbooks.js` reads/writes **`qbo_connections`** (columns `realm_id, access_token, refresh_token, token_expires_at, environment, company_name`), a different table whose DDL is **not in committed `db/`**. `integration_tokens` appears unused by the QBO route (UNVERIFIED whether anything else uses it).
- **One-way push only.** Sync creates QBO Customers/Invoices/Payments and back-fills local `qbo_*_id`; nothing is pulled from QBO. Edits made in QBO never flow back.
- **Items/products are not synced.** Invoice lines all reference a hard-coded QBO `ItemRef {value:'1', name:'Services'}`; there is no item-sync endpoint. Payments use a hard-coded `PaymentMethodRef {value:'1'}` and aren't applied to a specific invoice.
- **Android OAuth doesn't return to the app.** The callback `redirect_uri` is hard-wired to `FRONTEND_URL` (the website), so connecting from Android opens an external browser and lands on the web page; the Android screen reflects "Connected" only on its next status load. No deep link.
- **Sync is batched at 100/run.** Each entity sync is `LIMIT 100` and only processes un-synced rows, so large datasets need repeated runs; the UI doesn't indicate "more remaining".
- **Disconnect doesn't revoke at Intuit.** It only deletes the local `qbo_connections` row; the token isn't revoked with QBO, and local `qbo_*_id` markers persist (intended, to avoid duplicate re-pushes on reconnect).
- **`PUT /settings` (environment toggle) has no UI.** The route exists to switch sandbox/production, but neither web nor Android exposes it; `environment` is fixed to `'production'` by the callback.
