import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Plus, X, ClipboardList, UserCheck } from 'lucide-react';
import { jobsApi, customersApi, sourcesApi, companyApi } from '../lib/api';
import { useGet } from '../hooks/useApi';
import { Button, Input, Card, Modal, LoadingSpinner } from '../components/ui';
import { useSnackbar } from '../components/ui/Snackbar';
import QuickCreateCustomerModal from '../components/QuickCreateCustomerModal';

const JOB_TYPES = ['Service','Installation','Maintenance','Inspection','Repair','New Installation','Spring Replacement','Tune-Up','Other'];

const JOB_TYPE_TO_BACKEND = {
  'Service':            'service',
  'Installation':       'installation',
  'Maintenance':        'maintenance',
  'Inspection':         'inspection',
  'Repair':             'repair',
  'New Installation':   'installation',
  'Spring Replacement': 'repair',
  'Tune-Up':            'maintenance',
  'Other':              'service',
  'Estimate':           'estimate',
};

const STATE_ABBR = {
  'alabama':'AL','alaska':'AK','arizona':'AZ','arkansas':'AR',
  'california':'CA','colorado':'CO','connecticut':'CT',
  'delaware':'DE','florida':'FL','georgia':'GA','hawaii':'HI',
  'idaho':'ID','illinois':'IL','indiana':'IN','iowa':'IA',
  'kansas':'KS','kentucky':'KY','louisiana':'LA','maine':'ME',
  'maryland':'MD','massachusetts':'MA','michigan':'MI',
  'minnesota':'MN','mississippi':'MS','missouri':'MO',
  'montana':'MT','nebraska':'NE','nevada':'NV',
  'new hampshire':'NH','new jersey':'NJ','new mexico':'NM',
  'new york':'NY','north carolina':'NC','north dakota':'ND',
  'ohio':'OH','oklahoma':'OK','oregon':'OR','pennsylvania':'PA',
  'rhode island':'RI','south carolina':'SC','south dakota':'SD',
  'tennessee':'TN','texas':'TX','utah':'UT','vermont':'VT',
  'virginia':'VA','washington':'WA','west virginia':'WV',
  'wisconsin':'WI','wyoming':'WY','district of columbia':'DC',
};

function toStateAbbr(val) {
  if (!val) return val;
  const trimmed = val.trim();
  if (trimmed.length <= 2) return trimmed.toUpperCase();
  return STATE_ABBR[trimmed.toLowerCase()] || trimmed;
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

function SectionLabel({ children }) {
  return <p className="text-xs font-semibold text-[#1A73E8] uppercase tracking-wider mb-2">{children}</p>;
}

// Assignment category tabs
const ASSIGN_CATS = [
  { id: 'self',    label: 'Self' },
  { id: 'team',    label: 'Team' },
  { id: 'roster',  label: 'Roster' },
  { id: 'partner', label: 'Partner' },
];

export default function JobForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { showSnack } = useSnackbar();
  const isEdit = Boolean(id);

  // ── form fields ────────────────────────────────────────────────────────────
  const [form, setForm] = useState({
    notes: '',
    customer_id: '', customer_name: '',
    address: '', city: '', state: '', zip: '',
    scheduled_date: '', scheduled_time: '',
    // assignment
    assign_cat: 'self',        // 'self' | 'team' | 'roster' | 'partner'
    assigned_tech_id: '',      // team member (app user)
    assigned_roster_tech_id: '', // roster tech
    assigned_partner_company_id: '', // network partner
    // notifications
    notify_sms: true,
    notify_email: false,
    notify_push: true,
    // source (unified)
    source_option: 'company',  // 'company' | contact id | channel id
    // type
    job_type: 'Service',
    // edit-only
    status: 'unscheduled',
  });

  // ── customer search ────────────────────────────────────────────────────────
  const [customerSearch, setCustomerSearch]       = useState('');
  const [customerResults, setCustomerResults]     = useState([]);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [selectedCustomer, setSelectedCustomer]   = useState(null);
  const [showQuickCreate, setShowQuickCreate]     = useState(false);
  const [quickCreatePrefill, setQuickCreatePrefill] = useState({});
  const [extraPhones, setExtraPhones]             = useState([]);
  const [extraEmails, setExtraEmails]             = useState([]);

  // ── modals / state ─────────────────────────────────────────────────────────
  const [saving, setSaving]                       = useState(false);
  const [sendAfterSave, setSendAfterSave]         = useState(false);
  const [fieldErrors, setFieldErrors]             = useState({});
  const [pasteModal, setPasteModal]               = useState(false);
  const [ticketText, setTicketText]               = useState('');
  const [parsing, setParsing]                     = useState(false);
  const [duplicateModal, setDuplicateModal]       = useState(null);

  // ── source data ────────────────────────────────────────────────────────────
  const [companyName, setCompanyName]             = useState('My Company');
  const [sourceContacts, setSourceContacts]       = useState([]);
  const [adChannels, setAdChannels]               = useState([]);

  // ── refs ───────────────────────────────────────────────────────────────────
  const searchTO             = useRef(null);
  const streetInputRef       = useRef(null);
  const customerDropdownRef  = useRef(null);

  // ── remote data ────────────────────────────────────────────────────────────
  const { data: jobData, loading: jobLoading } = useGet(isEdit ? `/jobs/${id}` : null, [id]);
  const { data: techsData }   = useGet('/users/technicians');
  const { data: rosterData }  = useGet('/roster-techs');
  const { data: partnersData } = useGet('/network/connections');

  const teamMembers  = techsData?.technicians   || techsData || [];
  const rosterTechs  = rosterData?.technicians  || rosterData || [];
  const partners     = partnersData?.connections || partnersData?.partners || partnersData || [];

  // ── load company name + sources on mount ──────────────────────────────────
  useEffect(() => {
    companyApi.get().then(r => {
      const name = r.data?.company?.name || r.data?.name || 'My Company';
      setCompanyName(name);
    }).catch(() => {});
    sourcesApi.getContacts().then(r => setSourceContacts(r.data?.contacts || r.data || [])).catch(() => {});
    sourcesApi.getChannels().then(r => setAdChannels(r.data?.channels || r.data || [])).catch(() => {});
  }, []);

  // ── pre-fill from ?date= query param ──────────────────────────────────────
  useEffect(() => {
    if (isEdit) return;
    const p = new URLSearchParams(location.search);
    const presetDate = p.get('date');
    if (presetDate) setForm(prev => ({ ...prev, scheduled_date: presetDate }));
  }, []);

  // ── pre-fill from location state ──────────────────────────────────────────
  useEffect(() => {
    const parsed = location.state?.parsedData;
    if (parsed && !isEdit) {
      setForm(prev => ({
        ...prev,
        notes: [parsed.job_description, parsed.leftover_notes].filter(Boolean).join('\n\n') || prev.notes,
        address: parsed.address || parsed.service_address || prev.address,
        city: parsed.city || prev.city,
        state: toStateAbbr(parsed.state) || prev.state,
        zip: parsed.zip || prev.zip,
        job_type: parsed.type || parsed.job_type || prev.job_type,
        scheduled_date: parsed.scheduled_date ? parsed.scheduled_date.slice(0,10)
          : parsed.scheduled_start ? parsed.scheduled_start.slice(0,10) : prev.scheduled_date,
        scheduled_time: parsed.scheduled_time
          || (parsed.scheduled_start ? parsed.scheduled_start.slice(11,16) : '')
          || prev.scheduled_time,
      }));
      const phones = parsed.phone_numbers || (parsed.phone ? [parsed.phone] : []);
      if (phones.length > 0) setExtraPhones(phones.slice(0,3));
      const ec = parsed.existing_customer;
      const parsedPhone = (parsed.phone || parsed.phone_numbers?.[0] || '').replace(/\D/g, '');
      const phonesMatch = parsedPhone && ec?.phone &&
        (ec.phone.replace(/\D/g,'').endsWith(parsedPhone) ||
         parsedPhone.endsWith((ec?.phone||'').replace(/\D/g,'')));
      const parsedName = (parsed.customer_name||'').trim();
      const hasFullName = parsedName.includes(' ') && parsedName.split(' ').length >= 2;
      const isHighConf = parsed.existing_customer_id && ec && phonesMatch;
      const isMedConf  = parsed.existing_customer_id && ec && hasFullName &&
        ec.first_name && parsedName.toLowerCase().startsWith(ec.first_name.toLowerCase());
      if (isHighConf || isMedConf) {
        selectCustomer(ec);
      } else if (parsedName || parsedPhone) {
        const parts = parsedName.split(' ');
        customersApi.create({
          first_name: parts[0] || 'Customer',
          last_name: parts.slice(1).join(' ') || '',
          phone: parsedPhone || '',
          type: 'residential',
        }).then(r => selectCustomer(r.data?.customer || r.data)).catch(() => setCustomerSearch(parsed.customer_name||''));
      }
    }
    const preCustomer = location.state?.customer;
    if (preCustomer && !isEdit) {
      setForm(prev => ({ ...prev, customer_id: preCustomer.id||'', customer_name: preCustomer.name||'' }));
      setCustomerSearch(preCustomer.name||'');
    }
  }, []); // eslint-disable-line

  // ── Google Places autocomplete ────────────────────────────────────────────
  useEffect(() => {
    if (!streetInputRef.current || !window.google?.maps?.places) return;
    const ac = new window.google.maps.places.Autocomplete(
      streetInputRef.current,
      { types: ['address'], componentRestrictions: { country: 'us' } }
    );
    ac.addListener('place_changed', () => {
      const place = ac.getPlace();
      if (!place.address_components) return;
      let street = '', city = '', state = '', zip = '';
      for (const c of place.address_components) {
        const t = c.types;
        if (t.includes('street_number')) street = c.long_name + ' ';
        if (t.includes('route'))         street += c.long_name;
        if (t.includes('locality'))      city = c.long_name;
        if (t.includes('administrative_area_level_1')) state = c.short_name;
        if (t.includes('postal_code'))   zip = c.long_name;
      }
      setForm(prev => ({ ...prev, address: street.trim() || place.formatted_address, city, state: toStateAbbr(state), zip }));
    });
    return () => window.google?.maps?.event?.clearInstanceListeners(ac);
  }, [!!window.google?.maps?.places]); // eslint-disable-line

  // ── load existing job for edit ─────────────────────────────────────────────
  useEffect(() => {
    if (!isEdit || !jobData) return;
    const j = jobData.job || jobData;
    const sDate = j.scheduled_date ? j.scheduled_date.slice(0,10)
      : j.scheduled_start ? j.scheduled_start.slice(0,10) : '';
    const sTime = j.scheduled_time || (j.scheduled_start ? j.scheduled_start.slice(11,16) : '');

    let assign_cat = 'self', assigned_tech_id = '', assigned_roster_tech_id = '', assigned_partner_company_id = '';
    if (j.assigned_roster_tech_id) { assign_cat = 'roster'; assigned_roster_tech_id = j.assigned_roster_tech_id; }
    else if (j.assigned_to) { assign_cat = 'team'; assigned_tech_id = j.assigned_to; }

    // determine source_option
    let source_option = 'company';
    if (j.job_source_id) source_option = j.job_source_id;
    else if (j.ad_channel_id) source_option = j.ad_channel_id;

    setForm({
      notes: j.notes || j.description || '',
      customer_id: j.customer_id || '',
      customer_name: j.customer_name || j.customer?.name || '',
      address: j.address || '',
      city: j.city || '', state: j.state || '', zip: j.zip || '',
      scheduled_date: sDate, scheduled_time: sTime,
      assign_cat, assigned_tech_id, assigned_roster_tech_id, assigned_partner_company_id,
      notify_sms: true, notify_email: false, notify_push: true,
      source_option,
      job_type: j.type ? (j.type.charAt(0).toUpperCase() + j.type.slice(1)) : 'Service',
      status: j.status || 'unscheduled',
    });
    setCustomerSearch(j.customer_name || j.customer?.name || '');
  }, [isEdit, jobData]);

  // ── outside-click closes customer dropdown ────────────────────────────────
  useEffect(() => {
    function onMouseDown(e) {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(e.target))
        setShowCustomerDropdown(false);
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  // ── customer input ─────────────────────────────────────────────────────────
  function handleCustomerInput(e) {
    const val = e.target.value;
    setCustomerSearch(val);
    setSelectedCustomer(null);
    setForm(prev => ({ ...prev, customer_name: val, customer_id: '' }));
    if (fieldErrors.customer_id) setFieldErrors(prev => ({ ...prev, customer_id: '' }));
    clearTimeout(searchTO.current);
    if (val.length > 1) {
      searchTO.current = setTimeout(async () => {
        try {
          const res = await customersApi.list({ search: val, limit: 6 });
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
    const name = `${customer.first_name||''} ${customer.last_name||''}`.trim() || customer.name || '';
    setSelectedCustomer(customer);
    setForm(prev => ({
      ...prev,
      customer_id: customer.id || customer._id,
      customer_name: name,
      address: prev.address || customer.address || '',
      city:    prev.city    || customer.city    || '',
      state:   prev.state   || customer.state   || '',
      zip:     prev.zip     || customer.zip     || '',
    }));
    setCustomerSearch(name);
    setShowCustomerDropdown(false);
    setFieldErrors(prev => ({ ...prev, customer_id: '' }));
  }

  function onCustomerCreated(customer) {
    setShowQuickCreate(false);
    selectCustomer(customer);
  }

  // ── resolve customer from parsed ticket ────────────────────────────────────
  async function resolveCustomer(p) {
    const parsedPhone = (p.phone || p.phone_numbers?.[0] || '').replace(/\D/g,'');
    const parsedName  = (p.customer_name || '').trim();
    const parts       = parsedName.split(' ');
    const firstName   = parts[0] || '';
    const lastName    = parts.slice(1).join(' ') || '';

    if (p.existing_customer_id && p.existing_customer) {
      const ec = p.existing_customer;
      const phonesMatch = parsedPhone && ec.phone &&
        (ec.phone.replace(/\D/g,'').endsWith(parsedPhone) ||
         parsedPhone.endsWith(ec.phone.replace(/\D/g,'')));
      const hasFullName = parsedName.includes(' ') && parts.length >= 2;
      const nameMatch = hasFullName && ec.first_name &&
        parsedName.toLowerCase().startsWith(ec.first_name.toLowerCase());
      if (phonesMatch || nameMatch)
        return { customer: ec, action: 'matched', message: `Matched: ${`${ec.first_name} ${ec.last_name||''}`.trim()}` };
    }

    if (parsedPhone || parsedName) {
      try {
        const res = await customersApi.list({ search: parsedPhone || parsedName, limit: 5 });
        const results = res.data?.customers || res.data || [];
        if (parsedPhone && results.length > 0) {
          const phoneMatch = results.find(c =>
            (c.phone||'').replace(/\D/g,'').endsWith(parsedPhone) ||
            parsedPhone.endsWith((c.phone||'').replace(/\D/g,''))
          );
          if (phoneMatch)
            return { customer: phoneMatch, action: 'matched', message: `Matched: ${`${phoneMatch.first_name} ${phoneMatch.last_name||''}`.trim()}` };
        }
      } catch {}
    }

    if (firstName || parsedPhone) {
      try {
        const createRes = await customersApi.create({
          first_name: firstName || 'Customer',
          last_name: lastName || '',
          phone: parsedPhone || null,
          email: p.email || null,
          type: 'residential',
        });
        const created = createRes.data?.customer || createRes.data;
        return { customer: created, action: 'created', message: `New customer: ${`${firstName} ${lastName}`.trim()}` };
      } catch {}
    }

    try {
      const walkinRes = await customersApi.create({
        first_name: parsedName || 'Walk-in', last_name: '',
        phone: parsedPhone || null, type: 'residential',
      });
      const walkin = walkinRes.data?.customer || walkinRes.data;
      return { customer: walkin, action: 'created', message: parsedName ? `Customer: ${parsedName}` : 'Walk-in customer created' };
    } catch {}

    return { customer: null, action: 'failed', message: parsedName ? `Could not save customer "${parsedName}" — added to notes` : null };
  }

  async function applyParsedData(p) {
    setForm(prev => ({
      ...prev,
      notes: [p.job_description, p.leftover_notes].filter(Boolean).join('\n\n') || prev.notes,
      address: p.address || p.service_address || prev.address,
      city:    p.city    || prev.city,
      state:   toStateAbbr(p.state) || prev.state,
      zip:     p.zip     || prev.zip,
      job_type: p.type || p.job_type || prev.job_type,
      scheduled_date: p.scheduled_date ? p.scheduled_date.slice(0,10)
        : p.scheduled_start ? p.scheduled_start.slice(0,10) : prev.scheduled_date,
      scheduled_time: p.scheduled_time || (p.scheduled_start ? p.scheduled_start.slice(11,16) : '') || prev.scheduled_time,
    }));
    const phones = p.phone_numbers || (p.phone ? [p.phone] : []);
    if (phones.length > 0) setExtraPhones(phones.slice(0,3));

    const result = await resolveCustomer(p);
    if (result.action === 'matched' && result.customer) {
      setDuplicateModal({ matched: result.customer, parsedName: p.customer_name || '' });
      return;
    }
    if (result.customer) {
      selectCustomer(result.customer);
    } else {
      const customerInfo = [p.customer_name, p.phone, p.email].filter(Boolean).join(' | ');
      if (customerInfo) {
        setForm(prev => ({
          ...prev,
          notes: prev.notes ? `CUSTOMER: ${customerInfo}\n\n${prev.notes}` : `CUSTOMER: ${customerInfo}`,
        }));
      }
    }
    if (result.message) showSnack(result.message, result.action === 'failed' ? 'error' : 'success');
    else showSnack('Ticket parsed!', 'success');
  }

  async function handleParseTicket() {
    if (!ticketText.trim()) return;
    setParsing(true);
    try {
      const res = await jobsApi.parseTicket(ticketText);
      const p = res.data?.job || res.data;
      setPasteModal(false);
      setTicketText('');
      await applyParsedData(p);
    } catch (err) {
      showSnack(err?.response?.data?.error || 'Failed to parse ticket', 'error');
    } finally { setParsing(false); }
  }

  async function handlePasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim().length > 10) {
        setParsing(true);
        try {
          const res = await jobsApi.parseTicket(text.trim());
          const p = res.data?.job || res.data;
          await applyParsedData(p);
        } catch (err) {
          showSnack(err?.response?.data?.error || 'Failed to parse', 'error');
        } finally { setParsing(false); }
        return;
      }
      setPasteModal(true);
    } catch { setPasteModal(true); }
  }

  // ── build payload for job create/update ───────────────────────────────────
  function buildPayload(sendToTech = false) {
    let scheduled_start = null;
    if (form.scheduled_date) {
      const timeStr = form.scheduled_time || '12:00';
      const dt = new Date(`${form.scheduled_date}T${timeStr}:00`);
      scheduled_start = isNaN(dt.getTime()) ? null : dt.toISOString();
    }

    // Resolve assignment
    let assigned_to = null;
    let assigned_roster_tech_id = null;
    if (form.assign_cat === 'team')   assigned_to = form.assigned_tech_id || null;
    if (form.assign_cat === 'roster') assigned_roster_tech_id = form.assigned_roster_tech_id || null;

    // Resolve source
    let source_type = null, job_source_id = null, ad_channel_id = null;
    if (form.source_option === 'company') {
      source_type = 'own_company';
    } else {
      const contact = sourceContacts.find(c => c.id === form.source_option || c._id === form.source_option);
      const channel = adChannels.find(c => c.id === form.source_option || c._id === form.source_option);
      if (contact)      { source_type = 'external_contact'; job_source_id = form.source_option; }
      else if (channel) { source_type = 'own_company';      ad_channel_id = form.source_option; }
    }

    const type = JOB_TYPE_TO_BACKEND[form.job_type] || form.job_type?.toLowerCase() || null;

    return {
      customer_id: form.customer_id || null,
      type,
      notes: form.notes?.trim() || null,
      description: form.notes?.trim() || null,
      address: form.address?.trim() || null,
      city:    form.city?.trim()    || null,
      state:   toStateAbbr(form.state?.trim()) || null,
      zip:     form.zip?.trim()     || null,
      scheduled_start,
      assigned_to,
      assigned_roster_tech_id,
      source_type,
      job_source_id,
      ad_channel_id,
      ...(sendToTech ? {
        notify_sms:   form.notify_sms,
        notify_email: form.notify_email,
        notify_push:  form.notify_push,
      } : {}),
    };
  }

  // ── notify tech after save ────────────────────────────────────────────────
  async function notifyTech(jobId) {
    if (form.assign_cat === 'self') return;
    const calls = [];
    if (form.notify_sms || form.notify_push) {
      // dispatch triggers SMS for roster/team
      try { await jobsApi.dispatch(jobId, 0, 0); } catch {}
    }
  }

  // ── submit ─────────────────────────────────────────────────────────────────
  async function handleSubmit(e, sendMode = false) {
    if (e) e.preventDefault();
    if (!form.customer_id) { setFieldErrors({ customer_id: 'Customer is required' }); return; }

    setSaving(true);
    setSendAfterSave(sendMode);
    try {
      const payload = buildPayload(sendMode);

      if (isEdit) {
        await jobsApi.update(id, payload);
        if (sendMode) await notifyTech(id);
        showSnack('Job updated', 'success');
        navigate(`/jobs/${id}`);
      } else {
        const res = await jobsApi.create(payload);
        const newId = res.data?.job?.id || res.data?.id;
        if (sendMode && newId) await notifyTech(newId);
        showSnack(sendMode ? 'Job created & tech notified' : 'Job created', 'success');
        navigate(`/jobs/${newId}`);
      }
    } catch (err) {
      const msg = err?.response?.data?.error
        || err?.response?.data?.errors?.[0]?.msg
        || err?.response?.data?.message
        || 'Failed to save job';
      showSnack(msg, 'error');
    } finally {
      setSaving(false);
      setSendAfterSave(false);
    }
  }

  const isNonSelf = form.assign_cat !== 'self';
  const schedulePreview = form.scheduled_date
    ? `${formatDisplayDate(form.scheduled_date)}${form.scheduled_time ? ' at ' + formatDisplayTime(form.scheduled_time) : ''}`
    : '';

  if (isEdit && jobLoading) return <LoadingSpinner fullPage />;

  return (
    <div className="p-4 max-w-2xl mx-auto pb-32">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)}
          className="p-2 rounded-xl hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-600">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-gray-900 flex-1">{isEdit ? 'Edit Job' : 'New Job'}</h1>
        <button type="button" onClick={handlePasteFromClipboard} disabled={parsing}
          className="flex items-center gap-1.5 text-sm text-[#1A73E8] font-medium px-3 py-2 rounded-xl border border-[#1A73E8] min-h-[44px] hover:bg-blue-50 disabled:opacity-60">
          {parsing ? <span className="animate-spin inline-block">⟳</span> : <ClipboardList size={16} />}
          <span className="hidden sm:inline">{parsing ? 'Parsing...' : 'Paste Ticket'}</span>
        </button>
      </div>

      <form onSubmit={e => handleSubmit(e, false)} className="space-y-4">

        {/* ── SOURCE ─────────────────────────────────────────────────────── */}
        <Card>
          <SectionLabel>Job Source</SectionLabel>
          <select
            value={form.source_option}
            onChange={e => setForm(prev => ({ ...prev, source_option: e.target.value }))}
            className="w-full rounded-xl border border-gray-300 px-3 py-2.5 min-h-[44px] text-[16px] focus:outline-none focus:ring-2 focus:ring-[#1A73E8] bg-white"
          >
            <option value="company">{companyName} (My Company)</option>
            {sourceContacts.length > 0 && (
              <optgroup label="Source Contacts">
                {sourceContacts.map(c => (
                  <option key={c.id||c._id} value={c.id||c._id}>{c.name}</option>
                ))}
              </optgroup>
            )}
            {adChannels.length > 0 && (
              <optgroup label="Ad Channels">
                {adChannels.map(c => (
                  <option key={c.id||c._id} value={c.id||c._id}>{c.name}</option>
                ))}
              </optgroup>
            )}
          </select>
        </Card>

        {/* ── JOB TYPE ───────────────────────────────────────────────────── */}
        <Card>
          <SectionLabel>Job Type</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {JOB_TYPES.map(t => (
              <button key={t} type="button"
                onClick={() => setForm(prev => ({ ...prev, job_type: t }))}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors min-h-[36px] ${
                  form.job_type === t
                    ? 'bg-[#1A73E8] text-white border-[#1A73E8]'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}>{t}</button>
            ))}
          </div>
        </Card>

        {/* ── ASSIGNMENT ─────────────────────────────────────────────────── */}
        <Card>
          <SectionLabel>Assign Technician</SectionLabel>

          {/* Category tabs */}
          <div className="flex gap-1 mb-3 bg-gray-100 rounded-xl p-1">
            {ASSIGN_CATS.map(cat => (
              <button key={cat.id} type="button"
                onClick={() => setForm(prev => ({ ...prev, assign_cat: cat.id, assigned_tech_id: '', assigned_roster_tech_id: '', assigned_partner_company_id: '' }))}
                className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors min-h-[36px] ${
                  form.assign_cat === cat.id
                    ? 'bg-white text-[#1A73E8] shadow-sm font-semibold'
                    : 'text-gray-500 hover:text-gray-700'
                }`}>{cat.label}</button>
            ))}
          </div>

          {form.assign_cat === 'self' && (
            <p className="text-sm text-gray-500 py-1">Job assigned to you.</p>
          )}

          {form.assign_cat === 'team' && (
            <select value={form.assigned_tech_id}
              onChange={e => setForm(prev => ({ ...prev, assigned_tech_id: e.target.value }))}
              className="w-full rounded-xl border border-gray-300 px-3 py-2.5 min-h-[44px] text-[16px] focus:outline-none focus:ring-2 focus:ring-[#1A73E8] bg-white">
              <option value="">— Select Team Member —</option>
              {teamMembers.map(t => (
                <option key={t.id||t._id} value={t.id||t._id}>
                  {`${t.first_name||''} ${t.last_name||''}`.trim()}
                </option>
              ))}
            </select>
          )}

          {form.assign_cat === 'roster' && (
            <select value={form.assigned_roster_tech_id}
              onChange={e => setForm(prev => ({ ...prev, assigned_roster_tech_id: e.target.value }))}
              className="w-full rounded-xl border border-gray-300 px-3 py-2.5 min-h-[44px] text-[16px] focus:outline-none focus:ring-2 focus:ring-[#1A73E8] bg-white">
              <option value="">— Select Roster Tech —</option>
              {rosterTechs.map(t => (
                <option key={t.id||t._id} value={t.id||t._id}>{t.name||t.first_name}</option>
              ))}
            </select>
          )}

          {form.assign_cat === 'partner' && (
            <select value={form.assigned_partner_company_id}
              onChange={e => setForm(prev => ({ ...prev, assigned_partner_company_id: e.target.value }))}
              className="w-full rounded-xl border border-gray-300 px-3 py-2.5 min-h-[44px] text-[16px] focus:outline-none focus:ring-2 focus:ring-[#1A73E8] bg-white">
              <option value="">— Select Partner —</option>
              {partners.map(p => (
                <option key={p.id||p._id||p.company_id} value={p.id||p._id||p.company_id}>
                  {p.name||p.company_name||p.partner_name}
                </option>
              ))}
            </select>
          )}

          {/* Notification toggles — only for non-self */}
          {isNonSelf && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Notify via</p>
              <div className="flex gap-2">
                {[
                  { key: 'notify_sms',   label: 'SMS' },
                  { key: 'notify_email', label: 'Email' },
                  { key: 'notify_push',  label: 'Push' },
                ].map(({ key, label }) => (
                  <button key={key} type="button"
                    onClick={() => setForm(prev => ({ ...prev, [key]: !prev[key] }))}
                    className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors min-h-[36px] ${
                      form[key]
                        ? 'bg-[#1A73E8] text-white border-[#1A73E8]'
                        : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                    }`}>{label}</button>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* ── CUSTOMER ───────────────────────────────────────────────────── */}
        <Card>
          <SectionLabel>Customer</SectionLabel>

          {selectedCustomer ? (
            <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl mb-2">
              <UserCheck size={18} className="text-[#1A73E8] shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">
                  {`${selectedCustomer.first_name||''} ${selectedCustomer.last_name||''}`.trim() || selectedCustomer.name}
                </p>
                {selectedCustomer.phone && <p className="text-xs text-gray-500">{selectedCustomer.phone}</p>}
              </div>
              <button type="button"
                onClick={() => { setSelectedCustomer(null); setForm(prev => ({ ...prev, customer_id: '', customer_name: '' })); setCustomerSearch(''); }}
                className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg">
                <X size={16} />
              </button>
            </div>
          ) : (
            <div className="relative" ref={customerDropdownRef}>
              <input
                value={customerSearch}
                onChange={handleCustomerInput}
                placeholder="Search customer by name, phone, or email..."
                className={`w-full rounded-xl border px-3 py-2.5 min-h-[44px] text-[16px] focus:outline-none focus:ring-2 focus:ring-[#1A73E8] ${fieldErrors.customer_id ? 'border-red-400' : 'border-gray-300'}`}
              />
              {showCustomerDropdown && (
                <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                  {customerResults.map(c => (
                    <button key={c.id||c._id} type="button" onClick={() => selectCustomer(c)}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 text-sm border-b last:border-0 flex items-center justify-between">
                      <span className="font-medium">{`${c.first_name||''} ${c.last_name||''}`.trim() || c.name}</span>
                      {c.phone && <span className="text-gray-400 text-xs">{c.phone}</span>}
                    </button>
                  ))}
                  <button type="button"
                    onClick={() => { setShowCustomerDropdown(false); setQuickCreatePrefill({ first_name: customerSearch, phone: '' }); setShowQuickCreate(true); }}
                    className="w-full text-left px-4 py-3 hover:bg-blue-50 text-sm text-[#1A73E8] font-medium flex items-center gap-2">
                    <Plus size={14} /> Create new customer
                  </button>
                </div>
              )}
              {!showCustomerDropdown && customerSearch.length > 1 && !selectedCustomer && (
                <button type="button"
                  onClick={() => { setQuickCreatePrefill({ first_name: customerSearch, phone: '' }); setShowQuickCreate(true); }}
                  className="mt-1.5 text-sm text-[#1A73E8] font-medium flex items-center gap-1 min-h-[36px]">
                  <Plus size={14} /> Create new customer
                </button>
              )}
            </div>
          )}
          {fieldErrors.customer_id && <p className="text-red-500 text-xs mt-1">{fieldErrors.customer_id}</p>}

          {/* Extra phones */}
          {extraPhones.map((ph, idx) => (
            <div key={idx} className="flex gap-2 mt-2">
              <input type="tel" value={ph}
                onChange={e => { const a = [...extraPhones]; a[idx] = e.target.value; setExtraPhones(a); }}
                placeholder={`Phone ${idx+2}`}
                className="flex-1 rounded-xl border border-gray-300 px-3 py-2.5 min-h-[44px] text-[16px] focus:outline-none focus:ring-2 focus:ring-[#1A73E8]" />
              <button type="button" onClick={() => setExtraPhones(prev => prev.filter((_,i) => i !== idx))}
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
              <input type="email" value={em}
                onChange={e => { const a = [...extraEmails]; a[idx] = e.target.value; setExtraEmails(a); }}
                placeholder={`Email ${idx+2}`}
                className="flex-1 rounded-xl border border-gray-300 px-3 py-2.5 min-h-[44px] text-[16px] focus:outline-none focus:ring-2 focus:ring-[#1A73E8]" />
              <button type="button" onClick={() => setExtraEmails(prev => prev.filter((_,i) => i !== idx))}
                className="p-2 text-gray-400 hover:text-red-500 min-w-[44px] flex items-center justify-center"><X size={16} /></button>
            </div>
          ))}
          <button type="button" onClick={() => setExtraEmails(prev => [...prev, ''])}
            className="mt-2 text-sm text-[#1A73E8] font-medium min-h-[36px] flex items-center gap-1">
            <Plus size={14} /> Add email
          </button>
        </Card>

        {/* ── ADDRESS ────────────────────────────────────────────────────── */}
        <Card>
          <SectionLabel>Address</SectionLabel>
          {isEdit && (jobData?.job||jobData)?.address_verified === false && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2 mb-3">
              <span className="text-amber-500 text-lg shrink-0">⚠️</span>
              <div>
                <div className="text-sm font-semibold text-amber-800">Address may be inaccurate</div>
                <div className="text-xs text-amber-600">Please verify and re-save to update coordinates.</div>
              </div>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
            <input ref={streetInputRef}
              className="w-full rounded-xl border border-gray-300 px-3 py-2.5 min-h-[44px] text-[16px] focus:outline-none focus:ring-2 focus:ring-[#1A73E8]"
              placeholder="Start typing address..."
              value={form.address}
              onChange={e => setForm(prev => ({ ...prev, address: e.target.value }))} />
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3">
            <div className="col-span-1">
              <Input label="City" name="city" value={form.city}
                onChange={e => setForm(prev => ({ ...prev, city: e.target.value }))} placeholder="Tampa" />
            </div>
            <Input label="State" name="state" value={form.state}
              onChange={e => setForm(prev => ({ ...prev, state: e.target.value }))} placeholder="FL" />
            <Input label="ZIP" name="zip" value={form.zip}
              onChange={e => setForm(prev => ({ ...prev, zip: e.target.value }))} placeholder="33601" />
          </div>
        </Card>

        {/* ── NOTES ──────────────────────────────────────────────────────── */}
        <Card>
          <SectionLabel>Job Notes</SectionLabel>
          <textarea name="notes" value={form.notes}
            onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
            rows={3} placeholder="Job details, special instructions..."
            className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-gray-900 text-[16px] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1A73E8] resize-none" />
        </Card>

        {/* ── SCHEDULE ───────────────────────────────────────────────────── */}
        <Card>
          <SectionLabel>Schedule</SectionLabel>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <div className="relative">
                <input type="date" value={form.scheduled_date}
                  onChange={e => setForm(prev => ({ ...prev, scheduled_date: e.target.value }))}
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
                <input type="time" value={form.scheduled_time}
                  onChange={e => setForm(prev => ({ ...prev, scheduled_time: e.target.value }))}
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

        {/* ── STATUS (edit only) ─────────────────────────────────────────── */}
        {isEdit && (
          <Card>
            <SectionLabel>Status</SectionLabel>
            <select value={form.status}
              onChange={e => setForm(prev => ({ ...prev, status: e.target.value }))}
              className="w-full rounded-xl border border-gray-300 px-3 py-2.5 min-h-[44px] text-[16px] focus:outline-none focus:ring-2 focus:ring-[#1A73E8] bg-white">
              {[
                { value:'unscheduled', label:'Unscheduled' },
                { value:'scheduled',   label:'Scheduled'   },
                { value:'en_route',    label:'En Route'    },
                { value:'in_progress', label:'In Progress' },
                { value:'completed',   label:'Completed'   },
                { value:'holding',     label:'Holding'     },
                { value:'cancelled',   label:'Cancelled'   },
              ].map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </Card>
        )}

        {/* ── ACTION BUTTONS ─────────────────────────────────────────────── */}
        <div className="flex gap-3 pb-4">
          <Button type="button" variant="outlined" onClick={() => navigate(-1)} className="flex-1">Cancel</Button>
          <Button type="submit" loading={saving && !sendAfterSave} disabled={saving} className="flex-1">
            {isEdit ? 'Save Changes' : 'Save Job'}
          </Button>
          {isNonSelf && !isEdit && (
            <Button type="button"
              loading={saving && sendAfterSave}
              disabled={saving}
              onClick={e => handleSubmit(null, true)}
              className="flex-1 bg-green-600 hover:bg-green-700 border-green-600">
              Save &amp; Send
            </Button>
          )}
        </div>
      </form>

      {/* Paste Ticket Modal */}
      <Modal isOpen={pasteModal} onClose={() => { setPasteModal(false); setTicketText(''); }}
        title="Paste Job Ticket"
        footer={
          <>
            <Button variant="outlined" onClick={() => { setPasteModal(false); setTicketText(''); }}>Cancel</Button>
            <Button loading={parsing} disabled={!ticketText.trim()} onClick={handleParseTicket}>Parse with AI</Button>
          </>
        }>
        <div className="space-y-2">
          <p className="text-sm text-gray-500">Paste any job ticket, email, or work order. AI will extract job details automatically.</p>
          <textarea value={ticketText} onChange={e => setTicketText(e.target.value)} rows={8}
            placeholder="Paste any job ticket here..."
            className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A73E8] resize-none"
            autoFocus />
        </div>
      </Modal>

      {/* Duplicate Customer Modal */}
      <Modal isOpen={Boolean(duplicateModal)} onClose={() => setDuplicateModal(null)} title="Returning Customer?">
        {duplicateModal && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              We found an existing customer matching <strong>{duplicateModal.parsedName||'this contact'}</strong>:
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
              <p className="font-semibold text-gray-900">
                {`${duplicateModal.matched.first_name||''} ${duplicateModal.matched.last_name||''}`.trim() || duplicateModal.matched.name}
              </p>
              {duplicateModal.matched.phone    && <p className="text-sm text-gray-600">{duplicateModal.matched.phone}</p>}
              {duplicateModal.matched.address  && <p className="text-xs text-gray-500">{duplicateModal.matched.address}</p>}
            </div>
            <div className="grid grid-cols-1 gap-2">
              <Button onClick={() => { selectCustomer(duplicateModal.matched); setDuplicateModal(null); showSnack('Returning customer selected', 'success'); }}
                className="w-full">
                Returning Customer
              </Button>
              <Button variant="outlined" className="w-full"
                onClick={async () => {
                  setDuplicateModal(null);
                  showSnack('Creating new customer...', 'info');
                  try {
                    const parsedName = duplicateModal.parsedName.trim();
                    const parts = parsedName.split(' ');
                    const res = await customersApi.create({
                      first_name: parts[0]||'Customer',
                      last_name: parts.slice(1).join(' ')||'',
                      phone: duplicateModal.matched.phone||null,
                      type: 'residential',
                    });
                    selectCustomer(res.data?.customer||res.data);
                    showSnack('New customer created', 'success');
                  } catch { showSnack('Failed to create customer', 'error'); }
                }}>
                Create New Customer
              </Button>
              <Button variant="outlined" onClick={() => setDuplicateModal(null)} className="w-full">Go Back</Button>
            </div>
          </div>
        )}
      </Modal>

      <QuickCreateCustomerModal
        isOpen={showQuickCreate}
        onClose={() => setShowQuickCreate(false)}
        onCreated={onCustomerCreated}
        prefill={quickCreatePrefill}
      />
    </div>
  );
}
