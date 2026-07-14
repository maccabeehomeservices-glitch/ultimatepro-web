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
  ['settings-company', '/settings/company-profile'],
];

// list route → screenshot, then click the first row/card to reach a DETAIL screen and shot it.
const details = [
  ['job-detail', '/jobs', 'job'],
  ['customer-detail', '/customers', 'customer'],
  ['estimate-detail', '/estimates', 'estimate'],
  ['invoice-detail', '/invoices', 'invoice'],
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
    for (const [name, listRoute] of details) {
      await page.goto(listRoute);
      await settle(page);
      // first clickable card that navigates into a detail (a card link or a row button)
      const card = page.locator('a[href*="/"], [role="button"]').filter({ hasText: /\w/ });
      const clickable = page.locator('div.cursor-pointer, a.block, button').first();
      try {
        await clickable.click({ timeout: 4000 });
        await settle(page);
        await page.screenshot({ path: `crawl/${name}-${scheme}.png`, fullPage: true });
      } catch { /* no detail row seeded — skip */ }
    }
  });
}
