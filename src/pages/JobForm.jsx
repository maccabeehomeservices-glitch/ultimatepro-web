import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Search, ClipboardList, X } from 'lucide-react';
import api from '../lib/api';
import { useGet } from '../hooks/useApi';
import { Button, Input, Card, Modal, LoadingSpinner } from '../components/ui';
import { useSnackbar } from '../components/ui/Snackbar';

const JOB_TYPES = ['Service', 'Installation', 'Maintenance', 'Inspection', 'Repair', 'New Installation', 'Spring Replacement', 'Tune-Up', 'Other'];
const PRIORITIES = [
  { value: 'low',    label: 'Low',    sel: 'bg-gray-500 text-white border-gray-500',   unsel: 'text-gray-600 border-gray-300' },
  { value: 'medium', label: 'Medium', sel: 'bg-[#1A73E8] text-white border-[#1A73E8]', unsel: 'text-[#1A73E8] border-blue-300' },
  { value: 'high',   label: 'High',   sel: 'bg-orange-500 text-white border-orange-500', unsel: 'text-orange-500 border-orange-300' },
  { value: 'urgent', label: 'Urgent', sel: 'bg-red-500 text-white border-red-500',     unsel: 'text-red-500 border-red-300' },
];
const SOURCE_TYPES = [
  { value: 'network', label: 'Network' },
  { value: 'external_contact', label: 'Source Contact' },
  { value: 'own_company', label: 'Own Company' },
];
const STATUS_OPTIONS = [
  { value: 'unscheduled', label: 'Unscheduled' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'en_route', label: 'En Route' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'holding', label: 'Holding' },
  { value: 'cancelled', label: 'Cancelled' },
];

function SectionLabel({ children }) {
  return <p className="text-xs font-semibold text-[#1A73E8] uppercase tracking-wider mb-2">{children}</p>;
}

function formatDisplayDate(iso) {
  if (!iso) return '';
  try {
    const [y, m, d] = iso.split('-');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[parseInt(m,10)-1]} ${parseInt(d,10)}, ${y}`;
  } catch { return iso; }
}

function formatDisplayTime(hhmm) {
  if (!hhmm) return '';
  try {
    const [h, mn] = hhmm.split(':').map(Number);
    const ap = h < 12 ? 'AM' : 'PM';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${h12}:${String(mn).padStart(2,'0')} ${ap}`;
  } catch { return hhmm; }
}

export default function JobForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { showSnack } = useSnackbar();
  const isEdit = Boolean(id);

  const [form, setForm] = useState({
    title: '', notes: '',
    customer_id: '', customer_name: '',
    address: '', city: '', state: '', zip: '',
    scheduled_date: '', scheduled_time: '',
    assigned_tech_id: '', assigned_roster_tech_id: '',
    status: 'unscheduled',
    job_type: 'Service', priority: 'medium',
    source_type: '', job_source_id: '', source_review_link: '',
  });
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState([]);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [extraPhones, setExtraPhones] = useState([]);
  const [extraEmails, setExtraEmails] = useState([]);
  const [lineItems, setLineItems] = useState([]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [pasteModal, setPasteModal] = useState(false);
  const [ticketText, setTicketText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [lineItemModal, setLineItemModal] = useState(null);
  const [dupCustomer, setDupCustomer] = useState(null);
  const searchTO = useRef(null);

  const { data: jobData, loading: jobLoading } = useGet(isEdit ? `/jobs/${id}` : null, [id]);
  const { data: techsData } = useGet('/users/technicians');
  const { data: rosterData } = useGet('/roster-techs');
  const { data: sourcesData } = useGet(form.source_type === 'external_contact' ? '/sources' : null, [form.source_type]);

  // Pre-fill from location state (parsed ticket or pre-selected customer)
  useEffect(() => {
    const parsed = location.state?.parsedData;
    if (parsed && !isEdit) {
      setForm(prev => ({
        ...prev,
        title: parsed.title || parsed.job_title || prev.title,
        notes: parsed.description || parsed.notes || prev.notes,
        address: parsed.address || parsed.service_address || prev.address,
        scheduled_date: parsed.scheduled_date ? parsed.scheduled_date.slice(0,10) : prev.scheduled_date,
        scheduled_time: parsed.scheduled_time || prev.scheduled_time,
      }));
      if (parsed.customer_name) {
        setCustomerSearch(parsed.customer_name);
        setForm(prev => ({ ...prev, customer_name: parsed.customer_name }));
      }
    }
    const preCustomer = location.state?.customer;
    if (preCustomer && !isEdit) {
      setForm(prev => ({ ...prev, customer_id: preCustomer.id || '', customer_name: preCustomer.name || '' }));
      setCustomerSearch(preCustomer.name || '');
    }
  }, []); // eslint-disable-line

  // Load existing job for edit
  useEffect(() => {
    if (isEdit && jobData) {
      const j = jobData.job || jobData;
      const sDate = j.scheduled_date ? j.scheduled_date.slice(0,10)
        : j.scheduled_start ? j.scheduled_start.slice(0,10) : '';
      const sTime = j.scheduled_time || (j.scheduled_start ? j.scheduled_start.slice(11,16) : '');
      setForm({
        title: j.title || j.job_title || '',
        notes: j.notes || j.description || '',
        customer_id: j.customer_id || '',
        customer_name: j.customer_name || j.customer?.name || '',
        address: j.address || j.service_address || '',
        city: j.city || '', state: j.state || '', zip: j.zip || '',
        scheduled_date: sDate, scheduled_time: sTime,
        assigned_tech_id: j.assigned_tech_id || j.assigned_to || '',
        assigned_roster_tech_id: j.assigned_roster_tech_id || '',
        status: j.status || 'unscheduled',
        job_type: j.job_type || j.type || 'Service',
        priority: j.priority || 'medium',
        source_type: j.source_type || '',
        job_source_id: j.job_source_id || '',
        source_review_link: j.source_review_link || '',
      });
      setCustomerSearch(j.customer_name || j.customer?.name || '');
      if (j.line_items?.length) {
        setLineItems(j.line_items.map(li => ({
          name: li.name, qty: li.quantity || li.qty || 1,
          unit_price: li.unit_price || 0,
        })));
      }
    }
  }, [isEdit, jobData]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  }

  function handleCustomerInput(e) {
    const val = e.target.value;
    setCustomerSearch(val);
    setForm(prev => ({ ...prev, customer_name: val, customer_id: '' }));
    setDupCustomer(null);
    clearTimeout(searchTO.current);
    if (val.length > 1) {
      searchTO.current = setTimeout(async () => {
        try {
          const res = await api.get(`/customers?search=${encodeURIComponent(val)}&limit=6`);
          setCustomerResults(res.data?.customers || res.data || []);
          setShowCustomerDropdown(true);
        } catch { setCustomerResults([]); }
      }, 300);
    } else {
      setCustomerResults([]);
      setShowCustomerDropdown(false);
    }
  }

  function selectCustomer(customer) {
    const name = `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || customer.name || '';
    setForm(prev => ({
      ...prev,
      customer_id: customer.id || customer._id,
      customer_name: name,
      address: prev.address || customer.address || '',
      city: prev.city || customer.city || '',
      state: prev.state || customer.state || '',
      zip: prev.zip || customer.zip || '',
    }));
    setCustomerSearch(name);
    setShowCustomerDropdown(false);
    setDupCustomer(null);
  }

  async function handleParseTicket() {
    if (!ticketText.trim()) return;
    setParsing(true);
    try {
      const res = await api.post('/jobs/parse-ticket', { text: ticketText });
      const parsed = res.data?.job || res.data;
      setPasteModal(false);
      setTicketText('');
      setForm(prev => ({
        ...prev,
        title: parsed.title || parsed.job_title || prev.title,
        notes: parsed.description || parsed.notes || prev.notes,
        address: parsed.address || parsed.service_address || prev.address,
        scheduled_date: parsed.scheduled_date ? parsed.scheduled_date.slice(0,10) : prev.scheduled_date,
        scheduled_time: parsed.scheduled_time || prev.scheduled_time,
      }));
      if (parsed.customer_name) {
        setCustomerSearch(parsed.customer_name);
        setForm(prev => ({ ...prev, customer_name: parsed.customer_name }));
      }
      showSnack('Ticket parsed!', 'success');
    } catch {
      showSnack('Failed to parse ticket', 'error');
    } finally {
      setParsing(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = {};
    if (!form.title.trim()) errs.title = 'Title is required';
    if (!form.customer_id && !form.customer_name.trim()) errs.customer_name = 'Customer is required';
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSaving(true);
    try {
      const scheduledStart = form.scheduled_date
        ? `${form.scheduled_date}T${form.scheduled_time || '00:00'}:00`
        : undefined;
      const payload = {
        title: form.title,
        notes: form.notes, description: form.notes,
        customer_id: form.customer_id || undefined,
        customer_name: !form.customer_id ? form.customer_name : undefined,
        address: form.address, city: form.city, state: form.state, zip: form.zip,
        scheduled_date: form.scheduled_date || undefined,
        scheduled_time: form.scheduled_time || undefined,
        scheduled_start: scheduledStart,
        assigned_to: form.assigned_tech_id || undefined,
        assigned_roster_tech_id: form.assigned_roster_tech_id || undefined,
        status: form.status,
        job_type: form.job_type, type: form.job_type,
        priority: form.priority,
        source_type: form.source_type || undefined,
        job_source_id: form.job_source_id || undefined,
        source_review_link: form.source_review_link || undefined,
        line_items: lineItems.map(li => ({
          name: li.name, quantity: li.qty, unit_price: li.unit_price,
          total: li.qty * Number(li.unit_price),
        })),
      };
      if (isEdit) {
        await api.put(`/jobs/${id}`, payload);
        showSnack('Job updated', 'success');
        navigate(`/jobs/${id}`);
      } else {
        const res = await api.post('/jobs', payload);
        showSnack('Job created', 'success');
        navigate(`/jobs/${res.data?.job?.id || res.data?.id}`);
      }
    } catch (err) {
      showSnack(err?.response?.data?.message || 'Failed to save job', 'error');
    } finally {
      setSaving(false);
    }
  }

  const techs = techsData?.technicians || techsData || [];
  const rosterTechs = rosterData?.technicians || rosterData || [];
  const sources = sourcesData?.sources || sourcesData || [];

  if (isEdit && jobLoading) return <LoadingSpinner fullPage />;

  const schedulePreview = form.scheduled_date
    ? `${formatDisplayDate(form.scheduled_date)}${form.scheduled_time ? ' at ' + formatDisplayTime(form.scheduled_time) : ''}`
    : '';

  return (
    <div className="p-4 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-600">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-gray-900 flex-1">{isEdit ? 'Edit Job' : 'New Job'}</h1>
        <button
          type="button"
          onClick={() => setPasteModal(true)}
          className="flex items-center gap-1.5 text-sm text-[#1A73E8] font-medium px-3 py-2 rounded-xl border border-[#1A73E8] min-h-[44px] hover:bg-blue-50 transition-colors"
        >
          <ClipboardList size={16} />
          <span className="hidden sm:inline">Paste Ticket</span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* CUSTOMER */}
        <Card>
          <SectionLabel>Customer</SectionLabel>
          <div className="relative">
            <input
              value={form.customer_id ? form.customer_name : customerSearch}
              onChange={handleCustomerInput}
              placeholder="Search customer..."
              className={`w-full rounded-xl border px-3 py-2.5 min-h-[44px] text-[16px] focus:outline-none focus:ring-2 focus:ring-[#1A73E8] ${errors.customer_name ? 'border-red-400' : 'border-gray-300'}`}
            />
            {errors.customer_name && <p className="text-red-500 text-xs mt-1">{errors.customer_name}</p>}
            {showCustomerDropdown && customerResults.length > 0 && (
              <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                {customerResults.map(c => (
                  <button key={c.id || c._id} type="button" onClick={() => selectCustomer(c)}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 text-sm border-b last:border-0 flex items-center justify-between">
                    <span className="font-medium">{`${c.first_name || ''} ${c.last_name || ''}`.trim() || c.name}</span>
                    {c.phone && <span className="text-gray-400 text-xs">{c.phone}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Duplicate warning */}
          {dupCustomer && (
            <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm">
              <p className="font-medium text-amber-800 mb-2">Returning customer: {dupCustomer.name}</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => { selectCustomer(dupCustomer); setDupCustomer(null); }}
                  className="text-xs px-3 py-1.5 bg-[#1A73E8] text-white rounded-lg min-h-[32px]">Use Existing</button>
                <button type="button" onClick={() => setDupCustomer(null)}
                  className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg min-h-[32px]">Create New</button>
                <button type="button" onClick={() => navigate(`/customers/${dupCustomer.id || dupCustomer._id}`)}
                  className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg min-h-[32px]">View</button>
              </div>
            </div>
          )}

          {/* Extra phones */}
          {extraPhones.map((ph, idx) => (
            <div key={idx} className="flex gap-2 mt-2">
              <input type="tel" value={ph} onChange={e => { const a = [...extraPhones]; a[idx] = e.target.value; setExtraPhones(a); }}
                placeholder={`Phone ${idx + 2}`} className="flex-1 rounded-xl border border-gray-300 px-3 py-2.5 min-h-[44px] text-[16px] focus:outline-none focus:ring-2 focus:ring-[#1A73E8]" />
              <button type="button" onClick={() => setExtraPhones(prev => prev.filter((_, i) => i !== idx))}
                className="p-2 text-gray-400 hover:text-red-500 min-w-[44px] flex items-center justify-center"><X size={16} /></button>
            </div>
          ))}
          <button type="button" onClick={() => setExtraPhones(prev => [...prev, ''])}
            className="mt-2 text-sm text-[#1A73E8] font-medium min-h-[36px] flex items-center gap-1">
            <Plus size={14} /> Add phone
          </button>

          {/* Extra emails */}
          {extraEmails.map((em, idx) => (
            <div key={idx} className="flex gap-2 mt-2">
              <input type="email" value={em} onChange={e => { const a = [...extraEmails]; a[idx] = e.target.value; setExtraEmails(a); }}
                placeholder={`Email ${idx + 2}`} className="flex-1 rounded-xl border border-gray-300 px-3 py-2.5 min-h-[44px] text-[16px] focus:outline-none focus:ring-2 focus:ring-[#1A73E8]" />
              <button type="button" onClick={() => setExtraEmails(prev => prev.filter((_, i) => i !== idx))}
                className="p-2 text-gray-400 hover:text-red-500 min-w-[44px] flex items-center justify-center"><X size={16} /></button>
            </div>
          ))}
          <button type="button" onClick={() => setExtraEmails(prev => [...prev, ''])}
            className="mt-2 text-sm text-[#1A73E8] font-medium min-h-[36px] flex items-center gap-1">
            <Plus size={14} /> Add email
          </button>
        </Card>

        {/* JOB INFO */}
        <Card>
          <SectionLabel>Job Info</SectionLabel>
          <Input label="Job Title" name="title" value={form.title} onChange={handleChange}
            placeholder="e.g. AC Repair - Main Unit" error={errors.title} />
          <div className="mt-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes for technician</label>
            <textarea name="notes" value={form.notes} onChange={handleChange} rows={3}
              placeholder="Job details..."
              className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-gray-900 text-[16px] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1A73E8] resize-none" />
          </div>
        </Card>

        {/* TYPE */}
        <Card>
          <SectionLabel>Type</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {JOB_TYPES.map(t => (
              <button key={t} type="button" onClick={() => setForm(prev => ({ ...prev, job_type: t }))}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors min-h-[36px] ${
                  form.job_type === t ? 'bg-[#1A73E8] text-white border-[#1A73E8]' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}>{t}</button>
            ))}
          </div>
        </Card>

        {/* PRIORITY */}
        <Card>
          <SectionLabel>Priority</SectionLabel>
          <div className="flex gap-2">
            {PRIORITIES.map(p => (
              <button key={p.value} type="button" onClick={() => setForm(prev => ({ ...prev, priority: p.value }))}
                className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors min-h-[44px] ${
                  form.priority === p.value ? p.sel : `bg-white ${p.unsel} hover:bg-gray-50`
                }`}>{p.label}</button>
            ))}
          </div>
        </Card>

        {/* LOCATION */}
        <Card>
          <SectionLabel>Location</SectionLabel>
          <Input label="Street Address" name="address" value={form.address} onChange={handleChange} placeholder="123 Main St" />
          <div className="grid grid-cols-3 gap-2 mt-3">
            <div className="col-span-1">
              <Input label="City" name="city" value={form.city} onChange={handleChange} placeholder="Tampa" />
            </div>
            <Input label="State" name="state" value={form.state} onChange={handleChange} placeholder="FL" />
            <Input label="ZIP" name="zip" value={form.zip} onChange={handleChange} placeholder="33601" />
          </div>
        </Card>

        {/* SCHEDULE */}
        <Card>
          <SectionLabel>Schedule</SectionLabel>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <div className="relative">
                <input type="date" name="scheduled_date" value={form.scheduled_date} onChange={handleChange}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2.5 min-h-[44px] text-[16px] focus:outline-none focus:ring-2 focus:ring-[#1A73E8]" />
                {form.scheduled_date && (
                  <button type="button" onClick={() => setForm(p => ({ ...p, scheduled_date: '' }))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 w-6 h-6 flex items-center justify-center">
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
              <div className="relative">
                <input type="time" name="scheduled_time" value={form.scheduled_time} onChange={handleChange}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2.5 min-h-[44px] text-[16px] focus:outline-none focus:ring-2 focus:ring-[#1A73E8]" />
                {form.scheduled_time && (
                  <button type="button" onClick={() => setForm(p => ({ ...p, scheduled_time: '' }))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 w-6 h-6 flex items-center justify-center">
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>
          {schedulePreview && (
            <p className="mt-2 text-sm text-[#1A73E8] font-medium">{schedulePreview}</p>
          )}
        </Card>

        {/* ASSIGNMENT */}
        <Card>
          <SectionLabel>Assignment</SectionLabel>
          <div className="space-y-3">
            {rosterTechs.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Technicians</p>
                <select value={form.assigned_roster_tech_id}
                  onChange={e => setForm(p => ({ ...p, assigned_roster_tech_id: e.target.value, assigned_tech_id: '' }))}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2.5 min-h-[44px] text-[16px] focus:outline-none focus:ring-2 focus:ring-[#1A73E8] bg-white">
                  <option value="">— Select Technician —</option>
                  {rosterTechs.map(t => (
                    <option key={t.id || t._id} value={t.id || t._id}>{t.name || t.first_name}</option>
                  ))}
                </select>
              </div>
            )}
            {techs.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase mb-1">App Users</p>
                <select value={form.assigned_tech_id}
                  onChange={e => setForm(p => ({ ...p, assigned_tech_id: e.target.value, assigned_roster_tech_id: '' }))}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2.5 min-h-[44px] text-[16px] focus:outline-none focus:ring-2 focus:ring-[#1A73E8] bg-white">
                  <option value="">— Select App User —</option>
                  {techs.map(t => (
                    <option key={t.id || t._id} value={t.id || t._id}>{`${t.first_name || ''} ${t.last_name || ''}`.trim()}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </Card>

        {/* CHARGES & PARTS */}
        <Card>
          <SectionLabel>Charges & Parts</SectionLabel>
          <div className="flex gap-2 mb-3">
            <button type="button" onClick={() => setLineItemModal('charge')}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 min-h-[44px]">
              <Plus size={16} /> Add Charge
            </button>
            <button type="button" onClick={() => setLineItemModal('part')}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 min-h-[44px]">
              <Plus size={16} /> Add Part
            </button>
          </div>
          {lineItems.length > 0 && (
            <div className="space-y-2">
              {lineItems.map((li, idx) => (
                <div key={idx} className="flex items-center gap-2 py-2 border-b border-gray-50 last:border-0">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{li.name}</p>
                    <p className="text-xs text-gray-400">{li.qty} × ${Number(li.unit_price).toFixed(2)}</p>
                  </div>
                  <p className="text-sm font-semibold text-gray-900">${(li.qty * Number(li.unit_price)).toFixed(2)}</p>
                  <button type="button" onClick={() => setLineItems(prev => prev.filter((_, i) => i !== idx))}
                    className="text-red-400 hover:text-red-600 p-1 min-w-[32px] min-h-[32px] flex items-center justify-center">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <div className="flex justify-between pt-1">
                <span className="text-sm font-semibold text-gray-700">Subtotal</span>
                <span className="text-sm font-bold text-[#1A73E8]">
                  ${lineItems.reduce((s, li) => s + li.qty * Number(li.unit_price), 0).toFixed(2)}
                </span>
              </div>
            </div>
          )}
        </Card>

        {/* SOURCE */}
        <Card>
          <SectionLabel>Source</SectionLabel>
          <p className="text-xs text-gray-400 mb-2">How did this job come in?</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {SOURCE_TYPES.map(s => (
              <button key={s.value} type="button"
                onClick={() => setForm(prev => ({ ...prev, source_type: prev.source_type === s.value ? '' : s.value, job_source_id: '' }))}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors min-h-[36px] ${
                  form.source_type === s.value ? 'bg-[#1A73E8] text-white border-[#1A73E8]' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}>{s.label}</button>
            ))}
          </div>
          {form.source_type === 'external_contact' && sources.length > 0 && (
            <select value={form.job_source_id}
              onChange={e => setForm(p => ({ ...p, job_source_id: e.target.value }))}
              className="w-full rounded-xl border border-gray-300 px-3 py-2.5 min-h-[44px] text-[16px] focus:outline-none focus:ring-2 focus:ring-[#1A73E8] bg-white mb-3">
              <option value="">— Select Source —</option>
              {sources.map(s => <option key={s.id || s._id} value={s.id || s._id}>{s.name}</option>)}
            </select>
          )}
          <Input label="Review / Source Link (optional)" name="source_review_link"
            value={form.source_review_link} onChange={handleChange} placeholder="https://..." />
        </Card>

        {/* STATUS (edit mode only) */}
        {isEdit && (
          <Card>
            <SectionLabel>Status</SectionLabel>
            <select name="status" value={form.status} onChange={handleChange}
              className="w-full rounded-xl border border-gray-300 px-3 py-2.5 min-h-[44px] text-[16px] focus:outline-none focus:ring-2 focus:ring-[#1A73E8] bg-white">
              {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </Card>
        )}

        <div className="flex gap-3 pb-4">
          <Button type="button" variant="outlined" onClick={() => navigate(-1)} className="flex-1">Cancel</Button>
          <Button type="submit" loading={saving} disabled={saving} className="flex-1">
            {isEdit ? 'Save Changes' : 'Create Job'}
          </Button>
        </div>
      </form>

      {/* Paste Ticket Modal */}
      <Modal
        isOpen={pasteModal}
        onClose={() => { setPasteModal(false); setTicketText(''); }}
        title="Paste Job Ticket"
        footer={
          <>
            <Button variant="outlined" onClick={() => { setPasteModal(false); setTicketText(''); }}>Cancel</Button>
            <Button loading={parsing} disabled={!ticketText.trim()} onClick={handleParseTicket}>Parse with AI</Button>
          </>
        }
      >
        <div className="space-y-2">
          <p className="text-sm text-gray-500">Paste any job ticket, email, or work order. AI will extract job details automatically.</p>
          <textarea value={ticketText} onChange={e => setTicketText(e.target.value)} rows={8}
            placeholder="Paste any job ticket here..."
            className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A73E8] resize-none"
            autoFocus />
        </div>
      </Modal>

      {/* Add Line Item Modal */}
      {lineItemModal && (
        <AddLineItemModal
          type={lineItemModal}
          onAdd={item => { setLineItems(prev => [...prev, item]); setLineItemModal(null); }}
          onClose={() => setLineItemModal(null)}
        />
      )}
    </div>
  );
}

function AddLineItemModal({ type, onAdd, onClose }) {
  const [name, setName] = useState('');
  const [qty, setQty] = useState(1);
  const [unitPrice, setUnitPrice] = useState('');
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const searchTO = useRef(null);

  useEffect(() => {
    if (search.length < 2) { setResults([]); return; }
    clearTimeout(searchTO.current);
    searchTO.current = setTimeout(async () => {
      try {
        const res = await api.get(`/pricebook/items?search=${encodeURIComponent(search)}`);
        setResults(res.data?.items || res.data || []);
      } catch { setResults([]); }
    }, 300);
  }, [search]);

  function selectItem(item) {
    setName(item.name);
    setUnitPrice(String(item.price || item.unit_price || ''));
    setSearch('');
    setResults([]);
  }

  const total = Number(qty || 1) * Number(unitPrice || 0);

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={type === 'charge' ? 'Add Charge' : 'Add Part'}
      footer={
        <>
          <Button variant="outlined" onClick={onClose}>Cancel</Button>
          <Button disabled={!name.trim()} onClick={() => onAdd({ name, qty: Number(qty), unit_price: Number(unitPrice || 0) })}>
            Add
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="relative">
          <label className="block text-sm font-medium text-gray-700 mb-1">Item Name</label>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={name || search}
              onChange={e => { setSearch(e.target.value); setName(e.target.value); }}
              placeholder="Search pricebook or type name..."
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-300 min-h-[44px] text-[16px] focus:outline-none focus:ring-2 focus:ring-[#1A73E8]"
            />
          </div>
          {results.length > 0 && (
            <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden max-h-48 overflow-y-auto">
              {results.map(item => (
                <button key={item.id || item._id} type="button" onClick={() => selectItem(item)}
                  className="w-full text-left px-4 py-2.5 hover:bg-gray-50 text-sm border-b last:border-0 flex justify-between">
                  <span className="font-medium">{item.name}</span>
                  <span className="text-[#1A73E8]">${Number(item.price || item.unit_price || 0).toFixed(2)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Qty</label>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setQty(q => Math.max(1, q - 1))}
                className="w-10 h-10 rounded-xl border border-gray-300 flex items-center justify-center text-gray-600 font-bold text-lg hover:bg-gray-50">−</button>
              <span className="w-8 text-center font-semibold text-gray-900">{qty}</span>
              <button type="button" onClick={() => setQty(q => q + 1)}
                className="w-10 h-10 rounded-xl border border-gray-300 flex items-center justify-center text-gray-600 font-bold text-lg hover:bg-gray-50">+</button>
            </div>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Unit Price ($)</label>
            <input type="number" value={unitPrice} onChange={e => setUnitPrice(e.target.value)}
              placeholder="0.00" min="0" step="0.01"
              className="w-full rounded-xl border border-gray-300 px-3 py-2.5 min-h-[44px] text-[16px] focus:outline-none focus:ring-2 focus:ring-[#1A73E8]" />
          </div>
        </div>
        {total > 0 && (
          <div className="flex justify-between pt-2 border-t border-gray-100">
            <span className="text-sm text-gray-600">Total</span>
            <span className="font-bold text-[#1A73E8]">${total.toFixed(2)}</span>
          </div>
        )}
      </div>
    </Modal>
  );
}
