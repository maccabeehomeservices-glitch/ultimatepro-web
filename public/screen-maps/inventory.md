# Screen Map, Inventory

> **Format:** Action-Map Schema v1. Source of truth; the HTML atlas is rendered from it.
> When code changes this screen, update this file in the same commit. Reality on disk wins.

---

## SCREEN

| Field | Value |
|---|---|
| `screen_id` | `inventory` |
| `display_name` | Inventory |
| `surfaces` | android, web |
| `route_android` | `inventory` → `InventoryScreen`; `inventory/trucks/{truckId}` → `TruckStockScreen`; `inventory/restock-requests` → `RestockRequestsScreen`; `inventory/restock-requests/{requestId}` → `RestockRequestDetailScreen` (InventoryScreens.kt) |
| `route_web` | `/inventory` → `Inventory` (Inventory.jsx, 443 lines) |
| `primary_actors` | owner, manager, tech |
| `purpose` | Track parts across the warehouse and each truck: edit counts, move warehouse stock onto a truck, request and fulfill restocks, and auto-deduct truck stock when a job completes. Gated by an inventory-enabled setting. |
| `last_verified` | 2026-06-07 · Tier 3 Batch 1: transfer-to-truck fixed — web now POSTs the registered `/inventory/trucks/:truckId/send-items` (was `/inventory/transfer`, 404). Both platforms move stock server-side (warehouse −qty / truck +qty). Prior: 2026-05-31 Stage-1 audit, 79940c8. |

### load_sequence
`GET /inventory/settings` (enabled gate; auto-creates a row). Web tabs: Warehouse `GET /inventory/warehouse`; Trucks `GET /inventory/trucks` + `GET /inventory/trucks/:id/stock`; My Truck `GET /inventory/tech-truck/:userId`; Requests `GET /inventory/restock-requests?status`. All inventory routes are auth-gated (`router.use(auth)`).

### entry_points
- Both: More/Settings → Inventory. (Pricebook restock shortcut also opens a request dialog on Android.)

---

## ACTIONS

---

### `inventory.settings-toggle`
- **label:** Enable Inventory
- **section:** stock
- **actors:** owner, manager
- **purpose:** Turn the whole inventory feature on/off (gates deduction + the screens).
- **visibility:** Android InventoryScreen shows an "Enable Inventory" button when disabled; web exposes the toggle in the Settings module (not the Inventory page).
- **precondition:** n/a
- **confirm:** n/a
- **route_chain:** `GET /inventory/settings` · `PUT /inventory/settings`
- **request_body:** `{ enabled }`
- **side_effects:** upserts `inventory_settings.enabled`.
- **end_state:** Inventory enabled/disabled.
- **failure_modes:** none.
- **parity:** PARTIAL, same endpoint; Android hosts the toggle on the Inventory screen, web in Settings.
- **status:** OK
- **status_note:** When disabled, the on-completion deduction is skipped.

### `inventory.warehouse-edit`
- **label:** Warehouse item count (Save)
- **section:** stock
- **actors:** owner, manager
- **purpose:** Set the on-hand count of a warehouse item.
- **visibility:** Warehouse tab.
- **precondition:** n/a
- **confirm:** n/a
- **route_chain:** `PUT /inventory/warehouse/:id`
- **request_body:** `{ quantity }`
- **side_effects:** updates `warehouse_inventory.qty_on_hand`.
- **end_state:** Count saved.
- **failure_modes:** none.
- **parity:** MATCH, both edit warehouse counts.
- **status:** OK
- **status_note:** n/a
### `inventory.truck-stock-edit`
- **label:** Truck item count (Save)
- **section:** stock
- **actors:** owner, manager
- **purpose:** Set the on-hand count of an item on a specific truck.
- **visibility:** Trucks tab (web) / `TruckStockScreen` (Android).
- **precondition:** a truck is selected.
- **confirm:** n/a
- **route_chain:** `PUT /inventory/trucks/:truckId/stock/:itemId`
- **request_body:** `{ qty_on_hand, min_qty }`
- **side_effects:** updates `truck_inventory.qty_on_hand`/`min_qty`.
- **end_state:** Count saved.
- **failure_modes:** none.
- **parity:** MATCH, same endpoint; web inline on the Trucks tab, Android on a dedicated screen.
- **status:** OK
- **status_note:** n/a
### `inventory.my-truck`
- **label:** My Truck (on-hand + low-stock)
- **section:** stock
- **actors:** tech
- **purpose:** A tech sees their own truck's stock and low-stock flags.
- **visibility:** My Truck tab.
- **precondition:** the user has an assigned truck.
- **confirm:** n/a
- **route_chain:** `GET /inventory/tech-truck/:userId`
- **request_body:** n/a
- **side_effects:** read-only (returns truck + `item_count` + `low_stock_count`).
- **end_state:** Truck stock shown.
- **failure_modes:** none.
- **parity:** MATCH, read-only view of the tech's truck.
- **status:** OK
- **status_note:** n/a
### `inventory.transfer-to-truck`
- **label:** Transfer (warehouse → truck)
- **section:** move-stock
- **actors:** owner, manager
- **purpose:** Move a warehouse item onto a truck.
- **visibility:** web Warehouse tab "→ Truck"; Android "Send items to truck" on `TruckStockScreen`.
- **precondition:** a destination truck + quantity.
- **confirm:** transfer modal.
- **route_chain:** both `POST /inventory/trucks/:truckId/send-items` (truckId in path). _(2026-06-07: web fixed — was `POST /inventory/transfer`, unregistered → 404.)_
- **request_body:** `{ items: [{ pricebook_item_id, qty, min_qty, is_permanent }] }` (web sends one item; Android may batch).
- **side_effects:** decrement warehouse, increment truck — server-side, both platforms. Pre-checks warehouse stock; 400 if insufficient.
- **end_state:** stock transferred (warehouse −qty, truck +qty).
- **failure_modes:** `400` insufficient warehouse stock; `404` truck not found.
- **parity:** MATCH, both call the registered `send-items` endpoint.
- **status:** OK
- **status_note:** Web "Transfer to Truck" always 404s; only Android's send-items path works.

### `inventory.request-restock`
- **label:** Request Restock
- **section:** move-stock
- **actors:** tech, manager
- **purpose:** Ask the office to restock selected truck items.
- **visibility:** Trucks tab (web "Request Restock") / restock dialog (Android).
- **precondition:** ≥1 item selected.
- **confirm:** restock modal (items + quantities).
- **route_chain:** `POST /inventory/restock-requests`
- **request_body:** `{ truck_id, items:[{pricebook_item_id, item_name, qty_requested}], notes }`
- **side_effects:** inserts a `restock_requests` row (status `pending`) + `restock_request_items`.
- **end_state:** Request sent to office.
- **failure_modes:** none observed.
- **parity:** MATCH, both create a restock request.
- **status:** OK
- **status_note:** n/a
### `inventory.restock-fulfill`
- **label:** Fulfill Request
- **section:** move-stock
- **actors:** owner, manager
- **purpose:** Fulfill a pending restock request (adds the fulfilled quantities to the truck).
- **visibility:** Android `RestockRequestDetailScreen` ("Fulfill"). **Web's Restock-Requests tab is read-only** (lists pending/fulfilled/all, no fulfill control).
- **precondition:** a pending request.
- **confirm:** per-item fulfilled quantities.
- **route_chain:** `PUT /inventory/restock-requests/:id/fulfill`
- **request_body:** `{ items:[{pricebook_item_id, qty_fulfilled}] }`
- **side_effects:** sets `restock_request_items.qty_fulfilled`, **adds to `truck_inventory.qty_on_hand` (+= qty_fulfilled, upsert)**, sets request `status='fulfilled'`, `fulfilled_at`, `fulfilled_by`.
- **end_state:** Truck stock increased; request closed.
- **failure_modes:** none observed.
- **parity:** ANDROID-ONLY, web can create requests but has no fulfill UI.
- **status:** OK
- **status_note:** n/a
### `inventory.completion-deduction`
- **label:** Auto-deduct on job completion
- **section:** auto
- **actors:** system
- **purpose:** Subtract used parts from the assigned tech's truck when a job completes.
- **visibility:** automatic (no button).
- **precondition:** `inventory_settings.enabled` and the assigned tech has an active truck.
- **confirm:** n/a
- **route_chain:** automatic in `POST /jobs/:id/status` (status=completed); plus a manual `POST /inventory/deduct-job/:jobId`.
- **request_body:** manual `{ truck_id, items:[{pricebook_item_id, qty}] }`
- **side_effects:** **automatic** (jobs.js ~898–929): when enabled, finds the tech's truck and runs `UPDATE truck_inventory SET qty_on_hand = GREATEST(0, qty_on_hand − used)` for each invoice line item with a `pricebook_item_id`. The **manual** endpoint decrements the given items on a given truck (`GREATEST(0, qty − qty)`).
- **end_state:** Truck stock reduced by the job's parts.
- **failure_modes:** none observed (errors are caught/logged, never block completion).
- **parity:** MATCH, the deduction is server-side and fires from job completion regardless of surface.
- **status:** OK
- **status_note:** Driven by invoice line items' `pricebook_item_id`; items without one aren't deducted.

---

## SCREEN-LEVEL DRIFT FLAGS

- **Web "Transfer to Truck" is broken (404)**, it posts to `POST /inventory/transfer`, which is not a registered route; the real warehouse→truck move is `POST /inventory/trucks/:truckId/send-items` (used by Android). Web warehouse→truck transfers never happen.
- **Restock fulfill is Android-only**, web lists restock requests read-only; only Android's `RestockRequestDetailScreen` fulfills (`PUT /restock-requests/:id/fulfill`, which adds to truck stock).
- **Enable toggle lives in different places**, Android InventoryScreen ("Enable Inventory"); web in the Settings module. Same `PUT /inventory/settings`.
- **On-completion deduction is automatic + server-side**, fires inside `POST /jobs/:id/status` (completed) when enabled, deducting invoice line items from the tech's truck; a separate manual `/deduct-job` endpoint also exists.
- **UNVERIFIED:** exact web Settings location/host of the inventory toggle; Android InventoryScreen warehouse-edit + my-truck specifics; whether `/deduct-job` (manual) has any UI caller.
