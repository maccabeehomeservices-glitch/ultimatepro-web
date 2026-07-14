// P3.1d readability crawl (David's method): screenshot every route full-page in dark AND
// light, logged-in with demo data, so we can EYEBALL each shot and read every string.
// Tagged @crawl so the normal suite can exclude it (--grep-invert @crawl). Run:
//   npx playwright test dark-crawl --project=desktop
import { test } from '@playwright/test';
import { ownerState } from './helpers.js';

test.use({ storageState: ownerState });
test.describe.configure({ timeout: 180_000 });

const routes = [
  ['dashboard', '/dashboard'],
  ['jobs', '/jobs'],
  ['customers', '/customers'],
  ['leads', '/leads'],
  ['calendar', '/calendar'],
  ['estimates', '/estimates'],
  ['invoices', '/invoices'],
  ['payments', '/payments'],
  ['phone', '/phone'],
  ['reports', '/reports'],
  ['payroll', '/payroll'],
  ['pricebook', '/pricebook'],
  ['network', '/network'],
  ['inventory', '/inventory'],
  ['notifications', '/notifications'],
  ['settings', '/settings'],
  ['settings-company', '/settings/company'],
];

// list route → click the first list CARD to reach a DETAIL screen and shot it.
// seg = the plural route segment used in the detail URL (/jobs/:id, /customers/:id, …).
const details = [
  ['job-detail', '/jobs', 'jobs'],
  ['customer-detail', '/customers', 'customers'],
  ['estimate-detail', '/estimates', 'estimates'],
  ['invoice-detail', '/invoices', 'invoices'],
];

async function settle(page) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1200);
}

for (const scheme of ['dark', 'light']) {
  test(`@crawl @desktop-only ${scheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    for (const [name, route] of routes) {
      await page.goto(route);
      await settle(page);
      await page.screenshot({ path: `crawl/${name}-${scheme}.png`, fullPage: true });
    }
    for (const [name, listRoute, seg] of details) {
      await page.goto(listRoute);
      await settle(page);
      // Click the FIRST real, VISIBLE list card inside the content region. Every list
      // renders its rows as <Card onClick=navigate> → div.cursor-pointer; scoping to <main>
      // skips the sidebar/header (the old generic selector landed on the Notifications bell).
      // The `:visible` filter is essential for /jobs: at desktop the mobile JobCards
      // (md:hidden → display:none) come FIRST in the DOM, so a plain .first() grabbed a
      // hidden card and the click hung until timeout. Then we ASSERT the URL became a detail
      // route before shooting, so a mis-click can't silently screenshot the wrong screen.
      const card = page.locator('main .cursor-pointer:visible').first();
      try {
        await card.click({ timeout: 6000 });
        await page.waitForURL(new RegExp(`/${seg}/[^/]+$`), { timeout: 12000 });
        await settle(page);
        await page.screenshot({ path: `crawl/${name}-${scheme}.png`, fullPage: true });
      } catch { /* no detail row seeded, or nav didn't reach a detail — skip */ }
    }
  });
}
