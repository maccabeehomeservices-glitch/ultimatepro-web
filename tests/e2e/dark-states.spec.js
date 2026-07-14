// P3.1d REOPEN — STATE-LEVEL dark audit (David's real order). A route screenshot shows
// EMPTY fields; the black-on-black defect lives in INTERACTIVE states — inputs with VALUES
// typed in, selects chosen, textareas with content, modals opened, edit modes. This spec
// drives those states and screenshots each in dark AND light so every typed value can be
// eyeballed for readability. Tagged @states @desktop-only. Run:
//   npx playwright test dark-states --project=desktop
import { test } from '@playwright/test';
import { ownerState } from './helpers.js';

test.use({ storageState: ownerState });
test.describe.configure({ timeout: 240_000 });

async function settle(page) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1000);
}

// Fill every visible, editable text field + choose a real option in every select, so the
// shot shows TYPED VALUES (the state a route crawl never captures).
async function fillEveryField(page) {
  const boxes = page.locator(
    'input:not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="range"]):not([type="color"]):not([readonly]):not([disabled]), textarea:not([readonly]):not([disabled])'
  );
  const n = await boxes.count();
  for (let i = 0; i < n; i++) {
    const el = boxes.nth(i);
    try {
      if (!(await el.isVisible())) continue;
      const type = (await el.getAttribute('type')) || 'text';
      const val =
        type === 'number' ? '1234.56' :
        type === 'email'  ? 'typed.value@demo.local' :
        type === 'tel'    ? '(757) 555-0142' :
        type === 'date'   ? '2026-07-20' :
        type === 'time'   ? '14:30' :
        type === 'search' ? 'Typed search text' :
        'Typed Value ' + i + ' — reads in dark?';
      await el.fill(val, { timeout: 2000 });
    } catch { /* skip un-fillable */ }
  }
  const selects = page.locator('select:visible');
  const sn = await selects.count();
  for (let i = 0; i < sn; i++) {
    try { await selects.nth(i).selectOption({ index: 1 }, { timeout: 1500 }); } catch {}
  }
}

// Best-effort: click a control by visible text if present; returns true if it acted.
async function clickIf(page, name, re) {
  const el = page.getByRole('button', { name: re }).first();
  try {
    if (await el.isVisible({ timeout: 1500 })) { await el.click(); await settle(page); return true; }
  } catch {}
  return false;
}

const FORMS = [
  ['new-customer', '/customers/new'],
  ['new-job',      '/jobs/new'],
  ['new-estimate', '/estimates/new'],
  ['new-invoice',  '/invoices/new'],
  ['company-profile', '/settings/company'],
];

for (const scheme of ['dark', 'light']) {
  test(`@states @desktop-only ${scheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });

    // 1) Every create/edit form, FILLED.
    for (const [name, route] of FORMS) {
      await page.goto(route);
      await settle(page);
      await fillEveryField(page);
      await page.waitForTimeout(300);
      await page.screenshot({ path: `crawl-states/${name}-filled-${scheme}.png`, fullPage: true });
    }

    // 2) Estimate builder mid-entry — add a line item so the price/qty/description inputs appear, then fill.
    await page.goto('/estimates/new');
    await settle(page);
    await clickIf(page, 'add-item', /add (item|line|product|service)/i);
    await fillEveryField(page);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `crawl-states/estimate-builder-items-${scheme}.png`, fullPage: true });

    // 3) Job Detail — open the first job, fill the Notes textarea, screenshot the edit state.
    await page.goto('/jobs');
    await settle(page);
    const jobCard = page.locator('main .cursor-pointer:visible').first();
    try {
      await jobCard.click({ timeout: 5000 });
      await page.waitForURL(/\/jobs\/[^/]+$/, { timeout: 12000 });
      await settle(page);
      const notes = page.locator('textarea:visible').first();
      if (await notes.isVisible().catch(() => false)) {
        await notes.fill('Typed job notes — customer called, gate code 4471, dog in yard. Reads in dark?');
      }
      await page.waitForTimeout(300);
      await page.screenshot({ path: `crawl-states/job-detail-notes-${scheme}.png`, fullPage: true });

      // 4) A modal on the job detail: try the status/send/payment pickers.
      for (const [label, re] of [['status', /status|update/i], ['charge', /charge|payment|record pay/i], ['send', /send/i]]) {
        if (await clickIf(page, label, re)) {
          await page.screenshot({ path: `crawl-states/modal-${label}-${scheme}.png`, fullPage: true });
          await page.keyboard.press('Escape').catch(() => {});
          await page.waitForTimeout(400);
        }
      }
    } catch { /* no seeded job — skip */ }

    // 5) Estimate detail — open the Send modal (a picker with its own inputs).
    await page.goto('/estimates');
    await settle(page);
    const estCard = page.locator('main .cursor-pointer:visible').first();
    try {
      await estCard.click({ timeout: 5000 });
      await page.waitForURL(/\/estimates\/[^/]+$/, { timeout: 12000 });
      await settle(page);
      if (await clickIf(page, 'send', /send|share/i)) {
        await page.screenshot({ path: `crawl-states/modal-estimate-send-${scheme}.png`, fullPage: true });
      }
    } catch {}
  });
}
