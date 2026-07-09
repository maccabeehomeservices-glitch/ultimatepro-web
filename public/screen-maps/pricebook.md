# Screen Map, Pricebook

> **Format:** Action-Map Schema v1. Source of truth; the HTML atlas is rendered from it.
> When code changes this screen, update this file in the same commit. Reality on disk wins.

---

## SCREEN

| Field | Value |
|---|---|
| `screen_id` | `pricebook` |
| `display_name` | Pricebook |
| `surfaces` | android, web |
| `route_android` | `pricebook` → `PricebookScreens.kt` (categories grid → item list → `ItemFormDialog`) |
| `route_web` | `/pricebook` → `Pricebook.jsx` |
| `primary_actors` | owner, admin, manager (write gated `pricebook:full`/`edit_self`) |
| `purpose` | The reusable catalog of billable line items, grouped into categories. Items are pulled into estimates/invoices via the "Pricebook" picker in the estimate builder. Each item carries name, SKU, description, unit price, cost price, item type, an image, and active state. |
| `last_verified` | 2026-07-07 · P2.14: (GAP 3) item TYPE reduced to **labor \| material** on both platforms — a pricebook item is either work performed (labor) or a part/product (material); the legacy `service`/`part` values are normalized (service→labor, part→material) on display and by a staging migration (`db/migrate_pricebook_types_p214.sql`, 10 rows service→labor). The `pricebook_items.item_type` CHECK is left permissive (labor,material,discount,service) so the estimate-line discount mechanism + legacy rows stay valid — tightening it is a separate David-gated migration. (GAP 1) WEB item form now has an image **UPLOAD** (POST /uploads → {url} → `image_url`) in addition to the URL field, matching Android's uploader. |

### load_sequence
Web: `GET /pricebook/categories` on mount; on category open, `GET /pricebook/items?category_id=`. Android mirrors via `PricebookViewModel`.

### entry_points
- **Android:** main nav / more menu → Pricebook.
- **Web:** `/pricebook` (nav), and the estimate builder "Pricebook" buttons open the picker sourced from the same items.

---

## ACTIONS

### `pricebook.add-category`
- **label:** Category / Add Category
- **actors:** owner, admin (write)
- **route_chain:** `POST /pricebook/categories { name }`
- **notes:** `pricebook_categories.type` (separate enum: labor/material/discount/service/membership/other) is NOT reduced by P2.14 — GAP 3 targets item type only.

### `pricebook.add-item` / `pricebook.edit-item`
- **label:** Add Item / edit pencil
- **actors:** owner, admin, manager (`pricebook:full` for edit/delete; `edit_self` to add)
- **route_chain:** `POST /pricebook/items` / `PUT /pricebook/items/:id`
- **request_body:** `{ category_id, name, sku, description, unit_price, cost_price, item_type, taxable, image_url, is_active }`
- **item_type:** **`labor` | `material`** (P2.14 GAP 3). Web `ITEM_TYPE_OPTIONS` + Android type chips both show only these two; default `labor`. Backend create default = `labor` (routes/pricebook.js); CSV import maps any type → labor/material (routes/import.js); seed uses `labor`.
- **image (P2.14 GAP 1):**
  - **Android:** `ItemFormDialog` image picker (`PickVisualMedia`/`GetContent`) → `uploadPricebookImage` → `POST /uploads` multipart (`purpose=pricebook`, `entity_type=pricebook_item`) → `{url}` → `image_url`.
  - **Web:** item modal "Image" upload button → `uploadsApi.upload(file, 'pricebook_item', '', 'pricebook')` → `res.data.url` → `image_url`; the "Or image URL" text field remains as the secondary path. Both persist to the single `pricebook_items.image_url` column.

### `pricebook.delete-item`
- **route_chain:** `DELETE /pricebook/items/:id` (web `pricebook:full`).

---

## FIELDS (item form)

| field | type | notes |
|---|---|---|
| name | text | required |
| sku | text | optional |
| description | text | optional |
| unit_price | number | required (sell price) |
| cost_price | number | optional (feeds profit.js material cost) |
| item_type | enum | **labor \| material** (P2.14 GAP 3) |
| image_url | text/url | upload (primary) or URL (secondary) — P2.14 GAP 1 |
| category_id | select | |
| is_active | toggle | inactive items hidden from pickers |

---

## CROSS-REFERENCES
- **estimate-builder.md** — pricebook items are pulled into estimate line items via the picker; the estimate DISCOUNT (`item_type='discount'` line) is an estimate-line concept, NOT a pricebook item type (see that map).
- **profit.js** — `item_type='material'` on job/estimate line items drives material-cost vs sell allocation in the earnings engine (unchanged by P2.14; that is a LINE-ITEM type, independent of the pricebook picker).
