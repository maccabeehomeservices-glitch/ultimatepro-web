import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { X, UserCheck } from 'lucide-react';
import { UpBack, UpPlus, UpPasteTicket } from '../components/ui/icons';
import { jobsApi, customersApi, sourcesApi, companyApi, rosterTechsApi } from '../lib/api';
import { formatInJobZone } from '../lib/timezone';
import { useGet } from '../hooks/useApi';
import { useAuth } from '../hooks/useAuth';
import { Button, Input, Card, Modal, LoadingSpinner } from '../components/ui';
import { useSnackbar } from '../components/ui/Snackbar';
import QuickCreateCustomerModal from '../components/QuickCreateCustomerModal';

// P3.8: job-type chips come from GET /company/job-types (the company's editable set,
// tracked by `key` = the stored jobs.type value). This fallback is used only if that
// fetch fails (offline / first paint).
const FALLBACK_JOB_TYPES = [
  { key: 'service', label: 'Service' }, { key: 'installation', label: 'Installation' },
  { key: 'maintenance', label: 'Maintenance' }, { key: 'inspection', label: 'Inspection' },
  { key: 'repair', label: 'Repair' }, { key: 'emergency', label: 'Emergency' },
];

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

// Format raw phone digits as a customer display name so the customer pill
// shows useful info (e.g. "(757) 555-1212") instead of a literal "Customer"
// placeholder when AI extracts a phone but no name. Backend customers POST
// requires non-empty first_name.
function formatPhoneAsName(phoneStr) {
  if (!phoneStr) return '';
  const digits = String(phoneStr).replace(/\D/g, '');
  if (digits.length === 10) return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
  if (digits.length === 11 && digits[0] === '1') return `+1 (${digits.slice(1,4)}) ${digits.slice(4,7)}-${digits.slice(7)}`;
  return digits;
}

function fallbackCustomerName(phoneStr) {
  return formatPhoneAsName(phoneStr) || 'New customer';
}

function SectionLabel({ children }) {
  return <p className="text-xs font-semibold text-blue uppercase tracking-wider mb-2">{children}</p>;
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
  const { user } = useAuth();
  const isEdit = Boolean(id);

  // ── form fields ────────────────────────────────────────────────────────────
  const [form, setForm] = useState({
    notes: '',
    customer_id: '', customer_name: '',
    address: '', city: '', state: '', zip: '',
    scheduled_date: '', scheduled_time: '', scheduled_end_time: '',
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
    job_type: 'service',
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
  const [jobTypes, setJobTypes]                   = useState(FALLBACK_JOB_TYPES); // P3.8: company's job-type set

  // ── modals / state ─────────────────────────────────────────────────────────
  const [saving, setSaving]                       = useState(false);
  const [sendAfterSave, setSendAfterSave]         = useState(false);
  const [fieldErrors, setFieldErrors]             = useState({});
  const [pasteModal, setPasteModal]               = useState(false);
  const [pasteText, setPasteText]                 = useState('');
  const [pasteLoading, setPasteLoading]           = useState(false);
  const [pasteError, setPasteError]               = useState(null);
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
    // P3.8: job-type chips from the company's editable set.
    companyApi.getJobTypes().then(r => {
      const list = Array.isArray(r.data) ? r.data : [];
      if (list.length) setJobTypes(list);
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
      const parsedName = (parsed.customer_name||'').trim();
      // P2.1l Part B: gate on the backend match_type (never silently attach a name-only match).
      if (parsed.existing_customer_id && ec) {
        if (parsed.match_type === 'phone') {
          selectCustomer(ec);                                   // strong phone match → auto-attach
        } else {
          setDuplicateModal({ matched: ec, parsedName, parsedPhone }); // name-only → surface the choice (default Create New)
        }
      } else if (parsedName || parsedPhone) {
        const parts = parsedName.split(' ');
        customersApi.create({
          first_name: parts[0] || fallbackCustomerName(parsedPhone),
          last_name: parts.slice(1).join(' ') || '',
          phone: parsedPhone || '',
          phone2: (parsed.phone_numbers?.[1] || '').replace(/\D/g,'') || null,  // P2.35: 2nd phone → phone2, not notes
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
      { types: ['address'], componentRestrictions: { country: 'us' }, fields: ['address_components', 'geometry', 'formatted_address'] }
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
      // Capture coords so the backend can resolve the job's timezone immediately (TZ 2/3).
      const loc = place.geometry?.location;
      setForm(prev => ({
        ...prev,
        address: street.trim() || place.formatted_address,
        city, state: toStateAbbr(state), zip,
        lat: loc ? loc.lat() : prev.lat,
        lng: loc ? loc.lng() : prev.lng,
      }));
    });
    return () => window.google?.maps?.event?.clearInstanceListeners(ac);
  }, [!!window.google?.maps?.places]); // eslint-disable-line

  // ── load existing job for edit ─────────────────────────────────────────────
  useEffect(() => {
    if (!isEdit || !jobData) return;
    const j = jobData.job || jobData;
    // Show the job-zone wall-clock so editing doesn't shift the time (TZ 2/3).
    const sDate = j.scheduled_date ? j.scheduled_date.slice(0,10)
      : j.scheduled_start ? formatInJobZone(j.scheduled_start, j, 'yyyy-MM-dd') : '';
    const sTime = j.scheduled_time || (j.scheduled_start ? formatInJobZone(j.scheduled_start, j, 'HH:mm') : '');
    // P2.19: prefill the arrival-window "to" time (job-zone) only if it differs from start.
    const sEndTime = (j.scheduled_end && j.scheduled_end !== j.scheduled_start)
      ? formatInJobZone(j.scheduled_end, j, 'HH:mm') : '';

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
      scheduled_date: sDate, scheduled_time: sTime, scheduled_end_time: sEndTime,
      assign_cat, assigned_tech_id, assigned_roster_tech_id, assigned_partner_company_id,
      notify_sms: true, notify_email: false, notify_push: true,
      source_option,
      job_type: j.type || 'service',  // P3.8: the stored key highlights the matching chip
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

  // Pre-fill paste textarea from clipboard when modal opens (desktop convenience).
  // Mobile / permission-denied silently no-ops, user pastes manually.
  useEffect(() => {
    if (pasteModal) {
      navigator.clipboard?.readText?.()
        .then(text => { if (text) setPasteText(text); })
        .catch(() => {});
    }
  }, [pasteModal]);

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
    // P2.35: carry the 2nd parsed phone into the new customer's phone2 so it lands
    // in the phone section (not notes) and shows on the job detail.
    const secondPhone = (p.phone_numbers?.[1] || '').replace(/\D/g,'') || null;
    const parsedName  = (p.customer_name || '').trim();
    const parts       = parsedName.split(' ');
    const firstName   = parts[0] || '';
    const lastName    = parts.slice(1).join(' ') || '';

    // P2.1l Part B: the backend's match_type gates auto-attach — never re-derive it here.
    //   'phone' → strong match → attach silently.
    //   'name'  → name-only (even name+address, no phone) → NEVER silently attach; surface
    //             the duplicate-choice modal (defaults to Create New).
    // Any candidate with a non-phone/unknown match_type is treated as 'name' (safer).
    if (p.existing_customer_id && p.existing_customer) {
      const ec = p.existing_customer;
      const ecName = `${ec.first_name} ${ec.last_name||''}`.trim();
      if (p.match_type === 'phone')
        return { customer: ec, action: 'attach', message: `Matched by phone: ${ecName}` };
      return { customer: ec, action: 'matched', message: `Possible match: ${ecName}` };
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
        const fallbackName = fallbackCustomerName(parsedPhone);
        const createRes = await customersApi.create({
          first_name: firstName || fallbackName,
          last_name: lastName || '',
          phone: parsedPhone || null,
          phone2: secondPhone,
          email: p.email || null,
          type: 'residential',
        });
        const created = createRes.data?.customer || createRes.data;
        const displayName = `${firstName} ${lastName}`.trim() || fallbackName;
        return { customer: created, action: 'created', message: `New customer: ${displayName}` };
      } catch {}
    }

    try {
      const walkinRes = await customersApi.create({
        first_name: parsedName || 'Walk-in', last_name: '',
        phone: parsedPhone || null, phone2: secondPhone, type: 'residential',
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
      setDuplicateModal({
        matched: result.customer,
        parsedName: p.customer_name || '',
        parsedPhone: (p.phone || p.phone_numbers?.[0] || '').replace(/\D/g, ''),
      });
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

  // P2.1l Part B: the duplicate-choice modal DEFAULTS to Create New — this runs for the
  // "Create New" button AND on dismiss (backdrop / close). It creates the new customer from
  // the PARSED ticket name+phone (never the matched customer's phone), so a name-match with
  // a different phone produces a correct new record instead of silently reusing the old one.
  async function createNewFromDuplicate() {
    const dm = duplicateModal;
    setDuplicateModal(null);
    if (!dm) return;
    showSnack('Creating new customer...', 'info');
    try {
      const parts = (dm.parsedName || '').trim().split(' ');
      const res = await customersApi.create({
        first_name: parts[0] || fallbackCustomerName(dm.parsedPhone),
        last_name: parts.slice(1).join(' ') || '',
        phone: dm.parsedPhone || null,
        type: 'residential',
      });
      selectCustomer(res.data?.customer || res.data);
      showSnack('New customer created', 'success');
    } catch { showSnack('Failed to create customer', 'error'); }
  }

  async function handleParseTicket() {
    if (!pasteText.trim()) return;
    setPasteLoading(true);
    setPasteError(null);
    try {
      const res = await jobsApi.parseTicket(pasteText);
      const p = res.data?.job || res.data || {};
      const phoneList = Array.isArray(p.phone_numbers) ? p.phone_numbers : [];
      const hasAnyData =
        ['job_title', 'job_description', 'leftover_notes', 'customer_name', 'phone', 'email', 'address', 'city']
          .some(k => p[k] !== null && p[k] !== undefined && String(p[k]).trim() !== '')
        || phoneList.some(ph => ph && String(ph).trim() !== '');
      if (!hasAnyData) {
        setPasteError("Couldn't extract any job details from the text. Please paste a clearer ticket.");
        return;
      }
      setPasteModal(false);
      setPasteText('');
      await applyParsedData(p);
    } catch (err) {
      setPasteError(err?.response?.data?.error || 'Failed to parse ticket');
    } finally { setPasteLoading(false); }
  }

  function handlePasteFromClipboard() {
    setPasteText('');
    setPasteError(null);
    setPasteModal(true);
  }

  // ── build payload for job create/update ───────────────────────────────────
  function buildPayload(sendToTech = false) {
    // Path B (TZ 2/3): send the raw wall-clock + coords; the backend resolves the job's
    // zone and converts to a UTC instant. No client-side UTC conversion.
    const scheduled_local = form.scheduled_date
      ? `${form.scheduled_date}T${form.scheduled_time || '12:00'}`
      : null;
    // P2.19: arrival-window end — only when both a start time and a "to" time are set.
    const scheduled_end_local = (form.scheduled_date && form.scheduled_time && form.scheduled_end_time)
      ? `${form.scheduled_date}T${form.scheduled_end_time}`
      : null;

    // Resolve assignment
    let assigned_to = null;
    let assigned_roster_tech_id = null;
    if (form.assign_cat === 'self')   assigned_to = user?.id || null;
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

    const type = (form.job_type || '').trim().toLowerCase() || null;  // P3.8: form.job_type is the key

    return {
      customer_id: form.customer_id || null,
      type,
      notes: form.notes?.trim() || null,
      description: form.notes?.trim() || null,
      address: form.address?.trim() || null,
      city:    form.city?.trim()    || null,
      state:   toStateAbbr(form.state?.trim()) || null,
      zip:     form.zip?.trim()     || null,
      scheduled_local,
      scheduled_end_local,
      lat: form.lat ?? null,
      lng: form.lng ?? null,
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
  // F3: Save & Send notifies the assigned TECH (mirror Android's notify-tech), not the
  // customer "on the way" dispatch. The customer en-route SMS stays at Job Detail's
  // dispatch/arrived actions, where it belongs — not at job creation.
  async function notifyTech(jobId) {
    if (form.assign_cat === 'self') return;
    // Backend notify-tech accepts 'sms' or 'email' (no 'both'); prefer SMS when selected.
    const method = form.notify_sms ? 'sms' : (form.notify_email ? 'email' : null);
    if (!method) return;
    const techId = form.assigned_roster_tech_id || form.assigned_tech_id || null;
    try { await rosterTechsApi.notifyTech(jobId, techId, method); } catch {}
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
    ? `${formatDisplayDate(form.scheduled_date)}${form.scheduled_time ? ' at ' + formatDisplayTime(form.scheduled_time) + (form.scheduled_end_time ? ' – ' + formatDisplayTime(form.scheduled_end_time) : '') : ''}`
    : '';

  if (isEdit && jobLoading) return <LoadingSpinner fullPage />;

  return (
    <div className="p-4 max-w-2xl mx-auto pb-32">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)}
          className="p-2 rounded-xl hover:bg-background min-h-[44px] min-w-[44px] flex items-center justify-center text-ink">
          <UpBack size={20} />
        </button>
        <h1 className="text-xl font-bold text-ink flex-1">{isEdit ? 'Edit Job' : 'New Job'}</h1>
        <button type="button" onClick={handlePasteFromClipboard}
          className="flex items-center gap-1.5 text-sm text-blue font-medium px-3 py-2 rounded-xl border border-blue min-h-[44px] hover:bg-blue-50">
          <UpPasteTicket size={16} />
          <span className="hidden sm:inline">Paste Ticket</span>
        </button>
      </div>

      <form onSubmit={e => handleSubmit(e, false)} className="space-y-4">

        {/* ── SOURCE (Option B: hidden for non-full job creators; admin sets it later) ── */}
        {(user?.permissions_resolved?.jobs ?? 'full') === 'full' && (
        <Card>
          <SectionLabel>Job Source</SectionLabel>
          <select
            value={form.source_option}
            onChange={e => setForm(prev => ({ ...prev, source_option: e.target.value }))}
            className="w-full rounded-xl border border-hairline px-3 py-2.5 min-h-[44px] text-[16px] focus:outline-none focus:ring-2 focus:ring-blue bg-card"
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
        )}

        {/* ── JOB TYPE ───────────────────────────────────────────────────── */}
        <Card>
          <SectionLabel>Job Type</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {jobTypes.map(t => (
              <button key={t.key} type="button"
                onClick={() => setForm(prev => ({ ...prev, job_type: t.key }))}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors min-h-[36px] ${
                  form.job_type === t.key
                    ? 'bg-blue text-white border-blue'
                    : 'bg-card text-ink border-hairline hover:bg-background'
                }`}>{t.label}</button>
            ))}
          </div>
        </Card>

        {/* ── ASSIGNMENT ─────────────────────────────────────────────────── */}
        <Card>
          <SectionLabel>Assign Technician</SectionLabel>

          {/* Category tabs */}
          <div className="flex gap-1 mb-3 bg-background rounded-xl p-1">
            {ASSIGN_CATS.map(cat => (
              <button key={cat.id} type="button"
                onClick={() => setForm(prev => ({ ...prev, assign_cat: cat.id, assigned_tech_id: '', assigned_roster_tech_id: '', assigned_partner_company_id: '' }))}
                className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors min-h-[36px] ${
                  form.assign_cat === cat.id
                    ? 'bg-card text-blue shadow-sm font-semibold'
                    : 'text-muted hover:text-ink'
                }`}>{cat.label}</button>
            ))}
          </div>

          {form.assign_cat === 'self' && (
            <p className="text-sm text-muted py-1">Job assigned to you.</p>
          )}

          {form.assign_cat === 'team' && (
            <select value={form.assigned_tech_id}
              onChange={e => setForm(prev => ({ ...prev, assigned_tech_id: e.target.value }))}
              className="w-full rounded-xl border border-hairline px-3 py-2.5 min-h-[44px] text-[16px] focus:outline-none focus:ring-2 focus:ring-blue bg-card">
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
              className="w-full rounded-xl border border-hairline px-3 py-2.5 min-h-[44px] text-[16px] focus:outline-none focus:ring-2 focus:ring-blue bg-card">
              <option value="">— Select Roster Tech —</option>
              {rosterTechs.map(t => (
                <option key={t.id||t._id} value={t.id||t._id}>{t.name||t.first_name}</option>
              ))}
            </select>
          )}

          {form.assign_cat === 'partner' && (
            <select value={form.assigned_partner_company_id}
              onChange={e => setForm(prev => ({ ...prev, assigned_partner_company_id: e.target.value }))}
              className="w-full rounded-xl border border-hairline px-3 py-2.5 min-h-[44px] text-[16px] focus:outline-none focus:ring-2 focus:ring-blue bg-card">
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
            <div className="mt-3 pt-3 border-t border-hairline">
              <p className="text-xs font-semibold text-blue uppercase tracking-wider mb-3">SEND VIA</p>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.notify_sms}
                    onChange={e => setForm(prev => ({ ...prev, notify_sms: e.target.checked }))}
                    className="w-4 h-4 rounded border-hairline text-blue cursor-pointer" />
                  <span className="text-sm font-medium">SMS</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.notify_email}
                    onChange={e => setForm(prev => ({ ...prev, notify_email: e.target.checked }))}
                    className="w-4 h-4 rounded border-hairline text-blue cursor-pointer" />
                  <span className="text-sm font-medium">Email</span>
                </label>
                {form.assign_cat === 'team' && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.notify_push}
                      onChange={e => setForm(prev => ({ ...prev, notify_push: e.target.checked }))}
                      className="w-4 h-4 rounded border-hairline text-blue cursor-pointer" />
                    <span className="text-sm font-medium">Push</span>
                  </label>
                )}
              </div>
            </div>
          )}
        </Card>

        {/* ── CUSTOMER ───────────────────────────────────────────────────── */}
        <Card>
          <SectionLabel>Customer</SectionLabel>

          {selectedCustomer ? (
            <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue rounded-xl mb-2">
              <UserCheck size={18} className="text-blue shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-ink truncate">
                  {`${selectedCustomer.first_name||''} ${selectedCustomer.last_name||''}`.trim() || selectedCustomer.name}
                </p>
                {selectedCustomer.phone && <p className="text-xs text-muted">{selectedCustomer.phone}</p>}
              </div>
              <button type="button"
                onClick={() => { setSelectedCustomer(null); setForm(prev => ({ ...prev, customer_id: '', customer_name: '' })); setCustomerSearch(''); }}
                className="p-1.5 text-muted hover:text-red-500 rounded-lg">
                <X size={16} />
              </button>
            </div>
          ) : (
            <div className="relative" ref={customerDropdownRef}>
              <input
                value={customerSearch}
                onChange={handleCustomerInput}
                placeholder="Search customer by name, phone, or email..."
                className={`w-full rounded-xl border px-3 py-2.5 min-h-[44px] text-[16px] focus:outline-none focus:ring-2 focus:ring-blue ${fieldErrors.customer_id ? 'border-red-400' : 'border-hairline'}`}
              />
              {showCustomerDropdown && (
                <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-card border border-hairline rounded-xl shadow-lg overflow-hidden">
                  {customerResults.map(c => (
                    <button key={c.id||c._id} type="button" onClick={() => selectCustomer(c)}
                      className="w-full text-left px-4 py-3 hover:bg-background text-sm border-b last:border-0 flex items-center justify-between">
                      <span className="font-medium">{`${c.first_name||''} ${c.last_name||''}`.trim() || c.name}</span>
                      {c.phone && <span className="text-muted text-xs">{c.phone}</span>}
                    </button>
                  ))}
                  <button type="button"
                    onClick={() => { setShowCustomerDropdown(false); setQuickCreatePrefill({ first_name: customerSearch, phone: '' }); setShowQuickCreate(true); }}
                    className="w-full text-left px-4 py-3 hover:bg-blue-50 text-sm text-blue font-medium flex items-center gap-2">
                    <UpPlus size={14} /> Create new customer
                  </button>
                </div>
              )}
              {!showCustomerDropdown && customerSearch.length > 1 && !selectedCustomer && (
                <button type="button"
                  onClick={() => { setQuickCreatePrefill({ first_name: customerSearch, phone: '' }); setShowQuickCreate(true); }}
                  className="mt-1.5 text-sm text-blue font-medium flex items-center gap-1 min-h-[36px]">
                  <UpPlus size={14} /> Create new customer
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
                className="flex-1 rounded-xl border border-hairline px-3 py-2.5 min-h-[44px] text-[16px] focus:outline-none focus:ring-2 focus:ring-blue" />
              <button type="button" onClick={() => setExtraPhones(prev => prev.filter((_,i) => i !== idx))}
                className="p-2 text-muted hover:text-red-500 min-w-[44px] flex items-center justify-center"><X size={16} /></button>
            </div>
          ))}
          <button type="button" onClick={() => setExtraPhones(prev => [...prev, ''])}
            className="mt-2 text-sm text-blue font-medium min-h-[36px] flex items-center gap-1">
            <UpPlus size={14} /> Add phone
          </button>

          {/* Extra emails */}
          {extraEmails.map((em, idx) => (
            <div key={idx} className="flex gap-2 mt-2">
              <input type="email" value={em}
                onChange={e => { const a = [...extraEmails]; a[idx] = e.target.value; setExtraEmails(a); }}
                placeholder={`Email ${idx+2}`}
                className="flex-1 rounded-xl border border-hairline px-3 py-2.5 min-h-[44px] text-[16px] focus:outline-none focus:ring-2 focus:ring-blue" />
              <button type="button" onClick={() => setExtraEmails(prev => prev.filter((_,i) => i !== idx))}
                className="p-2 text-muted hover:text-red-500 min-w-[44px] flex items-center justify-center"><X size={16} /></button>
            </div>
          ))}
          <button type="button" onClick={() => setExtraEmails(prev => [...prev, ''])}
            className="mt-2 text-sm text-blue font-medium min-h-[36px] flex items-center gap-1">
            <UpPlus size={14} /> Add email
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
            <label className="block text-sm font-medium text-ink mb-1">Street Address</label>
            <input ref={streetInputRef}
              className="w-full rounded-xl border border-hairline px-3 py-2.5 min-h-[44px] text-[16px] focus:outline-none focus:ring-2 focus:ring-blue"
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
            className="w-full rounded-xl border border-hairline px-3 py-2.5 text-ink text-[16px] placeholder-muted focus:outline-none focus:ring-2 focus:ring-blue resize-none" />
        </Card>

        {/* ── SCHEDULE ───────────────────────────────────────────────────── */}
        <Card>
          <SectionLabel>Schedule</SectionLabel>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Date</label>
              <div className="relative">
                <input type="date" value={form.scheduled_date}
                  onChange={e => setForm(prev => ({ ...prev, scheduled_date: e.target.value }))}
                  className="w-full rounded-xl border border-hairline px-3 py-2.5 min-h-[44px] text-[16px] focus:outline-none focus:ring-2 focus:ring-blue" />
                {form.scheduled_date && (
                  <button type="button" onClick={() => setForm(p => ({ ...p, scheduled_date: '' }))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-ink w-6 h-6 flex items-center justify-center">
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Time</label>
              <div className="relative">
                <input type="time" value={form.scheduled_time}
                  onChange={e => setForm(prev => ({ ...prev, scheduled_time: e.target.value }))}
                  className="w-full rounded-xl border border-hairline px-3 py-2.5 min-h-[44px] text-[16px] focus:outline-none focus:ring-2 focus:ring-blue" />
                {form.scheduled_time && (
                  <button type="button" onClick={() => setForm(p => ({ ...p, scheduled_time: '' }))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-ink w-6 h-6 flex items-center justify-center">
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
            {/* P2.19: optional arrival-window "to" time */}
            <div className="col-span-2">
              <label className="block text-sm font-medium text-ink mb-1">Arrival window end <span className="text-muted font-normal">(optional)</span></label>
              <div className="relative max-w-[calc(50%-0.375rem)]">
                <input type="time" value={form.scheduled_end_time} disabled={!form.scheduled_time}
                  onChange={e => setForm(prev => ({ ...prev, scheduled_end_time: e.target.value }))}
                  className="w-full rounded-xl border border-hairline px-3 py-2.5 min-h-[44px] text-[16px] focus:outline-none focus:ring-2 focus:ring-blue disabled:bg-background disabled:text-muted" />
                {form.scheduled_end_time && (
                  <button type="button" onClick={() => setForm(p => ({ ...p, scheduled_end_time: '' }))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-ink w-6 h-6 flex items-center justify-center">
                    <X size={14} />
                  </button>
                )}
              </div>
              <p className="mt-1 text-xs text-muted">Gives the customer an arrival window (e.g. 8:00 AM – 10:00 AM) instead of an exact time.</p>
            </div>
          </div>
          {schedulePreview && (
            <p className="mt-2 text-sm text-blue font-medium">{schedulePreview}</p>
          )}
        </Card>


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
      <Modal isOpen={pasteModal} onClose={() => { if (!pasteLoading) { setPasteModal(false); setPasteText(''); setPasteError(null); } }}
        title="Paste Job Ticket"
        footer={
          <>
            <Button variant="outlined" disabled={pasteLoading} onClick={() => { setPasteModal(false); setPasteText(''); setPasteError(null); }}>Cancel</Button>
            <Button loading={pasteLoading} disabled={!pasteText.trim()} onClick={handleParseTicket}>Parse with AI</Button>
          </>
        }>
        <div className="space-y-2">
          <p className="text-sm text-muted">Paste any job ticket, email, or work order. AI will extract job details automatically.</p>
          <textarea value={pasteText} onChange={e => setPasteText(e.target.value)} rows={8}
            placeholder="Paste any job ticket text here, emails, screenshots OCR, etc."
            className="w-full rounded-xl border border-hairline px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue resize-none"
            autoFocus />
          {pasteError && (
            <p className="text-sm text-red-600">{pasteError}</p>
          )}
        </div>
      </Modal>

      {/* Duplicate Customer Modal — P2.1l Part B: a NAME-only match (never phone) surfaces
          this choice and DEFAULTS to Create New; dismissing it creates the new customer. */}
      <Modal isOpen={Boolean(duplicateModal)} onClose={createNewFromDuplicate} title="Possible Existing Customer">
        {duplicateModal && (
          <div className="space-y-4">
            <p className="text-sm text-ink">
              A customer with a similar name to <strong>{duplicateModal.parsedName||'this contact'}</strong> already
              exists. We'll create a NEW customer unless this is the same person:
            </p>
            <div className="bg-blue-50 border border-blue rounded-xl p-3">
              <p className="font-semibold text-ink">
                {`${duplicateModal.matched.first_name||''} ${duplicateModal.matched.last_name||''}`.trim() || duplicateModal.matched.name}
              </p>
              {duplicateModal.matched.phone    && <p className="text-sm text-ink">{duplicateModal.matched.phone}</p>}
              {duplicateModal.matched.address  && <p className="text-xs text-muted">{duplicateModal.matched.address}</p>}
            </div>
            <div className="grid grid-cols-1 gap-2">
              <Button onClick={createNewFromDuplicate} className="w-full">
                Create New Customer
              </Button>
              <Button variant="outlined" className="w-full"
                onClick={() => { selectCustomer(duplicateModal.matched); setDuplicateModal(null); showSnack('Using existing customer', 'success'); }}>
                Use This Customer
              </Button>
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
