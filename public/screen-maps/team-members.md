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
| `route_web` | `/settings/team` → `UserManagement` (`pages/settings/UserManagement.jsx`) |
| `manages_table` | `users` (app accounts: owner/admin/manager/technician/dispatcher) |
| `primary_actors` | owner, admin |
| `purpose` | Manage the company's app users, list, invite/create, edit role+contact, deactivate, reactivate. **Web fixed (Tier 2.1, 2026-06-06): web now sends `first_name`/`last_name` + the valid role enum, renders split names + an Inactive badge, and has reactivate, matching Android.** |
| `last_verified` | 2026-06-06 · Tier 2.1 web fix (create/edit/list/reactivate/delete-copy). Prior: 2026-05-31 Stage-1 audit, commit 6147cd1. |

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
- **failure_modes:** none. Web renders `${first_name} ${last_name}`, avatar from `first_name[0]`, and an **Inactive** badge (+ dimmed row) for `is_active=false`.
- **parity:** MATCH, both render split names, email, phone, role badge, and an Inactive badge for deactivated users.
- **status:** OK
- **status_note:** Fixed Tier 2.1 (2026-06-06): web now reads `first_name`/`last_name` (was `u.name`).

### `team-members.create`
- **label:** Add / invite user
- **section:** write
- **actors:** owner, admin
- **purpose:** Create a new team member with a password.
- **visibility:** "+ Add User" (web) / PersonAdd (Android).
- **precondition:** owner/admin.
- **confirm:** n/a
- **route_chain:** `POST /users` → validates `first_name`, `last_name`, `email`, `password`(≥8), `role∈{admin,manager,technician,dispatcher}` → bcrypt hash → INSERT → `safeUser`
- **request_body:** Android `{first_name, last_name, email, phone, role, password}` ✓ ; web `{first_name, last_name, email, phone, role, password}` ✓ (fixed Tier 2.1)
- **side_effects:** inserts a `users` row (on success).
- **end_state:** New user in list.
- **failure_modes:** duplicate email → 409; password missing (web blocks client-side before POST). The prior always-400 (wrong `name` key + invalid `tech`/`owner` role values) is resolved.
- **parity:** MATCH, both send the correct keys and the valid role set (`technician/dispatcher/manager/admin`, default `technician`).
- **status:** OK
- **status_note:** Fixed Tier 2.1 (2026-06-06): web body split into `first_name`/`last_name`; role `<select>` is now the exact enum.

### `team-members.edit`
- **label:** Edit user
- **section:** write
- **actors:** owner, admin
- **purpose:** Change a user's contact/role (and optionally password on Android).
- **visibility:** ✏️ per row (non-owner on web; non-owner & active on Android).
- **precondition:** owner/admin; editing an owner requires being the owner.
- **confirm:** n/a
- **route_chain:** `PUT /users/:id` → COALESCE update of first_name,last_name,email,phone,role,color,hourly_rate,commission_pct (+password if sent)
- **request_body:** Android `{first_name, last_name, email, phone, role, (password)}` ✓ ; web `{first_name, last_name, email, phone, role, (password if entered)}` ✓ (fixed Tier 2.1)
- **side_effects:** updates the `users` row.
- **end_state:** Updated card.
- **failure_modes:** 404 if not found; editing an `owner` row requires being the owner (backend, users.js:102). Name edits now persist; role values are constrained to the valid enum by the `<select>`.
- **parity:** MATCH, both edit all fields correctly; web's password field is optional on edit (blank = keep current).
- **status:** OK
- **status_note:** Fixed Tier 2.1 (2026-06-06): web sends `first_name`/`last_name` (name edits persist) and a valid role; optional password on edit added.

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
- **parity:** MATCH, both call `DELETE /users/:id` (soft delete) and both copy now says "Deactivate" / "can reactivate later".
- **status:** OK
- **status_note:** Fixed Tier 2.1 (2026-06-06): web copy reworded to "Deactivate … You can reactivate them later" (was "removed / cannot be undone"); web now shows an Inactive badge and a reactivate control.

### `team-members.reactivate`
- **label:** Reactivate user
- **section:** write
- **actors:** owner, admin
- **purpose:** Restore a deactivated user.
- **visibility:** a Refresh/♻️ icon on inactive non-owner rows (both surfaces).
- **precondition:** owner/admin.
- **confirm:** n/a
- **route_chain:** `PUT /users/:id/reactivate` → `UPDATE users SET is_active = true`
- **request_body:** n/a
- **side_effects:** sets `is_active = true`.
- **end_state:** User active again.
- **failure_modes:** 404 if not found.
- **parity:** MATCH, web added a ♻️ reactivate button on inactive rows (Tier 2.1) → `usersApi.reactivate(id)`; Android uses a Refresh icon.
- **status:** OK
- **status_note:** Web now surfaces reactivate (was Android-only).

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

- **RESOLVED (Tier 2.1, 2026-06-06) — `name` vs `first_name`/`last_name`.** Web now sends and renders the split fields, so list names render, create works, and edit persists name changes. (Was: single `name` key broke all three.)
- **RESOLVED (Tier 2.1) — web role `<select>`.** Now exactly `technician / dispatcher / manager / admin` (default `technician`), matching the API enum; `tech`/`owner` removed. Owner is intentionally excluded (owners are not created/edited here).
- **`commission_pct` / `hourly_rate` have no input on EITHER surface.** The API accepts them on create/update, but neither screen sends them (so they stay at the `0` default). **Deferred:** editable pay fields ship with the granular permission system, not Tier 2.1.
- **`worker_type` & `material_policy` are `users` columns** (added by `migrate_materials.sql`) but `users.js` never reads or writes them, they're managed elsewhere, not on this screen. **`pay_model` does not exist** as a column anywhere (the task's guess).
- **RESOLVED (Tier 2.1) — soft-delete semantics.** `DELETE /users/:id` only sets `is_active=false`. Web copy now reads "Deactivate … You can reactivate them later", web shows an Inactive badge, and web has a reactivate control, matching Android.
