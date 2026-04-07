export function getToken() {
  return localStorage.getItem('up_token');
}

export function setToken(t) {
  localStorage.setItem('up_token', t);
}

export function clearToken() {
  localStorage.removeItem('up_token');
}

export function getCurrentUser() {
  try {
    const token = getToken();
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1];
    const padded = payload + '=='.slice(0, (4 - (payload.length % 4)) % 4);
    const decoded = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

export function getStoredUser() {
  return JSON.parse(localStorage.getItem('up_user') || 'null');
}

export function setStoredUser(u) {
  localStorage.setItem('up_user', JSON.stringify(u));
}

export function getStoredCompany() {
  return JSON.parse(localStorage.getItem('up_company') || 'null');
}

export function setStoredCompany(c) {
  localStorage.setItem('up_company', JSON.stringify(c));
}
