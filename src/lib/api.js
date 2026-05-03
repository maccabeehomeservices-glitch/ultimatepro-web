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

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Canonical job-status palette — must match skills/ui-design-system.md §1
// and android AppColors.jobStatus() in Theme.kt.
export const statusColor = (status) => ({
  unscheduled: '#6B7280',
  scheduled:   '#2563EB',
  en_route:    '#F97316',
  in_progress: '#0EA5E9',
  holding:     '#D97706',
  completed:   '#16A34A',
  cancelled:   '#DC2626',
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
  ? new Date(t).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  : '—';

export const formatMinutes = (mins) => {
  const h = Math.floor((mins || 0) / 60);
  const m = (mins || 0) % 60;
  return h > 0 ? `${h} hrs ${m} min` : `${m} min`;
};

// ─── AUTH ─────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email, password) =>
    api.post('/auth/login', { email, password }),
  register: (data) =>
    api.post('/auth/register', data),
  me: () =>
    api.get('/auth/me'),
  logout: () =>
    api.post('/auth/logout'),
  updateProfile: (data) =>
    api.put('/auth/me', data),
  changePassword: (current_password, new_password) =>
    api.put('/auth/change-password', { current_password, new_password }),
};

// ─── JOBS ─────────────────────────────────────────────────────────────────────
export const jobsApi = {
  list: (params) =>
    api.get('/jobs', { params }),

  today: () =>
    api.get('/jobs/today'),

  get: (id) =>
    api.get(`/jobs/${id}`),

  create: (data) =>
    api.post('/jobs', {
      customer_id: data.customer_id,
      title: data.title,
      description: data.description,
      type: data.type,
      priority: data.priority,
      assigned_to: data.assigned_to,
      assigned_roster_tech_id: data.assigned_roster_tech_id,
      scheduled_start: data.scheduled_start,
      scheduled_end: data.scheduled_end,
      address: data.address,
      city: data.city,
      state: data.state,
      zip: data.zip,
      notes: data.notes,
      internal_notes: data.internal_notes,
      source_type: data.source_type,
      job_source_id: data.job_source_id,
      ad_channel_id: data.ad_channel_id,
      ad_channel_custom: data.ad_channel_custom,
      line_items: data.line_items || [],
      linked_job_id: data.linked_job_id,
      notify_sms: data.notify_sms,
      notify_email: data.notify_email,
      notify_push: data.notify_push,
    }),

  update: (id, data) =>
    api.put(`/jobs/${id}`, {
      title: data.title,
      description: data.description,
      type: data.type,
      priority: data.priority,
      assigned_to: data.assigned_to,
      assigned_roster_tech_id: data.assigned_roster_tech_id,
      scheduled_start: data.scheduled_start,
      scheduled_end: data.scheduled_end,
      address: data.address,
      city: data.city,
      state: data.state,
      zip: data.zip,
      notes: data.notes,
      internal_notes: data.internal_notes,
      source_type: data.source_type,
      job_source_id: data.job_source_id,
      ad_channel_id: data.ad_channel_id,
      ad_channel_custom: data.ad_channel_custom,
      line_items: data.line_items,
      tech_permissions: data.tech_permissions,
      profit_override: data.profit_override,
      override_source_pct: data.override_source_pct,
      override_tech_pct: data.override_tech_pct,
    }),

  updateStatus: (id, status, notes) =>
    api.post(`/jobs/${id}/status`, { status, notes }),

  delete: (id) =>
    api.delete(`/jobs/${id}`),

  parseTicket: (text) =>
    api.post('/jobs/parse-ticket', { text }),

  dispatch: (id, tech_lat = 0, tech_lng = 0) =>
    api.post(`/jobs/${id}/dispatch`, { tech_lat, tech_lng }),

  sendToPartner: (id, partner_company_id, notes, tech_permissions) =>
    api.post(`/jobs/${id}/send-to-partner`, {
      partner_company_id,
      notes,
      tech_permissions: tech_permissions || {
        add_notes: true, collect_payments: true, take_photos: true,
        add_parts: false, edit_details: false, cancel_job: false,
        view_history: true,
      },
    }),

  confirmPartnerStatus: (id, action) =>
    api.post(`/jobs/${id}/confirm-partner-status`, { action }),

  updateReminderMethod: (id, reminder_method) =>
    api.patch(`/jobs/${id}/reminder-method`, { reminder_method }),

  complete: (id, data) =>
    api.post(`/jobs/${id}/complete`, data),

  getCompletion: (id) =>
    api.get(`/jobs/${id}/completion`),

  confirmCompletion: (id) =>
    api.post(`/jobs/${id}/completion/confirm`),

  captureSignature: (id, signature_data) =>
    api.post(`/jobs/${id}/signature`, { signature_data }),

  restore: (id) =>
    api.post(`/jobs/${id}/restore`),

  addPhoto: (id, photo_url) =>
    api.post(`/jobs/${id}/photos`, { photo_url }),

  arrived: (id) =>
    api.post(`/jobs/${id}/arrived`),

  getParts: (id) =>
    api.get(`/jobs/${id}/parts`),

  savePart: (id, data) =>
    api.post(`/jobs/${id}/parts`, data),

  updatePart: (id, partId, data) =>
    api.put(`/jobs/${id}/parts/${partId}`, data),

  deletePart: (id, partId) =>
    api.delete(`/jobs/${id}/parts/${partId}`),
};

// ─── CUSTOMERS ────────────────────────────────────────────────────────────────
export const customersApi = {
  list: (params) =>
    api.get('/customers', { params }),

  get: (id) =>
    api.get(`/customers/${id}`),

  create: (data) =>
    api.post('/customers', {
      first_name: data.first_name,
      last_name: data.last_name,
      email: data.email,
      phone: data.phone,
      phone2: data.phone2,
      address: data.address,
      city: data.city,
      state: data.state,
      zip: data.zip,
      type: data.type,
      notes: data.notes,
      tags: data.tags,
    }),

  update: (id, data) =>
    api.put(`/customers/${id}`, data),

  delete: (id) =>
    api.delete(`/customers/${id}`),

  getStats: (id) =>
    api.get(`/customers/${id}/stats`),

  getHistory: (id, exclude_job_id) =>
    api.get(`/customers/${id}/history`, { params: { exclude_job_id } }),

  getContacts: (id) =>
    api.get(`/customers/${id}/contacts`),

  addContact: (id, type, value, label) =>
    api.post(`/customers/${id}/contacts`, { type, value, label }),

  updateContact: (contactId, value, label) =>
    api.put(`/customers/contacts/${contactId}`, { value, label }),

  deleteContact: (contactId) =>
    api.delete(`/customers/contacts/${contactId}`),
};

// ─── ESTIMATES ────────────────────────────────────────────────────────────────
export const estimatesApi = {
  list: (params) =>
    api.get('/estimates', { params }),

  get: (id) =>
    api.get(`/estimates/${id}`),

  create: (data) =>
    api.post('/estimates', {
      customer_id: data.customer_id,
      job_id: data.job_id,
      title: data.title,
      notes: data.notes,
      terms: data.terms,
      valid_until: data.valid_until,
      line_items: data.line_items || [],
      discount_pct: data.discount_pct,
    }),

  update: (id, data) =>
    api.put(`/estimates/${id}`, {
      title: data.title,
      notes: data.notes,
      terms: data.terms,
      valid_until: data.valid_until,
      line_items: data.line_items,
      discount_pct: data.discount_pct,
      status: data.status,
    }),

  send: (id, options = {}) =>
    api.post(`/estimates/${id}/send`, {
      send_sms: options.send_sms ?? true,
      send_email: options.send_email ?? true,
      emails: options.emails || [],
      phones: options.phones || [],
    }),

  approve: (id, signature_url, signer_name) =>
    api.post(`/estimates/${id}/approve`, { signature_url, signer_name }),

  convertToInvoice: (id) =>
    api.post(`/estimates/${id}/convert-to-invoice`),

  updateDepositSettings: (id, deposit_required, deposit_amount, deposit_type) =>
    api.put(`/estimates/${id}/deposit-settings`, { deposit_required, deposit_amount, deposit_type }),

  collectDeposit: (id, amount_collected, payment_method) =>
    api.post(`/estimates/${id}/collect-deposit`, { amount_collected, payment_method }),

  saveTiers: (id, tiers) =>
    api.post(`/estimates/${id}/tiers`, { tiers }),

  getTiers: (id) =>
    api.get(`/estimates/${id}/tiers`),

  selectTier: (id, tier_id) =>
    api.post(`/estimates/${id}/select-tier`, { tier_id }),

  captureSignature: (id, signature_data, signer_name) =>
    api.post(`/estimates/${id}/sign`, { signature_data, signer_name }),

  addPhoto: (id, file) => {
    const form = new FormData();
    form.append('file', file);
    return api.post(`/estimates/${id}/add-photo`, form,
      { headers: { 'Content-Type': 'multipart/form-data' } });
  },

  delete: (id) =>
    api.delete(`/estimates/${id}`),
};

// ─── INVOICES ─────────────────────────────────────────────────────────────────
export const invoicesApi = {
  list: (params) =>
    api.get('/invoices', { params }),

  get: (id) =>
    api.get(`/invoices/${id}`),

  create: (data) =>
    api.post('/invoices', data),

  update: (id, data) =>
    api.put(`/invoices/${id}`, data),

  send: (id, options = {}) =>
    api.post(`/invoices/${id}/send`, {
      send_sms: options.send_sms ?? true,
      send_email: options.send_email ?? true,
      emails: options.emails || [],
      phones: options.phones || [],
    }),

  collectPayment: (id, method, amount, reference, notes) =>
    api.post(`/invoices/${id}/payment`, { method, amount, reference, notes }),

  sendReceipt: (id, options = {}) =>
    api.post(`/invoices/${id}/send-receipt`, {
      send_sms: options.send_sms ?? true,
      send_email: options.send_email ?? true,
      send_review_request: options.send_review_request ?? true,
      emails: options.emails || [],
      phones: options.phones || [],
    }),

  captureSignature: (id, signature_data) =>
    api.post(`/invoices/${id}/sign`, { signature_data }),

  void: (id) =>
    api.post(`/invoices/${id}/void`),

  stopFollowup: (id) =>
    api.patch(`/invoices/${id}/stop-followup`),

  resetFollowup: (id) =>
    api.patch(`/invoices/${id}/reset-followup`),

  getScanpayQr: (id) =>
    api.get(`/invoices/${id}/scanpay-qr`),
};

// ─── PAYMENTS ─────────────────────────────────────────────────────────────────
export const paymentsApi = {
  list: (params) =>
    api.get('/payments', { params }),

  create: (data) =>
    api.post('/payments', {
      customer_id: data.customer_id,
      invoice_id: data.invoice_id,
      amount: data.amount,
      method: data.method,
      notes: data.notes,
      check_number: data.check_number,
    }),

  summary: (from, to) =>
    api.get('/payments/summary', { params: { from, to } }),

  scanpayLink: (invoice_id, amount, customer_phone) =>
    api.post('/payments/scanpay-link', { invoice_id, amount, customer_phone }),

  scanpayCharge: (invoice_id, amount, customer_email) =>
    api.post('/payments/scanpay/charge', { invoice_id, amount, customer_email }),
};

// ─── PRICEBOOK ────────────────────────────────────────────────────────────────
export const pricebookApi = {
  getCategories: () =>
    api.get('/pricebook/categories'),

  createCategory: (name, type, sort_order) =>
    api.post('/pricebook/categories', { name, type, sort_order }),

  updateCategory: (id, data) =>
    api.put(`/pricebook/categories/${id}`, data),

  deleteCategory: (id) =>
    api.delete(`/pricebook/categories/${id}`),

  getItems: (params) =>
    api.get('/pricebook/items', { params }),

  createItem: (data) =>
    api.post('/pricebook/items', {
      category_id: data.category_id,
      sku: data.sku,
      name: data.name,
      description: data.description,
      unit_price: data.unit_price,
      cost_price: data.cost_price,
      item_type: data.item_type,
      taxable: data.taxable,
      sort_order: data.sort_order,
    }),

  updateItem: (id, data) =>
    api.put(`/pricebook/items/${id}`, data),

  deleteItem: (id) =>
    api.delete(`/pricebook/items/${id}`),
};

// ─── NETWORK ──────────────────────────────────────────────────────────────────
export const networkApi = {
  getMyId: () =>
    api.get('/network/my-id'),

  getConnections: () =>
    api.get('/network/connections'),

  getActiveSimple: () =>
    api.get('/network/connections/active-simple'),

  getConnection: (id) =>
    api.get(`/network/connections/${id}`),

  search: (q, type) =>
    api.get('/network/search', { params: { q, type } }),

  invite: (search_value, search_type) =>
    api.post('/network/connections/invite', { search_value, search_type }),

  respond: (id, action) =>
    api.put(`/network/connections/${id}/respond`, { action }),

  pause: (id) =>
    api.put(`/network/connections/${id}/pause`),

  proposeAgreement: (connection_id, sender_keeps_pct, receiver_keeps_pct, review_goes_to, notes) =>
    api.post('/network/agreements', { connection_id, sender_keeps_pct, receiver_keeps_pct, review_goes_to, notes }),

  getAgreements: (connection_id) =>
    api.get(`/network/agreements/${connection_id}`),

  respondToAgreement: (id, action, counter) =>
    api.put(`/network/agreements/${id}/respond`, { action, ...counter }),

  getConnectionReport: (id, date_from, date_to) =>
    api.get(`/network/connections/${id}/report`, { params: { date_from, date_to } }),

  sendConnectionReport: (id, date_from, date_to, recipient_email) =>
    api.post(`/network/connections/${id}/report/send`, { date_from, date_to, recipient_email }),
};

// ─── SETTINGS ─────────────────────────────────────────────────────────────────
export const settingsApi = {
  getReviewPlatforms: () =>
    api.get('/settings/review-platforms'),

  createReviewPlatform: (data) =>
    api.post('/settings/review-platforms', data),

  updateReviewPlatform: (id, data) =>
    api.put(`/settings/review-platforms/${id}`, data),

  deleteReviewPlatform: (id) =>
    api.delete(`/settings/review-platforms/${id}`),

  getBooking: () =>
    api.get('/settings/booking'),

  updateBooking: (data) =>
    api.put('/settings/booking', data),
};

// ─── SOURCES ──────────────────────────────────────────────────────────────────
export const sourcesApi = {
  getContacts: () =>
    api.get('/sources/contacts'),

  createContact: (data) =>
    api.post('/sources/contacts', data),

  updateContact: (id, data) =>
    api.put(`/sources/contacts/${id}`, data),

  deleteContact: (id) =>
    api.delete(`/sources/contacts/${id}`),

  getChannels: () =>
    api.get('/sources/channels'),

  createChannel: (name) =>
    api.post('/sources/channels', { name }),

  updateChannel: (id, data) =>
    api.put(`/sources/channels/${id}`, data),

  getReport: (date_from, date_to) =>
    api.get('/sources/report', { params: { date_from, date_to } }),

  exportReport: (from, to) =>
    api.get('/sources/report/export', { params: { date_from: from, date_to: to, format: 'csv' }, responseType: 'blob' }),

  getCommissionRules: () =>
    api.get('/sources/commission-rules'),

  saveCommissionRule: (data) =>
    api.post('/sources/commission-rules', data),

  deleteCommissionRule: (id) =>
    api.delete(`/sources/commission-rules/${id}`),
};

// ─── ROSTER TECHS ─────────────────────────────────────────────────────────────
export const rosterTechsApi = {
  list: () =>
    api.get('/roster-techs'),

  create: (data) =>
    api.post('/roster-techs', {
      name: data.name,
      phone: data.phone,
      email: data.email,
      commission_pct: data.commission_pct,
      cc_fee_pct: data.cc_fee_pct,
    }),

  update: (id, data) =>
    api.put(`/roster-techs/${id}`, data),

  delete: (id) =>
    api.delete(`/roster-techs/${id}`),

  notifyTech: (job_id, tech_id, method) =>
    api.post('/roster-techs/notify-tech', { job_id, tech_id, notify_method: method }),
};

// ─── MEMBERSHIPS ──────────────────────────────────────────────────────────────
export const membershipsApi = {
  getPlans: () =>
    api.get('/memberships/plans'),

  createPlan: (data) =>
    api.post('/memberships/plans', {
      name: data.name,
      description: data.description,
      frequency: data.frequency,
      price: data.price,
    }),

  updatePlan: (id, data) =>
    api.put(`/memberships/plans/${id}`, data),

  deletePlan: (id) =>
    api.delete(`/memberships/plans/${id}`),

  getCustomerMemberships: (customerId) =>
    api.get(`/memberships/customer/${customerId}`),

  assignMembership: (customerId, data) =>
    api.post(`/memberships/customer/${customerId}`, {
      plan_id: data.plan_id,
      start_date: data.start_date,
      end_date: data.end_date,
      renewal_date: data.renewal_date,
      notes: data.notes,
    }),

  updateMembership: (id, data) =>
    api.put(`/memberships/${id}`, {
      status: data.status,
      next_job_date: data.next_job_date,
      notes: data.notes,
    }),

  deleteMembership: (id) =>
    api.delete(`/memberships/${id}`),

  createNextJob: (id, description, tech_id) =>
    api.post(`/memberships/${id}/create-next-job`, { description, tech_id }),

  getDueSoon: () =>
    api.get('/memberships/due-soon'),
};

// ─── INVENTORY ────────────────────────────────────────────────────────────────
export const inventoryApi = {
  getSettings: () =>
    api.get('/inventory/settings'),

  updateSettings: (enabled) =>
    api.put('/inventory/settings', { enabled }),

  getWarehouse: () =>
    api.get('/inventory/warehouse'),

  addWarehouseItem: (pricebook_item_id, qty_on_hand, min_qty) =>
    api.post('/inventory/warehouse', { pricebook_item_id, qty_on_hand, min_qty }),

  updateWarehouseItem: (itemId, qty_on_hand, min_qty) =>
    api.put(`/inventory/warehouse/${itemId}`, { qty_on_hand, min_qty }),

  getTrucks: () =>
    api.get('/inventory/trucks'),

  createTruck: (data) =>
    api.post('/inventory/trucks', data),

  getTruckStock: (truckId) =>
    api.get(`/inventory/trucks/${truckId}/stock`),

  addTruckStockItem: (truckId, data) =>
    api.post(`/inventory/trucks/${truckId}/stock`, data),

  updateTruckStockItem: (truckId, itemId, qty_on_hand, min_qty) =>
    api.put(`/inventory/trucks/${truckId}/stock/${itemId}`, { qty_on_hand, min_qty }),

  deleteTruckStockItem: (truckId, itemId) =>
    api.delete(`/inventory/trucks/${truckId}/stock/${itemId}`),

  sendItemsToTruck: (truckId, items) =>
    api.post(`/inventory/trucks/${truckId}/send-items`, { items }),

  createRestockRequest: (truck_id, items, notes) =>
    api.post('/inventory/restock-requests', { truck_id, items, notes }),

  getRestockRequests: (status) =>
    api.get('/inventory/restock-requests', { params: { status } }),

  getTechTruck: (userId) =>
    api.get(`/inventory/tech-truck/${userId}`),
};

// ─── REPORTS ──────────────────────────────────────────────────────────────────
export const reportsApi = {
  getDashboard: (from, to) =>
    api.get('/reports/dashboard', { params: { from, to } }),

  getRevenue: (from, to, group_by = 'week') =>
    api.get('/reports/revenue', { params: { from, to, group_by } }),

  getJobs: (from, to, group_by) =>
    api.get('/reports/jobs', { params: { from, to, group_by } }),

  getSourceReport: (date_from, date_to) =>
    api.get('/sources/report', { params: { date_from, date_to } }),

  getConnectionReport: (connectionId, date_from, date_to) =>
    api.get(`/network/connections/${connectionId}/report`, { params: { date_from, date_to } }),

  getEarnings: (from, to, user_id) =>
    api.get('/reports/earnings', { params: { from, to, user_id } }),

  exportRevenue: (from, to, group_by) =>
    api.get('/reports/revenue/export', { params: { from, to, group_by, format: 'csv' }, responseType: 'blob' }),

  exportJobs: (from, to, group_by) =>
    api.get('/reports/jobs/export', { params: { from, to, group_by, format: 'csv' }, responseType: 'blob' }),

  exportEarnings: (from, to, user_id) =>
    api.get('/reports/earnings/export', { params: { from, to, user_id, format: 'csv' }, responseType: 'blob' }),
};

// ─── GPS ──────────────────────────────────────────────────────────────────────
export const gpsApi = {
  getLive: () =>
    api.get('/gps/live'),

  ping: (lat, lng) =>
    api.post('/gps/ping', { lat, lng }),
};

// ─── SMS ──────────────────────────────────────────────────────────────────────
export const smsApi = {
  getConversations: () =>
    api.get('/sms/conversations'),

  getMessages: (conversationId) =>
    api.get(`/sms/conversations/${conversationId}/messages`),

  sendMessage: (conversationId, message) =>
    api.post(`/sms/conversations/${conversationId}/send`, { message }),

  getCustomerMessages: (customerId) =>
    api.get(`/sms/customer/${customerId}/messages`),

  getJobMessages: (jobId) =>
    api.get(`/sms/job/${jobId}/messages`),
};

// ─── USERS ────────────────────────────────────────────────────────────────────
export const usersApi = {
  list: () =>
    api.get('/users'),

  getTechnicians: () =>
    api.get('/users/technicians'),

  get: (id) =>
    api.get(`/users/${id}`),

  create: (data) =>
    api.post('/users', {
      first_name: data.first_name,
      last_name: data.last_name,
      email: data.email,
      password: data.password,
      role: data.role,
      phone: data.phone,
    }),

  update: (id, data) =>
    api.put(`/users/${id}`, {
      first_name: data.first_name,
      last_name: data.last_name,
      email: data.email,
      role: data.role,
      phone: data.phone,
      ...(data.password ? { password: data.password } : {}),
    }),

  delete: (id) =>
    api.delete(`/users/${id}`),

  reactivate: (id) =>
    api.put(`/users/${id}/reactivate`),
};

// ─── TIMESHEETS ───────────────────────────────────────────────────────────────
export const timesheetsApi = {
  clockIn: () =>
    api.post('/timesheets/clock-in'),

  clockOut: () =>
    api.post('/timesheets/clock-out'),

  getStatus: () =>
    api.get('/timesheets/status'),

  getReport: (start_date, end_date, user_id) =>
    api.get('/timesheets/report', { params: { start_date, end_date, user_id } }),

  exportReport: (start_date, end_date, user_id) =>
    api.get('/timesheets/report', { params: { start_date, end_date, user_id, format: 'csv' }, responseType: 'blob' }),
};

// ─── UPLOADS ──────────────────────────────────────────────────────────────────
export const uploadsApi = {
  upload: (file, entity_type, entity_id, purpose) => {
    const form = new FormData();
    form.append('file', file);
    form.append('entity_type', entity_type);
    form.append('entity_id', entity_id);
    form.append('purpose', purpose);
    return api.post('/uploads', form, { headers: { 'Content-Type': 'multipart/form-data' } });
  },

  getUploads: (entity_type, entity_id, purpose) =>
    api.get('/uploads', { params: { entity_type, entity_id, purpose } }),
};

// ─── COMPANY ─────────────────────────────────────────────────────────────────
export const companyApi = {
  get: () =>
    api.get('/company'),
  update: (data) =>
    api.put('/company', data),
  getCustomFields: () =>
    api.get('/company/custom-fields'),
  createCustomField: (data) =>
    api.post('/company/custom-fields', data),
  updateCustomField: (id, data) =>
    api.put(`/company/custom-fields/${id}`, data),
  deleteCustomField: (id) =>
    api.delete(`/company/custom-fields/${id}`),
  getJobyRules: () =>
    api.get('/company/joby-rules'),
  updateJobyRule: (id, data) =>
    api.put(`/company/joby-rules/${id}`, data),
  uploadLogo: (formData) =>
    api.post('/company/logo', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
};

// ─── NOTIFICATIONS ───────────────────────────────────────────────────────────
export const notificationsApi = {
  list: (unread_only) =>
    api.get('/notifications', { params: unread_only ? { unread_only: true } : {} }),

  getUnreadCount: () =>
    api.get('/notifications/unread-count'),

  markRead: (id) =>
    api.put(`/notifications/${id}/read`),

  markAllRead: () =>
    api.put('/notifications/read-all'),

  delete: (id) =>
    api.delete(`/notifications/${id}`),
};

// ─── LEADS ───────────────────────────────────────────────────────────────────
export const leadsApi = {
  list: (params) =>
    api.get('/leads', { params }),
  create: (data) =>
    api.post('/leads', data),
  get: (id) =>
    api.get(`/leads/${id}`),
  update: (id, data) =>
    api.put(`/leads/${id}`, data),
  delete: (id) =>
    api.delete(`/leads/${id}`),
};

// ─── SCHEDULES ───────────────────────────────────────────────────────────────
export const schedulesApi = {
  list: (params) =>
    api.get('/schedules', { params }),
  create: (data) =>
    api.post('/schedules', data),
  update: (id, data) =>
    api.put(`/schedules/${id}`, data),
  delete: (id) =>
    api.delete(`/schedules/${id}`),
};

// ─── QUICKBOOKS ───────────────────────────────────────────────────────────────
export const quickbooksApi = {
  getStatus: () =>
    api.get('/integrations/quickbooks/status'),

  getConnectUrl: () =>
    api.get('/integrations/quickbooks/connect'),

  syncCustomers: () =>
    api.post('/integrations/quickbooks/sync/customers'),

  syncInvoices: () =>
    api.post('/integrations/quickbooks/sync/invoices'),

  syncPayments: () =>
    api.post('/integrations/quickbooks/sync/payments'),

  syncAll: () =>
    api.post('/integrations/quickbooks/sync/all'),

  updateSettings: (data) =>
    api.put('/integrations/quickbooks/settings', data),

  disconnect: () =>
    api.delete('/integrations/quickbooks/disconnect'),
};

// ─── IMPORT ───────────────────────────────────────────────────────────────────
export const importApi = {
  preview: (file, type) => {
    const form = new FormData();
    form.append('file', file);
    form.append('type', type);
    return api.post('/import/preview', form, { headers: { 'Content-Type': 'multipart/form-data' } });
  },

  execute: (data) =>
    api.post('/import/execute', {
      type: data.type,
      fileData: data.fileData,
      fileName: data.fileName,
      mappings: data.mappings,
      duplicateAction: data.duplicateAction,
      categoryAssignments: data.categoryAssignments || {},
      categoryGuesses: data.categoryGuesses || {},
    }),
};
