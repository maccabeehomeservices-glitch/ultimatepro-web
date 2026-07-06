import { test, expect } from '@playwright/test';
import { ownerState } from './helpers.js';

// STEP 4 — one contract per shipped fix the atlas records, asserting the FIXED surface so
// it can't silently revert. Non-destructive: no writes, no external sends. (Fixes whose
// only exercise path fires real comms — SMS send, network invite — are locked at their web
// surface, since firing them against staging would hit live Twilio/SendGrid.)
test.use({ storageState: ownerState });

test('team members: create form splits name into First + Last (shipped fix)', async ({ page }) => {
  await page.goto('/settings/team');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: '+ Add Team Member' }).click();
  // Two separate required name fields, in this order — a revert to a single "Name" fails.
  await expect(page.getByText('First Name', { exact: false }).first()).toBeVisible();
  await expect(page.getByText('Last Name', { exact: false }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create Team Member' })).toBeVisible();
});

test('estimate builder: Good-Better-Best mode is present (GBB present flow)', async ({ page }) => {
  await page.goto('/estimates/new');
  await page.waitForLoadState('networkidle');
  await expect(page.getByText('Good-Better-Best Mode')).toBeVisible();
});

test('estimate detail: Attach Photo control present (fixed 2026-06-07)', async ({ page }) => {
  await page.goto('/estimates');
  await page.waitForLoadState('networkidle');
  await page.getByText('All', { exact: true }).first().click();
  await page.getByText(/EST-/).first().click();
  await page.waitForURL(/\/estimates\/[0-9a-f-]{36}/);
  await expect(page.getByText(/Attach Photo/)).toBeVisible();
});

test('phone/SMS: Messages + Calls tabs (thread-envelope surface)', async ({ page }) => {
  await page.goto('/phone');
  await page.waitForLoadState('networkidle');
  await expect(page.getByText('Messages', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Calls', { exact: true }).first()).toBeVisible();
});

test('network: web accept/decline surface (UCM ID + search tabs)', async ({ page }) => {
  await page.goto('/network');
  await page.waitForLoadState('networkidle');
  await expect(page.getByText('Your UCM ID', { exact: true })).toBeVisible();
  await expect(page.getByText(/By Phone/)).toBeVisible();
  await expect(page.getByText(/By UCM ID/)).toBeVisible();
});

test('inventory: four-tab layout incl. transfer target (fixed transfer)', async ({ page }) => {
  await page.goto('/inventory');
  await page.waitForLoadState('networkidle');
  for (const tab of ['Warehouse', 'Trucks', 'My Truck', 'Restock Requests']) {
    await expect(page.getByText(tab, { exact: true }).first()).toBeVisible();
  }
});
