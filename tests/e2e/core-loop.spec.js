import { test, expect } from '@playwright/test';
import { ownerState, e2eName, drawSignature, hideBottomNav } from './helpers.js';

// STEP 2 — the core business loop as one continuous, asserted journey against staging:
//   create customer → create job (assigned to roster tech Tina) → estimate w/ line item
//   → in-app signature → convert to invoice (totals carry) → partial then full payment
//   → complete job → payroll reflects the tech's earnings.
// Comms-free throughout: in-app "Get Signature" + "Charge Payment", never a Send button,
// and "Save Job" (not "Save & Send") so no tech-notify SMS/email fires.
test.use({ storageState: ownerState });
test.describe.configure({ mode: 'serial' });

test('core loop: customer → job → estimate → sign → invoice → pay → complete → payroll', async ({ page }) => {
  test.setTimeout(120_000);
  const first = e2eName('Cust');            // unique first name
  const fullName = `${first} Loop`;
  const UNIT = '300';                        // one $300 service line, tax_rate 0 → total $300.00

  // ── 1. Create customer ──────────────────────────────────────────────────────
  await page.goto('/customers/new');
  await page.locator('input[name="first_name"]').fill(first);
  await page.locator('input[name="last_name"]').fill('Loop');
  await page.locator('input[name="phone"]').fill('5550100');
  await page.getByRole('button', { name: 'Create Customer' }).click();
  await page.waitForURL(/\/customers\/[0-9a-f-]{36}/);
  await expect(page.getByText(first).first()).toBeVisible();

  // ── 2. Create job for that customer, assigned to roster tech "Tina Tech" ─────
  await page.goto('/jobs/new');
  await page.getByPlaceholder('Search customer by name, phone, or email...').fill(first);
  await page.getByText(fullName).first().click();               // pick from dropdown
  await page.getByRole('button', { name: 'Service', exact: true }).click();
  await page.getByRole('button', { name: 'Roster', exact: true }).click();
  await page.locator('select:has(option:has-text("Tina Tech"))').selectOption({ label: 'Tina Tech' });
  // "Save Job" only (NOT the green "Save & Send", which would notify the tech).
  await page.getByRole('button', { name: 'Save Job', exact: true }).click();
  await page.waitForURL(/\/jobs\/[0-9a-f-]{36}/);
  const jobId = page.url().split('/jobs/')[1].split(/[/?#]/)[0];

  // ── 3. Job detail shows the flat cust_* fields ──────────────────────────────
  await expect(page.getByText(first).first()).toBeVisible();

  // ── 4. Create estimate from the job (job_id + customer_id prefilled) ─────────
  await page.getByRole('button', { name: /Create Estimate/ }).click();
  await page.waitForURL(/\/estimates\/new/);
  await page.getByRole('button', { name: 'Add', exact: true }).first().click();   // Services → blank row
  await page.getByPlaceholder('Item name').first().fill('E2E Service Line');
  await page.getByPlaceholder('0.00').first().fill(UNIT);
  await hideBottomNav(page);  // it overlaps the builder's sticky footer
  await page.getByRole('button', { name: 'Save Draft' }).click();
  await page.waitForURL(/\/estimates\/[0-9a-f-]{36}/);
  await expect(page.getByText('$300.00').first()).toBeVisible();

  // ── 5. Capture signature in-app (no comms) ──────────────────────────────────
  await page.getByRole('button', { name: /Get Signature/ }).click();
  await page.getByPlaceholder("Signer's full name").fill('E2E Signer');
  await drawSignature(page);
  await page.getByRole('button', { name: 'Save Signature' }).click();
  await expect(page.getByText(/Signature captured/i)).toBeVisible();

  // ── 6. Convert to invoice via the auto "Add to Invoice?" prompt; totals carry ─
  const [convertResp] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/convert-to-invoice') && r.request().method() === 'POST'),
    page.getByRole('button', { name: 'Yes', exact: true }).click(),
  ]);
  expect(convertResp.ok()).toBeTruthy();
  await page.waitForURL(/\/invoices\/[0-9a-f-]{36}/);
  await expect(page.getByText('$300.00').first()).toBeVisible();  // total carried exactly

  // ── 7. Partial payment → still an outstanding balance ───────────────────────
  await page.getByRole('button', { name: 'Charge Payment' }).click();
  await expect(page.getByRole('heading', { name: 'Record Payment' })).toBeVisible();
  await page.getByPlaceholder('0.00').fill('100');
  const [pay1] = await Promise.all([
    page.waitForResponse(r => /\/invoices\/[^/]+\/payment/.test(r.url()) && r.request().method() === 'POST'),
    page.getByRole('button', { name: 'Record', exact: true }).click(),
  ]);
  expect(pay1.ok()).toBeTruthy();
  // Partially paid: the $100 payment is recorded in history and a balance still stands.
  await expect(page.getByText('Payment History')).toBeVisible();
  await expect(page.getByText('$100.00').first()).toBeVisible();
  await expect(page.getByText(/outstanding balance/i)).toBeVisible();  // not fully paid yet

  // ── 8. Pay the remainder → invoice becomes paid ─────────────────────────────
  await page.getByRole('button', { name: 'Charge Payment' }).click();
  await page.getByPlaceholder('0.00').fill('200');
  const [pay2] = await Promise.all([
    page.waitForResponse(r => /\/invoices\/[^/]+\/payment/.test(r.url()) && r.request().method() === 'POST'),
    page.getByRole('button', { name: 'Record', exact: true }).click(),
  ]);
  expect(pay2.ok()).toBeTruthy();
  // Paid: the amber balance banner is gone and Charge Payment is no longer offered.
  await expect(page.getByRole('button', { name: 'Charge Payment' })).toBeHidden();
  await expect(page.getByText(/outstanding balance/i)).toBeHidden();

  // ── 9. Complete the job ─────────────────────────────────────────────────────
  await page.goto(`/jobs/${jobId}`);
  await page.waitForLoadState('networkidle');
  await hideBottomNav(page);
  await page.getByRole('button', { name: /Completed/ }).click();
  await expect(page.getByRole('heading', { name: 'Complete Job' })).toBeVisible();
  const [completeResp] = await Promise.all([
    page.waitForResponse(r => /\/jobs\/[^/]+\/complete/.test(r.url()) && r.request().method() === 'POST'),
    page.getByRole('button', { name: 'Complete Job', exact: true }).click(),
  ]);
  expect(completeResp.ok()).toBeTruthy();
  await expect(page.getByText('Completed').first()).toBeVisible({ timeout: 15_000 });

  // ── 10. Payroll reflects the completed job's tech earnings (assert the API) ──
  const [earnResp] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/reports/earnings') && r.request().method() === 'GET'),
    page.goto('/payroll'),
  ]);
  expect(earnResp.ok()).toBeTruthy();
  const earnJson = await earnResp.json();
  const tina = (earnJson.earnings || []).find(e => `${e.first_name} ${e.last_name}`.includes('Tina'));
  expect(tina, 'Tina Tech earnings row present').toBeTruthy();
  expect(Number(tina.total)).toBeGreaterThan(0);        // completed job produced earnings
  expect(Number(tina.job_count)).toBeGreaterThanOrEqual(1);
  await expect(page.getByText('Tina Tech').first()).toBeVisible({ timeout: 15_000 });
});
