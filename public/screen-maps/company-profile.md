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
| `route_web` | `/settings/company` → `CompanyProfile` (CompanyProfile.jsx, 887 lines) |
| `manages_table` | `companies` (the single tenant row, keyed by `req.companyId`) |
| `primary_actors` | owner, admin |
| `purpose` | Edit the company's identity used across the app/print: name, tagline, contact, address, and logo. Logo is uploaded to Cloudinary; everything else is a single `PUT /company`. The UltimatePro network ID is shown read-only. |
| `last_verified` | 2026-05-31 · Stage-1 read-only audit · commit: 6147cd1 |

### load_sequence
Both surfaces: `GET /company` → the full `companies` row; map into the form. Web also reads `logo_url` + `ultimatecrm_id`; Android the same. **P3.10 (web + android):** on mount also fires `GET /company/email-alias` to populate the Branded Email section (`{ alias, address, domain }`; alias/address null if unclaimed). Web fires it in parallel with the company load; Android's `CompanyProfileViewModel.init` launches `load()` and `loadAlias()` together (the latter also resolves `team_settings:full` from stored role/perms to gate the manage controls). **P3.10 Tier 2 (web, 2026-07-14):** the web page ALSO fires `GET /company/sender-email` in parallel on mount to populate the "Or use your own email address" (BYO) block inside the Branded Email section (`{ email, name, verified, status }`, status `none|pending|verified`). Android does not yet have Tier 2. **P3.5 (web + android, 2026-07-14):** both surfaces ALSO fire `GET /provisioning/phone` in parallel on mount to populate the "PHONE NUMBER" section (`{ status, subaccount, number, selected_number, a2p_status, configured }`, status `none|subaccount|number_selected|active`). Web fires it in parallel with the company load; Android's `CompanyProfileViewModel.init` launches `loadPhone()` alongside `load()`/`loadAlias()`/`loadSenderEmail()` (it resolves `team_settings:full` from stored role/perms to gate the manage controls, same as the alias block). When `configured===false` the section shows a muted "Phone provisioning isn't available yet." and stops. When `status==='active'` it chains a second read, `GET /provisioning/phone/usage`, for the usage line. **Android note:** `GET /provisioning/phone` returns no price, so on a cold reload into `number_selected` the "/mo" price is shown only when known (from a prior search/select in the same session).

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

### `company-profile.sender-email-verify`
- **label:** Verify your own email (BYO) — start (P3.10 Tier 2, web only)
- **section:** persist
- **actors:** owner, admin (any `team_settings: full`)
- **purpose:** Verify a company-owned email as the sending identity so estimates/invoices send From that exact address (via SendGrid single-sender verification).
- **visibility:** web only, inside the Branded Email section's "Or use your own email address" block, while `status: none` (email input + "Verify this address").
- **precondition:** `team_settings: full`; a non-empty email; company street + city already saved (server requires the physical address for SendGrid).
- **route_chain:** `POST /company/sender-email` body `{ email, name? }` → 200 `{ email, verified:false, status:'pending', message }` | 400 `{ error, reason }` (`format` | `address_required` | `sendgrid`) | 503 `{ reason:'no_key' }` | 403.
- **request_body:** `{ "email": "you@yourcompany.com" }` (trimmed client-side; `name` omitted).
- **side_effects:** SendGrid sends the owner a confirmation link; server records the pending sender. Nothing changes in the actual From address until the link is clicked.
- **end_state:** section flips to the pending state; "Verification email sent!" (or the server `message`) snack.
- **failure_modes:** 400 `address_required` → "Add your company street + city above first"; 400 `format` → "Enter a valid email"; 503 `no_key` → "Email verification isn't set up — contact support"; other → response `error` fallback. All shown as a red snack.
- **parity:** WEB ONLY (P3.10 Tier 2). Android has no BYO sender yet.
- **status:** OK
- **status_note:** Controls hidden entirely unless `can('team_settings','full')`, same gate as the alias block.
### `company-profile.sender-email-refresh`
- **label:** Refresh verification status (P3.10 Tier 2, web only)
- **section:** load
- **actors:** owner, admin (any `team_settings: full`)
- **purpose:** Poll whether the owner has clicked the SendGrid confirmation link yet.
- **visibility:** web only, in the pending state ("Refresh status" button).
- **route_chain:** `GET /company/sender-email/status` → `{ email, verified, status }`; flips to `verified` once the link is clicked.
- **request_body:** n/a
- **side_effects:** read-only.
- **end_state:** on `verified` → green "✓ Verified — your emails now send from <email>." + success snack; still pending → "Still waiting — click the link in the email, then Refresh again." (red snack).
- **failure_modes:** error → red snack (response `error` fallback).
- **parity:** WEB ONLY (P3.10 Tier 2).
- **status:** OK
- **status_note:** Manual poll (button), not an interval; the user refreshes after clicking the emailed link.
### `company-profile.sender-email-remove`
- **label:** Remove sending address (P3.10 Tier 2, web only)
- **section:** persist
- **actors:** owner, admin (any `team_settings: full`)
- **purpose:** Drop the BYO sender so emails revert to the branded alias (or default).
- **visibility:** web only, "Remove" button in both the pending and verified states.
- **confirm:** modal — warns the address will no longer be the From address; emails revert to the branded alias (or default).
- **route_chain:** `DELETE /company/sender-email` → `{ email:null, status:'none' }`.
- **request_body:** n/a
- **side_effects:** clears the sender server-side; section resets to the `none` (add) state.
- **end_state:** "Sending address removed" snack; input reappears.
- **failure_modes:** error → red snack.
- **parity:** WEB ONLY (P3.10 Tier 2).
- **status:** OK
- **status_note:** n/a
### `company-profile.phone-search`
- **label:** Search for a phone number by area code (P3.5, web only)
- **section:** edit
- **actors:** owner, admin (any `team_settings: full`)
- **purpose:** Find available dedicated (Twilio) numbers for a 3-digit US area code.
- **visibility:** web only, in the "PHONE NUMBER" section while status is `none`/`subaccount` (no selection yet). Hidden when `configured===false`.
- **precondition:** `team_settings: full`; a 3-digit area code (the input strips non-digits and caps at 3; Search is disabled until length===3).
- **route_chain:** `GET /provisioning/phone/search?area_code=<ddd>` → `{ numbers:[{ phoneNumber, friendlyName, locality, region }], monthly_price_usd }` | 400 `{ reason:'area_code' }`.
- **request_body:** n/a (query param `area_code`).
- **side_effects:** read-only.
- **end_state:** each result renders as a row (`friendlyName` + `locality, region`) with a Select button; a "**$X.XX/mo** + usage" line shows `monthly_price_usd`. Empty list → "No numbers found for that area code. Try another."
- **failure_modes:** 400 `area_code` (or client pre-check) → red snack "Enter a 3-digit area code"; other errors → response `error` fallback snack.
- **parity:** MATCH (P3.5, Android added 2026-07-14). Android: `repo.searchPhoneNumbers(areaCode)` → `GET /provisioning/phone/search`; renders the same result rows + "$X.XX/mo + usage" line. Android's `onPhoneAreaCode` strips non-digits and caps at 3, and Search is disabled until length===3 — same as web. Difference: Android maps a search 400 `reason:area_code` (or the client pre-check) to the "Enter a 3-digit area code" snack via `phoneErrorText`; other errors fall back to the server `error` message.
- **status:** OK
- **status_note:** Controls hidden unless `can('team_settings','full')` (Android: `canUi(role, perms, "team_settings", "full")`), same gate as the alias block.
### `company-profile.phone-select`
- **label:** Request this number (P3.5, web only)
- **section:** persist
- **actors:** owner, admin (any `team_settings: full`)
- **purpose:** Reserve a chosen number for platform-approved purchase. **No money is spent from this UI** — it ends at "Requested — pending activation".
- **visibility:** web only, the "Select" button on each search-result row.
- **precondition:** `team_settings: full`; a number picked from search results.
- **route_chain:** `POST /provisioning/phone/subaccount` first (ensure the subaccount — success `{ subaccount:true, status:'subaccount' }`, ignore the "already exists" case; 503 `{ reason:'not_configured' }` aborts), then `POST /provisioning/phone/select` body `{ phone_number }` → `{ selected_number, monthly_price_usd, status:'number_selected', message }` | 400 | 403 → then refetch `GET /provisioning/phone`.
- **request_body:** subaccount: none; select: `{ "phone_number": "+1757…" }`.
- **side_effects:** creates the Twilio subaccount if missing; records the selected (pending) number server-side. The actual purchase is done later by the UltimatePro team, NOT here.
- **end_state:** section flips to the `number_selected` state ("Requested **{selected_number}** — {price}/mo. Pending activation by the UltimatePro team."); success/`message` snack.
- **failure_modes:** subaccount 503 `not_configured` → "Phone provisioning isn't available yet." (aborts, no select); select 400/403/other → response `error` fallback snack. While one row is being requested, all Select buttons are disabled.
- **parity:** MATCH (P3.5, Android added 2026-07-14). Android: `repo.createPhoneSubaccount()` then `repo.selectPhoneNumber(phoneNumber)` (`POST /provisioning/phone/subaccount` → `POST /provisioning/phone/select`); the ensure-subaccount call is idempotent and its `already` case is ignored. Difference: Android updates the read view from the `select` response body (status/`selected_number`/`monthly_price_usd`) rather than re-fetching `GET /provisioning/phone`; the spinner is on the specific row being requested (`phoneSelecting == phoneNumber`) and all Select buttons disable while `phoneBusy`. The button label is "Request this number".
- **status:** OK
- **status_note:** n/a
### `company-profile.phone-reset`
- **label:** Choose a different number (P3.5, web only)
- **section:** persist
- **actors:** owner, admin (any `team_settings: full`)
- **purpose:** Clear a pending selection and return to search.
- **visibility:** web only, in the `number_selected` state.
- **route_chain:** `DELETE /provisioning/phone/select` → `{ selected_number:null, status:'reset' }`. Web then refetches `GET /provisioning/phone`; Android locally resets `status` to `subaccount` (a selection always implies the subaccount was created) without a refetch.
- **request_body:** n/a
- **side_effects:** clears the pending selection server-side; UI returns to the search state.
- **end_state:** search input reappears (web shows a "Selection cleared" snack; Android silently returns to the search state).
- **failure_modes:** error → response `error` fallback snack.
- **parity:** MATCH (P3.5, Android added 2026-07-14). Android: `repo.clearPhoneSelection()` → `DELETE /provisioning/phone/select`; the "Choose a different number" ghost button is gated behind `canManagePhone`. Difference: Android infers the post-reset status locally (`subaccount`) rather than re-reading `GET /provisioning/phone`.
- **status:** OK
- **status_note:** No confirm modal (nothing was purchased — it's just a pending reservation).
### `company-profile.phone-usage`
- **label:** Dedicated number usage line (P3.5, web only)
- **section:** load
- **actors:** owner, admin
- **purpose:** Show the live number + a compact month-to-date usage summary once a number is active.
- **visibility:** web only, in the `active` state (chained after the mount status load).
- **route_chain:** `GET /provisioning/phone/usage` → `{ subaccount, sms, calls, cost_usd }`.
- **request_body:** n/a
- **side_effects:** read-only.
- **end_state:** number shown prominently; muted line "{sms} texts · {calls} calls · ${cost_usd} this month" (line omitted if the usage read fails — non-fatal). Android phrases it "This month: {sms} texts · {calls} calls · ${cost_usd}".
- **failure_modes:** usage read error → line hidden; the number still shows.
- **parity:** MATCH (P3.5, Android added 2026-07-14). Android: `loadPhone()` chains `loadPhoneUsage()` (`GET /provisioning/phone/usage`) when `status==='active'`; the usage line is best-effort (silently omitted on error).
- **status:** OK
- **status_note:** n/a
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
- **Branded Email Tier 2 "use your own email" (BYO) — web only (P3.10 Tier 2, 2026-07-14).** Beneath the Tier 1 alias claim, the web Branded Email section now has an "Or use your own email address" block that verifies a company-owned address as the sending identity via SendGrid single-sender verification: `GET /company/sender-email` (mount load), `POST /company/sender-email` (start → SendGrid confirmation email, `status: pending`), `GET /company/sender-email/status` (manual "Refresh status" poll → flips to `verified` when the emailed link is clicked), `DELETE /company/sender-email` (revert to the branded alias/default). Three UI states — `none` (email input + "Verify this address"), `pending` (sent-to note + reassurance that nothing breaks until confirmed + Refresh/Remove), `verified` (green "✓ Verified…" + Remove). Client methods added to `companyApi` (`getSenderEmail`/`setSenderEmail`/`getSenderEmailStatus`/`deleteSenderEmail`). Backend was pre-built; web only added the client + UI. Controls gated behind `can('team_settings','full')` (same as the alias block). **Android does not yet have Tier 2.**
- **Dedicated phone number (Twilio) — web + android (P3.5, web 2026-07-14, Android 2026-07-14).** A "PHONE NUMBER" section (labeled block, mirroring BRANDED EMAIL) on **both** surfaces lets an owner self-serve a dedicated calls+texts number via `provisioning/phone/*`: `GET /provisioning/phone` (mount load; `configured===false` → muted "Phone provisioning isn't available yet." and stop), search by 3-digit area code (`GET /provisioning/phone/search?area_code=`), pick a number → ensure subaccount (`POST /provisioning/phone/subaccount`) then reserve it (`POST /provisioning/phone/select`), reset a pending pick (`DELETE /provisioning/phone/select`), and a usage line when active (`GET /provisioning/phone/usage`). Four UI states — `none`/`subaccount` (intro + area-code input + Search + result rows with per-row Request-this-number and a "$X.XX/mo + usage" line), `number_selected` ("Requested {number} — {price}/mo. Pending activation by the UltimatePro team." + "Choose a different number"), `active` (number shown prominently + "{sms} texts · {calls} calls · ${cost_usd} this month"). **The actual purchase is platform-approved and happens outside this UI — no money is spent here; the flow ends at the "Requested — pending activation" state.** All write actions gated behind `can('team_settings','full')` (Android: `canUi(role, perms, "team_settings", "full")`, same as the alias/sender blocks). Web client methods on `companyApi` (`getPhoneProvisioning`/`createPhoneSubaccount`/`searchPhoneNumbers`/`selectPhoneNumber`/`resetPhoneSelection`/`getPhoneUsage`); Android placed the section right after BRANDED EMAIL in `CompanyProfileScreen.kt`, wired through `ApiService` (`getPhoneProvision`/`createPhoneSubaccount`/`searchPhoneNumbers`/`selectPhoneNumber`/`clearPhoneSelection`/`getPhoneUsage`) → `CrmRepository` → `CompanyProfileViewModel` (models `PhoneProvision`/`PhoneNumberOption`/`PhoneSearch`/`PhoneSelect`/`PhoneUsage` in Models.kt). Backend was pre-built; both clients only added the client + UI. **Minor Android-vs-web gaps:** on Select/Reset Android updates the read view from the response body (or infers `subaccount` after reset) instead of re-fetching `GET /provisioning/phone`; and because `GET /provisioning/phone` returns no price, a cold reload into `number_selected` shows the "/mo" price only when it's already known in-session.
- **Gating asymmetry:** the page loads for any authenticated user (`GET` is `auth` only), but Save and logo upload are `ownerOrAdmin`, a non-admin can edit the form and only discover the 403 on Save.
- **Cloudinary credentials are hard-coded as fallbacks** in `company.js:8–12` (cloud_name/api_key/api_secret literals). Security follow-up (out of scope for this map; flagged).
