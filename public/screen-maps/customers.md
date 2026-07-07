# Screen Map, Customers (List)

> **Format:** Action-Map Schema v1. Source of truth; the HTML atlas is rendered from it.
> When code changes this screen, update this file in the same commit. Reality on disk wins.

---

## SCREEN

| Field | Value |
|---|---|
| `screen_id` | `customers` |
| `display_name` | Customers (List) |
| `surfaces` | android, web |
| `route_android` | `customers` → `CustomerListScreen` (CustomerScreens.kt 217–365) |
| `route_web` | `/customers` → `Customers` (Customers.jsx, 259 lines) |
| `primary_actors` | office, owner |
| `purpose` | Find a customer and act on them: search, filter, open a customer, add a new one, or import a batch. The list is the entry point to Customer Detail. (Bulk delete removed — customers are permanent, P2.1l.) |
| `last_verified` | 2026-07-07 · P2.1l Part A: customer bulk-delete/selection removed (customers permanent). Prior: 2026-05-31 · Stage-1 read-only audit · commit: 9366abe |

### load_sequence
`GET /customers?page&limit=50&search?&type?` → `{customers}`. Web paginates explicitly (page state + "Load more"); Android `vm.load(search)` with pull-to-refresh and an `ON_RESUME` reload.

### entry_points
- Both: bottom-nav "Customers" tab. Also reached from places that link to `/customers/:id` (the list itself is the tab root).

---

## ACTIONS

---

### `customers.search`
- **label:** Search box
- **section:** filters
- **actors:** office, owner
- **purpose:** Find customers by name/phone/email.
- **visibility:** always
- **precondition:** n/a
- **confirm:** n/a
- **route_chain:** `GET /customers?search=` (web debounced 300 ms; Android live `vm.load`)
- **request_body:** n/a
- **side_effects:** `read-refresh`
- **end_state:** Filtered list.
- **failure_modes:** none.
- **parity:** MATCH, both filter via the `search` query param.
- **status:** OK
- **status_note:** n/a
### `customers.type-filter`
- **label:** All / Residential / Commercial chips
- **section:** filters
- **actors:** office, owner
- **purpose:** Filter the list by customer type.
- **visibility:** web only.
- **precondition:** n/a
- **confirm:** n/a
- **route_chain:** `GET /customers?type=residential|commercial`
- **request_body:** n/a
- **side_effects:** `read-refresh`
- **end_state:** Filtered list.
- **failure_modes:** none.
- **parity:** WEB-ONLY, Android shows a type badge per row but has no type filter (search only).
- **status:** OK
- **status_note:** n/a
### `customers.refresh`
- **label:** Refresh
- **section:** header
- **actors:** office, owner
- **purpose:** Reload the list.
- **visibility:** always
- **precondition:** n/a
- **confirm:** n/a
- **route_chain:** re-issues `GET /customers`
- **request_body:** n/a
- **side_effects:** `read-refresh`
- **end_state:** Fresh list.
- **failure_modes:** none.
- **parity:** PARTIAL, web has a Refresh button; Android uses pull-to-refresh + an `ON_RESUME` reload.
- **status:** OK
- **status_note:** n/a
### `customers.pagination`
- **label:** Load more / scroll
- **section:** list footer
- **actors:** office, owner
- **purpose:** Page through results beyond the first 50.
- **visibility:** web: a "Load more customers..." button when a full page (50) returned. Android: scroll list.
- **precondition:** more results exist.
- **confirm:** n/a
- **route_chain:** `GET /customers?page=N&limit=50`
- **request_body:** n/a
- **side_effects:** appends to the list.
- **end_state:** More rows.
- **failure_modes:** none observed.
- **parity:** DIVERGENT, web is explicit page-increment "Load more"; Android's pagination behavior inside `vm.load` is **UNVERIFIED** (no visible load-more control).
- **status:** OK
- **status_note:** n/a
### `customers.customer-open`
- **label:** Customer row/card
- **section:** list
- **actors:** office, owner
- **purpose:** Open a customer's detail.
- **visibility:** when not in selection mode.
- **precondition:** n/a
- **confirm:** n/a
- **route_chain:** navigate `/customers/:id`
- **request_body:** n/a
- **side_effects:** `navigate`
- **end_state:** Customer Detail.
- **failure_modes:** none.
- **parity:** MATCH, both open Customer Detail (Android long-press enters selection mode instead).
- **status:** OK
- **status_note:** Rows show Member / Returning badges (web) and a type/Member badge (Android).

### `customers.new-customer`
- **label:** + New (FAB / Add)
- **section:** fab / header
- **actors:** office, owner
- **purpose:** Create a new customer.
- **visibility:** always (FAB + header icon; web empty-state also has "Add Customer").
- **precondition:** n/a
- **confirm:** n/a
- **route_chain:** navigate `/customers/new` → `POST /customers` (on save in the form)
- **request_body:** (form), not built on this screen
- **side_effects:** `navigate`
- **end_state:** New Customer form.
- **failure_modes:** none.
- **parity:** MATCH, both have a FAB/header "New".
- **status:** OK
- **status_note:** n/a
### `customers.import`
- **label:** Import
- **section:** header
- **actors:** office, owner
- **purpose:** Bulk-import customers from a file.
- **visibility:** always (header icon/button).
- **precondition:** n/a
- **confirm:** n/a
- **route_chain:** navigate `/import?type=customers` → Import wizard (`POST /import/preview` / `/import/execute`)
- **request_body:** n/a
- **side_effects:** `navigate`
- **end_state:** Import wizard.
- **failure_modes:** none.
- **parity:** MATCH, both link to the customers import wizard.
- **status:** OK
- **status_note:** n/a
### `customers.bulk-delete` — REMOVED (P2.1l Part A: customers are permanent)
- **label:** ~~Select → Delete Selected~~ — removed
- **section:** selection mode
- **purpose:** Bulk delete is gone. Web: the "Select" button + selection toolbar + row checkboxes are removed. Android: long-press multi-select + the selection-mode trash action are removed (long-press no longer enters selection mode). Selection mode existed ONLY to delete, so the whole feature is retired.
- **visibility:** none. Tapping a customer row opens Customer Detail on both platforms.
- **route_chain:** `DELETE /customers/:id` → **403** backstop; no UI caller.
- **status:** OK · **status_note:** customers are permanent (P2.1l).
- **failure_modes:** none observed (web swallows individual failures in the loop).
- **parity:** MATCH, both bulk-delete via repeated `DELETE /customers/:id`.
- **status:** OK
- **status_note:** n/a
---

## SCREEN-LEVEL DRIFT FLAGS

- **Type filter is web-only**, Android shows a type badge per row but offers no residential/commercial filter (search only).
- **Pagination differs**, web has an explicit "Load more" (page++); Android's in-`vm.load` paging is UNVERIFIED (no visible control).
- **Refresh**, web button vs Android pull-to-refresh + `ON_RESUME`.
- **Selection entry differs**, web "Select" button vs Android long-press; both bulk-delete the same way.
- **UNVERIFIED:** Android `CustomerViewModel.load` pagination; the exact `{customers}` response fields used for Member/Returning badges (`job_count`/`has_membership` web vs `has_active_membership` Android).
