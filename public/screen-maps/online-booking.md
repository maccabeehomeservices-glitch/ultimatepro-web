# Screen Map, Online Booking

> **Format:** Action-Map Schema v1. Source of truth; the HTML atlas is rendered from it.
> When code changes this screen, update this file in the same commit. Reality on disk wins.

---

## SCREEN

| Field | Value |
|---|---|
| `screen_id` | `online-booking` |
| `display_name` | Online Booking |
| `surfaces` | android, web |
| `route_android` | `OnlineBookingSettingsScreen` + `OnlineBookingViewModel` (OnlineBookingSettingsScreen.kt) |
| `route_web` | `/settings/online-booking` → `OnlineBooking` (OnlineBooking.jsx, 158 lines) |
| `manages_table` | `booking_settings` (one row per company; auto-created on first GET) |
| `primary_actors` | owner, admin |
| `purpose` | Configure the public self-booking page (`/book?company=<UCM_ID>`): enable it, set display name/tagline, working days, time windows, service areas, services, confirmation message, and appointment/follow-up reminders. **FIXED 2026-06-07: web OnlineBooking.jsx now mirrors the backend FLAT schema (like Android) — save + load round-trip. The per-action `failure_modes` below describe the PRE-FIX state.** Web is now a full mirror of Android, incl. the booking-link card (Copy/Share) + every section. |
| `last_verified` | 2026-06-07 · Web OnlineBooking.jsx brought to FULL Android parity: added the **booking-link card** (link + Copy + Share; UCM ID from `GET /network/my-id`, URL = backend `/book?company=<ucm>`), **Availability** (working_days chips / time_windows toggles / max stepper), **Services Offered**, **Confirmation Message** — plus the earlier flat-schema fix (service_areas `{zip_code,radius_miles,label}`, `company_display_name`/`company_tagline`, flat `reminder_*`/`followup_*`). GET load now displays every saved field (Android-saved config shows on web). `primary_color` has no control on either platform (passed through). **The SPA `/book` stub now redirects to the working backend `/book?company=` form** (preserving the query) — the bare web-domain URL reaches a real booking page; the dead console.log stub is gone. Prior: 2026-05-31 Stage-1 audit, 6147cd1. |

### load_sequence
Both: `GET /settings/booking` → `SELECT * FROM booking_settings WHERE company_id`; if absent it **INSERTs a default row** and returns it. `service_areas` normalised to `[]` when null.

### gating
`/settings/booking` GET/PUT are `auth` only (no owner/admin gate). The public booking page (`/book`) and widget submit (`/bookings/widget/:slug`, `/bookings/submit`) are **public, no auth**.

### backend field contract (the source of the web mismatch)
`PUT /settings/booking` destructures **flat** keys: `enabled, company_display_name, company_tagline, primary_color, working_days, time_windows, max_bookings_per_window, service_area_zips, service_areas, services, confirmation_message, reminder_enabled, reminder_hours_before, reminder_method, followup_enabled, followup_days_after, followup_repeat_every, followup_max_reminders, followup_method`. Service areas are validated as `{ zip_code (5 digits), radius_miles (1–100) }` and new zips are geocoded into `zip_lat_cache`. UPSERT on `company_id` with COALESCE.

### entry_points
- Web: Settings → "Online Booking" (`/settings/online-booking`).
- Android: "More" → Business → "Online Booking".

---

## ACTIONS

---

### `online-booking.load`
- **label:** Load settings
- **section:** load
- **actors:** owner, admin
- **purpose:** Fetch the booking config into the form.
- **visibility:** on open.
- **route_chain:** `GET /settings/booking` (auto-creates the row if missing)
- **request_body:** n/a
- **side_effects:** may INSERT a default `booking_settings` row.
- **end_state:** Form populated.
- **failure_modes:** **web maps almost nothing**, it reads `business_name`/`tagline`/`appointment_reminders`/`followup_reminders` and `service_areas[].zip/.radius`, but the row has `company_display_name`/`company_tagline`/flat `reminder_*`/`followup_*` and `service_areas[].zip_code/.radius_miles` → web shows blank name/tagline, default-off reminders, and "undefined, undefined mi" for any existing area.
- **parity:** DIVERGENT, Android reads the correct keys (`companyDisplayName`, `companyTagline`, `serviceAreas[].zipCode/.radiusMiles`, flat reminder/followup) and populates fully.
- **status:** OK _(FIXED 2026-06-07: web aligned to backend flat keys)_
- **status_note:** Only `enabled` round-trips on web; the rest of the loaded config is misread.

### `online-booking.enable-toggle`
- **label:** Enable online booking
- **section:** general
- **actors:** owner, admin
- **purpose:** Master on/off for the public booking page.
- **visibility:** top toggle.
- **route_chain:** persisted via Save → `PUT /settings/booking` `{ enabled }`
- **request_body:** `{ enabled }`
- **side_effects:** sets `booking_settings.enabled`.
- **end_state:** Booking page on/off.
- **failure_modes:** none (this is the one key web sends that the backend reads).
- **parity:** MATCH, both send `enabled`; it persists on both.
- **status:** OK
- **status_note:** n/a
### `online-booking.appearance`
- **label:** Display name + tagline
- **section:** general
- **actors:** owner, admin
- **purpose:** Branding shown on the booking page.
- **visibility:** text inputs.
- **route_chain:** Save → `PUT /settings/booking`
- **request_body:** Android `{company_display_name, company_tagline}`; **web `{business_name, tagline}`** ✗
- **side_effects:** updates `company_display_name` / `company_tagline` (Android only).
- **end_state:** Branding saved (Android); discarded (web).
- **failure_modes:** **web sends `business_name`/`tagline`, the backend reads `company_display_name`/`company_tagline`** → silently ignored (COALESCE-null keeps old values). Nothing persists from web.
- **parity:** DIVERGENT, Android uses the correct keys; web uses wrong keys → no-op.
- **status:** OK _(FIXED 2026-06-07: web aligned to backend flat keys)_
- **status_note:** Wrong request keys; web edits never save.

### `online-booking.availability`
- **label:** Working days / time windows / max-per-window
- **section:** availability
- **actors:** owner, admin
- **purpose:** Define when slots are offered and capacity.
- **visibility:** both (web added 2026-06-07).
- **route_chain:** Save → `PUT /settings/booking` `{working_days, time_windows, max_bookings_per_window}`
- **request_body:** `{working_days:[…], time_windows:[{id,label,time,enabled}], max_bookings_per_window}`
- **side_effects:** updates those columns.
- **end_state:** Availability saved.
- **failure_modes:** none on Android.
- **parity:** MATCH _(web added 2026-06-07)_ — working-day chips (Mon–Sun), 3 preset time-window toggles, and a max-per-window stepper, mirroring Android.
- **status:** OK
- **status_note:** Works on Android; absent on web.

### `online-booking.service-areas`
- **label:** Service areas (ZIP + radius)
- **section:** service-area
- **actors:** owner, admin
- **purpose:** Limit booking to ZIPs within a radius.
- **visibility:** list + add.
- **route_chain:** Save → `PUT /settings/booking` `{service_areas:[…]}` → backend validates `zip_code`(5-digit) + `radius_miles`(1–100), geocodes new ZIPs
- **request_body:** Android `[{zip_code, radius_miles, label}]`; **web `[{zip, radius}]`** ✗
- **side_effects:** updates `service_areas` + `zip_lat_cache` (Android).
- **end_state:** Areas saved (Android); save fails (web).
- **failure_modes:** **web sends `{zip, radius}`; backend requires `zip_code`/`radius_miles`** → on Save with any web-added area, validation throws **400 "Invalid zip_code: undefined"**, failing the entire Save. Web also renders existing areas as "undefined, undefined mi" (reads `.zip`/`.radius`).
- **parity:** DIVERGENT, Android matches the contract (and a 5-digit/1–100 dialog); web's keys break both display and save.
- **status:** OK _(FIXED 2026-06-07: web aligned to backend flat keys)_
- **status_note:** Wrong keys → display broken + Save 400 when a web-added area is present.

### `online-booking.services-offered`
- **label:** Services offered
- **section:** services
- **actors:** owner, admin
- **purpose:** List bookable service types.
- **visibility:** both (web added 2026-06-07).
- **route_chain:** Save → `PUT /settings/booking` `{services:[…]}`
- **request_body:** `{services: ["…"]}`
- **side_effects:** updates `services`.
- **end_state:** Services saved.
- **failure_modes:** none on Android.
- **parity:** MATCH _(web added 2026-06-07)_ — services list with add/remove, mirroring Android.
- **status:** OK
- **status_note:** n/a
### `online-booking.confirmation-message`
- **label:** Confirmation message
- **section:** services
- **actors:** owner, admin
- **purpose:** Message shown after a customer books.
- **visibility:** both (web added 2026-06-07).
- **route_chain:** Save → `PUT /settings/booking` `{confirmation_message}`
- **request_body:** `{confirmation_message}`
- **side_effects:** updates `confirmation_message`.
- **end_state:** Saved.
- **failure_modes:** none on Android.
- **parity:** MATCH _(web added 2026-06-07)_ — confirmation-message textarea, mirroring Android.
- **status:** OK
- **status_note:** n/a
### `online-booking.appointment-reminders`
- **label:** Appointment reminders
- **section:** reminders
- **actors:** owner, admin
- **purpose:** Remind customers N hours before the appointment.
- **visibility:** toggle + hours + method.
- **route_chain:** Save → `PUT /settings/booking` flat `{reminder_enabled, reminder_hours_before, reminder_method}`
- **request_body:** Android flat `reminder_*`; **web nested `appointment_reminders:{enabled,hours_before,method}`** ✗
- **side_effects:** updates the flat `reminder_*` columns (Android).
- **end_state:** Reminders saved (Android); discarded (web).
- **failure_modes:** **web sends a nested `appointment_reminders` object; backend reads flat `reminder_enabled`/`reminder_hours_before`/`reminder_method`** → all three ignored.
- **parity:** DIVERGENT, Android sends flat keys; web's nested object is a no-op.
- **status:** OK _(FIXED 2026-06-07: web aligned to backend flat keys)_
- **status_note:** Nested-vs-flat shape mismatch; web reminder config never saves.

### `online-booking.followup-reminders`
- **label:** Follow-up reminders
- **section:** reminders
- **actors:** owner, admin
- **purpose:** Remind customers about unpaid invoices after service.
- **visibility:** toggle + days/repeat/max + method.
- **route_chain:** Save → `PUT /settings/booking` flat `{followup_enabled, followup_days_after, followup_repeat_every, followup_max_reminders, followup_method}`
- **request_body:** Android flat `followup_*`; **web nested `followup_reminders:{enabled,days_after,repeat_every,max_reminders,method}`** ✗
- **side_effects:** updates flat `followup_*` (Android).
- **end_state:** Saved (Android); discarded (web).
- **failure_modes:** **web sends a nested `followup_reminders` object; backend reads flat `followup_*`** → ignored.
- **parity:** DIVERGENT, same nested-vs-flat mismatch as appointment reminders.
- **status:** OK _(FIXED 2026-06-07: web aligned to backend flat keys)_
- **status_note:** Web follow-up config never saves.

### `online-booking.save`
- **label:** Save settings
- **section:** persist
- **actors:** owner, admin
- **purpose:** Persist the whole config.
- **visibility:** Save button.
- **route_chain:** `PUT /settings/booking` (UPSERT on company_id, COALESCE per field)
- **request_body:** the full settings object (web's keys mostly don't match, see fields above)
- **side_effects:** updates `booking_settings`.
- **end_state:** "Settings saved".
- **failure_modes:** **on web, only `enabled` actually persists**; everything else is dropped (wrong keys/shape), and if a web-added service area is present the request **400s** ("Invalid zip_code: undefined").
- **parity:** DIVERGENT, Android's Save persists every field correctly; web's Save is effectively an enabled-only toggle that can 400.
- **status:** OK _(FIXED 2026-06-07: web aligned to backend flat keys)_
- **status_note:** Mechanism is fine; web's payload keys are the problem.

### `online-booking.booking-link`
- **label:** Public booking link (copy)
- **section:** link
- **actors:** owner, admin
- **purpose:** Show/copy the public booking URL.
- **visibility:** both, shown when enabled + UCM ID loaded (web added 2026-06-07).
- **route_chain:** displays `https://…/book?company=<ultimatecrm_id>` (served by `routes/book.js`, mounted public at `/book`, no auth) + Copy
- **request_body:** n/a
- **side_effects:** clipboard.
- **end_state:** URL copied.
- **failure_modes:** none.
- **parity:** MATCH _(web added 2026-06-07)_ — both show the link when enabled; web adds **Copy + Share** (Web Share API, falls back to copy). UCM ID from `GET /network/my-id` (web) / `getCompanyRaw` (Android); the URL points at the backend `/book?company=<UCM_ID>` (book.js, public — server.js:94), NOT the web SPA.
- **status:** OK
- **status_note:** Confirmed `/book` route exists (public). Web users can't discover or share the link from this screen.

### `online-booking.back`
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

- **Web's payload keys do not match the backend.** Web sends `business_name`/`tagline` (backend wants `company_display_name`/`company_tagline`), nested `appointment_reminders`/`followup_reminders` objects (backend wants flat `reminder_*`/`followup_*`), and `service_areas[].zip/.radius` (backend wants `zip_code`/`radius_miles`). Net effect: **only the `enabled` toggle persists from web; adding a service area on web 400s the whole Save.** Android uses the correct contract throughout.
- ~~**Web is missing entire sections**~~ **FIXED 2026-06-07** — web now renders working days, time windows, max-per-window, services offered, confirmation message, and the **booking-link card** (Copy/Share), matching Android. Only `primary_color` has no control on either platform (a backend column, passed through unchanged).
- **The public booking link is Android-only.** `/book?company=<ultimatecrm_id>` is a real public page (server.js:94 → `routes/book.js`, no auth). Android shows + copies it; web never surfaces it.
- **`booking_settings` table DDL is not in committed `db/`** (created out-of-band, like roster_techs/job_sources). The authoritative column list is the `PUT /settings/booking` destructure. **UNVERIFIED** column types, but the column names are used consistently by the handler + Android.
- **No owner/admin gating** on `/settings/booking`. Service-area saves trigger Google geocoding of new ZIPs server-side (`zip_lat_cache`).
