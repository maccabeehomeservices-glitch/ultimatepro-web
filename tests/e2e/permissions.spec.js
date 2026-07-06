import { test, expect } from '@playwright/test';
import { techState } from './helpers.js';

// STEP 3 (permissions) — a technician must not see owner-only nav. The desktop Sidebar
// (active ≥768px) gates Reports/Payments/Payroll via can(section,'view'); the mobile
// BottomNav does NOT gate, so this assertion only holds on the DESKTOP project.
// Technician resolved perms: reports=none (→ Reports hidden), payments_refunds/
// accounting_earnings=edit_self (→ those stay visible). See RECONCILIATION §19.
test.use({ storageState: techState });

test('@desktop-only technician sidebar hides owner-only Reports nav', async ({ page }) => {
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');
  // Sidebar renders these as NavLinks (role=link).
  await expect(page.getByRole('link', { name: 'Jobs' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Customers' })).toBeVisible();
  // reports:none → Reports link is not rendered for a technician.
  await expect(page.getByRole('link', { name: 'Reports' })).toHaveCount(0);
});
