# Screen Map, Network (Partners)

> **Format:** Action-Map Schema v1. Source of truth; the HTML atlas is rendered from it.
> When code changes this screen, update this file in the same commit. Reality on disk wins.

---

## SCREEN

| Field | Value |
|---|---|
| `screen_id` | `network` |
| `display_name` | Network (Partners) |
| `surfaces` | android, web |
| `route_android` | `network` → `NetworkListScreen`; `network/{connectionId}` → `NetworkDetailScreen`; `network/{connectionId}/report` → `PartnerReportScreen` (NetworkScreens.kt) |
| `route_web` | `/network` → `Network` (Network.jsx, 599 lines; detail is an in-page modal) |
| `primary_actors` | owner, admin |
| `purpose` | The contractor-network hub: share your UCM ID, find/invite partners, accept/decline invites, negotiate a bilateral revenue-split agreement (`sender_keeps_pct` + `receiver_keeps_pct` = 100), pause partnerships, and run/send a per-partner revenue report. |
| `last_verified` | 2026-06-07 · Tier 3 Batch 1: web connection accept/decline wired (Network detail modal, recipient-only) → `networkApi.respond` → `PUT /network/connections/:id/respond`; mirrors Android. Agreement respond was already working. Prior: 2026-05-31 Stage-1 audit, 79940c8. |

### load_sequence
`GET /network/my-id` (your UCM id) + `GET /network/connections` (list). Detail: `GET /network/connections/:id` + `GET /network/agreements/:connection_id`.

### entry_points
- Both: More/Settings → Network. Jobs are forwarded to partners via Job-Detail "Send To" (uses the active agreement's split on completion).

---

## ACTIONS

---

### `network.my-ucm-id`
- **label:** Your UCM ID (copy)
- **section:** connect
- **actors:** owner, admin
- **purpose:** Share your `ultimatecrm_id` so partners can find you.
- **visibility:** always
- **precondition:** n/a
- **confirm:** n/a
- **route_chain:** `GET /network/my-id`
- **request_body:** n/a
- **side_effects:** clipboard copy.
- **end_state:** UCM id copied.
- **failure_modes:** none.
- **parity:** MATCH
- **status:** OK
- **status_note:** n/a
### `network.search-connect`
- **label:** Find a Contractor → Search + Connect
- **section:** connect
- **actors:** owner, admin
- **purpose:** Find a company by phone / email / UCM ID and send a connection invite.
- **visibility:** always
- **precondition:** a search value.
- **confirm:** n/a
- **route_chain:** `GET /network/search?q&type` → `POST /network/connections/invite`
- **request_body:** invite `{ search_value, search_type }` (`search_type` ∈ phone | email | ultimatecrm_id)
- **side_effects:** inserts a `contractor_connections` row (status `pending`, canonical company_a/company_b ordering by UUID); re-invites a previously `declined` connection.
- **end_state:** Invite sent.
- **failure_modes:** `404` no company with that field; `400` invite-yourself; `409` connection already exists (non-declined).
- **parity:** MATCH, both search by the three key types and invite.
- **status:** OK
- **status_note:** n/a
### `network.connection-respond`
- **label:** Accept / Decline a connection invite
- **section:** connect
- **actors:** owner, admin (the invitee)
- **purpose:** Respond to an incoming partnership invite.
- **visibility:** Both — Android NetworkDetailScreen + web Network detail modal (Accept/Decline, shown to the non-inviting recipient). _(2026-06-07: web wired — was Android-only.)_
- **precondition:** connection `status='pending'` and you are NOT the inviter.
- **confirm:** n/a
- **route_chain:** `PUT /network/connections/:id/respond`
- **request_body:** `{ action }` (accept | decline)
- **side_effects:** status → `active` (accept) or `declined` (decline); 403 if the inviting party tries to respond.
- **end_state:** Connection active/declined.
- **failure_modes:** `403` inviter responding to own invite; `400` not pending.
- **parity:** ANDROID-ONLY, the endpoint exists, but the web Network screen never calls it (only responds to *agreements*, not *connections*). A web-only company can't accept an incoming invite from this screen.
- **status:** OK
- **status_note:** Real web gap, see drift flags.

### `network.pause`
- **label:** Pause / Resume Partnership
- **section:** connect
- **actors:** owner, admin
- **purpose:** Toggle a partnership between active and paused.
- **visibility:** detail (web "Pause Partnership"; Android pause).
- **precondition:** status ∈ active | paused.
- **confirm:** web confirm view.
- **route_chain:** `PUT /network/connections/:id/pause`
- **request_body:** none
- **side_effects:** toggles status active↔paused.
- **end_state:** Partnership paused/resumed.
- **failure_modes:** `400` if not active/paused.
- **parity:** MATCH
- **status:** OK
- **status_note:** n/a
### `network.agreement-propose`
- **label:** Propose Agreement (revenue split)
- **section:** agreement
- **actors:** owner, admin
- **purpose:** Propose the bilateral revenue split + who gets reviews.
- **visibility:** detail, when no active/pending agreement (web) / always (Android).
- **precondition:** connection `status='active'`.
- **confirm:** propose form (your % + reviews-go-to + notes).
- **route_chain:** `POST /network/agreements`
- **request_body:** `{ connection_id, sender_keeps_pct, receiver_keeps_pct, review_goes_to, notes }`, web computes `receiver_keeps_pct = 100 − sender`.
- **side_effects:** **validates `sender_keeps_pct + receiver_keeps_pct == 100`** (else 400); auto-declines any existing `pending` agreement; inserts a `contractor_agreements` row (status `pending`). These `sender_keeps_pct`/`receiver_keeps_pct` are exactly what the Job-Complete partner split applies to `net`.
- **end_state:** Agreement proposed.
- **failure_modes:** `400` pct sum ≠ 100; `400` connection not active.
- **parity:** MATCH, both propose with a bilateral split + `review_goes_to` ∈ sender|receiver|both.
- **status:** OK
- **status_note:** n/a
### `network.agreement-respond`
- **label:** Accept / Decline an agreement
- **section:** agreement
- **actors:** owner, admin
- **purpose:** Respond to a pending revenue-split proposal.
- **visibility:** detail, when a `pending` agreement exists.
- **precondition:** n/a
- **confirm:** n/a
- **route_chain:** `PUT /network/agreements/:id/respond`
- **request_body:** `{ action }` (accept | decline; Android also supports counter)
- **side_effects:** sets the agreement `accepted`/`declined`; an accepted agreement becomes the active split used on partner-job completion.
- **end_state:** Agreement accepted/declined.
- **failure_modes:** none observed.
- **parity:** MATCH, both accept/decline; Android additionally can counter.
- **status:** OK
- **status_note:** n/a
### `network.partner-report-view`
- **label:** View Report (run partner report)
- **section:** report
- **actors:** owner, admin
- **purpose:** Per-partner revenue/earnings over a date range.
- **visibility:** detail "View Report" (web) / `PartnerReportScreen` (Android).
- **precondition:** n/a
- **confirm:** n/a
- **route_chain:** `GET /network/connections/:id/report?date_from&date_to`
- **request_body:** n/a
- **side_effects:** read-only (jobs + sender/receiver earnings + totals).
- **end_state:** Report shown.
- **failure_modes:** none.
- **parity:** MATCH, both run the connection report.
- **status:** OK
- **status_note:** n/a
### `network.partner-report-send`
- **label:** Send Partner Report
- **section:** report
- **actors:** owner, admin
- **purpose:** Email a partner their revenue report (PDF).
- **visibility:** Android `PartnerReportScreen` ("Send Report"). **On web, partner-report send lives in the Reports module's Partners tab**, not the Network screen.
- **precondition:** n/a
- **confirm:** send dialog.
- **route_chain:** `POST /network/connections/:id/report/send`
- **request_body:** `{ date_from, date_to, recipient_email? }`
- **side_effects:** emails a PDF to the office (+ optional partner).
- **end_state:** Report sent.
- **failure_modes:** none observed.
- **parity:** ANDROID-ONLY (on this screen), web's Network detail only has "View Report"; web sends partner reports from `/reports` (Partners tab).
- **status:** OK
- **status_note:** n/a
---

## SCREEN-LEVEL DRIFT FLAGS

- ~~**Web can't accept/decline a connection invite**~~ **FIXED 2026-06-07** — the web Network detail modal now shows Accept/Decline for an incoming connection request (recipient only, gated `invited_by !== company.id`) → `networkApi.respond` → `PUT /network/connections/:id/respond`. Mirrors Android; agreement respond was already wired.
- **Partner-report send is split by surface**, Android sends from the Network screen (`PartnerReportScreen`); web sends from the Reports module's Partners tab (same `POST /network/connections/:id/report/send`).
- **Bilateral split is enforced server-side**, `sender_keeps_pct + receiver_keeps_pct` must equal 100; proposing auto-declines the prior pending agreement; the accepted split is the one Job-Complete applies to partner `net`.
- **Web detail is a modal; Android uses dedicated screens** (NetworkDetailScreen + PartnerReportScreen).
- **UNVERIFIED:** Android counter-offer body shape on `agreement-respond`; whether any web notification path lets a web user accept a connection invite outside this screen.

### P2.31a — Update A receiver-side (built 2026-07-09; spec: backend/specs/P2.31a-update-a.md)
The partner RECEIVER-side flow now functions end-to-end (was largely unbuilt/broken):
- **SEND FIX:** `POST /jobs/:id/send-to-partner` filtered the agreement by `status='active'` (never a valid agreement status → every send 400'd); now `status='accepted'`. `partner_status` is set NULL at send (was 'pending').
- **RECEIVER can act on a shared job** — `PUT /jobs/:id` (edit) + `POST /invoices/:id/payment` are reachable by the receiver (`sent_to_company_id`), gated by the sender's `tech_permissions`: `edit_details` OFF → 403, `collect_payments` OFF → 403. Sender is never gated; a third company 404s.
- **7 per-job tech toggles** (`jobs.tech_permissions`, set at send): add_notes, collect_payments, take_photos, add_parts, edit_details, cancel_job, **view_history** (Job History tab visibility — UI-gated, role-scoped). Backend-enforced today: edit_details + collect_payments.
- **Confirm/dispute (Job Detail, sender banner):** a receiver's `/complete` lands as `jobs.partner_status` (the proposed status), NOT the real status; the sender's Job Detail shows **Confirm/Dispute** when `partner_status` is non-NULL. `POST /:id/confirm-partner-status {action}` — CONFIRM applies partner_status→real status + clears + confirms the settlement `cd` (so `/reports/partner` surfaces it); DISPUTE clears + appends a note, real status unchanged.
- **Settlement** (`/reports/partner`) mirrors both companies to the cent (e.g. 60/40 net 870 → sender 507 / receiver 333; balance ∓333). Verified via partner_receiver_p231a.test.js (9) + real-surface E2E.
- FILED P2.33: `edit_details` currently grants full-field receiver write (incl. money-override fields) — David to rule on field granularity.
