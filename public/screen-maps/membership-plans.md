# Screen Map, Membership Plans

> **Format:** Action-Map Schema v1. Source of truth; the HTML atlas is rendered from it.
> When code changes this screen, update this file in the same commit. Reality on disk wins.

---

## SCREEN

| Field | Value |
|---|---|
| `screen_id` | `membership-plans` |
| `display_name` | Membership Plans |
| `surfaces` | android, web |
| `route_android` | `MembershipPlansScreen` + `MembershipViewModel` (MembershipPlansScreen.kt) |
| `route_web` | `/settings/membership-plans` → `MembershipPlans` (MembershipPlans.jsx, 126 lines) |
| `manages_table` | **`membership_plans`** (the reusable plan *templates*), NOT `customer_memberships` (a customer's enrollment) |
| `primary_actors` | owner, admin |
| `purpose` | CRUD for membership plan templates (name, description, frequency, price). A plan's `frequency` drives the recurring-job cadence when a customer is enrolled. Android additionally lets you assign a plan to a customer from here (creating a `customer_memberships` row + first job); web does not. |
| `last_verified` | 2026-06-07 · Tier 3 Batch 1: web frequency vocab aligned to `weekly/monthly/quarterly/semi_annually/annually` (was `semi_annual`/`annual` → violated the DB CHECK → create failed). Backend next-job base now reads `jobs.scheduled_start` (was `scheduled_date`, non-existent → today). **Edit now preserves `is_active`** (was omitted → backend re-activated a deactivated plan). Prior: 2026-05-31 Stage-1 audit, 6147cd1. |

### plans vs enrollments (do not conflate)
- **`membership_plans`** = templates managed on *this* screen (`/memberships/plans`).
- **`customer_memberships`** = a specific customer's enrollment in a plan (`/memberships/customer/:customerId`, `/memberships/:id`, `/memberships/:id/create-next-job`). On web these are managed from Customer Detail; on Android the "assign" action here creates one.

### load_sequence
Both: `GET /memberships/plans` → `SELECT * FROM membership_plans WHERE company_id ORDER BY name` (bare array). `routes/memberships.js` applies `router.use(auth)` globally (auth on every route).

### gating
`auth` only, no owner/admin gate.

### entry_points
- Web: Settings → "Membership Plans" (`/settings/membership-plans`).
- Android: "More" → Business → "Membership Plans".

---

## ACTIONS

---

### `membership-plans.list`
- **label:** List plans
- **section:** list
- **actors:** owner, admin
- **purpose:** Show membership plan templates.
- **visibility:** on open.
- **route_chain:** `GET /memberships/plans`
- **request_body:** n/a
- **side_effects:** read-only.
- **end_state:** Plan cards (name, frequency · price, description).
- **failure_modes:** none.
- **parity:** MATCH, web `useGet('/memberships/plans')` (`data?.plans || data` → bare array); Android `vm.loadPlans()`. Android also shows an "Inactive" tag for `is_active=false`; web shows no active state.
- **status:** OK
- **status_note:** GET returns all plans (no `is_active` filter) on both.

### `membership-plans.add`
- **label:** Add plan
- **section:** write
- **actors:** owner, admin
- **purpose:** Create a plan template.
- **visibility:** "Add" (web) / + (Android).
- **precondition:** name non-blank.
- **confirm:** n/a
- **route_chain:** `POST /memberships/plans` → `INSERT INTO membership_plans (company_id, name, description, frequency, price)`
- **request_body:** `{name, description, frequency, price}`
- **side_effects:** inserts a `membership_plans` row.
- **end_state:** New plan in list.
- **failure_modes:** 400 if name/frequency/price missing.
- **parity:** MATCH _(2026-06-07: web frequency vocab aligned to `weekly / monthly / quarterly / semi_annually / annually`, matching the DB CHECK + `calculateNextJobDate` + Android)._ Previously web sent `semi_annual`/`annual`, which **violated the `membership_plans.frequency` CHECK constraint → plan creation failed**; now those values pass and schedule the correct cadence. Also fixed: the next-job base date now reads `jobs.scheduled_start` (was `scheduled_date`, a non-existent column → defaulted to today).
- **status:** OK
- **status_note:** n/a

### `membership-plans.edit`
- **label:** Edit plan
- **section:** write
- **actors:** owner, admin
- **purpose:** Update a plan template.
- **visibility:** edit per card.
- **precondition:** n/a
- **confirm:** n/a
- **route_chain:** `PUT /memberships/plans/:id` → `UPDATE … SET name, description, frequency, price, is_active` (direct set, not COALESCE)
- **request_body:** web `{name, frequency, price, description}` (no is_active → backend forces `is_active=true`); Android `{name, description, frequency, price, is_active=plan.isActive}`
- **side_effects:** overwrites the row.
- **end_state:** Updated card.
- **failure_modes:** 404 if not found.
- **parity:** DIVERGENT, same frequency-vocab issue as add. Also: web's `<select>` can't represent Android's `annually`/`semi_annually`/`weekly` values (it preserves an unedited value but only offers its own 4 on change); **web edit also re-activates the plan** (sends no `is_active` → backend defaults it to `true`), whereas Android preserves the current `is_active`.
- **status:** PARTIAL
- **status_note:** Edits persist, but frequency-vocab + the web is_active-reset are real footguns.

### `membership-plans.delete`
- **label:** Delete plan
- **section:** write
- **actors:** owner, admin
- **purpose:** Remove a plan template.
- **visibility:** 🗑 per card, with confirm.
- **precondition:** n/a
- **confirm:** confirm modal/dialog.
- **route_chain:** `DELETE /memberships/plans/:id` → hard `DELETE`
- **request_body:** n/a
- **side_effects:** removes the template row. Existing `customer_memberships` referencing it are **not** removed (their `plan_id` is left dangling; joins return null plan name).
- **end_state:** Plan gone from list.
- **failure_modes:** none surfaced (delete is idempotent, no rows-affected check).
- **parity:** MATCH, both hard-delete. Android's dialog explicitly notes "existing customer memberships using this plan will not be removed"; web just says "cannot be undone".
- **status:** OK
- **status_note:** Hard delete; dangling enrollments are possible (no FK cleanup shown).

### `membership-plans.assign-to-customer`
- **label:** Assign plan to a customer (Android)
- **section:** write
- **actors:** owner, admin
- **purpose:** Enroll a customer in this plan (creates a `customer_memberships` row + first scheduled job).
- **visibility:** Android only, a person-add icon per plan card.
- **precondition:** a customer selected; optional start/end/renewal dates + notes.
- **confirm:** n/a
- **route_chain:** `POST /memberships/customer/:customerId` → INSERT `customer_memberships` (computes `next_job_date` via `calculateNextJobDate(start, plan.frequency)`)
- **request_body:** `{plan_id, start_date, end_date, renewal_date, notes}`
- **side_effects:** creates an enrollment; the screen reports "membership assigned and N job(s) created".
- **end_state:** Customer enrolled.
- **failure_modes:** 404 if plan not found; 400 if `plan_id` missing.
- **parity:** ANDROID-ONLY, **the web Membership Plans page has no assign action** (web enrolls customers from Customer Detail instead). This is where the plan→enrollment bridge lives on Android.
- **status:** OK
- **status_note:** Touches `customer_memberships`, not `membership_plans`, included because it's an action on this Android screen.

### `membership-plans.back`
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

- **Frequency vocabulary mismatch (real bug).** Web offers `monthly / quarterly / semi_annual / annual`; Android + the scheduler use `weekly / monthly / quarterly / semi_annually / annually`. `calculateNextJobDate` (memberships.js:9) switches on the Android spellings, so a plan saved from web with `annual` or `semi_annual` **falls to the default monthly cadence** when enrolled. Web also can't create `weekly` plans. Fix: align web's option values to `annually`/`semi_annually` (+ add `weekly`).
- **Assign is Android-only here.** The plan→customer enrollment (`customer_memberships` + first job) is reachable from this screen only on Android; web users enroll from Customer Detail.
- **`payment_method`, `services_included`, `terms_and_conditions` are never touched.** The Batch-F task listed them as plan columns, but `memberships.js` reads/writes only `name, description, frequency, price, is_active`. They appear nowhere in the handler or either client, **UNVERIFIED** whether they even exist as columns; if they do, they have no input anywhere.
- **`membership_plans` table DDL is not in committed `db/`** (out-of-band, like roster_techs/job_sources/booking_settings). Column set authoritative from the handler.
- **Hard delete leaves dangling enrollments.** Deleting a plan doesn't cascade to `customer_memberships`; their `plan_id` becomes orphaned (joins then return a null plan name). Android warns about this; web doesn't.
- **`is_active` can't be toggled** from either editor (no UI). Web edit forces it back to `true`; Android preserves the existing value. GET lists all plans regardless of `is_active`.
