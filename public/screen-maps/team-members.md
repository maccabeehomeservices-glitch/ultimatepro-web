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
| `last_verified` | 2026-06-07 · Granular permissions PHASE 1 (FOUNDATION, NO ENFORCEMENT): `users.permissions` JSONB added (null = role template); `backend/utils/permissions.js` source of truth (9 sections × 4 levels + role templates + `hasPermission`/`resolvePermissions`/`validatePermissions`); `GET /users/permission-schema`; permission grid on Add/Edit (both platforms); "Add/Edit Team Member" rename. `hasPermission` is defined but wired to ZERO routes — nothing enforces yet. Prior: 2026-06-06 Tier 2.1 web fix. |

### load_sequence
Both: `GET /users` → `SELECT id, first_name, last_name, email, phone, role, …, is_active, hourly_rate, commission_pct, permissions, … ` (Phase 1 added `permissions`). **No `name` column is returned** (only `first_name`/`last_name`). The Add/Edit forms also `GET /users/permission-schema` → `{ sections, levels, role_templates }` to render the permission grid from one backend authority. `users.permissions` is JSONB, nullable (`null` = use the role template); it stores only OVERRIDES (sections that differ from the role default). Returned in `safeUser` + both GET selects.

### gating
`GET /users` = any authenticated user. **`POST /users`, `PUT /users/:id`, `DELETE /users/:id`, `PUT /users/:id/reactivate`, `GET /users/permission-schema` are all `ownerOrAdmin`.** Editing an `owner` row requires you to *be* the owner (users.js:102). You cannot deactivate your own account (users.js:141).

### permissions model (Phase 1, foundation only — NO ENFORCEMENT)
Single source of truth: `backend/utils/permissions.js`. **9 sections** (`jobs, customers, estimates_invoices, payments_refunds, pricebook, accounting_earnings, reports, job_sources_commissions, team_settings`); **4 levels** `none < view < edit_self < full` (`RANK 0..3`). `ROLE_TEMPLATES` per the locked grid (owner/admin all `full`; manager/dispatcher/technician per spec). `resolvePermissions(user)` = `override[section] ?? template[role][section] ?? 'none'`. `hasPermission(user, section, level)` = `RANK[resolved] >= RANK[level]` — **DEFINED + EXPORTED but called by ZERO routes this phase** (grep-verified). `validatePermissions` drives the 400 on bad section/level. Storage: only overrides are saved; role-template changes propagate live to non-overridden users. Enforcement is Phase 2; the `canApproveEarnings` migration is Phase 3 (seam untouched here).

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
- **request_body:** `{first_name, last_name, email, phone, role, password, permissions?}` (both platforms). `permissions` is an optional partial OVERRIDE object (delta vs role template); omitted/null = use the role template.
- **side_effects:** inserts a `users` row (on success), incl. `permissions` JSONB when overrides were set.
- **end_state:** New user in list.
- **failure_modes:** duplicate email → 409; password missing (web blocks client-side before POST); **invalid permission section/level → 400** (`validatePermissions`).
- **parity:** MATCH, both send the correct keys, the valid role set (`technician/dispatcher/manager/admin`, default `technician`), and the permission grid delta.
- **status:** OK
- **status_note:** Phase 1 (2026-06-07) added the permission grid (see `team-members.permissions-grid`). Stored only; nothing enforces it yet.

### `team-members.edit`
- **label:** Edit user
- **section:** write
- **actors:** owner, admin
- **purpose:** Change a user's contact/role (and optionally password on Android).
- **visibility:** ✏️ per row (non-owner on web; non-owner & active on Android).
- **precondition:** owner/admin; editing an owner requires being the owner.
- **confirm:** n/a
- **route_chain:** `PUT /users/:id` → COALESCE update of first_name,last_name,email,phone,role,color,hourly_rate,commission_pct (+password if sent)
- **request_body:** `{first_name, last_name, email, phone, role, (password if entered), permissions?}` (both platforms). `permissions` COALESCEs (omit = unchanged); a partial override object.
- **side_effects:** updates the `users` row (incl. `permissions = COALESCE($9, permissions)`).
- **end_state:** Updated card.
- **failure_modes:** 404 if not found; editing an `owner` row requires being the owner (users.js:102); **invalid permission section/level → 400**.
- **parity:** MATCH, both edit all fields + the permission grid; web's password is optional on edit (blank = keep current).
- **status:** OK
- **status_note:** Phase 1 (2026-06-07): edit form seeds the grid from existing overrides ?? role template; saves the delta. Stored only; nothing enforces it yet.

### `team-members.permissions-grid`
- **label:** Permission grid (9 sections × None/View/Edit-self/Full)
- **section:** write
- **actors:** owner, admin
- **purpose:** Set a team member's granular access per section, defaulting to the role template, overridable per cell. PHASE 1: stored + editable + displayed; **enforced by nothing yet** (Phase 2).
- **visibility:** inside the Add + Edit Team Member forms (web Modal; Android scrollable `AlertDialog`). Hidden for `owner` (shows a "Full access" note).
- **precondition:** `GET /users/permission-schema` loaded.
- **confirm:** n/a (part of the form save).
- **route_chain:** schema `GET /users/permission-schema`; saved via the create/edit `POST`/`PUT /users` `permissions` field.
- **request_body:** delta-only `permissions` object — sections equal to the role default are omitted; `null`/empty = pure role template.
- **side_effects:** none until saved (then stored as `users.permissions` JSONB).
- **end_state:** Overrides persisted; `resolvePermissions` returns template-merged-with-overrides.
- **failure_modes:** bad section/level → 400 (`validatePermissions`).
- **parity:** MATCH — web renders a 4-button row per section; Android renders `FilterChip`s in a scrollable AlertDialog. Selecting a role re-seeds the grid to that template and clears overrides (with a "Reset to [role] defaults" note) on both.
- **status:** OK
- **status_note:** Phase 1 foundation (2026-06-07). `hasPermission` exists in `backend/utils/permissions.js` but is wired to NO route — zero behavior change.

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
- **Granular permissions PHASE 1 (FOUNDATION, 2026-06-07) — NO ENFORCEMENT.** Added `users.permissions` JSONB (null = role template), `backend/utils/permissions.js` (single source of truth), `GET /users/permission-schema`, and the permission grid on Add/Edit (both platforms). `hasPermission` is defined + exported but **wired to zero routes** (grep-verified) — the app behaves exactly as before; permissions are stored + editable + displayed only. Renamed "Add/Edit User" → "Add/Edit Team Member" (web). Enforcement = Phase 2; the `canApproveEarnings` migration = Phase 3 (seam untouched).
- **`commission_pct`/`hourly_rate` still not editable here** (unchanged) — separate from the permission system; not added in Phase 1.
