# UltimatePro Web: Claude project rules

This file is auto-loaded by Claude Code when working in this folder.
The universal rules (Six Rules, em-dash ban, no fabrication, formatting,
verification) live in `C:\Users\dadus\Desktop\CLAUDE-RULES.md` and apply 
here too. This file adds UltimatePro web-specific rules on top.

## Project context

- React 18 + Vite 5 + Tailwind CSS dashboard.
- Hosted on Railway, custom domain ultimatepro.pro (SSL active).
- Repo: github.com/maccabeehomeservices-glitch/ultimatepro-web
- Auto-deploys on push to main.
- Sister projects:
  - Backend: C:\ultimatecrm\backend (Node.js + Express + PostgreSQL on 
    Railway, project steadfast-beauty)
  - Android: C:\ultimatecrm\android\android (Kotlin + Compose, package 
    com.ultimatepro)

## Parity rule (always)

**Android is the spec; web mirrors it exactly.** Same screens, same 
flow, same UX, same outcomes. When in doubt about a UI decision, do 
what Android does. Do not "improve" web in ways that diverge from 
Android. If a web-specific change is genuinely needed (e.g., desktop 
viewport), surface the divergence as a question, not a default.

## Hard rules (never violate)

- **Mobile-first.** Every component must work at 375px width.
- **Touch targets minimum 44px height. Inputs minimum 16px font** 
  (prevents iOS auto-zoom on tap).
- **Bottom nav (5 items) on mobile, sidebar on desktop.** The sidebar 
  collapses to 64px icon-only below 1024px (Apple HIG). Mobile 
  (<768px) uses bottom nav, never the sidebar.
- **Modals: bottom sheet on mobile, centered overlay on desktop.**
- **All array maps use null guard:** `(data?.items || []).map(...)`. 
  Never `.map()` directly on something that might be undefined.
- **After every mutation, reload from server.** No optimistic-only 
  state. The server is the source of truth.
- **Status colors:** always go through `statusColor()` from `lib/api.js`. 
  Never inline-color a status badge.
- **Estimate / invoice numbers come from DB with prefix already 
  included** (`EST-00021`, `INV-00033`). Never prepend `EST-` or `INV-` 
  in JSX. Render the number directly.
- **EstimateBuilder line item sections start empty.** No placeholder 
  blank input row. Show "No services added" / "No materials added" / 
  "No discounts added" placeholder text. Match Android.
- **Filter empty-name line items in `handleSave` before POSTing.** 
  Backend validates `line_items: isArray({ min: 1 })` so empty rows 
  break the contract.
- **Date chips on Jobs page use `activity_from` / `activity_to` for 
  ALL chips** (forward and past). The backend's `activity_date` CASE 
  pivots per status. Do not split into `from`/`to` for forward chips.

## API field name conventions (must match backend exactly)

- Paste ticket response: `job_title`, `job_description`, 
  `leftover_notes`, `phone`. NOT `title` / `description` / `notes` / 
  `customer_phone`.
- Jobs POST: `scheduled_start` ISO string, null-safe before 
  `.toISOString()`.
- Calendar fetches: `GET /jobs?from=&to=&limit=200`.
- Payroll fetches: `GET /reports/earnings`.
- Estimate signature on detail page is the in-Modal `SignaturePad` 
  component opened via `setShowSignature(true)`. There is no separate 
  `/sign/:token` URL flow on web; that is the customer-side flow only.

## Required reads before any change

When asked to fix or change anything, first read:
- The actual file(s) being modified, end-to-end. Print the relevant 
  block before editing.
- The matching Android composable in 
  `C:\ultimatecrm\android\android\app\src\main\java\com\ultimatepro\` 
  if the change is UI-related.
- The backend route handler in `C:\ultimatecrm\backend\routes\` if the 
  change touches an API call.

Never propose changes based on memory of how the file used to be. 
Always re-read.

## When in doubt

Ask David. Match Android. Do not improvise.
