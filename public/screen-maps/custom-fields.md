# Screen Map, Custom Fields

> **Format:** Action-Map Schema v1. Source of truth; the HTML atlas is rendered from it.
> When code changes this screen, update this file in the same commit. Reality on disk wins.

---

## SCREEN

| Field | Value |
|---|---|
| `screen_id` | `custom-fields` |
| `display_name` | Custom Fields |
| `surfaces` | android, web |
| `route_android` | `CustomFieldsScreen` + `CustomFieldsViewModel` (CustomFieldsScreen.kt) |
| `route_web` | `/settings/custom-fields` → `CustomFields` (CustomFields.jsx, 315 lines) |
| `manages_table` | `custom_fields` (field **definitions**), values are captured in the entity's own `custom_fields` JSONB |
| `primary_actors` | owner, admin |
| `purpose` | Define extra fields (label, type, options) that attach to Jobs / Customers / Estimates / Invoices. This screen edits the **definitions**; the captured **values** live in `<entity>.custom_fields` JSONB (confirmed `jobs.custom_fields`, jobs.js:370 on create, :701 on update). |
| `last_verified` | 2026-05-31 · Stage-1 read-only audit · commit: 6147cd1 |

### schema (confirmed, schema.sql:206–218)
`custom_fields(id, company_id, entity CHECK('job','customer','estimate','invoice'), label, field_key, field_type CHECK('text','number','date','select','checkbox','textarea','phone','email'), options TEXT[], required, sort_order, active, created_at)`.

### load_sequence
Both: `GET /company/custom-fields` (no entity param) → `SELECT * FROM custom_fields WHERE company_id AND active = true ORDER BY entity, sort_order`. Only **active** fields are returned, so a soft-deleted field disappears from the list on both surfaces.

### gating
`GET /company/custom-fields` = any authenticated user. **POST / PUT / DELETE are `ownerOrAdmin`** (company.js).

### entry_points
- Web: Settings → "Custom Fields" (`/settings/custom-fields`).
- Android: "More" → Business → "Custom Fields".

---

## ACTIONS

---

### `custom-fields.list`
- **label:** List fields (grouped by entity)
- **section:** list
- **actors:** owner, admin
- **purpose:** Show defined fields grouped by Jobs/Customers/Estimates/Invoices.
- **visibility:** on open.
- **route_chain:** `GET /company/custom-fields`
- **request_body:** n/a
- **side_effects:** read-only.
- **end_state:** Grouped field rows (label, type, required, options preview).
- **failure_modes:** none.
- **parity:** MATCH (mostly), web groups all four entities; **Android's `ENTITIES` list is `job/customer/estimate` only, it never renders an `invoice` group**, so invoice fields created on web won't appear on Android. Both list only active fields.
- **status:** OK
- **status_note:** Android silently hides any `invoice`-entity fields (no group for them).

### `custom-fields.create`
- **label:** Add field
- **section:** manage
- **actors:** owner, admin
- **purpose:** Create a new custom field definition.
- **visibility:** "Add Field" (web) / + (Android).
- **precondition:** label non-blank; `field_key` derived from the label (`^[a-z0-9_]+$`).
- **confirm:** n/a
- **route_chain:** `POST /company/custom-fields` → validates `entity∈{job,customer,estimate,invoice}`, `field_type∈{text,number,date,select,checkbox,textarea,phone,email}`, `field_key` matches `/^[a-z0-9_]+$/` → `INSERT`
- **request_body:** `{label, field_key, field_type, entity, options, required, sort_order}`
- **side_effects:** inserts a `custom_fields` row.
- **end_state:** New field in its entity group.
- **failure_modes:** **Android sends `field_type:"dropdown"`, which is NOT a valid value**, the validator + DB CHECK use `select`. So **Android's "Dropdown" choice 400s ("Invalid field type")**; only `text/number/date/checkbox` succeed from Android. Web uses the correct `select` and offers all 8 types.
- **parity:** DIVERGENT, web's 8 type options exactly match the backend (`select` for dropdowns) and all 4 entities work; **Android offers only 5 types, `text/number/dropdown/date/checkbox`, and its `dropdown` is rejected by the backend, plus it lacks `select/textarea/phone/email` and the `invoice` entity.**
- **status:** PARTIAL
- **status_note:** Web create is fully functional; Android create works only for text/number/date/checkbox (its Dropdown option is broken, and 4 backend types + the invoice entity are unavailable).

### `custom-fields.edit`
- **label:** Edit field
- **section:** manage
- **actors:** owner, admin
- **purpose:** Update a field's label / options / required (and active).
- **visibility:** edit per row.
- **precondition:** label non-blank.
- **confirm:** n/a
- **route_chain:** `PUT /company/custom-fields/:id` → COALESCE update of **only** `label, options, required, sort_order, active`
- **request_body:** web `{label, options, required}`; Android `{label, field_type, entity, required, active, options}`
- **side_effects:** updates label/options/required (+active on Android).
- **end_state:** Updated field.
- **failure_modes:** **Android lets you change Type and Entity in the edit dialog, but the PUT ignores `field_type` and `entity`** (it only reads label/options/required/sort_order/active), so those edits silently no-op. Web correctly hides the Type/Entity selectors when editing.
- **parity:** DIVERGENT, web only sends the editable fields; Android sends `field_type`/`entity` that the server drops (silent data-loss of the user's intent). Android additionally has an **Active toggle** (can set `active`), which web lacks, though an inactive field can't be reloaded (GET filters `active=true`), so reactivation is effectively unreachable on both.
- **status:** PARTIAL
- **status_note:** label/options/required persist on both; Android's Type/Entity edits are dropped server-side.

### `custom-fields.delete`
- **label:** Delete field (soft)
- **section:** manage
- **actors:** owner, admin
- **purpose:** Remove a field from forms.
- **visibility:** 🗑 per row, with confirm.
- **precondition:** n/a
- **confirm:** confirm modal/dialog.
- **route_chain:** `DELETE /company/custom-fields/:id` → `UPDATE custom_fields SET active = false` (soft delete, row kept, existing data preserved)
- **request_body:** n/a
- **side_effects:** sets `active=false`; the field disappears from the list (GET filters active).
- **end_state:** Field hidden from forms.
- **failure_modes:** none.
- **parity:** MATCH, both call `DELETE /company/custom-fields/:id` (soft). **Web's copy is accurate** ("hidden from forms, existing data preserved"); **Android's dialog says "permanently deleted", which is wrong**, it's a soft delete.
- **status:** OK
- **status_note:** Soft delete on both; Android's "permanently deleted" wording is misleading.

### `custom-fields.back`
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

- **Android's `dropdown` field type is invalid.** The backend validator + `custom_fields.field_type` CHECK use **`select`**; Android sends **`dropdown`**, so creating a dropdown field from Android **400s ("Invalid field type")**. Fix: Android should send `select`. Web uses `select` correctly.
- **Android edit drops Type/Entity.** `PUT /company/custom-fields/:id` only honours `label, options, required, sort_order, active`. Android's edit dialog exposes Type and Entity selectors and sends them, but they're silently ignored, the user thinks they changed the type/entity and nothing happens. Web hides those on edit (correct).
- **Entity & type coverage differ.** Web supports all 4 entities (`job/customer/estimate/invoice`) and all 8 field types; Android supports only 3 entities (no `invoice`) and 5 types (`text/number/dropdown/date/checkbox`), missing `select/textarea/phone/email`. Invoice fields are invisible on Android.
- **Definitions vs values.** This screen edits `custom_fields` (definitions). The captured values live in the entity's `custom_fields` JSONB, confirmed for jobs (`jobs.custom_fields`, jobs.js:370/701). Deleting a definition (soft) hides the input but leaves any stored values in the entity JSONB intact.
- **Soft delete, no real reactivation path.** `DELETE` sets `active=false` and the list only loads `active=true`, so a removed field can't be reopened to flip it back (Android's Active toggle is moot for already-removed fields). `sort_order` exists but neither surface has UI to set it (always 0).
