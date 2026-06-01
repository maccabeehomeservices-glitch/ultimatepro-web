# Screen Map, Job Sources

> **Format:** Action-Map Schema v1. Source of truth; the HTML atlas is rendered from it.
> When code changes this screen, update this file in the same commit. Reality on disk wins.

---

## SCREEN

| Field | Value |
|---|---|
| `screen_id` | `job-sources` |
| `display_name` | Job Sources |
| `surfaces` | android, web |
| `route_android` | `JobSourcesScreen` + `JobSourceViewModel` (JobSourcesScreen.kt) |
| `route_web` | `/settings/job-sources` → `JobSources` (JobSources.jsx, 812 lines) |
| `manages_table` | `job_sources` (source contacts) + `ad_channels` + `commission_rules`, three tabs, three tables |
| `primary_actors` | owner, admin |
| `purpose` | A 3-tab manager for where jobs come from and how they pay out: **Source Contacts** (referral partners / warranty cos, with a `profit_allocation_pct` that the profit engine reads), **Ad Channels** (own-company lead channels), and **Commission Rules** (per-source tech-commission overrides). Well-matched across web and Android. |
| `last_verified` | 2026-05-31 · Stage-1 read-only audit · commit: 6147cd1 |

### load_sequence
Both load all three feeds: `GET /sources/contacts` (job_sources, active only, by name), `GET /sources/channels` (ad_channels, **seeds 7 defaults** if none exist), `GET /sources/commission-rules` (joined to source/channel names).

### gating
All `/sources/*` routes are `auth` only, **no `ownerOrAdmin` check** on this router (unlike company/users). Any authenticated user can CRUD sources/channels/rules.

### profit-engine link (confirmed)
`job_sources.profit_allocation_pct` is **priority #1** for a job's source-cut in `utils/profit.js` (lines 18, 96–104): when `job.job_source_id` is set, `sourcePct = job_sources.profit_allocation_pct`. `commission_rules.tech_commission_pct` is resolved per job via `GET /sources/commission-rules/resolve` (source_contact → ad_channel → network → default).

### entry_points
- Web: Settings → "Job Sources" (`/settings/job-sources`).
- Android: "More" → Business → "Job Sources".

---

## ACTIONS

---

### `job-sources.contacts-list`
- **label:** List source contacts
- **section:** contacts
- **actors:** owner, admin
- **purpose:** Show referral/source contacts with profit allocation.
- **visibility:** Contacts tab (default).
- **route_chain:** `GET /sources/contacts` → `SELECT * FROM job_sources WHERE company_id AND is_active = true ORDER BY name`
- **request_body:** n/a
- **side_effects:** read-only.
- **end_state:** Contact cards (name, company, phone·email, "% profit allocation").
- **failure_modes:** none.
- **parity:** MATCH, web `sourcesApi.getContacts()`; Android `repo.getSourceContacts()`.
- **status:** OK
- **status_note:** Inactive/archived contacts are excluded server-side on both.

### `job-sources.contact-create`
- **label:** Add source contact
- **section:** contacts
- **actors:** owner, admin
- **purpose:** Add a job-source contact.
- **visibility:** "+ Add" (web) / FAB (Android) on the Contacts tab.
- **precondition:** name non-blank.
- **confirm:** n/a
- **route_chain:** `POST /sources/contacts` → `INSERT INTO job_sources (...)`
- **request_body:** `{name, company_name, phone, email, profit_allocation_pct, send_updates, send_closings, notes}`
- **side_effects:** inserts a `job_sources` row (`send_updates`/`send_closings` default true).
- **end_state:** New contact in list.
- **failure_modes:** 400 if name missing.
- **parity:** MATCH, identical field set and keys on both surfaces. `profit_allocation_pct` parsed to a number; `send_updates`/`send_closings` are toggles.
- **status:** OK
- **status_note:** n/a
### `job-sources.contact-edit`
- **label:** Edit source contact
- **section:** contacts
- **actors:** owner, admin
- **purpose:** Update a source contact.
- **visibility:** ✏️ per contact.
- **precondition:** n/a
- **confirm:** n/a
- **route_chain:** `PUT /sources/contacts/:id` → COALESCE update of all eight fields + `is_active`
- **request_body:** `{name, company_name, phone, email, profit_allocation_pct, send_updates, send_closings, notes}`
- **side_effects:** updates the `job_sources` row.
- **end_state:** Updated card.
- **failure_modes:** 404 if not found.
- **parity:** MATCH, same endpoint + keys on both.
- **status:** OK
- **status_note:** n/a
### `job-sources.contact-delete`
- **label:** Remove (archive) contact
- **section:** contacts
- **actors:** owner, admin
- **purpose:** Archive a source contact.
- **visibility:** 🗑 per contact, with confirm.
- **precondition:** n/a
- **confirm:** confirm modal/dialog.
- **route_chain:** `DELETE /sources/contacts/:id` → `UPDATE job_sources SET is_active = false`
- **request_body:** n/a
- **side_effects:** soft archive (won't appear in new job forms).
- **end_state:** Contact removed from the active list.
- **failure_modes:** 404 if not found.
- **parity:** MATCH, both call `DELETE /sources/contacts/:id`; both copy says "archived, won't appear in new job forms."
- **status:** OK
- **status_note:** n/a
### `job-sources.contact-toggle`
- **label:** Toggle contact active (Android)
- **section:** contacts
- **actors:** owner, admin
- **purpose:** Flip a contact's `is_active` directly from the card.
- **visibility:** Android only, a switch on each contact card.
- **precondition:** n/a
- **confirm:** n/a
- **route_chain:** `PUT /sources/contacts/:id` with `{ is_active: !current }`
- **request_body:** `{ is_active }`
- **side_effects:** sets `is_active`; turning it off removes the contact from the (active-only) list.
- **end_state:** Contact toggled.
- **failure_modes:** none.
- **parity:** ANDROID-ONLY, web has no per-contact active switch (web only archives via delete). Since the list is active-only on both, toggling off behaves like archiving.
- **status:** OK
- **status_note:** n/a
### `job-sources.channels-list`
- **label:** List ad channels
- **section:** channels
- **actors:** owner, admin
- **purpose:** Show own-company lead channels.
- **visibility:** Ad Channels tab.
- **route_chain:** `GET /sources/channels` → seeds 7 defaults (Google Ads, Yelp, Facebook, Referral, Walk-in, Repeat Customer, Other) if none exist, then lists by `display_order`
- **request_body:** n/a
- **side_effects:** **first load inserts default channels** for the company (a write on a GET).
- **end_state:** Channel rows with active toggles; custom ones tagged "Custom".
- **failure_modes:** none.
- **parity:** MATCH, web `getChannels()`; Android `getAdChannels()`.
- **status:** OK
- **status_note:** The default-seeding side effect runs once per company on first GET.

### `job-sources.channel-toggle`
- **label:** Toggle ad channel active
- **section:** channels
- **actors:** owner, admin
- **purpose:** Enable/disable a channel.
- **visibility:** switch per channel.
- **route_chain:** `PUT /sources/channels/:id` with `{ is_active }`
- **request_body:** `{ is_active }`
- **side_effects:** updates `ad_channels.is_active`.
- **end_state:** Channel toggled.
- **failure_modes:** 404 if not found.
- **parity:** MATCH, both toggle via `PUT /sources/channels/:id`.
- **status:** OK
- **status_note:** n/a
### `job-sources.channel-add`
- **label:** Add custom channel
- **section:** channels
- **actors:** owner, admin
- **purpose:** Create a custom ad channel.
- **visibility:** "+ Add Custom Channel".
- **precondition:** name non-blank.
- **confirm:** n/a
- **route_chain:** `POST /sources/channels` `{name}` → INSERT (`is_custom=true`, `display_order = max+1`)
- **request_body:** `{ name }`
- **side_effects:** inserts a custom `ad_channels` row.
- **end_state:** New channel in list.
- **failure_modes:** 400 if name missing.
- **parity:** MATCH, web `createChannel(name)`; Android `addChannel(name)`.
- **status:** OK
- **status_note:** n/a
### `job-sources.channel-rename`
- **label:** Rename custom channel
- **section:** channels
- **actors:** owner, admin
- **purpose:** Rename a custom channel.
- **visibility:** ✏️ on custom channels only (defaults can't be renamed).
- **precondition:** n/a
- **confirm:** n/a
- **route_chain:** `PUT /sources/channels/:id` `{name}`
- **request_body:** `{ name }`
- **side_effects:** updates the channel name.
- **end_state:** Renamed.
- **failure_modes:** 404 if not found.
- **parity:** MATCH, both gate rename to custom channels; no delete for channels on either surface.
- **status:** OK
- **status_note:** n/a
### `job-sources.rules-list`
- **label:** List commission rules
- **section:** commission
- **actors:** owner, admin
- **purpose:** Show the default + source-specific tech-commission rules.
- **visibility:** Commission tab.
- **route_chain:** `GET /sources/commission-rules` → joined to `job_sources.name` / `ad_channels.name`
- **request_body:** n/a
- **side_effects:** read-only.
- **end_state:** A default-rule card + a list of source-specific rules.
- **failure_modes:** none.
- **parity:** MATCH, both split `rule_type === 'default'` from the rest; both label by source/channel/network.
- **status:** OK
- **status_note:** n/a
### `job-sources.rule-save`
- **label:** Add / edit commission rule
- **section:** commission
- **actors:** owner, admin
- **purpose:** Set the tech-commission % for default / a source contact / an ad channel / network jobs.
- **visibility:** "+ Add Rule" / "Set Default" / ✏️.
- **precondition:** rule_type chosen; the matching source/channel selected; pct 0–100.
- **confirm:** n/a
- **route_chain:** `POST /sources/commission-rules` (UPSERT `ON CONFLICT (company_id, rule_type, job_source_id, ad_channel_id) DO UPDATE`)
- **request_body:** `{rule_type, job_source_id, ad_channel_id, tech_commission_pct, notes}`
- **side_effects:** inserts or updates a `commission_rules` row; feeds `/commission-rules/resolve` and the profit/payroll calc.
- **end_state:** Rule saved.
- **failure_modes:** 400 if `rule_type` missing or pct outside 0–100; both clients also validate client-side.
- **parity:** MATCH, same upsert endpoint + keys. Web disables the type `<select>` on edit; Android uses radio buttons; both pre-select an existing default when "Set Default" is used.
- **status:** OK
- **status_note:** See drift, the `ON CONFLICT` dedupe for `default`/`network` rules (null source+channel ids) may not fire under standard NULL-distinct index semantics (UNVERIFIED).

### `job-sources.rule-delete`
- **label:** Delete commission rule
- **section:** commission
- **actors:** owner, admin
- **purpose:** Remove a commission rule.
- **visibility:** 🗑 per rule (and on the default card).
- **precondition:** n/a
- **confirm:** confirm (web) / immediate (Android).
- **route_chain:** `DELETE /sources/commission-rules/:id` → hard `DELETE`
- **request_body:** n/a
- **side_effects:** permanently removes the row (not a soft delete).
- **end_state:** Rule gone.
- **failure_modes:** 404 if not found.
- **parity:** MATCH, both hard-delete. Web shows a confirm modal ("permanently deleted"); Android deletes immediately on the trash tap.
- **status:** OK
- **status_note:** Unlike contacts (soft-archive), rules are hard-deleted.

### `job-sources.back`
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

- **`profit_allocation_pct` is wired to the profit engine (confirmed).** `utils/profit.js` reads `job_sources.profit_allocation_pct` as the #1 source-cut when a job has `job_source_id` (lines 96–104), falling back to `profit_rules.source_pct` / default / 0. So editing it here directly changes profit splits.
- **No owner/admin gating on `/sources/*`.** Every route is `auth` only, any authenticated user (incl. technician/dispatcher) can create/edit/delete sources, channels, and commission rules. Contrast with company/users (which are `ownerOrAdmin`).
- **`GET /sources/channels` writes on read.** First load for a company INSERTs the 7 default channels, a side effect on a GET. Harmless but unusual.
- **Commission-rule upsert may not dedupe null-id rules.** `ON CONFLICT (company_id, rule_type, job_source_id, ad_channel_id)` relies on a unique index; for `default`/`network` rules both id columns are NULL, and under standard Postgres semantics NULLs are distinct, so the conflict target may not match → **possible duplicate default/network rules** unless the index uses `NULLS NOT DISTINCT`. **UNVERIFIED**, the `commission_rules` DDL is not in committed `db/` files. The web UI mitigates by editing an existing default instead of adding a second one.
- **`job_sources` table DDL is not in committed SQL** (like `roster_techs`). Columns `name, company_name, phone, email, profit_allocation_pct, send_updates, send_closings, notes, is_active, company_id` are used consistently by the handler and both clients; **UNVERIFIED** column types.
- **Report endpoints exist but aren't on this screen.** `sourcesApi.getReport` / `exportReport` (and `GET /sources/report[/export]`) power the Reports screen, not Job Sources, no dead buttons here.
