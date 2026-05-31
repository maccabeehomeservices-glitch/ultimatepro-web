# Screen Map — Company Profile

> **Format:** Action-Map Schema v1. Source of truth; the HTML atlas is rendered from it.
> When code changes this screen, update this file in the same commit. Reality on disk wins.

---

## SCREEN

| Field | Value |
|---|---|
| `screen_id` | `company-profile` |
| `display_name` | Company Profile |
| `surfaces` | android, web |
| `route_android` | `CompanyProfileScreen` + `CompanyProfileViewModel` (CompanyProfileScreen.kt) |
| `route_web` | `/settings/company` → `CompanyProfile` (CompanyProfile.jsx, 270 lines) |
| `manages_table` | `companies` (the single tenant row, keyed by `req.companyId`) |
| `primary_actors` | owner, admin |
| `purpose` | Edit the company's identity used across the app/print: name, tagline, contact, address, and logo. Logo is uploaded to Cloudinary; everything else is a single `PUT /company`. The UltimatePro network ID is shown read-only. |
| `last_verified` | 2026-05-31 · Stage-1 read-only audit · commit: 6147cd1 |

### load_sequence
Both surfaces: `GET /company` → the full `companies` row; map into the form. Web also reads `logo_url` + `ultimatecrm_id`; Android the same.

### gating
`GET /company` = any authenticated user. **`PUT /company` and `POST /company/logo` are `ownerOrAdmin`** (company.js:38,68). A manager/dispatcher/technician can open the page and type, but Save / logo upload will **403**.

### entry_points
- Web: Settings → "Company Profile" (`/settings/company`).
- Android: "More" → Business → "Company Profile".

---

## ACTIONS

---

### `company-profile.load`
- **label:** Load company
- **section:** load
- **actors:** owner, admin
- **purpose:** Fetch the company row into the form.
- **visibility:** on open.
- **route_chain:** `GET /company` → `SELECT * FROM companies WHERE id = $1`
- **request_body:** —
- **side_effects:** read-only.
- **end_state:** Form populated (name, tagline, phone, email, website, address/city/state/zip, logo, UCM id).
- **failure_modes:** load error → "Failed to load" snack.
- **parity:** MATCH — web `companyApi.get()`; Android `repo.getCompany()`. Same fields mapped.
- **status:** OK
- **status_note:** —

### `company-profile.ucm-id-copy`
- **label:** UltimatePro ID (copy)
- **section:** load
- **actors:** owner, admin
- **purpose:** Show the network ID and copy it to the clipboard.
- **visibility:** only when `ultimatecrm_id` is set.
- **route_chain:** — (display only; reads `ultimatecrm_id` from the loaded row)
- **request_body:** —
- **side_effects:** clipboard write.
- **end_state:** ID copied ("Copied!").
- **failure_modes:** none.
- **parity:** MATCH — both show the blue card + copy button; read-only (no edit). `ultimatecrm_id` is added by `migrate_network.sql` (`'UCM-'||UPPER(SUBSTRING(MD5(id) …))`).
- **status:** OK
- **status_note:** —

### `company-profile.edit-fields`
- **label:** Edit text fields
- **section:** edit
- **actors:** owner, admin
- **purpose:** Edit name*, tagline, phone, email, website, street/city/state/zip (local state until Save).
- **visibility:** always.
- **route_chain:** — (controlled inputs; no call until Save)
- **request_body:** —
- **side_effects:** local form state only.
- **end_state:** Edited values held until Save.
- **failure_modes:** none (no validation; name's "*" is cosmetic — not enforced client-side, and `PUT` uses `COALESCE` so a blank name would overwrite to `''`).
- **parity:** MATCH — identical field set on both. Android trims each field on save; web sends as-typed.
- **status:** OK
- **status_note:** The same 9 editable fields on both surfaces; no surface edits `country`, `timezone`, `currency`, or `tax_rate` (see drift).

### `company-profile.logo-upload`
- **label:** Upload logo
- **section:** edit
- **actors:** owner, admin
- **purpose:** Upload a company logo image.
- **visibility:** always.
- **precondition:** an image file (`image/*`, ≤5 MB).
- **confirm:** —
- **route_chain:** `POST /company/logo` (multipart field `logo`) → Cloudinary upload (`folder ultimatepro/logos/:companyId`, limit 400×400) → `UPDATE companies SET logo_url` → `{ logo_url }`
- **request_body:** `multipart/form-data`, field `logo` = file
- **side_effects:** Cloudinary asset created; `companies.logo_url` updated server-side immediately (not deferred to Save).
- **end_state:** Logo shown; "Logo uploaded!".
- **failure_modes:** non-image → multer rejects ("Only image files are allowed"); >5 MB rejected; no file → 400; **403 if not owner/admin**.
- **parity:** MATCH — web file input → `companyApi.uploadLogo(FormData)`; Android photo picker → temp file → `repo.uploadCompanyLogo(file)`. Both POST the `logo` part.
- **status:** OK
- **status_note:** Upload persists `logo_url` on its own (separate from the main Save).

### `company-profile.logo-remove`
- **label:** Remove logo
- **section:** edit
- **actors:** owner, admin
- **purpose:** Clear the company logo.
- **visibility:** only when a logo is set.
- **route_chain:** `PUT /company` with `{ logo_url: '' }`
- **request_body:** `{ "logo_url": "" }`
- **side_effects:** sets `companies.logo_url = ''` (empty string overwrites — `COALESCE($12, logo_url)` keeps `''` since it isn't null).
- **end_state:** Logo cleared; "Logo removed".
- **failure_modes:** 403 if not owner/admin; the Cloudinary asset itself is **not** deleted (only the URL is cleared).
- **parity:** MATCH — web `companyApi.update({logo_url:''})`; Android `repo.updateCompany(mapOf("logo_url" to ""))`.
- **status:** OK
- **status_note:** Removal is immediate (own `PUT`), not deferred to Save.

### `company-profile.save`
- **label:** Save profile
- **section:** persist
- **actors:** owner, admin
- **purpose:** Persist all edited fields.
- **visibility:** always (bottom button).
- **precondition:** owner/admin (else 403).
- **confirm:** —
- **route_chain:** `PUT /company` → `UPDATE companies SET name,email,phone,address,city,state,zip,country,timezone,currency,tax_rate,logo_url,settings,tagline,website … COALESCE(...) WHERE id` → returns the row
- **request_body:** web `{...form, logo_url}` = `{name, phone, email, address, city, state, zip, website, tagline, logo_url}`; Android the same (all trimmed)
- **side_effects:** updates the `companies` row; `updated_at = NOW()`.
- **end_state:** "Company profile saved!".
- **failure_modes:** **403 if not owner/admin**; potential **500 if `tagline`/`website` columns are absent** in the live DB (see drift — they're referenced by the handler but not defined in any committed schema/migration).
- **parity:** MATCH — same endpoint + same body keys on both surfaces.
- **status:** OK
- **status_note:** UNVERIFIED column risk on `tagline`/`website` (see drift); wiring itself is correct (right path, right keys, COALESCE).

### `company-profile.back`
- **label:** Back
- **section:** nav
- **actors:** owner, admin
- **purpose:** Return to Settings.
- **visibility:** top-left.
- **route_chain:** web `navigate('/settings')`; Android `onBack`
- **request_body:** —
- **side_effects:** none (unsaved edits are discarded).
- **end_state:** Settings landing.
- **failure_modes:** none.
- **parity:** MATCH.
- **status:** OK
- **status_note:** —

---

## SCREEN-LEVEL DRIFT FLAGS

- **`tagline` & `website` are referenced but not defined in committed SQL.** `PUT /company` writes `tagline = COALESCE($14, tagline)` and `website = COALESCE($15, website)` (company.js:56–57) and both clients read/send them, but neither column appears in `schema.sql` `companies` nor in any `db/migrate_*.sql`. **UNVERIFIED** whether they exist in the production DB (likely added out-of-band). If they are absent, the *entire* Save `UPDATE` 500s — not just those two fields.
- **Backend-supported columns with no input on either surface:** `PUT /company` also accepts `country`, `timezone`, `currency`, `tax_rate`, and `settings` (JSONB), but **no field on web or Android captures them**. The Batch-E task's hypothesised `tax_label`, `terms`, `default_tax_rate`, and `profile_mode` **do not exist** as columns (schema has `tax_rate`, not `default_tax_rate`); they are simply not part of this screen.
- **Logo upload & removal persist immediately**, independent of the main Save button (each is its own server write). Removing a logo clears the URL but does **not** delete the Cloudinary asset.
- **Gating asymmetry:** the page loads for any authenticated user (`GET` is `auth` only), but Save and logo upload are `ownerOrAdmin` — a non-admin can edit the form and only discover the 403 on Save.
- **Cloudinary credentials are hard-coded as fallbacks** in `company.js:8–12` (cloud_name/api_key/api_secret literals). Security follow-up (out of scope for this map; flagged).
