# Screen Map — Review Platforms

> **Format:** Action-Map Schema v1. Source of truth; the HTML atlas is rendered from it.
> When code changes this screen, update this file in the same commit. Reality on disk wins.

---

## SCREEN

| Field | Value |
|---|---|
| `screen_id` | `review-platforms` |
| `display_name` | Review Platforms |
| `surfaces` | android, web |
| `route_android` | `ReviewPlatformsScreen` + `ReviewPlatformViewModel` (ReviewPlatformsScreen.kt) |
| `route_web` | `/settings/review-platforms` → `ReviewPlatforms` (ReviewPlatforms.jsx, 340 lines) |
| `manages_table` | `review_platforms` — columns: `platform_name` (NOT `name`), `url`, `is_default`, `is_active`, `created_at` |
| `primary_actors` | owner, admin |
| `purpose` | Manage the review-link platforms (Google, Yelp, Facebook, etc.). The **default active** platform's URL is appended to payment receipts ("Leave a review"). CRUD + toggle-active + set-default, well-matched across web and Android. |
| `last_verified` | 2026-05-31 · Stage-1 read-only audit · commit: 6147cd1 |

### load_sequence
Both: `GET /settings/review-platforms` → `SELECT * FROM review_platforms WHERE company_id ORDER BY is_default DESC, created_at ASC`. The `review_platforms` table is created by a **startup migration** at the top of `routes/settings.js` (lines 11–20).

### gating
All `/settings/review-platforms` routes are `auth` only — **no `ownerOrAdmin` middleware**. Any authenticated user can CRUD platforms.

### key-mapping note
The request body key is **`name`** but the DB column is **`platform_name`** — the POST/PUT handlers map `name → platform_name` server-side, and both clients read `platform_name` back. So the `name` key is correct (not a bug). Web's helper `getPlatformName(p) = p.platform_name || p.name` handles either shape.

### receipt link (confirmed)
`invoices.js:645` — Send Receipt selects `platform_name AS name, url FROM review_platforms WHERE is_default = true AND is_active = true LIMIT 1`; if no default, `:650` falls back to the first active by `created_at`. `roster-techs.js:116` uses the same default-active URL in the tech-notify message.

### entry_points
- Web: Settings → "Review Platforms" (`/settings/review-platforms`).
- Android: "More" → Business → "Review Platforms".

---

## ACTIONS

---

### `review-platforms.list`
- **label:** List platforms
- **section:** list
- **actors:** owner, admin
- **purpose:** Show configured review platforms (default first).
- **visibility:** on open.
- **route_chain:** `GET /settings/review-platforms`
- **request_body:** —
- **side_effects:** read-only.
- **end_state:** Platform cards (name, url, Default badge, active toggle).
- **failure_modes:** none.
- **parity:** MATCH — web `settingsApi.getReviewPlatforms()`; Android `repo.getReviewPlatforms()`. Both order default-first.
- **status:** OK
- **status_note:** —

### `review-platforms.quick-add`
- **label:** Quick-add template
- **section:** list
- **actors:** owner, admin
- **purpose:** Pre-fill the add form for a known platform.
- **visibility:** "QUICK ADD" chips/buttons.
- **route_chain:** — (opens the add form with a prefilled name + url hint; no call until Save)
- **request_body:** —
- **side_effects:** local form state only.
- **end_state:** Add form prefilled.
- **failure_modes:** none.
- **parity:** PARTIAL — web offers **6** templates (Google, Yelp, Facebook, Thumbtack, Angi, BBB) with icons + URL prefixes, **filtered to hide already-added** ones; Android offers **4** static buttons (Google, Thumbtack, Facebook, Yelp) with URL hints, not filtered. Same end result (prefill → Save).
- **status:** OK
- **status_note:** —

### `review-platforms.add`
- **label:** Add platform
- **section:** manage
- **actors:** owner, admin
- **purpose:** Create a review platform.
- **visibility:** "+ Add" (web) / FAB (Android).
- **precondition:** name + url non-blank.
- **confirm:** —
- **route_chain:** `POST /settings/review-platforms` → `INSERT INTO review_platforms (company_id, platform_name, url, is_default, is_active)`
- **request_body:** web `{name, url}`; Android `{name, url, is_default, is_active}`
- **side_effects:** inserts a row; if `is_default` true, first clears any existing default.
- **end_state:** New platform in list.
- **failure_modes:** 400 if name or url missing (`name and url are required`).
- **parity:** MATCH — both POST `{name,...}` → server maps `name → platform_name`. (Web's add form sends only name+url; Android's sheet can also set `is_default`.)
- **status:** OK
- **status_note:** —

### `review-platforms.edit`
- **label:** Edit platform
- **section:** manage
- **actors:** owner, admin
- **purpose:** Update a platform's name/url.
- **visibility:** ✏️ per card.
- **precondition:** name + url non-blank.
- **confirm:** —
- **route_chain:** `PUT /settings/review-platforms/:id` → COALESCE update of platform_name, url, is_default, is_active
- **request_body:** web `{name, url}`; Android `{name, url, is_default, is_active}`
- **side_effects:** updates the row (404 if not found).
- **end_state:** Updated card.
- **failure_modes:** 404 if platform not found / wrong company.
- **parity:** MATCH — same endpoint + keys.
- **status:** OK
- **status_note:** —

### `review-platforms.toggle-active`
- **label:** Toggle active
- **section:** manage
- **actors:** owner, admin
- **purpose:** Enable/disable a platform (inactive ones aren't used for receipts).
- **visibility:** switch per card.
- **route_chain:** `PUT /settings/review-platforms/:id` with `{ is_active }`
- **request_body:** `{ is_active }`
- **side_effects:** updates `is_active`.
- **end_state:** Toggled.
- **failure_modes:** 404 if not found.
- **parity:** MATCH — web `updateReviewPlatform(id,{is_active})`; Android `updatePlatform(id,null,null,null,!isActive)`.
- **status:** OK
- **status_note:** —

### `review-platforms.set-default`
- **label:** Set as default
- **section:** manage
- **actors:** owner, admin
- **purpose:** Choose which platform's link goes on receipts.
- **visibility:** web — inline "Default" button on non-default active cards; Android — "Set as default" checkbox in the add/edit sheet.
- **route_chain:** `PUT /settings/review-platforms/:id` with `{ is_default: true }` → server first clears every other default for the company
- **request_body:** `{ is_default: true }`
- **side_effects:** sets this row default, unsets all others (single-default invariant enforced server-side).
- **end_state:** "Default" badge moves to this platform.
- **failure_modes:** 404 if not found.
- **parity:** DIVERGENT — same endpoint/effect, different affordance: **web** has a one-tap inline "Default" button per card; **Android** only exposes it via the add/edit sheet's checkbox (no per-card quick action).
- **status:** OK
- **status_note:** Single-default is enforced by the handler clearing other defaults before setting this one.

### `review-platforms.delete`
- **label:** Delete platform
- **section:** manage
- **actors:** owner, admin
- **purpose:** Remove a platform.
- **visibility:** 🗑 per card.
- **precondition:** —
- **confirm:** confirm modal (web) / immediate (Android).
- **route_chain:** `DELETE /settings/review-platforms/:id` → hard `DELETE`
- **request_body:** —
- **side_effects:** permanently removes the row (not soft delete).
- **end_state:** Platform gone; receipts lose that link.
- **failure_modes:** 404 if not found.
- **parity:** MATCH — both hard-delete. Web shows a confirm modal; Android deletes on the trash tap.
- **status:** OK
- **status_note:** Unlike contacts/users elsewhere, this is a hard delete.

### `review-platforms.back`
- **label:** Back
- **section:** nav
- **actors:** owner, admin
- **purpose:** Return to Settings.
- **visibility:** top-left.
- **route_chain:** web `navigate('/settings')`; Android `onBack`
- **request_body:** —
- **side_effects:** none.
- **end_state:** Settings landing.
- **failure_modes:** none.
- **parity:** MATCH.
- **status:** OK
- **status_note:** —

---

## SCREEN-LEVEL DRIFT FLAGS

- **`display_order` does not exist.** The Batch-F task hypothesised a `display_order` column, but the `review_platforms` DDL (settings.js:11–20) has only `platform_name, url, is_default, is_active, created_at`. Ordering is `is_default DESC, created_at ASC` — there is no per-row sort field and no UI for one.
- **Column is `platform_name`, request key is `name`.** Handlers map `name → platform_name`; both clients read `platform_name` back. Not a bug, but the asymmetry is worth knowing (web's `getPlatformName` defends against either).
- **Receipt link confirmed.** The default active platform's URL is what Send Receipt appends (`invoices.js:645`, fallback `:650` = first active); the tech-notify message uses the same (`roster-techs.js:116`). Deleting/deactivating the default silently changes which link receipts use.
- **No owner/admin gating.** `/settings/review-platforms` routes are `auth` only — any authenticated user can add/edit/delete platforms (and thereby change the receipt link).
- **Table created by startup migration**, not in `schema.sql`. It's an `IF NOT EXISTS` block that runs on boot of `routes/settings.js`; the column set is authoritative there.
- **Set-default affordance differs** (web per-card button vs Android sheet checkbox) — see the `set-default` action.
