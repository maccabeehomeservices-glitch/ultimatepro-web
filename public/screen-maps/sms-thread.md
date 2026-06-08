# Screen Map, SMS Conversation Thread

> **Format:** Action-Map Schema v1. Source of truth; the HTML atlas is rendered from it.
> When code changes this screen, update this file in the same commit. Reality on disk wins.

---

## SCREEN

| Field | Value |
|---|---|
| `screen_id` | `sms-thread` |
| `display_name` | SMS Conversation Thread |
| `surfaces` | android, web |
| `route_android` | `SmsThreadScreen(conversationId)` (PhoneScreens.kt:691), reached from the Messages tab |
| `route_web` | `/phone/thread/:id` → `SmsThread` (SmsThread.jsx, 92 lines). **Also** registered at `/phone/sms/:id` (App.jsx:111) — both work (alias param fixed 2026-06-07). |
| `primary_actors` | office (CSR), owner |
| `purpose` | A one-to-one SMS thread with a customer: read the message history, send a reply via Twilio, and clear the unread badge. Reached by tapping a conversation row in the Phone → Messages list. |
| `last_verified` | 2026-06-07 · SMS thread fixes: **alias param** `/phone/sms/:conversationId` → `:id` (matches the component, was → `undefined` 404); **header name** — `GET /sms/conversations/:id/messages` now envelopes `{ conversation: {customer_name, phone_number}, messages }` so the header shows the contact name (web was forward-compatible; Android parser unwraps `.messages`, keeps its cached-name fallback). Embedded `/sms/job/:id` + `/sms/customer/:id` left as bare arrays (their callers handle it). Prior: 2026-05-31 Stage-1 audit, 6147cd1. |

### load_sequence
Both surfaces: `GET /sms/conversations/:id/messages` with the `conversation_id` taken from the route/selection, **not** re-derived, so this screen avoids the bare-array `conversation_id`-is-null bug that breaks send on the Job-Detail and Customer-Detail message tabs. The backend returns a **bare array** of messages (`res.json(messages)`) and, as a side effect, sets `unread_count = 0` on the conversation.

### entry_points
- Web: Phone → Messages tab, conversation row → `navigate('/phone/thread/' + id)` (Phone.jsx:67).
- Android: PhoneScreen Messages tab → conversation row → `SmsThreadScreen(conversationId)`.

---

## ACTIONS

---

### `sms-thread.load-messages`
- **label:** Load thread messages
- **section:** thread
- **actors:** office, owner
- **purpose:** Read the full message history for one conversation.
- **visibility:** on screen open.
- **precondition:** a valid `conversation_id` from the conversations list.
- **confirm:** n/a
- **route_chain:** `GET /sms/conversations/:id/messages` (returns a bare array, ordered `created_at ASC`)
- **request_body:** n/a
- **side_effects:** read; server marks the conversation read (see `mark-read`).
- **end_state:** Bubbles rendered (outbound right / inbound left); auto-scrolled to newest.
- **failure_modes:** 404 if the conversation isn't found / not in the company.
- **parity:** MATCH, web `useGet('/sms/conversations/'+id+'/messages')`; Android `repo.getConversationMessages(id)`. Same endpoint, same bare-array shape.
- **status:** OK
- **status_note:** The id comes from the route param (web) or the tapped list row (Android), this screen is the one place SMS send is wired correctly, because the conversation_id is real here.

### `sms-thread.send`
- **label:** Send reply
- **section:** thread
- **actors:** office, owner
- **purpose:** Send an outbound SMS to the customer.
- **visibility:** bottom input + send button; disabled while empty or sending.
- **precondition:** non-blank body.
- **confirm:** n/a
- **route_chain:** `POST /sms/conversations/:id/send` → Twilio `sendSMS(toNumber, message)` → insert outbound row → `UPDATE last_message_at`; client then refetches/append.
- **request_body:** `{ message }`, web `mutate('post', …, { message: body })`; Android `mapOf("message" to message)`.
- **side_effects:** sends a real SMS; inserts an `sms_messages` row (`direction:'outbound'`, `status:'delivered'`).
- **end_state:** Input cleared, new bubble appears after refetch.
- **failure_modes:** 400 if message blank; 404 if conversation not found; Twilio error → 500 ("Failed to send message").
- **parity:** MATCH, identical endpoint and body key on both surfaces.
- **status:** OK
- **status_note:** Body key `message` matches the backend (`const { message } = req.body`) on both surfaces.

### `sms-thread.mark-read`
- **label:** Mark conversation read
- **section:** thread
- **actors:** office, owner
- **purpose:** Clear the unread badge when the thread is opened.
- **visibility:** automatic (server side-effect of loading messages).
- **precondition:** n/a
- **confirm:** n/a
- **route_chain:** side effect of `GET /sms/conversations/:id/messages` → `UPDATE sms_conversations SET unread_count = 0`
- **request_body:** n/a
- **side_effects:** zeroes `unread_count` for the conversation.
- **end_state:** Conversation shows as read in the list on next load.
- **failure_modes:** none beyond the load itself.
- **parity:** MATCH, server-side; both surfaces trigger it by loading the thread.
- **status:** OK
- **status_note:** n/a
### `sms-thread.autoscroll`
- **label:** Auto-scroll to newest
- **section:** thread
- **actors:** office, owner
- **purpose:** Keep the latest message in view on load and after sending.
- **visibility:** automatic.
- **precondition:** n/a
- **confirm:** n/a
- **route_chain:**, (UI only)
- **request_body:** n/a
- **side_effects:** none.
- **end_state:** List pinned to the last bubble.
- **failure_modes:** none.
- **parity:** MATCH, web `bottomRef.scrollIntoView` on `messages.length`; Android `animateScrollToItem(lastIndex)` on `threadMessages.size`.
- **status:** OK
- **status_note:** n/a
### `sms-thread.header-name`
- **label:** Header (who you're texting)
- **section:** thread
- **actors:** office, owner
- **purpose:** Show the customer name / phone number at the top of the thread.
- **visibility:** top bar.
- **precondition:** the conversation object must be known.
- **confirm:** n/a
- **route_chain:**, (derived from already-loaded data, not a dedicated fetch)
- **request_body:** n/a
- **side_effects:** none.
- **end_state:** Name + phone, or a generic fallback.
- **failure_modes:** falls back to a placeholder when the conversation object is absent.
- **parity:** MATCH _(fixed 2026-06-07)_ — `GET /sms/conversations/:id/messages` now returns `{ conversation: {customer_name, phone_number, …}, messages }`. Web reads `data.conversation.customer_name` (it was already forward-compatible) → header shows the name. Android unwraps `.messages` and still shows the name from its cached conversation list. Pre-fix: the endpoint returned a bare array, so web always fell back to "Conversation".
- **status:** OK _(FIXED 2026-06-07)_
- **status_note:** Backend now envelopes the conversation with the messages; no client-side workaround needed.

### `sms-thread.back`
- **label:** Back
- **section:** nav
- **actors:** office, owner
- **purpose:** Return to the conversation list.
- **visibility:** top-left arrow.
- **precondition:** n/a
- **confirm:** n/a
- **route_chain:**, (web `navigate(-1)`; Android `onBack`)
- **request_body:** n/a
- **side_effects:** none.
- **end_state:** Back at Phone → Messages.
- **failure_modes:** none.
- **parity:** MATCH.
- **status:** OK
- **status_note:** n/a
### `sms-thread.open-via-sms-alias`
- **label:** Open via /phone/sms/:conversationId (web alias route)
- **section:** nav
- **actors:** office, owner
- **purpose:** Alternate URL that is also wired to this screen.
- **visibility:** web only; reachable by direct URL.
- **precondition:** n/a
- **confirm:** n/a
- **route_chain:** `/phone/sms/:id` → `SmsThread` (reads `useParams().id`) → `GET /sms/conversations/:id/messages`
- **request_body:** n/a
- **side_effects:** loads the thread.
- **end_state:** Thread loads.
- **failure_modes:** none _(fixed 2026-06-07)_ — the alias param was renamed `:conversationId` → `:id` to match the component + the canonical route. Pre-fix it fetched `/conversations/undefined/messages` (404).
- **parity:** MATCH _(both alias + canonical `/phone/thread/:id` work)_.
- **status:** OK _(FIXED 2026-06-07)_
- **status_note:** Dead alias. Fix = read `useParams().id ?? useParams().conversationId`, or change the route to `:id`. Nothing in the app links to this alias today, so it's latent.

---

## SCREEN-LEVEL DRIFT FLAGS

- **Web header never shows the contact name.** `SmsThread` expects `data.conversation`, but `/sms/conversations/:id/messages` returns a **bare array**, so the header always falls back to "Conversation". Android sidesteps this by pulling the conversation from the already-loaded list. Fix: have the endpoint return `{ conversation, messages }`, or have the web page look the conversation up from its own list.
- **Broken alias route `/phone/sms/:conversationId`** (App.jsx:111): the param is `conversationId` but the component reads `useParams().id` → `undefined` → `GET /sms/conversations/undefined/messages` 404. The live path `/phone/thread/:id` works. Latent (nothing links to it).
- **This is the correct SMS-send surface.** Unlike the Job-Detail / Customer-Detail message tabs (which read bare-array endpoints where `conversation_id` is never populated, breaking their inline send), the dedicated thread carries a real `conversation_id`, so `POST /sms/conversations/:id/send` succeeds here.
- **UNVERIFIED:** Twilio delivery status callbacks (the insert hard-codes `status:'delivered'`); whether inbound messages arrive via webhook into the same `sms_messages` table (not audited this pass).
