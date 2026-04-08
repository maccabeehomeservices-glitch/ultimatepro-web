import axios from 'axios';

const api = axios.create({
  baseURL: (import.meta.env.VITE_API_URL || 'http://localhost:3000') + '/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('up_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('up_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;

// Status color mapping (matches Android exactly)
export const statusColor = (status) => ({
  unscheduled: '#6B7280',
  scheduled:   '#1A73E8',
  en_route:    '#4F46E5',
  in_progress: '#F59E0B',
  completed:   '#10B981',
  cancelled:   '#EF4444',
  holding:     '#D97706',
  deleted:     '#9CA3AF',
}[status] || '#6B7280');

export const statusLabel = (status) =>
  (status || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

export const formatMoney = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);

export const formatDate = (d) => d
  ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  : '—';

export const formatTime = (t) => t
  ? new Date('1970-01-01T' + t).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  : '—';

export const formatMinutes = (mins) => {
  const h = Math.floor((mins || 0) / 60);
  const m = (mins || 0) % 60;
  return h > 0 ? `${h} hrs ${m} min` : `${m} min`;
};
