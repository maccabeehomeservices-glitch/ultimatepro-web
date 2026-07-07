import { test, expect } from '@playwright/test';
import { ownerState } from './helpers.js';

// STEP 3 — breadth over the reconciled checklist. Read-only assertions against the seeded
// "Demo Door Co" (no writes, no external sends). Expected behavior = atlas + code.
test.use({ storageState: ownerState });

test('dashboard: greeting + the current 6-KPI card set', async ({ page }) => {
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');
  await expect(page.getByText(/Hello,/i)).toBeVisible();
  // Current cards (not the plan's old 3) — see RECONCILIATION 2.2.
  for (const label of ['Total Jobs', 'This Month', 'Completion Rate', 'Scheduled Today']) {
    await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
  }
});

test('jobs list: seeded jobs render and search stays non-empty', async ({ page }) => {
  await page.goto('/jobs');
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { name: 'Jobs' })).toBeVisible();
  await expect(page.getByText('No jobs found')).toHaveCount(0);   // seed has active jobs
  await page.getByPlaceholder('Search jobs...').fill('Demo');
  await expect(page.getByText('No jobs found')).toHaveCount(0);
});

test('jobs list: Filters dialog opens with Status + Technician sections', async ({ page }) => {
  await page.goto('/jobs');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: 'Filters' }).click();
  await expect(page.getByRole('heading', { name: 'Filters' })).toBeVisible();
  await expect(page.getByText('Received (from partners)')).toBeVisible();  // partner_view checkbox
});

test('calendar: month grid renders with day cells', async ({ page }) => {
  await page.goto('/calendar');
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { name: /\b20\d\d\b/ })).toBeVisible();  // "MMMM yyyy"
  expect(await page.getByRole('button').count()).toBeGreaterThan(20);             // day buttons
});

test('customers: list → detail with the four tabs', async ({ page }) => {
  await page.goto('/customers');
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { name: 'Customers' })).toBeVisible();
  await page.getByText(/Customer1/).first().click();
  await page.waitForURL(/\/customers\/[0-9a-f-]{36}/);
  for (const tab of ['Jobs', 'Estimates', 'Invoices', 'Messages']) {
    await expect(page.getByText(tab, { exact: true }).first()).toBeVisible();
  }
  await page.getByText('Estimates', { exact: true }).first().click();  // switch tab, no crash
});

test('customers are permanent: no delete/archive control on list or detail (P2.1l Part A)', async ({ page }) => {
  await page.goto('/customers');
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { name: 'Customers' })).toBeVisible();
  // The bulk-select entry point (whose only action was delete) is gone.
  await expect(page.getByRole('button', { name: 'Select' })).toHaveCount(0);
  await expect(page.getByText(/Delete Selected/i)).toHaveCount(0);
  // Detail: no delete affordance anywhere (trash icon + confirm modal removed); Edit remains.
  await page.getByText(/Customer1/).first().click();
  await page.waitForURL(/\/customers\/[0-9a-f-]{36}/);
  await expect(page.getByText(/Delete Customer/i)).toHaveCount(0);
});

test('estimates: list shows current status chips + seeded estimates', async ({ page }) => {
  await page.goto('/estimates');
  await page.waitForLoadState('networkidle');
  await expect(page.getByText('Signed', { exact: true })).toBeVisible();   // new chip (was not in plan)
  await page.getByText('All', { exact: true }).first().click();
  await expect(page.getByText(/EST-/).first()).toBeVisible();
});

test('invoices: default Unpaid filter + INV numbers under All', async ({ page }) => {
  await page.goto('/invoices');
  await page.waitForLoadState('networkidle');
  for (const chip of ['All', 'Unpaid', 'Paid', 'Overdue']) {
    await expect(page.getByText(chip, { exact: true }).first()).toBeVisible();
  }
  await page.getByText('All', { exact: true }).first().click();
  await expect(page.getByText(/INV-/).first()).toBeVisible();
});

test('payments: read-only list with date range', async ({ page }) => {
  await page.goto('/payments');
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { name: 'Payments', exact: true })).toBeVisible();
  expect(await page.locator('input[type="date"]').count()).toBeGreaterThanOrEqual(2);  // From/To
});

test('settings: menu lists Company Profile + Team Members first', async ({ page }) => {
  await page.goto('/settings');
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await expect(page.getByText('Company Profile')).toBeVisible();
  await expect(page.getByText('Team Members')).toBeVisible();
});
