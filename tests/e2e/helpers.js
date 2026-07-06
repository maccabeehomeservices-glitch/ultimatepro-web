// Shared E2E helpers: storageState paths, unique test-data names, small UI utilities.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect } from '@playwright/test';
import { E2E } from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ownerState = path.join(__dirname, '.auth', 'owner.json');
export const techState = path.join(__dirname, '.auth', 'technician.json');

// Monotonic-ish unique suffix without Date.now()/Math.random() flakiness across a run.
// Uses a per-process counter seeded from the worker start; good enough for uniqueness
// within a single serial suite. Falls back to a timestamp-ish value from process.hrtime.
let _seq = 0;
export function uid() {
  _seq += 1;
  const t = Number(process.hrtime.bigint() % 100000n);
  return `${t}${_seq}`;
}

export function e2eName(kind) {
  return `${E2E}-${kind}-${uid()}`;
}

// Wait for the SPA to be authenticated + past the loading gate on a protected route.
export async function gotoApp(page, route = '/dashboard') {
  await page.goto(route);
  // ProtectedRoute shows a loader until /auth/me resolves; the bottom nav / main content
  // then mounts. Wait for network to settle so localStorage token is consumed.
  await page.waitForLoadState('networkidle');
}

// Assert a toast/snackbar with the given text substring appears (case-insensitive).
export async function expectSnackbar(page, text) {
  await expect(page.getByText(new RegExp(text, 'i')).first()).toBeVisible({ timeout: 15_000 });
}

// The shared ui/Input + ui/Select render <label> as a bare sibling (no htmlFor), so
// getByLabel can't associate. Target the control that immediately follows the label text.
export function labeledInput(page, labelText) {
  return page.locator(`xpath=//label[contains(normalize-space(.), ${JSON.stringify(labelText)})]/following-sibling::input[1]`);
}
export function labeledSelect(page, labelText) {
  return page.locator(`xpath=//label[contains(normalize-space(.), ${JSON.stringify(labelText)})]/following-sibling::select[1]`);
}

// The fixed mobile bottom-nav (md:hidden, bottom-0) overlaps sticky page footers and
// intercepts clicks. Hide it so footer buttons (e.g. estimate builder "Save Draft") are
// clickable. Persists until the next full page load re-mounts Layout.
export async function hideBottomNav(page) {
  await page.evaluate(() => {
    document.querySelectorAll('div.fixed.bottom-0').forEach((el) => {
      if (el.className.includes('md:hidden')) el.style.display = 'none';
    });
  });
}

// Draw a squiggle on the SignaturePad canvas. hasDrawn flips on mousedown, enabling
// "Save Signature". Works in chromium even under an isMobile context.
export async function drawSignature(page) {
  const canvas = page.locator('canvas').first();
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('signature canvas not found');
  const x = box.x, y = box.y, w = box.width, h = box.height;
  await page.mouse.move(x + w * 0.2, y + h * 0.5);
  await page.mouse.down();
  await page.mouse.move(x + w * 0.4, y + h * 0.3, { steps: 10 });
  await page.mouse.move(x + w * 0.6, y + h * 0.7, { steps: 10 });
  await page.mouse.move(x + w * 0.8, y + h * 0.45, { steps: 10 });
  await page.mouse.up();
}
