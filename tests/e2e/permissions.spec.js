import { test, expect } from '@playwright/test';
import { techState, ownerState } from './helpers.js';

// STEP 3 (permissions) — a technician must not see owner-only nav AND must not reach the
// restricted pages by direct URL (P2.1h / P2.1d F9). Nav gating: the desktop Sidebar and the
// mobile BottomNav both filter items via can(section,'view'). Route gating: RequirePermission
// mirrors the backend requirePermission(section,level) so a direct-URL hit shows a clean
// "Access denied" panel instead of the broken shell that fires failing 403 fetches.
// Technician resolved perms: reports=none (→ Reports hidden + /reports denied), team_settings=
// none (→ Settings hidden + /settings denied); payments_refunds/accounting_earnings=edit_self
// (→ those stay visible, matching the backend which serves a technician those views).
// See RECONCILIATION §19 + MISSION_CONTROL P2.1h.

test.describe('technician permission gating', () => {
  test.use({ storageState: techState });

  test('@desktop-only sidebar hides owner-only Reports + Settings nav', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    // Sidebar renders these as NavLinks (role=link).
    await expect(page.getByRole('link', { name: 'Jobs' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Customers' })).toBeVisible();
    // reports:none → Reports link not rendered; team_settings:none → Settings link not rendered.
    await expect(page.getByRole('link', { name: 'Reports' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Settings' })).toHaveCount(0);
  });

  test('direct-nav to /reports shows Access denied, not the Reports shell', async ({ page }) => {
    await page.goto('/reports');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Access denied')).toBeVisible();
    // The real Reports page heading must NOT render (the shell is gated out).
    await expect(page.getByRole('heading', { name: 'Reports', exact: true })).toHaveCount(0);
  });

  test('direct-nav to /settings shows Access denied, not the Settings shell', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Access denied')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toHaveCount(0);
  });
});

test.describe('owner reaches gated pages (over-block guard)', () => {
  test.use({ storageState: ownerState });

  test('owner is never shown Access denied on /reports or /settings', async ({ page }) => {
    await page.goto('/reports');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Access denied')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Reports', exact: true })).toBeVisible();

    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Access denied')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
  });
});
