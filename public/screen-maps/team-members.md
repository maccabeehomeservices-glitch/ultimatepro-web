# Screen Map, Team Members

> **Format:** Action-Map Schema v1. Source of truth; the HTML atlas is rendered from it.
> When code changes this screen, update this file in the same commit. Reality on disk wins.

---

## SCREEN

| Field | Value |
|---|---|
| `screen_id` | `team-members` |
| `display_name` | Team Members |
| `surfaces` | android, web |
| `route_android` | `TeamMembersScreen` + `TeamMembersViewModel` (TeamMembersScreen.kt) |
| `route_web` | `/settings/team` → `UserManagement` (UserManagement.jsx, 256 lines) |
| `manages_table` | `users` (app accounts: owner/admin/manager/technician/dispatcher) |
| `primary_actors` | owner, admin |
| `purpose` | Manage the company's app users, list, invite/create, edit role+contact, deactivate, reactivate. **The web page is substantially broken against the current API (wrong field names + wrong role values); the Android screen is correct.** |
| `last_verified` | 2026-05-31 · Stage-1 read-only audit · commit: 6147cd1 |

### load_sequence
Both: `GET /users` → `SELECT id, first_name, last_name, email, phone, role, …, is_active, hourly_rate, commission_pct …`. **No `name` column is returned** (only `first_name`/`last_name`).

### gating
`GET /users` = any authenticated user. **`POST /users`, `PUT /users/:id`, `DELETE /users/:id`, `PUT /users/:id/reactivate` are all `ownerOrAdmin`.** Editing an `owner` row requires you to *be* the owner (users.js:102). You cannot deactivate your own account (users.js:141).

### entry_points
- Web: Settings → "Team Members" (`/settings/team`).
- Android: "More" → Business → "Team Members".

---

## ACTIONS

---

### `team-members.list`
- **label:** List users
- **section:** list
- **actors:** owner, admin
- **purpose:** Show all team members with role badges.
- **visibility:** on open.
- **route_chain:** `GET /users` (ordered role, first_name)
- **request_body:** n/a
- **side_effects:** read-only.
- **end_state:** User cards.
- **failure_modes:** **web renders no names**, it reads `u.name` and `u.name?.[0]`, but the API returns `first_name`/`last_name` and **no `name` field**, so the name line is blank and the avatar shows "?".
- **parity:** DIVERGENT, Android renders `"${first_name} ${last_name}"`, email, phone, role badge, and an **Inactive** badge for deactivated users. Web shows blank names (wrong key) and does not distinguish inactive users.
- **status:** PARTIAL
- **status_note:** Endpoint fine; web display is broken by the `name` vs `first_name`/`last_name` mismatch.

### `team-members.create`
- **label:** Add / invite user
- **section:** write
- **actors:** owner, admin
- **purpose:** Create a new team member with a password.
- **visibility:** "+ Add User" (web) / PersonAdd (Android).
- **precondition:** owner/admin.
- **confirm:** n/a
- **route_chain:** `POST /users` → validates `first_name`, `last_name`, `email`, `password`(≥8), `role∈{admin,manager,technician,dispatcher}` → bcrypt hash → INSERT → `safeUser`
- **request_body:** Android `{first_name, last_name, email, phone, role, password}` ✓ ; **web `{name, email, phone, role, password}`** ✗
- **side_effects:** inserts a `users` row (on success).
- **end_state:** New user in list.
- **failure_modes:** **web ALWAYS 400s**, (1) it sends a single `name` (no `first_name`/`last_name`) → "First name required"; (2) its role `<select>` offers `tech`/`admin`/`owner`, but `tech` and `owner` are **not** in the API enum → "Invalid role" (only `admin` would pass validation, and even then the missing names still 400). Duplicate email → 409.
- **parity:** DIVERGENT, Android sends the correct keys and a valid role set (`technician/dispatcher/manager/admin`) and works; web cannot create a user as shipped.
- **status:** BROKEN
- **status_note:** Web create is non-functional: wrong field names + 2 of 3 role options are invalid enum values.

### `team-members.edit`
- **label:** Edit user
- **section:** write
- **actors:** owner, admin
- **purpose:** Change a user's contact/role (and optionally password on Android).
- **visibility:** ✏️ per row (non-owner on web; non-owner & active on Android).
- **precondition:** owner/admin; editing an owner requires being the owner.
- **confirm:** n/a
- **route_chain:** `PUT /users/:id` → COALESCE update of first_name,last_name,email,phone,role,color,hourly_rate,commission_pct (+password if sent)
- **request_body:** Android `{first_name, last_name, email, phone, role, (password)}` ✓ ; **web `{name, email, phone, role}`** ✗ (no first/last; no password on edit)
- **side_effects:** updates the `users` row.
- **end_state:** Updated card.
- **failure_modes:** **web cannot edit names**, it sends `name` (ignored; `first_name`/`last_name` stay via COALESCE-NULL). **web 400s if the role becomes `tech` or `owner`** (invalid enum). Email/phone (and a valid role) do persist.
- **parity:** DIVERGENT, Android edits all fields correctly; web silently drops name edits and can 400 on role.
- **status:** PARTIAL
- **status_note:** Web partially works (email/phone/valid-role persist) but name edits are silently lost and bad role values 400.

### `team-members.delete`
- **label:** Remove (deactivate) user
- **section:** write
- **actors:** owner, admin
- **purpose:** Revoke a user's access.
- **visibility:** 🗑 per non-owner row.
- **precondition:** owner/admin; not your own account.
- **confirm:** confirm modal/dialog.
- **route_chain:** `DELETE /users/:id` → `UPDATE users SET is_active = false` (soft delete, never truly removed)
- **request_body:** n/a
- **side_effects:** sets `is_active = false`.
- **end_state:** User deactivated.
- **failure_modes:** 400 if you target your own id; 404 if not found.
- **parity:** MATCH, both call `DELETE /users/:id`. Wording differs (web "removed" vs Android "deactivated"); it is a soft delete on both.
- **status:** OK
- **status_note:** Web mislabels it "removed"/"cannot be undone" though the row is only deactivated; web also keeps showing deactivated users (no `is_active` filter, no badge).

### `team-members.reactivate`
- **label:** Reactivate user
- **section:** write
- **actors:** owner, admin
- **purpose:** Restore a deactivated user.
- **visibility:** Android only, a Refresh icon on inactive non-owner rows.
- **precondition:** owner/admin.
- **confirm:** n/a
- **route_chain:** `PUT /users/:id/reactivate` → `UPDATE users SET is_active = true`
- **request_body:** n/a
- **side_effects:** sets `is_active = true`.
- **end_state:** User active again.
- **failure_modes:** 404 if not found.
- **parity:** ANDROID-ONLY, the endpoint exists and works, but the **web page has no reactivate UI** (and shows no inactive state to trigger it).
- **status:** OK
- **status_note:** Functioning endpoint; web simply doesn't surface it.

### `team-members.back`
- **label:** Back
- **section:** nav
- **actors:** owner, admin
- **purpose:** Return to Settings.
- **visibility:** top-left.
- **route_chain:** web `navigate('/settings')`; Android `onBack`
- **request_body:** n/a
- **side_effects:** none.
- **end_state:** Settings landing.
- **failure_modes:** none.
- **parity:** MATCH.
- **status:** OK
- **status_note:** n/a
---

## SCREEN-LEVEL DRIFT FLAGS

- **Web uses `name`; the API uses `first_name`/`last_name`.** This single mismatch breaks three things on web: list names render blank, create always 400s ("First name required"), and edit can never change names. Android uses the correct split fields throughout.
- **Web role `<select>` is wrong.** Options are `tech` / `admin` / `owner`; the API enum is `admin / manager / technician / dispatcher`. So `tech` and `owner` both 400 ("Invalid role"); `manager`/`dispatcher` are unavailable on web. Android's dropdown is exactly `technician/dispatcher/manager/admin` (owner intentionally excluded).
- **`commission_pct` / `hourly_rate` have no input on EITHER surface.** The API accepts them on create/update, but neither screen sends them (so they stay at the `0` default). The Batch-E task's hypothesised editable pay fields aren't editable here.
- **`worker_type` & `material_policy` are `users` columns** (added by `migrate_materials.sql`) but `users.js` never reads or writes them, they're managed elsewhere, not on this screen. **`pay_model` does not exist** as a column anywhere (the task's guess).
- **Soft-delete semantics:** `DELETE /users/:id` only sets `is_active=false`. Web's copy ("This cannot be undone") is misleading and web offers no way back; Android correctly shows an Inactive badge + a reactivate button.
