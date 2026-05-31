# Screen Map — Phone / SMS Hub

> **Format:** Action-Map Schema v1. Source of truth; the HTML atlas is rendered from it.
> When code changes this screen, update this file in the same commit. Reality on disk wins.

---

## SCREEN

| Field | Value |
|---|---|
| `screen_id` | `phone` |
| `display_name` | Phone / SMS Hub |
| `surfaces` | android, web |
| `route_android` | `phone` → `PhoneScreen`; `phone/second-chance` → `SecondChanceScreen`; `phone/queue` → `LiveQueueScreen` (PhoneScreens.kt) |
| `route_web` | `/phone` → `Phone` (Phone.jsx, 117 lines) |
| `primary_actors` | office (CSR), owner |
| `purpose` | The call/SMS command center. Web is a thin 2-tab list (SMS conversations + call log). Android is a 4-tab hub (Call Log with click-to-call / Messages / CSR Stats / Numbers) plus two dedicated screens — Second-Chance lead recovery and the Live Queue. |
| `last_verified` | 2026-05-31 · Stage-1 read-only audit · commit: 6147cd1 |

### load_sequence
**Web:** Messages tab `GET /sms/conversations` (auto-refresh 60 s); Calls tab `GET /phone/calls`. **Android:** Call-Log `GET /phone/calls`; Messages `GET /sms/conversations`; CSR Stats `GET /phone/csr-stats`; Numbers `GET /phone/numbers`; the Second-Chance banner reads `GET /phone/second-chance`.

### entry_points
- Both: bottom-nav "Phone" tab. Dashboard 2nd-chance banner + Missed-Calls / 2nd-Chance KPI tiles navigate here.

---

## ACTIONS

---

### `phone.conversations-list`
- **label:** Messages (SMS conversations)
- **section:** hub
- **actors:** office, owner
- **purpose:** List SMS conversations and open a thread.
- **visibility:** web Messages tab (default); Android Messages tab.
- **precondition:** —
- **confirm:** —
- **route_chain:** `GET /sms/conversations` → row navigates to the thread (`/phone/thread/:id` web; `SmsThreadScreen` Android)
- **request_body:** —
- **side_effects:** read-only (returns conversations with `last_message`, `unread_count`).
- **end_state:** Conversation list / thread.
- **failure_modes:** none.
- **parity:** MATCH — both list conversations and open a thread. (Web auto-refreshes every 60 s.)
- **status:** OK
- **status_note:** `/sms/conversations` rows carry the real `conversation_id` (unlike the bare-array job/customer message endpoints).

### `phone.call-log`
- **label:** Calls / Call Log
- **section:** hub
- **actors:** office, owner
- **purpose:** Review inbound/outbound call history.
- **visibility:** web Calls tab; Android Call-Log tab (default).
- **precondition:** —
- **confirm:** —
- **route_chain:** `GET /phone/calls` (Android call rows add a tel: dial intent on "Call back")
- **request_body:** —
- **side_effects:** read-only; Android call-back opens the dialer (no server call).
- **end_state:** Call log; Android can dial back.
- **failure_modes:** none.
- **parity:** PARTIAL — same endpoint; Android adds click-to-call (dial intent) + richer rows (source tag, disposition, duration); web is display-only.
- **status:** OK
- **status_note:** —

### `phone.csr-stats`
- **label:** CSR Stats
- **section:** hub
- **actors:** owner, manager
- **purpose:** Per-CSR call + booking-rate stats.
- **visibility:** Android CSR-Stats tab only.
- **precondition:** —
- **confirm:** —
- **route_chain:** `GET /phone/csr-stats`
- **request_body:** —
- **side_effects:** read-only.
- **end_state:** Per-CSR cards (calls / booked / booking-rate %).
- **failure_modes:** none.
- **parity:** ANDROID-ONLY — web has no CSR stats tab.
- **status:** OK
- **status_note:** —

### `phone.numbers`
- **label:** Numbers (company VoIP lines)
- **section:** hub
- **actors:** owner
- **purpose:** List configured phone numbers + source tags.
- **visibility:** Android Numbers tab only.
- **precondition:** —
- **confirm:** —
- **route_chain:** `GET /phone/numbers`
- **request_body:** —
- **side_effects:** read-only.
- **end_state:** Number list (active/inactive + source tag).
- **failure_modes:** none.
- **parity:** ANDROID-ONLY — web has no Numbers tab.
- **status:** OK
- **status_note:** —

### `phone.second-chance`
- **label:** Second-Chance Leads (banner → screen)
- **section:** lead-recovery
- **actors:** office, owner
- **purpose:** Recover unbooked/missed callers: call back, book, mark lost, or text.
- **visibility:** Android banner (when `total > 0`) → `SecondChanceScreen`. **Web has no Second-Chance screen.**
- **precondition:** —
- **confirm:** —
- **route_chain:** `GET /phone/second-chance` (list + stats) ; per-lead: Call Back → dial + `PUT /phone/second-chance/:id` (status `called_back`), Book → `PUT … {status:'booked'}`, Lost → `PUT … {status:'lost'}`, Send SMS → `POST /phone/second-chance/:id/sms`
- **request_body:** status update `{ status }`
- **side_effects:** updates `second_chance_leads.status`; the SMS endpoint texts the caller.
- **end_state:** Lead advanced through New → Called → Booked / Lost.
- **failure_modes:** none observed.
- **parity:** ANDROID-ONLY — the whole lead-recovery flow (and its tabs New/Called/Booked/Lost) is Android-only.
- **status:** OK
- **status_note:** Confirms the earlier batch flag: Second-Chance is Android-only.

### `phone.live-queue`
- **label:** Live Queue
- **section:** lead-recovery
- **actors:** office, owner
- **purpose:** See live/active calls in real time.
- **visibility:** Android top-bar "Live Queue" icon → `LiveQueueScreen`. **Web has no Live Queue.**
- **precondition:** —
- **confirm:** —
- **route_chain:** `GET /phone/live-queue`
- **request_body:** —
- **side_effects:** read-only (live call state from `active_calls`).
- **end_state:** Live call list.
- **failure_modes:** none.
- **parity:** ANDROID-ONLY — confirms the earlier batch flag: Live Queue is Android-only.
- **status:** OK
- **status_note:** —

### `phone.refresh`
- **label:** Refresh
- **section:** nav
- **actors:** office, owner
- **purpose:** Re-pull the active tab.
- **visibility:** always
- **precondition:** —
- **confirm:** —
- **route_chain:** re-issues the active tab's GET
- **request_body:** —
- **side_effects:** `read-refresh`
- **end_state:** Fresh data.
- **failure_modes:** none.
- **parity:** MATCH — both have a refresh; web also auto-refreshes conversations every 60 s.
- **status:** OK
- **status_note:** —

---

## SCREEN-LEVEL DRIFT FLAGS

- **Web Phone is a thin 2-tab list** (SMS conversations + call log, both read-only). Android adds **CSR Stats**, **Numbers**, **click-to-call** on the call log, **Second-Chance lead recovery**, and the **Live Queue** — all Android-only.
- **Second-Chance and Live Queue are Android-only** (confirmed) — there are no `/phone/second-chance` or `/phone/queue` web routes.
- **No dialer/campaign UI in the hub** — the backend has power-dialer endpoints (`/phone/dialer/campaign`, `/phone/dialer/:id/dial-next`) but neither the web Phone page nor the Android `PhoneScreen` read this pass surfaces a dialer; **UNVERIFIED** whether any unread screen does.
- **UNVERIFIED:** `LiveQueueScreen` internals (coaching/barge actions like `POST /phone/coaching/join`, `POST /phone/mask`); the `second_chance` status enum beyond new/called_back/booked/lost.
