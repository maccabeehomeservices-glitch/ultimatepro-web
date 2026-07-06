// Shared E2E config + safety guard. Imported by playwright.config.js and global-setup.js.
//
// SAFETY: the deployed staging WEB bundle currently talks to the PRODUCTION backend
// (VITE_API_URL baked at build time — see MISSION_CONTROL P1.3 blocker). So we do NOT
// point Playwright at the staging web URL. Instead we build the web locally with
// VITE_API_URL pinned to the STAGING backend and serve it on localhost. All writes then
// land on staging + the "Demo Door Co" seed only.

export const STAGING_BACKEND = 'https://ultimatecrm-backend-staging.up.railway.app';
export const API_BASE = STAGING_BACKEND + '/api';
// Must be an origin the staging backend CORS allowlist accepts (server.js corsOrigins):
// http://localhost:5173 is whitelisted, so we serve the local preview build there.
export const PORT = 5173;
export const BASE_URL = `http://localhost:${PORT}`;

// Demo seed credentials (scripts/seed_staging.js).
export const OWNER = { email: 'demo@ultimatepro.pro', password: 'ChangeMe#Demo2026' };
// Technician user is not in the seed; global-setup creates it idempotently via the API.
export const TECH = {
  email: 'tech.e2e@demo.local',
  password: 'Tech#Demo2026',
  first_name: 'Tess',
  last_name: 'Tech',
};

// Test-data prefix so every row this suite creates is identifiable (and never collides
// with the seed's "Customer1..10 Demo" / "CTEST-" rows).
export const E2E = 'E2E';

// Hard guard: refuse to run against any production target.
export function assertSafeTargets() {
  const bad = [];
  if (/ultimatepro\.pro/i.test(BASE_URL)) bad.push(`BASE_URL is production web (${BASE_URL})`);
  if (/production/i.test(STAGING_BACKEND)) bad.push(`backend host looks like production (${STAGING_BACKEND})`);
  if (!/staging/i.test(STAGING_BACKEND)) bad.push(`backend host is not a staging host (${STAGING_BACKEND})`);
  if (bad.length) {
    throw new Error(
      'E2E SAFETY GUARD TRIPPED — refusing to run:\n  - ' + bad.join('\n  - ') +
      '\nThis suite may only run against staging services.'
    );
  }
}
