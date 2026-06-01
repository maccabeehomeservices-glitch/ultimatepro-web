# Screen Map, Customer Detail

> **Format:** Action-Map Schema v1. Source of truth; the HTML atlas is rendered from it.
> When code changes this screen, update this file in the same commit. Reality on disk wins.

---

## SCREEN

| Field | Value |
|---|---|
| `screen_id` | `customer-detail` |
| `display_name` | Customer Detail |
| `surfaces` | android, web |
| `route_android` | `customers/{id}` → `CustomerDetailScreen` (CustomerScreens.kt 371–748) |
| `route_web` | `/customers/:id` → `CustomerDetail` (CustomerDetail.jsx, 652 lines) |
| `primary_actors` | office, owner |
| `purpose` | The 360° view of one customer: stats, contact methods (+ add/delete phones/emails), address/navigate, memberships, notes, the customer portal link, and their jobs / estimates / invoices / messages. Web splits the entities into four tabs; Android shows Details + Messages (jobs inline). |
| `last_verified` | 2026-05-31 · Phase 0 [SMS-CONV] messaging fix · commit: 6d11289 |

### load_sequence
**Web:** `GET /customers/:id`, `GET /customers/:id/stats`, `GET /customers/:id/contacts`, `GET /memberships/customer/:id`, `GET /memberships/plans`; per-tab: `GET /jobs?customer_id=`, `GET /estimates?customer_id=`, `GET /invoices?customer_id=`, `GET /sms/customer/:id/messages`. **Android:** `loadCustomer`, `loadContacts`, `loadCustomerJobs`, `loadCustomerMemberships`, `loadPlans` on RESUME; `loadCustomerMessages` on the Messages tab. **Note:** this screen does **not** call `/customers/:id/history`, it uses `/stats` + per-entity `?customer_id=` queries. (`/history` is the Job-Detail history source.)

### entry_points
- Both: Customers list row; Dashboard memberships-due-soon row; anywhere linking `/customers/:id`.

---

## ACTIONS

---

### `customer-detail.back`
- **label:** Back
- **section:** header
- **actors:** office, owner
- **purpose:** Leave the customer.
- **visibility:** always
- **precondition:** n/a
- **confirm:** n/a
- **route_chain:** none (navigate)
- **request_body:** n/a
- **side_effects:** `navigate`
- **end_state:** Previous screen.
- **failure_modes:** none.
- **parity:** MATCH
- **status:** OK
- **status_note:** n/a
### `customer-detail.edit`
- **label:** Edit (pencil)
- **section:** header
- **actors:** office, owner
- **purpose:** Open the customer edit form.
- **visibility:** always
- **precondition:** n/a
- **confirm:** n/a
- **route_chain:** navigate `/customers/:id/edit`
- **request_body:** n/a
- **side_effects:** `navigate`
- **end_state:** Customer edit form.
- **failure_modes:** none.
- **parity:** MATCH
- **status:** OK
- **status_note:** n/a
### `customer-detail.add-job`
- **label:** Add Job (+)
- **section:** header
- **actors:** office, owner
- **purpose:** Create a new job pre-linked to this customer.
- **visibility:** always (header) + the Jobs-tab empty-state "Add Job" (web).
- **precondition:** n/a
- **confirm:** n/a
- **route_chain:** navigate `/jobs/new` with `state.customer = {id, name}` (web) / `onNewJob` (Android)
- **request_body:** n/a
- **side_effects:** `navigate`
- **end_state:** New Job form, customer pre-filled.
- **failure_modes:** none.
- **parity:** MATCH, both create a customer-scoped new job.
- **status:** OK
- **status_note:** n/a
### `customer-detail.delete`
- **label:** Delete Customer
- **section:** header
- **actors:** office, owner
- **purpose:** Delete the customer.
- **visibility:** web trash icon; Android overflow menu.
- **precondition:** n/a
- **confirm:** modal (web) / overflow → confirm dialog (Android).
- **route_chain:** `DELETE /customers/:id`
- **request_body:** n/a
- **side_effects:** deletes the customer; web → `/customers`, Android → `onDeleted`.
- **end_state:** Back to customers list.
- **failure_modes:** none observed.
- **parity:** MATCH
- **status:** OK
- **status_note:** n/a
### `customer-detail.stats`
- **label:** Stats cards (Total Jobs / Revenue / Open Estimates / Outstanding)
- **section:** stats
- **actors:** office, owner
- **purpose:** At-a-glance customer value.
- **visibility:** web only, when stats loaded.
- **precondition:** n/a
- **confirm:** n/a
- **route_chain:** `GET /customers/:id/stats`
- **request_body:** n/a
- **side_effects:** read-only.
- **end_state:** Stat tiles.
- **failure_modes:** none.
- **parity:** WEB-ONLY, Android's CustomerDetail does not load `/customers/:id/stats` (no stats tiles in the read range).
- **status:** OK
- **status_note:** n/a
### `customer-detail.contacts`
- **label:** Contacts, add/delete phones+emails, call, email
- **section:** contacts
- **actors:** office, owner
- **purpose:** Manage and use the customer's contact methods.
- **visibility:** always.
- **precondition:** n/a
- **confirm:** n/a
- **route_chain:** add `POST /customers/:id/contacts {type, value, label}`; delete `DELETE /customers/contacts/:contactId`; call `tel:` / email `mailto:` (device intents); navigate address → maps.
- **request_body:** add `{ type, value, label }`
- **side_effects:** inserts/removes a `customer_contacts` row.
- **end_state:** Contact added/removed; dialer/email/maps opened.
- **failure_modes:** none observed.
- **parity:** MATCH, both add/delete phone+email contacts and open tel/mailto/maps. (web extras: paste-multiple splits on `,/;\n` to add several at once.)
- **status:** OK
- **status_note:** n/a
### `customer-detail.notes-edit`
- **label:** Notes (editable)
- **section:** notes
- **actors:** office, owner
- **purpose:** Keep free-text notes on the customer.
- **visibility:** web: editable textarea (autosave on blur). Android: notes shown **read-only**.
- **precondition:** n/a
- **confirm:** n/a
- **route_chain:** `PUT /customers/:id` with `{ ...customer, notes }` (web, on blur when changed)
- **request_body:** the full customer object + `notes`
- **side_effects:** updates `customers.notes`.
- **end_state:** Notes saved.
- **failure_modes:** none observed.
- **parity:** WEB-ONLY, Android only displays notes; there's no edit on the Android detail screen (edit happens in the Edit form).
- **status:** OK
- **status_note:** Web sends the whole customer row back on every notes save.

### `customer-detail.memberships`
- **label:** Memberships (+ Add)
- **section:** memberships
- **actors:** office, owner
- **purpose:** View and assign membership plans.
- **visibility:** always (card with "Add").
- **precondition:** plans exist.
- **confirm:** add modal (web).
- **route_chain:** list `GET /memberships/customer/:id` + `GET /memberships/plans`; add `POST /memberships/customer/:id {plan_id, start_date}`
- **request_body:** add `{ plan_id, start_date }`
- **side_effects:** inserts a `customer_memberships` row.
- **end_state:** Membership assigned.
- **failure_modes:** none observed.
- **parity:** MATCH (web verified), Android loads memberships + plans too; its add UI lives lower in the Details list (**add interaction UNVERIFIED** in the read range, but the loads are present).
- **status:** OK
- **status_note:** n/a
### `customer-detail.portal`
- **label:** Customer Portal, Copy / Share / Open
- **section:** portal
- **actors:** office, owner
- **purpose:** Share the magic-link portal where the customer can view/approve/pay.
- **visibility:** when `portal_token` exists.
- **precondition:** customer has a `portal_token`.
- **confirm:** n/a
- **route_chain:** builds `{serverRoot}/portal/:token`; Copy (clipboard) / Share (native share) / Open (web only, new tab).
- **request_body:** n/a
- **side_effects:** none (clipboard / share sheet).
- **end_state:** Link copied/shared/opened.
- **failure_modes:** none.
- **parity:** MATCH, both Copy + Share; web additionally has an "Open Portal" link.
- **status:** OK
- **status_note:** n/a
### `customer-detail.entity-tabs`
- **label:** Jobs / Estimates / Invoices tabs
- **section:** tabs
- **actors:** office, owner
- **purpose:** Browse the customer's jobs, estimates, and invoices, and open each.
- **visibility:** web: four tabs (Jobs / Estimates / Invoices / Messages). Android: two tabs (Details / Messages), jobs render inside Details; **no estimates/invoices tabs**.
- **precondition:** n/a
- **confirm:** n/a
- **route_chain:** web per-tab `GET /jobs?customer_id=`, `GET /estimates?customer_id=`, `GET /invoices?customer_id=`; rows → `/jobs/:id`, `/estimates/:id`, `/invoices/:id`.
- **request_body:** n/a
- **side_effects:** `navigate`
- **end_state:** Job / Estimate / Invoice detail.
- **failure_modes:** none.
- **parity:** DIVERGENT, web browses all three entity types in tabs; Android shows only jobs (in Details) and has no estimates/invoices lists on this screen.
- **status:** PARTIAL
- **status_note:** Estimates/Invoices browsing from the customer is web-only.

### `customer-detail.messages-send`
- **label:** Messages tab, view + send
- **section:** messages
- **actors:** office, owner
- **purpose:** See and reply to the SMS thread with this customer.
- **visibility:** Messages tab.
- **precondition:** an SMS conversation exists.
- **confirm:** n/a
- **route_chain:** load `GET /sms/customer/:id/messages`; send `POST /sms/conversations/:convId/send {message}`
- **request_body:** send `{ message }`
- **side_effects:** sends an SMS reply.
- **end_state:** web → message NOT sendable (see below); Android → opens the SMS thread screen.
- **failure_modes:** **fixed** (2026-05-31): web now derives `convId` from the first message object (`msgs[0]?.conversation_id`), mirroring Android `customerMessages.firstOrNull()?.conversationId`, so the send box enables and reply works once a thread exists. Starting a brand-new conversation (zero prior messages) is disabled on both web AND Android (parity-matched, pre-existing).
- **parity:** MATCH, both derive `conversationId`/`convId` from the message objects and reply to the existing thread; both disable send when there are zero prior messages.
- **status:** OK
- **status_note:** Phase 0 [SMS-CONV] (2026-05-31): web inline reply fixed (convId from first message object, like Android). Same fix as the Job-Detail messages tab. Empty-thread start remains disabled on both surfaces (parity-matched, not a regression).

---

## SCREEN-LEVEL DRIFT FLAGS

- **Web customer Messages can't send**, `/sms/customer/:id/messages` returns a bare array with no `conversation_id`, so web's `convId` is always null and the composer is hidden. Android reads `conversationId` off the messages and opens the thread. (Identical to the Job-Detail messages bug.)
- **Tab models diverge**, web has Jobs / Estimates / Invoices / Messages tabs; Android has Details + Messages (jobs inline, **no estimates/invoices tabs**).
- **Stats card + editable Notes are web-only**, Android doesn't load `/customers/:id/stats` here and shows notes read-only.
- **This screen does not use `/customers/:id/history`**, it loads `/stats` + per-entity `?customer_id=` queries. (`/history` is the Job-Detail source.)
- **UNVERIFIED:** Android's lower Details list (jobs list, membership add UI, address) at CustomerScreens.kt 600–748, loads are present (`loadCustomerJobs`, `loadCustomerMemberships`, `loadPlans`) but the exact add-membership interaction was not read; whether Android shows estimates/invoices anywhere.
