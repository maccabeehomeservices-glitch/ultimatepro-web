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

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getStoredUser());
  const [company, setCompany] = useState(() => getStoredCompany());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (token) {
      api.get('/auth/me')
        .then((res) => {
          const { user: u, company: c } = res.data;
          setUser(u);
          setCompany(c);
          setStoredUser(u);
          setStoredCompany(c);
        })
        .catch(() => {
          clearToken();
          localStorage.removeItem('up_user');
          localStorage.removeItem('up_company');
          setUser(null);
          setCompany(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  async function login(email, password) {
    const res = await api.post('/auth/login', { email, password });
    const { token, refresh_token, user: u, company: c } = res.data;
    setToken(token);
    if (refresh_token) localStorage.setItem('up_refresh_token', refresh_token);
    setStoredUser(u);
    setStoredCompany(c);
    setUser(u);
    setCompany(c);
    return res.data;
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
    <AuthContext.Provider value={{ user, company, loading, login, logout, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
