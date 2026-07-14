// P3.1d REOPEN — RESIDUAL literal shot set (David's close-gate list): the states not yet
// individually captured — pricebook line-item price inputs, payment + signature modals, and
// the route-crawl's timed-out light-mode DETAIL shots. Captured in dark AND light so every
// typed value / modal can be eyeballed. Tagged @residual @desktop-only. Run:
//   npx playwright test dark-residual --project=desktop
import { test } from '@playwright/test';
import { ownerState } from './helpers.js';

test.use({ storageState: ownerState });
test.describe.configure({ timeout: 240_000 });

async function settle(page) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1000);
}
async function fillNumbers(page, v) {
  const nums = page.locator('input[type="number"]:visible');
  const n = await nums.count();
  for (let i = 0; i < n; i++) { try { await nums.nth(i).fill(v, { timeout: 1500 }); } catch {} }
}
async function fillText(page, v) {
  const boxes = page.locator('input[type="text"]:visible, input:not([type]):visible, textarea:visible');
  const n = await boxes.count();
  for (let i = 0; i < n; i++) { try { await boxes.nth(i).fill(v, { timeout: 1200 }); } catch {} }
}

for (const scheme of ['dark', 'light']) {
  test(`@residual @desktop-only ${scheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });

    // A. Estimate builder — PRICEBOOK PICKER modal (has a search input).
    await page.goto('/estimates/new');
    await settle(page);
    try {
      await page.getByRole('button', { name: 'Pricebook', exact: true }).first().click({ timeout: 5000 });
      await settle(page);
      const search = page.locator('[role="dialog"] input, .fixed input, [class*="modal"] input').first();
      if (await search.isVisible().catch(() => false)) await search.fill('Typed search — reads in dark?');
      await page.waitForTimeout(300);
      await page.screenshot({ path: `crawl-residual/pricebook-picker-${scheme}.png`, fullPage: true });
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(400);
    } catch {}

    // B. Estimate LINE-ITEM PRICE inputs — "+ Add" a manual line, fill name + Qty/Amount.
    try {
      await page.getByRole('button', { name: 'Add', exact: true }).first().click({ timeout: 5000 });
      await settle(page);
      await fillText(page, 'Typed line item — reads in dark?');
      await fillNumbers(page, '1234.56');
      await page.waitForTimeout(300);
      await page.screenshot({ path: `crawl-residual/estimate-lineitem-prices-${scheme}.png`, fullPage: true });
    } catch {}

    // C. Invoice detail — PAYMENT modal (amount/method/reference/notes inputs).
    await page.goto('/invoices');
    await settle(page);
    try {
      await page.locator('main .cursor-pointer:visible').first().click({ timeout: 5000 });
      await page.waitForURL(/\/invoices\/[^/]+$/, { timeout: 15000 });
      await settle(page);
      const pay = page.getByRole('button', { name: /charge payment|record payment/i }).first();
      if (await pay.isVisible({ timeout: 2500 }).catch(() => false)) {
        await pay.click();
        await settle(page);
        await fillNumbers(page, '250.00');
        await fillText(page, 'Typed payment note — reads in dark?');
        await page.waitForTimeout(300);
        await page.screenshot({ path: `crawl-residual/payment-modal-${scheme}.png`, fullPage: true });
        await page.keyboard.press('Escape').catch(() => {});
        await page.waitForTimeout(400);
      }
    } catch {}

    // D. Estimate detail — SIGNATURE modal (SignaturePad canvas + title/buttons).
    await page.goto('/estimates');
    await settle(page);
    try {
      await page.locator('main .cursor-pointer:visible').first().click({ timeout: 5000 });
      await page.waitForURL(/\/estimates\/[^/]+$/, { timeout: 15000 });
      await settle(page);
      const sig = page.getByRole('button', { name: /get signature|signature/i }).first();
      if (await sig.isVisible({ timeout: 2500 }).catch(() => false)) {
        await sig.click();
        await settle(page);
        await page.screenshot({ path: `crawl-residual/signature-modal-${scheme}.png`, fullPage: true });
        await page.keyboard.press('Escape').catch(() => {});
        await page.waitForTimeout(400);
      }
    } catch {}

    // E. DETAIL screens in BOTH modes (fills the route-crawl's timed-out light-detail gap).
    const details = [
      ['job-detail', '/jobs', 'jobs'],
      ['customer-detail', '/customers', 'customers'],
      ['estimate-detail', '/estimates', 'estimates'],
      ['invoice-detail', '/invoices', 'invoices'],
    ];
    for (const [name, list, seg] of details) {
      await page.goto(list);
      await settle(page);
      try {
        await page.locator('main .cursor-pointer:visible').first().click({ timeout: 6000 });
        await page.waitForURL(new RegExp(`/${seg}/[^/]+$`), { timeout: 15000 });
        await settle(page);
        await page.screenshot({ path: `crawl-residual/${name}-${scheme}.png`, fullPage: true });
      } catch {}
    }
  });
}
