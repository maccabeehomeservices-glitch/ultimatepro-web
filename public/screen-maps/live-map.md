# Screen Map, Live Map

> **Format:** Action-Map Schema v1. Source of truth; the HTML atlas is rendered from it.
> When code changes this screen, update this file in the same commit. Reality on disk wins.

---

## SCREEN

| Field | Value |
|---|---|
| `screen_id` | `live-map` |
| `display_name` | Live Map |
| `surfaces` | android, web |
| `route_android` | `LiveMapScreen(onBack, onJob)` + `MapViewModel` (LiveMapScreen.kt) |
| `route_web` | `/map` (or dashboard map tile) → `LiveMap` (LiveMap.jsx, 232 lines) |
| `primary_actors` | office, owner |
| `purpose` | A Google-Maps view of the day: active **job pins** (status-colored) and live **technician pins** (blue), each tappable for detail and a jump to the Job Detail. Polls so positions stay current. |
| `last_verified` | 2026-05-31 · Stage-1 read-only audit · commit: 6147cd1 |

### load_sequence
Both surfaces load two feeds: **jobs** `GET /jobs?status=scheduled,en_route,in_progress,unscheduled` (web `limit=200`; Android `page=1`) and **techs** `GET /gps/live` (a **bare array** of technicians who pinged within the last 5 min, role `technician`, `is_active`, each joined to their current `in_progress` job). Pins with stored `lat/lng` are placed directly; otherwise the client geocodes the full address. **Poll intervals differ: web reloads both feeds every 30 s; Android polls techs every 15 s and loads jobs once (re-loads on resume / manual refresh).**

### entry_points
- Web: Dashboard map tile / back button returns to `/dashboard`.
- Android: navigated as `LiveMapScreen`; back via `onBack`.

---

## ACTIONS

---

### `live-map.load-jobs`
- **label:** Load + plot job pins
- **section:** map
- **actors:** office, owner
- **purpose:** Show active jobs as status-colored pins.
- **visibility:** on open.
- **precondition:** n/a
- **confirm:** n/a
- **route_chain:** `GET /jobs?status=scheduled,en_route,in_progress,unscheduled` (web `limit=200`; Android `page=1`, then filters `isActive`)
- **request_body:** n/a
- **side_effects:** read; client may geocode (see `geocode-fallback`).
- **end_state:** Colored circle pins; tap opens job detail.
- **failure_modes:** jobs without coords AND without a geocodable address are silently dropped.
- **parity:** MATCH, same endpoint + status filter. Web reloads jobs every 30 s with the tech poll; Android loads jobs once on open and on resume / refresh (not on the 15 s tech timer).
- **status:** OK
- **status_note:** Color mapping: web `statusColor(status)`; Android `jobStatusHue(status)`, both keyed off the same status vocab.

### `live-map.load-techs`
- **label:** Load + plot tech pins
- **section:** map
- **actors:** office, owner
- **purpose:** Show live technician locations (blue pins).
- **visibility:** on open, then polled.
- **precondition:** tech has pinged GPS within 5 min.
- **confirm:** n/a
- **route_chain:** `GET /gps/live` (bare array; server filters role=technician, is_active, `recorded_at >= now-5min`, LATERAL-joins current `in_progress` job)
- **request_body:** n/a
- **side_effects:** read-only.
- **end_state:** Blue pins (web labels with initial); tap shows tech detail.
- **failure_modes:** techs not pinging within 5 min disappear from the feed.
- **parity:** PARTIAL (timing), **web polls every 30 s, Android every 15 s.** Same endpoint/shape. Web tolerates the bare array via `gpsRes.data?.techs || gpsRes.data`.
- **status:** OK
- **status_note:** Depends on the tech app sending `POST /gps/ping`; the ping sender is a field-app concern (UNVERIFIED here).

### `live-map.job-pin-open`
- **label:** Open Job from pin
- **section:** map
- **actors:** office, owner
- **purpose:** Jump from a job pin to that job's detail.
- **visibility:** tap a job pin.
- **precondition:** n/a
- **confirm:** n/a
- **route_chain:** tap → detail card/InfoWindow → open Job Detail (web `<a href="/jobs/:id">` intercepted to SPA `navigate`; Android `onJob(job.id)`)
- **request_body:** n/a
- **side_effects:** navigation only.
- **end_state:** Job Detail screen.
- **failure_modes:** none.
- **parity:** MATCH, both pin → detail → Job Detail. Web InfoWindow shows job_number / title / customer / status / schedule + an address-mismatch warning when `address_verified === false`; Android shows a bottom card with the same essentials.
- **status:** OK
- **status_note:** n/a
### `live-map.tech-pin-open`
- **label:** Open tech (and their job) from pin
- **section:** map
- **actors:** office, owner
- **purpose:** Inspect a technician and, on Android, jump to the job they're on.
- **visibility:** tap a tech pin.
- **precondition:** n/a
- **confirm:** n/a
- **route_chain:** tap → tech detail; Android card adds `onJob(current_job_id)` when the tech has an `in_progress` job
- **request_body:** n/a
- **side_effects:** navigation only (Android).
- **end_state:** Tech info; Android can open the active job.
- **failure_modes:** none.
- **parity:** DIVERGENT, **Web tech pin is info-only** (name + `current_job_title` or "Available", no navigation). **Android** shows a bottom card with name / current job / address and an Open-in-new button → `onJob(current_job_id)` that opens the tech's active job. Android can also show `job_address`; web cannot navigate from a tech pin.
- **status:** PARTIAL
- **status_note:** The tech→job jump exists only on Android.

### `live-map.geocode-fallback`
- **label:** Geocode address when no coords
- **section:** map
- **actors:** office, owner
- **purpose:** Place a pin even when the job/tech row has no stored `lat/lng`.
- **visibility:** automatic.
- **precondition:** job has an address/city.
- **confirm:** n/a
- **route_chain:** client-side Google geocoding (web `google.maps.Geocoder`; Android `GET maps.googleapis.com/maps/api/geocode/json`, cached in-memory)
- **request_body:** n/a
- **side_effects:** external Google Maps call.
- **end_state:** Pin placed at the geocoded location.
- **failure_modes:** geocode `status != OK` → pin silently skipped.
- **parity:** MATCH (behavior), both geocode client-side and prefer stored coords first. **Note:** the two surfaces use *different hardcoded* Google Maps API keys (see drift).
- **status:** OK
- **status_note:** n/a
### `live-map.refresh`
- **label:** Refresh
- **section:** nav
- **actors:** office, owner
- **purpose:** Manually re-pull the map.
- **visibility:** refresh button (web) / resume + refresh (Android).
- **precondition:** n/a
- **confirm:** n/a
- **route_chain:** web `fetchData()` (jobs + techs); Android `refresh()` → `loadJobPins()` (jobs only; techs keep polling)
- **request_body:** n/a
- **side_effects:** read.
- **end_state:** Fresh pins.
- **failure_modes:** none.
- **parity:** PARTIAL, web refresh reloads both feeds; Android manual refresh reloads jobs only (techs are on their own 15 s loop).
- **status:** OK
- **status_note:** n/a
### `live-map.auto-zoom`
- **label:** Auto-fit to pins
- **section:** map
- **actors:** office, owner
- **purpose:** Frame all pins on first load.
- **visibility:** automatic, once.
- **precondition:** at least one pin.
- **confirm:** n/a
- **route_chain:**, (UI only)
- **request_body:** n/a
- **side_effects:** none.
- **end_state:** Map fit to bounds (or zoomed to a single pin).
- **failure_modes:** none.
- **parity:** MATCH, web `map.fitBounds`; Android `newLatLngBounds` (once, guarded by `hasAutoZoomed`). Default center 36.8529,-75.978 zoom 11 on both.
- **status:** OK
- **status_note:** n/a
### `live-map.back`
- **label:** Back
- **section:** nav
- **actors:** office, owner
- **purpose:** Leave the map.
- **visibility:** top-left.
- **precondition:** n/a
- **confirm:** n/a
- **route_chain:** web `navigate('/dashboard')`; Android `onBack`
- **request_body:** n/a
- **side_effects:** none.
- **end_state:** Previous screen.
- **failure_modes:** none.
- **parity:** MATCH, web hard-routes to `/dashboard`; Android pops the back stack.
- **status:** OK
- **status_note:** n/a
---

## SCREEN-LEVEL DRIFT FLAGS

- **Poll cadence differs:** web reloads jobs+techs together every **30 s**; Android polls techs every **15 s** and loads jobs once (on open / resume / manual refresh). Tech positions are fresher on Android; web jobs re-fetch more often.
- **Tech pin navigation is Android-only.** Web tech pins are display-only; Android tech pins can open the tech's `in_progress` job. Web users must find the job another way.
- **Two different hardcoded Google Maps API keys live in client source**, web JS SDK key (`…kJiNQ`, LiveMap.jsx:5) and Android geocoding key (`…vQjyk`, LiveMapScreen.kt:118). Both are committed in plaintext; rotating/​restricting them is a security follow-up (out of scope for this map, but flagged).
- **`GET /gps/live` is a bare array** filtered to techs that pinged within 5 min. Both clients tolerate the shape. Depends on the field app sending `POST /gps/ping`, **UNVERIFIED** here whether/how often the tech app pings.
- **Silent pin drops:** jobs with neither coords nor a geocodable address, and failed geocodes, are dropped without a user-visible message on both surfaces.
