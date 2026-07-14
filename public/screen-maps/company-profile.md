# Screen Map, Company Profile

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
| `route_web` | `/settings/company` → `CompanyProfile` (CompanyProfile.jsx, 503 lines) |
| `manages_table` | `companies` (the single tenant row, keyed by `req.companyId`) |
| `primary_actors` | owner, admin |
| `purpose` | Edit the company's identity used across the app/print: name, tagline, contact, address, and logo. Logo is uploaded to Cloudinary; everything else is a single `PUT /company`. The UltimatePro network ID is shown read-only. |
| `last_verified` | 2026-05-31 · Stage-1 read-only audit · commit: 6147cd1 |

### load_sequence
Both surfaces: `GET /company` → the full `companies` row; map into the form. Web also reads `logo_url` + `ultimatecrm_id`; Android the same. **P3.10 (web + android):** on mount also fires `GET /company/email-alias` to populate the Branded Email section (`{ alias, address, domain }`; alias/address null if unclaimed). Web fires it in parallel with the company load; Android's `CompanyProfileViewModel.init` launches `load()` and `loadAlias()` together (the latter also resolves `team_settings:full` from stored role/perms to gate the manage controls).

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
- **request_body:** n/a
- **side_effects:** read-only.
- **end_state:** Form populated (name, tagline, phone, email, website, address/city/state/zip, logo, UCM id).
- **failure_modes:** load error → "Failed to load" snack.
- **parity:** MATCH, web `companyApi.get()`; Android `repo.getCompany()`. Same fields mapped.
- **status:** OK
- **status_note:** n/a
### `company-profile.ucm-id-copy`
- **label:** UltimatePro ID (copy)
- **section:** load
- **actors:** owner, admin
- **purpose:** Show the network ID and copy it to the clipboard.
- **visibility:** only when `ultimatecrm_id` is set.
- **route_chain:**, (display only; reads `ultimatecrm_id` from the loaded row)
- **request_body:** n/a
- **side_effects:** clipboard write.
- **end_state:** ID copied ("Copied!").
- **failure_modes:** none.
- **parity:** MATCH, both show the blue card + copy button; read-only (no edit). `ultimatecrm_id` is added by `migrate_network.sql` (`'UCM-'||UPPER(SUBSTRING(MD5(id) …))`).
- **status:** OK
- **status_note:** n/a
### `company-profile.edit-fields`
- **label:** Edit text fields
- **section:** edit
- **actors:** owner, admin
- **purpose:** Edit name*, tagline, phone, email, website, street/city/state/zip (local state until Save).
- **visibility:** always.
- **route_chain:**, (controlled inputs; no call until Save)
- **request_body:** n/a
- **side_effects:** local form state only.
- **end_state:** Edited values held until Save.
- **failure_modes:** none (no validation; name's "*" is cosmetic, not enforced client-side, and `PUT` uses `COALESCE` so a blank name would overwrite to `''`).
- **parity:** MATCH, identical field set on both. Android trims each field on save; web sends as-typed.
- **status:** OK
- **status_note:** The same 9 editable fields on both surfaces; no surface edits `country`, `timezone`, `currency`, or `tax_rate` (see drift).

### `company-profile.logo-upload`
- **label:** Upload logo
- **section:** edit
- **actors:** owner, admin
- **purpose:** Upload a company logo image.
- **visibility:** always.
- **precondition:** an image file (`image/*`, ≤5 MB).
- **confirm:** n/a
- **route_chain:** `POST /company/logo` (multipart field `logo`) → Cloudinary upload (`folder ultimatepro/logos/:companyId`, limit 400×400) → `UPDATE companies SET logo_url` → `{ logo_url }`
- **request_body:** `multipart/form-data`, field `logo` = file
- **side_effects:** Cloudinary asset created; `companies.logo_url` updated server-side immediately (not deferred to Save).
- **end_state:** Logo shown; "Logo uploaded!".
- **failure_modes:** non-image → multer rejects ("Only image files are allowed"); >5 MB rejected; no file → 400; **403 if not owner/admin**.
- **parity:** MATCH, web file input → `companyApi.uploadLogo(FormData)`; Android photo picker → temp file → `repo.uploadCompanyLogo(file)`. Both POST the `logo` part.
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
- **side_effects:** sets `companies.logo_url = ''` (empty string overwrites, `COALESCE($12, logo_url)` keeps `''` since it isn't null).
- **end_state:** Logo cleared; "Logo removed".
- **failure_modes:** 403 if not owner/admin; the Cloudinary asset itself is **not** deleted (only the URL is cleared).
- **parity:** MATCH, web `companyApi.update({logo_url:''})`; Android `repo.updateCompany(mapOf("logo_url" to ""))`.
- **status:** OK
- **status_note:** Removal is immediate (own `PUT`), not deferred to Save.

### `company-profile.save`
- **label:** Save profile
- **section:** persist
- **actors:** owner, admin
- **purpose:** Persist all edited fields.
- **visibility:** always (bottom button).
- **precondition:** owner/admin (else 403).
- **confirm:** n/a
- **route_chain:** `PUT /company` → `UPDATE companies SET name,email,phone,address,city,state,zip,country,timezone,currency,tax_rate,logo_url,settings,tagline,website … COALESCE(...) WHERE id` → returns the row
- **request_body:** web `{...form, logo_url}` = `{name, phone, email, address, city, state, zip, website, tagline, logo_url}`; Android the same (all trimmed)
- **side_effects:** updates the `companies` row; `updated_at = NOW()`.
- **end_state:** "Company profile saved!".
- **failure_modes:** **403 if not owner/admin**. (Earlier "500 if `tagline`/`website` missing" risk is **resolved**, both columns confirmed present in the production DB via live schema introspection; see drift.)
- **parity:** MATCH, same endpoint + same body keys on both surfaces.
- **status:** OK
- **status_note:** `tagline`/`website` columns confirmed to exist in production (live schema introspection); wiring is correct (right path, right keys, COALESCE). No Save-500 risk.

### `company-profile.email-alias-check`
- **label:** Branded email — live availability check (P3.10 Tier 1)
- **section:** edit
- **actors:** owner, admin (any `team_settings: full`)
- **purpose:** As the owner types a slug, check whether `<slug>@ultimatepro.pro` is claimable.
- **visibility:** both surfaces, while the claim/edit input is open (no alias yet, or after Edit/Change).
- **route_chain:** `GET /company/email-alias/check?slug=<x>` → `{ available, reason?, slug, address }`, debounced ~400 ms (Android: a `viewModelScope` Job cancelled/restarted each keystroke).
- **request_body:** n/a (query param `slug`, lowercased client-side; Android also trims).
- **side_effects:** read-only.
- **end_state:** inline status — green "Available ✓", or a red friendly message mapped from `reason` (`required|length|format|reserved|taken|cooldown`); blank input shows the naming rules as helper text. Web additionally shows a neutral "This is your current address" and skips the call when you retype your own current slug; **Android has no such shortcut — it runs the check for any non-empty change.**
- **failure_modes:** web network error → muted "Couldn't check right now, try again"; Android clears the status silently on a check error. Claim/Save stays disabled unless `available`.
- **parity:** MATCH (core flow). Both debounce ~400 ms and lowercase client-side, map the same `reason` codes, and gate the button on `available`. Difference: web short-circuits the "own current slug" case; Android always calls the endpoint.
- **status:** OK
- **status_note:** Web enables Claim/Save only when `available` AND the slug differs from the current alias; Android enables it when `available && !busy && !checking` (no self-compare), so re-submitting an unchanged slug is a no-op round-trip rather than being pre-disabled.

### `company-profile.email-alias-claim`
- **label:** Claim / change branded email (P3.10 Tier 1)
- **section:** persist
- **actors:** owner, admin (any `team_settings: full`)
- **purpose:** Claim a new alias, or change an existing one, in the shared `@ultimatepro.pro` namespace.
- **visibility:** both surfaces; "Claim" when none set, "Save" when changing an existing alias (Android's Edit re-opens the field pre-filled with the current slug).
- **precondition:** `team_settings: full`; availability check returned `available`.
- **route_chain:** `PUT /company/email-alias` body `{ slug }` → 200 `{ alias, address, domain }` | 400 `{ error, reason }` (invalid) | 409 `{ error, reason }` (unavailable).
- **request_body:** `{ "slug": "seaside" }` (lowercased/trimmed client-side).
- **side_effects:** server sets the company's alias. On 4xx: web re-fetches `GET /company/email-alias` to stay truthful; Android keeps the typed input and shows the error (no re-fetch).
- **end_state:** read view shows `<slug>@ultimatepro.pro`; web "Branded email saved!" / Android "Branded email set!" snack.
- **failure_modes:** web 400/409 → red snack with friendly reason text (falls back to `error`). Android surfaces the response `error` string (its `Result` wrapper doesn't parse `reason` on the PUT), so it relies on the check gating the button up front.
- **parity:** MATCH. Android: `repo.setEmailAlias(slug)` → `PUT /company/email-alias`; success updates the read view + snack. The `reason`-code mapping runs on the check, not the PUT.
- **status:** OK
- **status_note:** Controls hidden entirely if `!can('team_settings','full')` (web matches ReviewPlatforms gating; Android gates identically via `canUi(role, perms, "team_settings", "full")`). The route itself is already behind `RequirePermission section="team_settings"`.

### `company-profile.email-alias-remove`
- **label:** Remove branded email (P3.10 Tier 1)
- **section:** persist
- **actors:** owner, admin (any `team_settings: full`)
- **purpose:** Release the claimed alias back to the pool.
- **visibility:** both surfaces; "Remove" button in the read view (web ghost-danger; Android red-label `AppButton`).
- **precondition:** an alias is claimed; `team_settings: full`.
- **confirm:** modal — warns the name enters a cooldown before it can be re-claimed and that customer replies stop routing to the inbox (web modal; Android `AlertDialog` with Release/Keep).
- **route_chain:** `DELETE /company/email-alias` → 200 `{ alias: null, address: null }`.
- **request_body:** n/a
- **side_effects:** clears the company's alias server-side; UI resets to the claim state.
- **end_state:** web "Branded email removed" / Android "Branded email released" snack; section returns to the empty/claim input.
- **failure_modes:** error → red snack.
- **parity:** MATCH. Android: confirm `AlertDialog` → `repo.deleteEmailAlias()` → `DELETE /company/email-alias`; resets to the claim state.
- **status:** OK
- **status_note:** Releasing enters a cooldown; a later re-claim of the same slug can come back as `reason: cooldown` from the check endpoint.

### `company-profile.back`
- **label:** Back
- **section:** nav
- **actors:** owner, admin
- **purpose:** Return to Settings.
- **visibility:** top-left.
- **route_chain:** web `navigate('/settings')`; Android `onBack`
- **request_body:** n/a
- **side_effects:** none (unsaved edits are discarded).
- **end_state:** Settings landing.
- **failure_modes:** none.
- **parity:** MATCH.
- **status:** OK
- **status_note:** n/a
---

## SCREEN-LEVEL DRIFT FLAGS

- **`tagline` & `website` exist in production (no Save-500 risk).** `PUT /company` writes `tagline = COALESCE($14, tagline)` and `website = COALESCE($15, website)` (company.js:56–57) and both clients read/send them. These columns are **not** in `schema.sql` `companies` or any `db/migrate_*.sql`, but they **are confirmed present in the production database via live schema introspection**, i.e. the committed-SQL absence is a schema-scatter artifact (added out-of-band), not a runtime risk. Save works; the action was never broken on this basis.
- **Default Terms & Conditions field (P2.17 PART 2, 2026-07-07).** A `companies.default_terms TEXT` column now exists (boot migration in server.js) and BOTH surfaces capture it: web = a multi-line "Default Terms & Conditions" textarea (CompanyProfile.jsx), Android = a "DEFAULT TERMS & CONDITIONS" multi-line CompanyField (CompanyProfileScreen.kt). `PUT /company` writes `default_terms = COALESCE($16, default_terms)` (company.js). New estimates and invoices auto-fill their `terms` from this default on create (a blank per-document terms → company default; explicit terms override that document only). Renders on estimate/invoice detail, the sign page, and the PDF.
- **Backend-supported columns with no input on either surface:** `PUT /company` also accepts `country`, `timezone`, `currency`, `tax_rate`, and `settings` (JSONB), but **no field on web or Android captures them**. (The Batch-E task's hypothesised `tax_label`, `default_tax_rate`, and `profile_mode` still do not exist; `terms`/`default_terms` now DOES — see the flag above.)
- **Logo upload & removal persist immediately**, independent of the main Save button (each is its own server write). Removing a logo clears the URL but does **not** delete the Cloudinary asset.
- **Branded Email alias — web + Android (P3.10 Tier 1; web 2026-07-14, Android 2026-07-14).** A "BRANDED EMAIL" section on **both** surfaces lets an owner claim/change/remove a slug in the shared `<slug>@ultimatepro.pro` namespace via `GET/PUT/DELETE /company/email-alias` (+ debounced `GET /company/email-alias/check`). Android placed the section right after CONTACT (`CompanyProfileScreen.kt`), wired through `ApiService` (`getEmailAlias`/`checkEmailAlias`/`setEmailAlias`/`deleteEmailAlias`) → `CrmRepository` → `CompanyProfileViewModel`. Unlike the identity fields (which the whole page loads for any authenticated user but blocks writes at 403), the alias write controls are **hidden** unless `can('team_settings','full')` (Android: `canUi(role, perms, "team_settings", "full")`), matching ReviewPlatforms — so there is no discover-the-403-on-save surprise here. Minor Android-vs-web gaps: Android runs the availability check even when the typed slug equals the current one (no "own current slug" shortcut), and on a PUT 4xx it shows the response `error` string rather than a `reason`-mapped message (the `reason` mapping runs on the check). Backend was pre-built; both clients only added the client + UI.
- **Gating asymmetry:** the page loads for any authenticated user (`GET` is `auth` only), but Save and logo upload are `ownerOrAdmin`, a non-admin can edit the form and only discover the 403 on Save.
- **Cloudinary credentials are hard-coded as fallbacks** in `company.js:8–12` (cloud_name/api_key/api_secret literals). Security follow-up (out of scope for this map; flagged).
