import { defineConfig } from '@playwright/test';
import { BASE_URL, PORT, STAGING_BACKEND, assertSafeTargets } from './tests/e2e/config.js';

// Trip the guard at config load time too (belt + suspenders with global-setup).
assertSafeTargets();

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.js',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1, // serial: shared demo company, write-heavy core loop
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    // Primary: mobile 375x812 (chromium). Runs everything except desktop-only specs.
    {
      name: 'mobile',
      use: { browserName: 'chromium', viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true },
      grepInvert: /@desktop-only/,
    },
    // One desktop project 1280x800 for layout/nav that only exists on desktop.
    {
      name: 'desktop',
      use: { browserName: 'chromium', viewport: { width: 1280, height: 800 } },
      grep: /@desktop-only/,
    },
  ],
  webServer: {
    // Build with VITE_API_URL pinned to STAGING backend, then serve the build on localhost.
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    env: { VITE_API_URL: STAGING_BACKEND },
  },
});
