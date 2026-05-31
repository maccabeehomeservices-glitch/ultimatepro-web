# Screen Map — Settings (landing)

> **Format:** Action-Map Schema v1. Source of truth; the HTML atlas is rendered from it.
> When code changes this screen, update this file in the same commit. Reality on disk wins.
> **Scope:** the Settings **landing page only** — each row is mapped as a navigation action to its sub-page. The sub-pages themselves are *not* mapped here (they are the 11 still-pending screens in the index).

---

## SCREEN

| Field | Value |
|---|---|
| `screen_id` | `settings` |
| `display_name` | Settings (landing) |
| `surfaces` | android, web |
| `route_android` | `SettingsScreen` (titled **"More"**, SettingsScreen.kt) — also the Android nav hub |
| `route_web` | `/settings` → `Settings` (Settings.jsx, 114 lines) |
| `primary_actors` | owner, office |
| `purpose` | The settings menu: a list of rows that navigate to configuration sub-pages, plus an inline dark-mode toggle and a version stamp. On Android the same screen ("More") doubles as the navigation hub for screens the web app keeps in its bottom nav. |
| `last_verified` | 2026-05-31 · Stage-1 read-only audit · commit: 6147cd1 |

### load_sequence
**Web:** no fetch on load — it's a static list of `NavLink`s plus a dark-mode toggle (reads `localStorage.up_dark_mode`). **Android:** `networkIdVm.load()` → `GET` network id for the "My UltimatePro ID" card; notification toggle states come from local `NotificationPreferences`.

### entry_points
- Web: bottom-nav / menu "Settings".
- Android: bottom-nav "More".

---

## ACTIONS

> Each row's `end_state` is "navigates to <sub-page>". All 11 web sub-page routes are registered in App.jsx (verified) — no broken links.

---

### `settings.company`
- **label:** Company Profile
- **section:** business
- **actors:** owner
- **purpose:** Open company profile (name, logo, contact, address).
- **visibility:** always.
- **route_chain:** `NavLink → /settings/company` (→ `CompanyProfile`)
- **side_effects:** navigation only.
- **end_state:** Company Profile sub-page.
- **parity:** MATCH — Android Business → "Company Profile" (`onCompanyProfile`).
- **status:** OK

### `settings.team`
- **label:** Team Members
- **section:** business
- **actors:** owner
- **purpose:** Manage app users, roles, access.
- **visibility:** always.
- **route_chain:** `NavLink → /settings/team` (→ `UserManagement`)
- **side_effects:** navigation only.
- **end_state:** Team Members sub-page.
- **parity:** MATCH — Android Business → "Team Members" (`onTeamMembers`).
- **status:** OK

### `settings.technicians`
- **label:** Roster Technicians
- **section:** business
- **actors:** owner
- **purpose:** Manage field techs without app logins.
- **visibility:** always.
- **route_chain:** `NavLink → /settings/technicians` (→ `RosterTechs`)
- **side_effects:** navigation only.
- **end_state:** Roster Technicians sub-page.
- **parity:** MATCH — Android Business → "Technicians" (`onTechnicians`).
- **status:** OK

### `settings.review-platforms`
- **label:** Review Platforms
- **section:** business
- **actors:** owner
- **purpose:** Manage review links sent with receipts.
- **visibility:** always.
- **route_chain:** `NavLink → /settings/review-platforms` (→ `ReviewPlatforms`)
- **side_effects:** navigation only.
- **end_state:** Review Platforms sub-page.
- **parity:** MATCH — Android Business → "Review Platforms" (`onReviewPlatforms`).
- **status:** OK

### `settings.online-booking`
- **label:** Online Booking
- **section:** business
- **actors:** owner
- **purpose:** Configure the customer self-booking link.
- **visibility:** always.
- **route_chain:** `NavLink → /settings/online-booking` (→ `OnlineBooking`)
- **side_effects:** navigation only.
- **end_state:** Online Booking sub-page.
- **parity:** MATCH — Android Business → "Online Booking" (`onOnlineBooking`).
- **status:** OK

### `settings.job-sources`
- **label:** Job Sources
- **section:** business
- **actors:** owner
- **purpose:** Track where jobs come from.
- **visibility:** always.
- **route_chain:** `NavLink → /settings/job-sources` (→ `JobSources`)
- **side_effects:** navigation only.
- **end_state:** Job Sources sub-page.
- **parity:** MATCH — Android Business → "Job Sources" (`onJobSources`).
- **status:** OK

### `settings.membership-plans`
- **label:** Membership Plans
- **section:** business
- **actors:** owner
- **purpose:** Define recurring service plans.
- **visibility:** always.
- **route_chain:** `NavLink → /settings/membership-plans` (→ `MembershipPlans`)
- **side_effects:** navigation only.
- **end_state:** Membership Plans sub-page.
- **parity:** MATCH — Android Business → "Membership Plans" (`onMembershipPlans`). (Note: the *standalone* `/memberships` web nav route was flagged missing in an earlier batch — this Settings sub-page route is registered and works.)
- **status:** OK

### `settings.custom-fields`
- **label:** Custom Fields
- **section:** business
- **actors:** owner
- **purpose:** Add custom data fields to jobs/customers/estimates.
- **visibility:** always.
- **route_chain:** `NavLink → /settings/custom-fields` (→ `CustomFields`)
- **side_effects:** navigation only.
- **end_state:** Custom Fields sub-page.
- **parity:** MATCH — Android Business → "Custom Fields" (`onCustomFields`).
- **status:** OK

### `settings.automation`
- **label:** Ailot (Automation Rules)
- **section:** business
- **actors:** owner
- **purpose:** Smart automation rules.
- **visibility:** always.
- **route_chain:** `NavLink → /settings/automation` (→ `AutomationRules`)
- **side_effects:** navigation only.
- **end_state:** Ailot / Automation Rules sub-page.
- **parity:** MATCH — Android Business → "⚡ Ailot" (`onAilot`).
- **status:** OK

### `settings.integrations`
- **label:** Integrations (QuickBooks)
- **section:** business
- **actors:** owner
- **purpose:** Connect QuickBooks Online and other tools.
- **visibility:** always.
- **route_chain:** `NavLink → /settings/integrations` (→ `Integrations`)
- **side_effects:** navigation only.
- **end_state:** Integrations sub-page.
- **parity:** MATCH — Android Business → "Integrations" (`onIntegrations`).
- **status:** OK

### `settings.notifications`
- **label:** Notifications
- **section:** preferences
- **actors:** owner, office
- **purpose:** Manage notification preferences.
- **visibility:** always.
- **route_chain:** web `NavLink → /settings/notifications` (→ `Notifications` sub-page)
- **side_effects:** navigation (web) / inline toggles (Android).
- **end_state:** Notifications sub-page (web).
- **parity:** DIVERGENT — **web navigates to a Notifications sub-page**; **Android has no sub-page** — it shows inline toggles right on the "More" screen (New Jobs, Job Status Updates, Partner Jobs, New Bookings, Estimate Signed) writing to device-local `NotificationPreferences` via `notifPrefs.setX(...)`. So the web sub-page and the Android inline toggles are different surfaces for the same concept.
- **status:** OK
- **status_note:** Web nav resolves (route registered). Android prefs are device-local, not server-synced.

### `settings.dark-mode`
- **label:** Appearance — Dark Mode
- **section:** preferences
- **actors:** owner, office
- **purpose:** Toggle dark theme.
- **visibility:** always (inline toggle, no navigation).
- **route_chain:** — (UI only)
- **side_effects:** web writes `localStorage.up_dark_mode` + `document.documentElement.classList.toggle('dark')`; Android `onToggleDark`.
- **end_state:** Theme toggled.
- **parity:** MATCH — both are inline toggles on the landing; no sub-page.
- **status:** OK

### `settings.version`
- **label:** Version / Built stamp
- **section:** preferences
- **actors:** owner, office
- **purpose:** Show app version + build time.
- **visibility:** footer.
- **route_chain:** — (display only)
- **side_effects:** none.
- **end_state:** Version text shown.
- **parity:** MATCH — web `__APP_VERSION__ / __BUILD_TIME__` footer; Android `BuildConfig.VERSION_NAME (build VERSION_CODE)` + `BUILD_TIMESTAMP` in the About section.
- **status:** OK

### `settings.android-more-shortcuts`
- **label:** "More" nav shortcuts (Views / Finance / Payroll / Price Book / Network / Inventory)
- **section:** android-extras
- **actors:** owner, office
- **purpose:** On Android, the "More" screen also links to Calendar, Live Map, Reports, Estimates, Invoices, Payments, Payroll, Price Book, My Network, Inventory.
- **visibility:** Android only.
- **route_chain:** Android callbacks (`onCalendar`, `onLiveMap`, `onReports`, `onEstimates`, `onInvoices`, `onPayments`, `onPayroll`, `onPricebook`, `onNetwork`, `onInventory`)
- **side_effects:** navigation only.
- **end_state:** The respective screen.
- **parity:** ANDROID-ONLY (placement) — the web app reaches these via its bottom nav / dedicated routes, not from the Settings landing. Same destinations, different entry point.
- **status:** OK

### `settings.android-ucm-id`
- **label:** My UltimatePro ID (copy / share)
- **section:** android-extras
- **actors:** owner
- **purpose:** Show the company's network ID; copy it or share via the OS share sheet.
- **visibility:** Android only.
- **route_chain:** `GET` network id (`repo.getMyNetworkId()` → `ultimatecrm_id`); copy → clipboard; share → `Intent.ACTION_SEND`
- **side_effects:** clipboard / share intent.
- **end_state:** ID copied or shared.
- **parity:** ANDROID-ONLY — the web Settings landing has no UCM-ID card.
- **status:** OK

### `settings.android-sign-out`
- **label:** Sign Out
- **section:** android-extras
- **actors:** owner, office
- **purpose:** Log out (with a confirm dialog).
- **visibility:** Android only (on this screen).
- **route_chain:** confirm dialog → `onLogout`
- **side_effects:** ends the session.
- **end_state:** Signed out.
- **parity:** ANDROID-ONLY (on this screen) — the web Settings landing has no Sign-Out row; web logout lives elsewhere in the app chrome.
- **status:** OK

---

## SCREEN-LEVEL DRIFT FLAGS

- **Android "More" ≠ web "Settings".** Android's screen is a combined nav hub + settings menu: it adds Views (Calendar / Live Map / Reports), Finance (Estimates / Invoices / Payments), Payroll, Price Book, My Network, Inventory, a "My UltimatePro ID" card, and Sign-Out — none of which are on the web Settings landing (web reaches those via its own nav). Same destinations, different placement.
- **Notifications is a sub-page on web but inline toggles on Android.** Web `/settings/notifications` is a dedicated screen; Android shows 5 inline toggles writing **device-local** `NotificationPreferences` (not server-synced). The two are not the same surface.
- **All 11 web sub-page routes are registered** (App.jsx:121–131) — every Settings landing link resolves; no 404s. The 11 sub-pages are the remaining unmapped screens tracked in the index.
- **UNVERIFIED:** whether the web app exposes the Android-only items (UCM-ID card, inline notification prefs, in-settings logout) anywhere else; the sub-page internals (deliberately out of scope for this landing map).
