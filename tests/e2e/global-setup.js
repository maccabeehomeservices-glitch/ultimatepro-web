// Global setup: guard, then log in as owner + technician against the STAGING backend and
// persist Playwright storageState (localStorage token/user/company) for both roles.
// The technician user is created idempotently since the demo seed has no technician.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { API_BASE, BASE_URL, OWNER, TECH, assertSafeTargets } from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const AUTH_DIR = path.join(__dirname, '.auth');
export const ownerStatePath = path.join(AUTH_DIR, 'owner.json');
export const techStatePath = path.join(AUTH_DIR, 'technician.json');

async function apiLogin(email, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`login failed for ${email}: HTTP ${res.status} ${await res.text()}`);
  return res.json();
}

// Build a Playwright storageState from a login response: the app reads up_token /
// up_user / up_company from localStorage on the BASE_URL origin.
function stateFromLogin(data) {
  const localStorageEntries = [
    { name: 'up_token', value: data.token },
    { name: 'up_user', value: JSON.stringify({ ...data.user, permissions_resolved: data.permissions_resolved }) },
    { name: 'up_company', value: JSON.stringify(data.company) },
  ];
  if (data.refresh_token) localStorageEntries.push({ name: 'up_refresh_token', value: data.refresh_token });
  return { cookies: [], origins: [{ origin: BASE_URL, localStorage: localStorageEntries }] };
}

async function ensureTechnician(ownerToken) {
  // Try to create; tolerate "already exists". Then log in as the technician.
  const res = await fetch(`${API_BASE}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify({
      first_name: TECH.first_name, last_name: TECH.last_name,
      email: TECH.email, password: TECH.password, role: 'technician',
    }),
  });
  if (!res.ok && res.status !== 409) {
    const body = await res.text();
    // A duplicate-email error may surface as 400/500 depending on the router — only
    // fail hard if a subsequent login also fails.
    if (!/exist|dupli|taken|unique/i.test(body)) {
      console.warn(`[e2e global-setup] create technician returned HTTP ${res.status}: ${body}`);
    }
  }
  return apiLogin(TECH.email, TECH.password);
}

export default async function globalSetup() {
  assertSafeTargets();
  fs.mkdirSync(AUTH_DIR, { recursive: true });

  const owner = await apiLogin(OWNER.email, OWNER.password);
  fs.writeFileSync(ownerStatePath, JSON.stringify(stateFromLogin(owner), null, 2));

  const tech = await ensureTechnician(owner.token);
  fs.writeFileSync(techStatePath, JSON.stringify(stateFromLogin(tech), null, 2));

  console.log(`[e2e global-setup] auth ready — owner=${owner.user.email} tech=${tech.user.email} (role ${tech.user.role})`);
}
