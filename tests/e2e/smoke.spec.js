import { test, expect } from '@playwright/test';
import { ownerState } from './helpers.js';

// Smoke: proves the whole pipeline — local build against staging backend, preview server,
// guard, owner storageState, and a protected route rendering real seeded data.
test.use({ storageState: ownerState });

test('owner lands on dashboard with greeting + bottom nav (not redirected to login)', async ({ page }) => {
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByText(/Hello,/i)).toBeVisible();
  // Mobile bottom nav present.
  await expect(page.getByRole('link', { name: 'Home' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Jobs' })).toBeVisible();
});
