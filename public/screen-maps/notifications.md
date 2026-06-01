# Screen Map, Notifications (settings sub-page)

> **Format:** Action-Map Schema v1. Source of truth; the HTML atlas is rendered from it.
> When code changes this screen, update this file in the same commit. Reality on disk wins.
> **Scope:** the **Settings sub-page** at `/settings/notifications` (notification *preferences*), NOT the in-app notification *feed* (`NotificationsPage` at `/notifications`, a separate screen).

---

## SCREEN

| Field | Value |
|---|---|
| `screen_id` | `notifications` |
| `display_name` | Notifications (preferences) |
| `surfaces` | web (sub-page); android (inline on Settings landing, no sub-page) |
| `route_android` | none, Android shows these toggles inline on the "More"/Settings landing (device-local `NotificationPreferences`); there is no dedicated Android screen |
| `route_web` | `/settings/notifications` → `Notifications` (Notifications.jsx, 81 lines) |
| `manages_table` | **none**, web persists to `localStorage` (`up_notification_prefs`); Android persists to local `NotificationPreferences`. No server table. |
| `primary_actors` | owner, admin, office |
| `purpose` | Toggle which app notifications you want: New Jobs, Job Status Updates, Partner Jobs, New Bookings, Estimate Signed. **Entirely device-local on both surfaces, nothing is server-synced, and on web nothing actually reads the saved value.** |
| `last_verified` | 2026-05-31 · Stage-1 read-only audit · commit: 6147cd1 |

### persistence (the whole story)
- **Web:** the page reads/writes `localStorage['up_notification_prefs']` directly. It **never calls the API**. The footer even says "Preferences are saved on this device."
- **Backend:** `GET /settings/notifications` returns a **hard-coded all-true object** (no table read); `PUT /settings/notifications` **echoes the request body and persists nothing** (no DB write). These are stub endpoints, and the web page doesn't call them.
- **Consumer:** `up_notification_prefs` is referenced **only inside Notifications.jsx** (write + read-on-mount). No other web code reads it, so toggling a preference changes a localStorage value that nothing acts on.

### entry_points
- Web: Settings → "Notifications" (`/settings/notifications`).
- Android: "More"/Settings landing → inline "Notifications" toggles (no navigation to a sub-page).

---

## ACTIONS

---

### `notifications.load-prefs`
- **label:** Load preferences
- **section:** prefs
- **actors:** owner, admin, office
- **purpose:** Show the five toggle states.
- **visibility:** on open.
- **route_chain:**, (reads `localStorage['up_notification_prefs']`; defaults all-true)
- **request_body:** n/a
- **side_effects:** none (local read).
- **end_state:** Five toggles rendered.
- **failure_modes:** falls back to defaults (all true) if localStorage is empty/corrupt.
- **parity:** DIVERGENT, web reads from `localStorage` on a dedicated sub-page; Android reads inline toggle states from its local `NotificationPreferences` on the Settings landing. Same five concepts, different surface + different local store.
- **status:** OK
- **status_note:** Local read works; it just isn't backed by a server.

### `notifications.toggle-pref`
- **label:** Toggle a preference (×5)
- **section:** prefs
- **actors:** owner, admin, office
- **purpose:** Turn New Jobs / Job Status / Partner Jobs / New Bookings / Estimate Signed on or off.
- **visibility:** five switches.
- **precondition:** n/a
- **confirm:** n/a
- **route_chain:**, (writes `localStorage['up_notification_prefs']`; shows "Saved"). **No API call.**
- **request_body:** n/a
- **side_effects:** updates the localStorage object only.
- **end_state:** Toggle flipped, "Saved" snackbar.
- **failure_modes:** the saved value **gates nothing**, no other code reads `up_notification_prefs`, and it's never sent to the server, so it cannot affect server-pushed (FCM) notifications.
- **parity:** DIVERGENT, web writes `up_notification_prefs` (localStorage); Android writes its local `NotificationPreferences`. Neither is server-synced; the web value has no consumer at all.
- **status:** PARTIAL
- **status_note:** The toggle saves locally (so it "works" mechanically) but achieves nothing functional, write-only preference, no server effect, no client consumer on web.

### `notifications.server-endpoints`
- **label:** Backend notif-prefs endpoints (stub)
- **section:** backend
- **actors:**, (system)
- **purpose:** Nominal server API for notification preferences.
- **visibility:** not user-facing.
- **route_chain:** `GET /settings/notifications` (returns hard-coded all-true), `PUT /settings/notifications` (echoes body, no write)
- **request_body:** PUT `{new_jobs, job_status, partner_jobs, new_bookings, estimate_signed}` → echoed back unchanged
- **side_effects:** **none**, no table, no persistence.
- **end_state:** A response that looks like settings but stores nothing.
- **failure_modes:** any client relying on these to persist would silently lose data (GET always returns all-true regardless of input).
- **parity:** dead, the web page never calls them; Android uses device-local `NotificationPreferences`. No audited client uses these routes, and they don't persist.
- **status:** DEAD
- **status_note:** Stub endpoints (no table). UNVERIFIED whether any unaudited caller hits them, but neither this web page nor the Android landing does.

### `notifications.back`
- **label:** Back
- **section:** nav
- **actors:** owner, admin, office
- **purpose:** Return to Settings.
- **visibility:** top-left.
- **route_chain:** web `navigate('/settings')`; Android, n/a (inline, no sub-page)
- **request_body:** n/a
- **side_effects:** none.
- **end_state:** Settings landing.
- **failure_modes:** none.
- **parity:** WEB-ONLY (as a back action), Android has no sub-page to back out of.
- **status:** OK
- **status_note:** n/a
---

## SCREEN-LEVEL DRIFT FLAGS

- **Fully device-local; nothing is server-synced.** Web saves to `localStorage['up_notification_prefs']`; Android saves to local `NotificationPreferences`. Switching devices or reinstalling loses the settings, and the server has no record of them.
- **The web toggles are inert.** `up_notification_prefs` is read **only** by the page that writes it (to re-render its own switches). No other web code consults it, and it's never sent to the server, so toggling "New Jobs" off does **not** stop New-Job notifications. It's effectively a placeholder UI.
- **The backend endpoints are no-op stubs.** `GET /settings/notifications` returns a constant all-true object; `PUT` echoes the body without writing. There is no `notification_preferences` table. Any future client that trusts these will silently lose its settings.
- **Surface mismatch (matches the Batch-D finding).** Web has a dedicated sub-page; Android has no sub-page and instead shows the same five toggles inline on the Settings landing. Both are device-local.
- **Five keys, consistent labels:** `new_jobs` (New Jobs), `job_status` (Job Status Updates), `partner_jobs` (Partner Jobs), `new_bookings` (New Bookings), `estimate_signed` (Estimate Signed), the same set the Android landing toggles use.
