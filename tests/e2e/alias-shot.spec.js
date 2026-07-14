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
    await page.screenshot({ path: `crawl-alias/branded-email-${scheme}.png`, fullPage: true });
  });
}
