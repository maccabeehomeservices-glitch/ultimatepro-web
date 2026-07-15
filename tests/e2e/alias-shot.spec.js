// P3.10 Tier 1 proof — screenshot the new Company Profile "Branded Email" field in dark AND
// light, with a slug typed in so the live availability status renders. @aliasshot @desktop-only.
import { test } from '@playwright/test';
import { ownerState } from './helpers.js';

test.use({ storageState: ownerState });
test.describe.configure({ timeout: 120_000 });

for (const scheme of ['dark', 'light']) {
  test(`@aliasshot @desktop-only ${scheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('/settings/company');
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(1200);
    // Type a slug into the branded-email input so the debounced live check shows a status.
    const slug = page.locator('input[placeholder="yourbrand"]');
    if (await slug.isVisible().catch(() => false)) {
      await slug.click();
      await slug.pressSequentially('seasidedemo', { delay: 60 }); // real keystrokes → React onChange + debounce
      await page.waitForTimeout(2500); // let the ~400ms debounce + staging round-trip resolve
    }
    // Tier 2 BYO email input (type=email) — type a value so its state renders.
    const byo = page.locator('input[type="email"]').last();
    if (await byo.isVisible().catch(() => false)) {
      await byo.click();
      await byo.pressSequentially('owner@myrealco.com', { delay: 40 });
      await page.waitForTimeout(400);
    }
    // P3.5 phone section — enter an area code + Search so the number results render (live Twilio).
    const ac = page.locator('input[placeholder="Area code"]');
    if (await ac.isVisible().catch(() => false)) {
      await ac.click();
      await ac.pressSequentially('757', { delay: 40 });
      await page.getByRole('button', { name: 'Search' }).first().click().catch(() => {});
      await page.waitForTimeout(2500); // let the live number search resolve
    }
    await page.screenshot({ path: `crawl-alias/branded-email-${scheme}.png`, fullPage: true });
  });
}
