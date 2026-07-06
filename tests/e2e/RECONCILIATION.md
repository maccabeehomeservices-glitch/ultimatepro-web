# P1.3 STEP 0 — RECONCILIATION

Cross-check of the **Apr 11 2026 QA Testing Plan** (274 cases, 20 sections;
`C:\Users\dadus\Downloads\UltimatePro_QA_Testing_Plan.md`) against **current truth**:
each screen's atlas contract (`web/public/screen-maps/*.md`) and the **component code on
disk** (`web/src/pages/*.jsx`). The plan is a **coverage checklist only** — 3 months stale.
Expected behavior in every E2E test comes from ATLAS + CODE, never the plan. **Where atlas
and code disagree, code on disk wins** and the drift is logged (bottom of this file).

Legend: **STILL-VALID** · **CHANGED** (behavior differs — cite the winning file:line) ·
**OBSOLETE** (feature removed/renamed) · **BACKEND-COVERED** (money/aggregation math + API
shapes already asserted by the P1.2 backend contract suite — E2E asserts only the UI surface).

> ⚠️ **Staging backend holds live comms creds** (Twilio/SendGrid — see MISSION_CONTROL P1.1
> blocker). Every E2E flow AVOIDS controls that fire real customer SMS/email. The full
> avoid-list is at the end of this file.

---

## Section-by-section triage

### 1 — Login & Auth (`Login.jsx`)
- 1.1 valid login → `/dashboard` **STILL-VALID**. 1.2 wrong pw → inline red error, stays **STILL-VALID** (fallback text `Invalid email or password. Please try again.`).
- 1.3 empty fields **CHANGED** — no JS validation; native HTML `required` on both `<Input>`s (Login.jsx:51,60). Assert `:invalid` / no navigation, not a custom message.
- 1.4 session persistence / 1.5 sign-out — **BACKEND/LAYOUT-COVERED** (live in `useAuth` / Layout, not Login).
- Anchors: `/login`; labels `Email` (ph `you@example.com`), `Password`; button `Sign In`.

### 2 — Dashboard (`Dashboard.jsx`)
- 2.1 greeting `Hello, {first_name} 👋` **STILL-VALID** (:295).
- 2.2 KPI cards **CHANGED** — **6** cards (`Total Jobs`, `This Month`, `Completion Rate`, `Scheduled Today`, `Missed Calls`, `2nd Chance`), :344-391. "Open Invoices" **OBSOLETE**.
- 2.3 clickable KPIs **CHANGED** — only `Missed Calls` + `2nd Chance` → `/phone`; others static.
- 2.4-2.6 Active Jobs list + View all + click→detail **STILL-VALID**. 2.7 Memberships Due Soon **STILL-VALID**; its "View all" **CHANGED** → `/settings/membership-plans` (:401, atlas drift — was flagged broken).
- 2.8-2.11 Map/pins/popup **STILL-VALID** (InfoWindow link text is `Open Job →`, not "View Job →").
- 2.14-2.16 Clock In/Out **STILL-VALID**. 2.17-2.19 Paste Ticket **CHANGED** — always a modal (`Paste Job Ticket`, `Parse with AI`); no silent auto-parse.
- Anchors: `/dashboard`; card labels above; `Full Map`→`/live-map`; FAB `Paste Ticket`.

### 3A — Jobs List (`Jobs.jsx`)
- 3.1 loads **STILL-VALID** (default status set = scheduled,en_route,in_progress,unscheduled,holding — not "all").
- 3.2 status filter **CHANGED** — a **Filters dialog** (funnel, `aria-label="Filters"`) with status **checkboxes** + `Received (from partners)` (partner_view), not an inline chip row.
- 3.5 date range **CHANGED** — inline **date CHIP row** + a `custom` chip opening a `Custom Date Range` dialog; sends `activity_from/activity_to` (status-pivoted).
- 3.6 tech filter **CHANGED** — moved inside Filters dialog (checkboxes). 3.7 priority filter **OBSOLETE**.
- 3.3/3.4 search+clear, 3.8 `Load more jobs...`, 3.9 `+` FAB→`/jobs/new`, 3.11 status badges, 3.12/3.13 refresh, 3.14 empty `No jobs found` — **STILL-VALID**.
- Anchors: `/jobs`; `h1 Jobs`; search ph `Search jobs...`; desktop table headers `Job #/Customer/Type/Status/Scheduled/Address/Tech`.

### 3B — Job Detail (`JobDetail.jsx`)
- 3.15-3.20 load/tabs/status/customer **STILL-VALID** (History tab hidden for techs w/o view_history; choosing **Completed** in the status modal routes to the Complete modal, not `/status`).
- 3.21 line items **CHANGED** — render **inside the Invoice card** (`jobInvoice.line_items`), no standalone Charges&Parts card. 3.22 add line item **OBSOLETE on this screen** (done on the Invoice screen).
- 3.26 **Get Signature OBSOLETE (removed)** — signing lives on estimate/invoice only.
- 3.27 Complete Job **STILL-VALID** (UI); math **BACKEND-COVERED**. Non-partner modal = Completion Notes only; partner adds parts/CC-split fields.
- 3.29 Dispatch **CHANGED** — confirm-only, sends real geolocation (no fake 0,0). 3.34 Collect Deposit **CHANGED** → button is `💳 Charge Payment` (records a real payment via `POST /invoices/:id/payment`).
- 3.28 Restore, 3.30 Send to Tech/Partner, 3.31 partner-permission toggles (only on sent-out jobs), 3.32 reminder method, 3.33 `+ Create Estimate`, 3.35 Messages, 3.36 History, 3.37 Edit — **STILL-VALID** (see file for exact modal titles).
- Anchors: `/jobs/:id`; buttons `✅ Completed`, `📤 Send to Tech`, `📧 Send Receipt`(AVOID), `+ Create Estimate`; modal titles `Update Status`/`Complete Job`/`Collect Payment`.

### 3C — Job Form (`JobForm.jsx`)
- 3.41 title field **OBSOLETE** (no title input — derived backend-side). 3.44 priority chips **OBSOLETE**. 3.52 line items **OBSOLETE**. 3.56 empty-title validation **OBSOLETE** → only validation is **Customer required**.
- 3.50 tech assignment **CHANGED** — tabs `Self/Team/Roster/Partner` (not one dropdown). 3.51 source picker **CHANGED** — hidden unless `permissions_resolved.jobs === 'full'`.
- 3.54 save **CHANGED** — button `Save Job` (not "Create Job"); `Save & Send` (green) appears only for non-Self assignment (fires tech notify — avoid). Payload sends `scheduled_local` + `lat/lng`, **not** `scheduled_start`.
- 3.38-3.40 customer search/select/quick-create, 3.43 type chips, 3.45-3.47 address + Places + state-abbr, 3.48/3.49 schedule optional, 3.53 Paste Ticket, 3.57 cancel — **STILL-VALID**.
- Anchors: `/jobs/new`; customer ph `Search customer by name, phone, or email...`; assign tabs; type chips (`Service`…); footer `Cancel`/`Save Job`.

### 4A — Customers List (`Customers.jsx`)
- All **STILL-VALID**: search (`Search customers...`), type chips `All/Residential/Commercial`, `⭐ Member`/`↩ Returning` badges, `Load more customers...`, bulk `Select`→`🗑 Delete Selected` (gated `customers:full`), `+`→`/customers/new`, `Import`→`/import?type=customers`.

### 4B — Customer Detail (`CustomerDetail.jsx`)
- All **STILL-VALID** (stat tiles `Total Jobs/Total Revenue/Open Estimates/Outstanding`; tabs `Jobs/Estimates/Invoices/Messages`; contacts add/delete; notes autosave onBlur; memberships add; portal Copy/Open; `Add Job`→`/jobs/new` with state.customer). SMS send = **AVOID**.

### 4C — Customer Form (`CustomerForm.jsx`)
- 4.30 save **CHANGED** — validation stronger: requires `first_name` **AND** (`phone` OR `email`) → errors `First name is required` / `Phone or email required`. Sends `customer_type` (title-cased), not `type`. Button `Create Customer`/`Save Changes`.
- Anchors: labels `First Name/Last Name/Phone/Email/City/State/Zip`; type chips `Residential/Commercial`.

### 5 — Calendar (`Calendar.jsx`)
- 5.3 day panel **CHANGED** — opens a **Modal** (title `EEEE, MMMM d`), no fetch. 5.5 **CHANGED** — button `+ New Job on This Day` → `/jobs/new?date=`. 5.8 today **CHANGED** — amber cell + blue date number.
- 5.1/5.2 (≤3 dots/day) /5.4/5.6/5.7 swipe /5.9/5.10 (`No jobs scheduled for this day.`) — **STILL-VALID**.

### 6A — Estimates List (`Estimates.jsx`)
- 6.2 filters **CHANGED** — chips `All/Draft/Sent/Signed/Approved`; "Completed"/"Declined" **OBSOLETE**, `Signed` new. Rest **STILL-VALID** (search, click→detail, `+`→builder).

### 6B — Estimate Detail (`EstimateDetail.jsx`)
- 6.9 **Get Signature** (in-app) **STILL-VALID** — button `✍️ Get Signature` → modal `Get Signature`, input ph `Signer's full name` + SignaturePad → `POST /estimates/:id/sign`. On success auto-opens **`Add to Invoice?`** modal (`No`/`Yes`; Yes → convert).
- 6.12 Convert **STILL-VALID** — `Convert to Invoice` (visible when signed) → `POST /estimates/:id/convert-to-invoice`.
- 6.14 GBB **CHANGED** — 1–5 tiers (not fixed Good/Better/Best); `Present GBB Options` picker. 6.15 Attach Photo **STILL-VALID** (fixed 2026-06-07).
- 6.8 **Send for Signature = AVOID** (`POST /estimates/:id/send`). 6.13 Collect Deposit gated `payments_refunds:edit_self`.

### 6C — Estimate Builder (`EstimateBuilder.jsx`)
- 6.19 add-from-pricebook **CHANGED** — modal `Add from Pricebook` (search `Search items...`); a separate `Add` button inserts a blank manual row. 6.21 discount **CHANGED** — a line-item section, not a field. 6.23 GBB **CHANGED** — `Good-Better-Best Mode`, 1–5 tiers.
- **Line-item shape (load-bearing): `{ name, quantity, unit_price, total, item_type }`** — item name input ph `Item name`, `Qty` StepperInput, `Unit Price` numeric input ph `0.00`. Footer: `Cancel` / `Save Draft`(new)|`Save`(edit) / green `Send` (**does NOT send comms — only saves**, per EstimateBuilder.jsx:333).

### 7 — Invoices (`Invoices.jsx`, `InvoiceDetail.jsx`)
- 7.2 filters **CHANGED** — chips `All/Unpaid/Paid/Overdue`, default **Unpaid**.
- 7.5 record payment **STILL-VALID** — trigger `Charge Payment` → modal `Record Payment` (`Amount`/`Payment Method`/`Notes`, submit `Record`) → `POST /invoices/:id/payment`. Methods `Cash/Check/Credit Card/ACH/Other`. 7.7/7.8 partial→full status = **BACKEND-COVERED**.
- 7.13 Void **OBSOLETE** (removed). 7.15 "Charge via ScanPay" **OBSOLETE** → `📲 ScanPay QR` (live processor, caution) + `🔗 ScanPay Link` (**SMS, AVOID**).
- 7.9 Send Invoice / 7.10 Send Receipt = **AVOID** (SMS+email). 7.11/7.12 reminders, 7.16 signature, 7.17 history, 7.18 amber balance banner — **STILL-VALID**.

### 8 — Payments (`Payments.jsx`) — read-only
- All **STILL-VALID**: `From`/`To` (default −30d…today), method badges (cash=green/check=blue/credit_card=purple/ach=indigo), `$X,XXX.XX`, invoice link only when `invoice_id`, `Total Collected` banner. No external sends.

### 9 — Phone / SMS (`Phone.jsx`, `SmsThread.jsx`)
- 9.1 tabs **CHANGED** — order `Messages`(default)`/Calls`. 9.5 send message = **AVOID** (live Twilio, `POST /sms/conversations/:id/send`). Reading conversations/calls is safe.

### 10 — Reports (`Reports.jsx`)
- Tabs **CHANGED** — `Revenue / Job Sources / Timesheets / Partners`. 10.3 Jobs tab **OBSOLETE**; 10.4 Earnings tab **OBSOLETE** (moved to Payroll). 10.6 → `Partners`; 10.7 → `Job Sources`.
- Date presets `This Week/This Month/Last Month/YTD/Custom` + `From`/`To`. `📧 Send Report` (Partners) = **AVOID** (emails a PDF). Math **BACKEND-COVERED**.

### 11 — Payroll (`Payroll.jsx`)
- **CHANGED** — earnings-by-actor list (name·jobs·type·total), **not** a timesheet view. New controls: `✓ Mark Paid` (gated `accounting_earnings:full`, money-write, confirm `Mark range paid`) + `📥 Export CSV`. Cards drill to `/reports/team|roster|source/:id`. Math **BACKEND-COVERED**.

### 12 — Pricebook (`Pricebook.jsx`)
- 12.5 edit category / 12.6 delete category **OBSOLETE** (no UI). Item CRUD gated (`pricebook:edit_self`/`full`). Rest **STILL-VALID** (category grid, `+ Category`, `+ Add Item` modal `Item Name */Unit Price *`, search).

### 13 — Network (`Network.jsx`)
- 13.3 search **CHANGED** — 3 tabs `📱 By Phone/✉️ By Email/🔑 By UCM ID`. 13.4 invite **CHANGED** — button `Connect` (**AVOID** — real invite). 13.10 pause has **no Resume** control.
- 13.1/13.2/13.5-13.9/13.11 **STILL-VALID** (Copy UCM ID, connection modal, Revenue Split, Propose Agreement [`Send Proposal`, sum=100 **BACKEND-COVERED**], Accept/Decline, View Report). Avoid firing Connect/Propose/Accept/Pause against staging.

### 14 — Inventory (`Inventory.jsx`)
- 14.1 tabs **CHANGED** — **4** tabs `Warehouse/Trucks/My Truck/Restock Requests`. 14.5 transfer **STILL-VALID** (fixed) — `→ Truck` modal `Transfer {item}` → `POST /inventory/trucks/:id/send-items` (old `/transfer` 404 gone). 14.6 low-stock badge only on My Truck. Stock deltas **BACKEND-COVERED**.

### 15 — Leads (`Leads.jsx`)
- Heading is `Lead Pipeline`. 15.6 delete uses **native `window.confirm`** (handle the browser dialog). 15.7 quick-status buttons are status-conditional (`Mark Contacted` only when new; `Qualify` only when contacted). 15.8 `→ Convert to Job` → `/jobs/new` with mapped `parsedData`. Rest **STILL-VALID**.

### 16A — Settings menu (`Settings.jsx`)
- **CHANGED (expanded)** — 8 nav rows + `Custom Fields`/`Ailot`/`Integrations` + inline `Appearance`/`Dark mode` toggle (localStorage `up_dark_mode`). Company Profile first, Team Members second — **STILL-VALID**.

### 16B — Company Profile (`settings/CompanyProfile.jsx`)
- 16.9 logo **CHANGED** — `📷 Upload Logo` file upload (Cloudinary) + `Remove Logo`, no URL field. Rest **STILL-VALID** (`Save Company Profile`, `←`→`/settings`).

### 16C — Team Members (`settings/UserManagement.jsx`) ★ regression contract
- 16.12 add-user **CHANGED (the shipped fix)** — button `+ Add Team Member` (gated `team_settings:full`); form splits name into **`First Name *` + `Last Name *` (two side-by-side fields, that order)** → `Email *` → `Phone` → `Role` → Permissions grid → `Password *`; submit `Create Team Member` (UserManagement.jsx:259-278, 362). **Regression lock: any revert to a single Name field fails.**
- 16.14 delete **CHANGED** — soft **Deactivate** (`Deactivate Team Member`) + `Inactive` badge + `♻️` reactivate, not hard delete. 16.16 role badges **CHANGED** — owner=purple/admin=blue/manager=green/technician=amber/dispatcher=indigo. 16.15 owner-protected / 16.17 password-required **STILL-VALID**.

### 16D — Other settings sub-pages
- 16.18 Roster Techs **STILL-VALID** (`Name */Phone/Email/Commission %/CC Fee %`). 16.19 Job Sources **CHANGED** — 3 tabs `Contacts/Ad Channels/Commission`. 16.20 Membership Plans **STILL-VALID** + **BUG**: `emptyForm` default `frequency:'annual'` but options use `annually` → new form opens with no frequency selected (MembershipPlans.jsx:20-21). 16.21 Review Platforms **STILL-VALID** (+ Quick-Add templates). 16.22 Online Booking **STILL-VALID** (sub-cards only when enabled). 16.23 Notifications **CHANGED** — localStorage-only (`up_notification_prefs`), device-local, no backend.

### 17 — Import Wizard (`ImportWizard.jsx`)
- **CHANGED** — single wizard `/import?type=pricebook|customers`; upload button `Analyze File` (accepts .csv/.xlsx/.xls/.tsv); AI mapping editable (**BACKEND-COVERED**); execute tiles `Imported/Updated/Skipped/Errors`; dup step only if `duplicate_count>0`.

### 18 — End-to-end workflows
- A (Paste→complete), B (Estimate→Invoice→Payment), C (Lead→Job), D (Calendar create) — **STILL-VALID** as flows; convert route is `/convert-to-invoice`; statuses limited to the CHECK set (no `invoiced`/`on_hold`). B steps "Send for Signature" + "Send Receipt" = **AVOID**. **This suite's core-loop covers B end-to-end with in-app signature + record-payment.**

### 19 — Mobile responsiveness ★ nav contract
- **BottomNav** (mobile `md:hidden`, <768px): exactly 5 — `Home /dashboard`, `Jobs /jobs`, `Customers /customers`, `Alerts /notifications`, `More` (sheet). **No permission gating.**
- **Sidebar** (desktop `hidden md:flex`, ≥768px — active at 1280px): 15 items, **gates `Payments`/`Reports`/`Payroll`** via `can(section,'view')` (Sidebar.jsx:36,38,39). Labels differ (`Dashboard`, `Phone / SMS`).
- ⇒ **Permission-gating E2E must run on the DESKTOP project** (Sidebar), since the mobile BottomNav shows everything.

### 20 — Error handling & edge cases
- 20.1 network error → snackbar, no white screen **STILL-VALID**. 20.3 session expired → `<Navigate to="/login">` **STILL-VALID**. 20.2 invalid URL — router has `path="*"` → `Navigate to /dashboard` (App.jsx:139). 20.4/20.5/20.8 empty states / spinners / double-submit guards **STILL-VALID**. 20.7 special chars **BACKEND-COVERED**.

---

## External-send controls the suite AVOIDS (staging = live comms creds)
| Control | Screen | Endpoint | Effect |
|---|---|---|---|
| Send for Signature | Estimate Detail | `POST /estimates/:id/send` | SMS/email estimate |
| Send Invoice | Invoice Detail | `POST /invoices/:id/send` | SMS+email + pay link |
| Send Receipt | Invoice Detail / Job Detail | `POST /invoices/:id/send-receipt` | SMS+email receipt |
| 🔗 ScanPay Link | Invoice Detail | `POST /payments/scanpay-link` | Texts pay link |
| 📲 ScanPay QR (caution) | Invoice Detail | `POST /payments/scanpay-qr` | Live processor order |
| Send (SMS thread) | Phone/SMS, Customer, Job | `POST /sms/conversations/:id/send` | Live Twilio SMS |
| Connect / Propose / Accept | Network | `/network/*` | Real partner invite/agreement |
| 📧 Send Report | Reports → Partners | `/network/connections/:id/report/send` | Emails a PDF |
| Save & Send | Job Form | `roster-techs/notify-tech` | Notifies a tech |

_Not a send despite the label:_ Estimate Builder green **Send** button (only saves).

## Atlas / code drift + real bugs found (→ queue candidates)
1. **`dashboard.md`** flags Memberships "View all" as broken → code fixed it to `/settings/membership-plans` (Dashboard.jsx:401). Atlas is stale.
2. **MembershipPlans frequency default bug** — `emptyForm().frequency:'annual'` vs option value `annually`; new-plan form opens with no frequency selected (MembershipPlans.jsx:20-21). Real low-severity bug → queue.
3. Hardcoded **production** backend URL in `ExportReportMenu.jsx:7`, `Book.jsx:8`, `OnlineBooking.jsx:26` (report-export blob + booking share links always point at prod, ignoring `VITE_API_URL`) → queue candidate.
4. **Staging web bundle → prod backend** (VITE_API_URL baked to production) — this suite works around it by building locally against the staging backend; David must fix the Railway staging build env → queue.
