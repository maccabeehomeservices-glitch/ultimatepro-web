import { createContext, useContext, useState, useEffect } from 'react';
import api from '../lib/api';
import {
  getToken,
  setToken,
  clearToken,
  getStoredUser,
  setStoredUser,
  getStoredCompany,
  setStoredCompany,
} from '../lib/auth';

export const AuthContext = createContext(null);

// Mirror backend RANK (utils/permissions.js). Used by can() for UI gating.
const RANK = { none: 0, view: 1, edit_self: 2, full: 3 };

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getStoredUser());
  const [company, setCompany] = useState(() => getStoredCompany());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) { setLoading(false); return; }

    // Re-fetch /auth/me → refresh the resolved per-section permission levels on the
    // user so the UI can gate controls (e.g. Option B: hide the source picker when
    // jobs != full). /auth/me is the source; login fills it immediately.
    const refreshMe = async () => {
      try {
        const res = await api.get('/auth/me');
        const { user: u, company: c, permissions_resolved } = res.data;
        const up = { ...u, permissions_resolved };
        setUser(up);
        setCompany(c);
        setStoredUser(up);
        setStoredCompany(c);
      } catch {
        clearToken();
        localStorage.removeItem('up_user');
        localStorage.removeItem('up_company');
        setUser(null);
        setCompany(null);
      }
    };

    refreshMe().finally(() => setLoading(false));

    // P3.7: refresh permissions when the tab/window regains focus, so an owner's
    // permission change reaches a logged-in user on next foreground — no re-login.
    const onForeground = () => {
      if (document.visibilityState === 'visible' && getToken()) refreshMe();
    };
    document.addEventListener('visibilitychange', onForeground);
    window.addEventListener('focus', onForeground);
    return () => {
      document.removeEventListener('visibilitychange', onForeground);
      window.removeEventListener('focus', onForeground);
    };
  }, []);

  async function login(email, password) {
    const res = await api.post('/auth/login', { email, password });
    const { token, refresh_token, user: u, company: c, permissions_resolved } = res.data;
    setToken(token);
    if (refresh_token) localStorage.setItem('up_refresh_token', refresh_token);
    // Carry the resolved permission levels immediately at login (no reload needed).
    const up = { ...u, permissions_resolved };
    setStoredUser(up);
    setStoredCompany(c);
    setUser(up);
    setCompany(c);
    return res.data;
  }

  // can(section, level): true if the user's resolved level for `section` meets or
  // exceeds `level`. Null-safe (returns false if permissions_resolved is missing).
  // Phase 3a-0: available for UI gating; nothing is hidden yet.
  function can(section, level) {
    const lvl = user?.permissions_resolved?.[section];
    return (RANK[lvl] ?? 0) >= (RANK[level] ?? 0);
  }

  async function logout() {
    try {
      await api.post('/auth/logout');
    } catch {
      // best effort
    }
    clearToken();
    localStorage.removeItem('up_user');
    localStorage.removeItem('up_company');
    localStorage.removeItem('up_refresh_token');
    setUser(null);
    setCompany(null);
  }

  const isAuthenticated = !!user && !!getToken();

  return (
    <AuthContext.Provider value={{ user, company, loading, login, logout, isAuthenticated, can }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
