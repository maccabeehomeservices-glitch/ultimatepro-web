import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import {
  ArrowLeft, Edit, Send, MapPin, Camera, X, ChevronLeft, ChevronRight,
  Plus, ChevronDown, Trash2, Navigation, CheckCircle,
} from 'lucide-react';
import { useGet, useMutation } from '../hooks/useApi';
import { useAuth } from '../hooks/useAuth';
import api, { formatDate, formatTime, jobsApi } from '../lib/api';
import { Card, Badge, Button, Modal, LoadingSpinner, Tabs, Input, Select, Toggle, StepperInput } from '../components/ui';
import { useSnackbar } from '../components/ui/Snackbar';
import { formatInJobZone } from '../lib/timezone';

const JOB_STATUSES = [
  { value: 'unscheduled', label: 'Unscheduled' },
  { value: 'scheduled',   label: 'Scheduled'   },
  { value: 'en_route',    label: 'En Route'     },
  { value: 'in_progress', label: 'In Progress'  },
  { value: 'completed',   label: 'Completed'    },
  { value: 'holding',     label: 'Holding'      },
  { value: 'cancelled',   label: 'Cancelled'    },
];

const STATUS_COLORS = {
  unscheduled: 'bg-gray-500',
  scheduled:   'bg-blue-600',
  en_route:    'bg-indigo-600',
  in_progress: 'bg-amber-500',
  completed:   'bg-green-600',
  holding:     'bg-orange-500',
  cancelled:   'bg-red-500',
  deleted:     'bg-gray-400',
};

const PRIORITY_COLORS = {
  low:    'bg-gray-100 text-gray-600',
  medium: 'bg-blue-100 text-blue-700',
  high:   'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
};

const REMINDER_OPTIONS = [
  { value: '',      label: 'Default' },
  { value: 'email', label: 'Email'   },
  { value: 'sms',   label: 'SMS'     },
  { value: 'both',  label: 'Both'    },
  { value: 'none',  label: 'None'    },
];

const PAYMENT_METHODS = [
  { value: 'cash',        label: 'Cash'        },
  { value: 'check',       label: 'Check'       },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'ach',         label: 'ACH'         },
];

// Mirror Android TechPermissionsSheet (JobScreens.kt:2826-2833): same keys, same labels.
const TECH_PERM_KEYS = [
  ['collect_payments', 'Collect Payments'],
  ['add_notes',        'Add Notes'],
  ['take_photos',      'Take Photos'],
  ['edit_details',     'Edit Job Details'],
  ['cancel_job',       'Cancel Job'],
  ['view_history',     'View Job History'],
];

const tabList = [
  { id: 'details',  label: 'Details'  },
  { id: 'history',  label: 'History'  },
  { id: 'messages', label: 'Messages' },
];

function formatCurrency(v) {
  return '$' + Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function SectionLabel({ children }) {
  return <p className="text-xs font-semibold text-blue uppercase tracking-wider mb-2 mt-4">{children}</p>;
}

function Lightbox({ photos, startIndex, onClose }) {
  const [idx, setIdx] = useState(startIndex);
  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex flex-col items-center justify-center" onClick={onClose}>
      <button onClick={onClose} className="absolute top-4 right-4 text-white p-2"><X size={28} /></button>
      <div className="flex items-center gap-4 w-full px-4" onClick={e => e.stopPropagation()}>
        <button onClick={() => setIdx(i => Math.max(0, i-1))} className="text-white p-2 disabled:opacity-30" disabled={idx===0}>
          <ChevronLeft size={32} />
        </button>
        <img src={photos[idx]?.url || photos[idx]} alt="" className="flex-1 max-h-[70vh] object-contain rounded-xl" />
        <button onClick={() => setIdx(i => Math.min(photos.length-1, i+1))} className="text-white p-2 disabled:opacity-30" disabled={idx===photos.length-1}>
          <ChevronRight size={32} />
        </button>
      </div>
      <p className="text-white/60 text-sm mt-3">{idx+1} / {photos.length}</p>
    </div>
  );
}

export default function JobDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showSnack } = useSnackbar();
  const { data: job, loading, refetch } = useGet(`/jobs/${id}`);
  const { mutate, loading: mutating } = useMutation();
  const { user, can } = useAuth();

  const [activeTab, setActiveTab]           = useState('details');
  const [statusModal, setStatusModal]       = useState(false);
  const [dispatchModal, setDispatchModal]   = useState(false);
  const [sendToModal, setSendToModal]       = useState(false);
  const [depositModal, setDepositModal]     = useState(false);
  const [depositForm, setDepositForm]       = useState({ method: 'cash', amount: '' });
  const [reminderMethod, setReminderMethod] = useState('');

  // Notes
  const [notes, setNotes]           = useState('');
  const [notesSaving, setNotesSaving] = useState(false);

  // Photos
  const [beforePhotos, setBeforePhotos]     = useState([]);
  const [afterPhotos, setAfterPhotos]       = useState([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [lightbox, setLightbox]             = useState(null);
  const beforeInputRef = useRef(null);
  const afterInputRef  = useRef(null);

  // Send To
  const [sendToRecipients, setSendToRecipients] = useState([]);
  const [sendToLoading, setSendToLoading]       = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState(null);
  const [sendMethod, setSendMethod]             = useState('sms');
  const [sendingTo, setSendingTo]               = useState(false);

  // History
  const [jobHistory, setJobHistory]   = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [partnerActing, setPartnerActing]   = useState(false);
  const [histOpen, setHistOpen]   = useState({});
  const [pastJobs, setPastJobs]   = useState([]);
  const [jobEstimates, setJobEstimates] = useState([]);
  const [jobInvoices, setJobInvoices]   = useState([]);
  const [histLoading, setHistLoading]   = useState({});

  // Parts
  const [parts, setParts]           = useState([]);
  const [partsModal, setPartsModal] = useState(false);
  const [partForm, setPartForm]     = useState({ name: '', cost: '', provider: 'company' });
  const [savingPart, setSavingPart] = useState(false);

  // Invoice
  const [jobInvoice, setJobInvoice]         = useState(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [addingToInvoice, setAddingToInvoice] = useState(false);

  // Add line item
  const [addItemModal, setAddItemModal] = useState(false);
  const [pbSearch, setPbSearch]         = useState('');
  const [pbResults, setPbResults]       = useState([]);
  const [pbSearching, setPbSearching]   = useState(false);
  const [newItem, setNewItem]           = useState({ name: '', qty: 1, unit_price: '' });
  const [addingItem, setAddingItem]     = useState(false);
  const pbSearchTimeout = useRef(null);

  // Tech permissions
  const [techPerms, setTechPerms]         = useState(null);
  const [techPermSaving, setTechPermSaving] = useState(false);

  // Complete / delete
  const [showComplete, setShowComplete]     = useState(false);
  const [completionNotes, setCompletionNotes] = useState('');
  const [completing, setCompleting]         = useState(false);
  const [approvingEarnings, setApprovingEarnings] = useState(false);
  // Partner-split form (mirrors Android CompleteJobScreen). Only used when job.agreement_id != null.
  const [partsPaidBy, setPartsPaidBy]             = useState('none');   // sender|receiver|none
  const [partsAmount, setPartsAmount]             = useState('');
  const [paymentCollectedBy, setPaymentCollectedBy] = useState('sender'); // sender|receiver
  const [hasCcFee, setHasCcFee]                   = useState(false);
  const [ccFeeAmount, setCcFeeAmount]             = useState('');
  const [ccFeePaidBy, setCcFeePaidBy]             = useState('split');  // sender|receiver|split
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [arriving, setArriving]             = useState(false);

  // Profit allocation override
  const [showProfitModal, setShowProfitModal]               = useState(false);
  const [profitOverrideEnabled, setProfitOverrideEnabled]   = useState(false);
  const [profitSourcePct, setProfitSourcePct]               = useState('');
  const [profitTechPct, setProfitTechPct]                   = useState('');
  const [profitSubmitting, setProfitSubmitting]             = useState(false);

  // Messages
  const [jobMessages, setJobMessages]   = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [convId, setConvId]             = useState(null);
  const [messageBody, setMessageBody]   = useState('');
  const [sendingMsg, setSendingMsg]     = useState(false);
  const messagesEndRef = useRef(null);

  const jobData = job?.job || job;

  // ── sync notes ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!jobData) return;
    if (jobData.notes != null) setNotes(jobData.notes || '');
  }, [jobData?.id]);

  // ── load before/after photos via /uploads (mirror Android getUploads) ───────
  useEffect(() => { if (id) loadPhotos(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (jobData?.reminder_method != null) setReminderMethod(jobData.reminder_method || '');
  }, [jobData?.reminder_method]);

  useEffect(() => {
    if (!jobData) return;
    // Normalize to Android's 6 keys + editor semantics (JobScreens.kt:2835):
    // view_history default-allow (!== false); all others default-deny (=== true).
    const tp = jobData.tech_permissions || {};
    setTechPerms({
      collect_payments: tp.collect_payments === true,
      add_notes:        tp.add_notes === true,
      take_photos:      tp.take_photos === true,
      edit_details:     tp.edit_details === true,
      cancel_job:       tp.cancel_job === true,
      view_history:     tp.view_history !== false,
    });
  }, [jobData?.id]);

  // ── load job parts ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    jobsApi.getParts(id).then(r => setParts(r.data || [])).catch(() => {});
  }, [id]);

  // ── load job invoice ───────────────────────────────────────────────────────
  async function loadInvoice() {
    if (!id) return;
    setInvoiceLoading(true);
    try {
      const r = await api.get(`/invoices?job_id=${id}&limit=1`);
      const invList = r.data?.invoices || r.data || [];
      setJobInvoice(invList[0] || null);
    } catch { /* ignore transient */ }
    finally { setInvoiceLoading(false); }
  }
  useEffect(() => { loadInvoice(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── load estimates for this job (matches Android JobDetail flow) ──────────
  // Backend GET /api/jobs/:id does not return estimates; fetch separately.
  const [currentJobEstimates, setCurrentJobEstimates] = useState([]);
  useEffect(() => {
    if (!id) return;
    api.get(`/estimates?job_id=${id}`)
      .then(r => {
        const list = r.data?.estimates || r.data || [];
        setCurrentJobEstimates(Array.isArray(list) ? list : []);
      })
      .catch(() => setCurrentJobEstimates([]));
  }, [id]);

  // ── messages ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (activeTab !== 'messages' || !id) return;
    setMessagesLoading(true);
    api.get(`/sms/job/${id}/messages`)
      .then(res => {
        const msgs = res.data?.messages || (Array.isArray(res.data) ? res.data : []);
        setJobMessages(msgs);
        // Mirror Android: derive convId from the first message object (the bare-array
        // response carries no top-level conversation_id). Empty thread → null → composer hidden.
        setConvId(msgs[0]?.conversation_id ?? null);
      })
      .catch(() => setJobMessages([]))
      .finally(() => setMessagesLoading(false));
  }, [activeTab, id]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [jobMessages.length]);

  // ── send-to recipients (P2.36: ALL assignable — self, team, roster, partners) ──
  useEffect(() => {
    if (!sendToModal || !jobData) return;
    setSendToLoading(true);
    const recipients = [];
    // Self first — an owner/dispatcher can send the job to their own phone/email.
    if (user?.id) recipients.push({
      id: user.id, name: `${`${user.first_name || ''} ${user.last_name || ''}`.trim() || 'You'} (You)`,
      type: 'app_user', phone: user.phone || null, email: user.email || null,
    });
    Promise.allSettled([
      api.get('/users'),
      api.get('/roster-techs'),
      api.get('/network/connections/active-simple'),
    ]).then(([usersR, rosterR, partnersR]) => {
      const users = usersR.status === 'fulfilled' ? (usersR.value.data?.users || usersR.value.data || []) : [];
      users.filter(u => u.id !== user?.id).forEach(u => recipients.push({
        id: u.id, name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'Team member',
        type: 'app_user', phone: u.phone || null, email: u.email || null,
      }));
      const roster = rosterR.status === 'fulfilled' ? (rosterR.value.data?.roster_techs || rosterR.value.data || []) : [];
      roster.forEach(t => recipients.push({ id: t.id, name: t.name, type: 'roster_tech', phone: t.phone || null, email: t.email || null }));
      const partners = partnersR.status === 'fulfilled' ? (partnersR.value.data || []) : [];
      partners.forEach(c => recipients.push({ id: c.partner_id, name: c.partner_name, type: 'partner', connection_id: c.connection_id }));
      setSendToRecipients(recipients);
    }).catch(() => setSendToRecipients(recipients))
      .finally(() => setSendToLoading(false));
  }, [sendToModal]);

  // ── handlers ───────────────────────────────────────────────────────────────
  async function handlePartnerStatus(action) {
    setPartnerActing(true);
    try {
      await api.post(`/jobs/${id}/confirm-partner-status`, { action });
      showSnack('Status updated', 'success');
      refetch();
    } catch { showSnack('Failed to update status', 'error'); }
    finally { setPartnerActing(false); }
  }

  function handlePbSearch(val) {
    setPbSearch(val);
    clearTimeout(pbSearchTimeout.current);
    if (!val.trim()) { setPbResults([]); return; }
    setPbSearching(true);
    pbSearchTimeout.current = setTimeout(async () => {
      try {
        const res = await api.get(`/pricebook/items?search=${encodeURIComponent(val)}&limit=10`);
        setPbResults(res.data?.items || res.data || []);
      } catch { setPbResults([]); }
      finally { setPbSearching(false); }
    }, 300);
  }

  function selectPbItem(item) {
    setNewItem({ name: item.name, qty: 1, unit_price: item.unit_price || item.price || '' });
    setPbSearch(item.name);
    setPbResults([]);
  }

  async function handleAddLineItem() {
    if (!newItem.name.trim()) { showSnack('Item name required', 'error'); return; }
    if (!jobInvoice?.id) { showSnack('No invoice exists for this job. Create one first.', 'error'); return; }
    setAddingItem(true);
    try {
      const current = jobInvoice.line_items || [];
      const updated = [...current, {
        name: newItem.name,
        quantity: newItem.qty,
        unit_price: Number(newItem.unit_price) || 0,
        total: (Number(newItem.unit_price) || 0) * newItem.qty,
        item_type: 'service',
      }];
      await api.put(`/invoices/${jobInvoice.id}`, { line_items: updated });
      showSnack('Item added', 'success');
      setAddItemModal(false);
      setNewItem({ name: '', qty: 1, unit_price: '' });
      setPbSearch(''); setPbResults([]);
      refetch();
    } catch { showSnack('Failed to add item', 'error'); }
    finally { setAddingItem(false); }
  }

  async function handleTechPermToggle(key, value) {
    const updated = { ...techPerms, [key]: value };
    setTechPerms(updated);
    setTechPermSaving(true);
    try {
      await jobsApi.update(id, { tech_permissions: updated });
      showSnack('Saved', 'success');
      refetch();  // so canViewHistory + other gates reflect the change
    } catch {
      setTechPerms(prev => ({ ...prev, [key]: !value }));
      showSnack('Failed to save', 'error');
    } finally { setTechPermSaving(false); }
  }

  async function toggleHistSection(section) {
    const isOpening = !histOpen[section];
    setHistOpen(prev => ({ ...prev, [section]: isOpening }));
    if (!isOpening || histLoading[section]) return;
    setHistLoading(prev => ({ ...prev, [section]: true }));
    try {
      if (['past_jobs','estimates','invoices'].includes(section) && jobData?.customer_id) {
        const res = await api.get(`/customers/${jobData.customer_id}/history`, { params: { exclude_job_id: id } });
        const hist = res.data || {};
        setPastJobs(hist.jobs || []);
        setJobEstimates(hist.estimates || []);
        setJobInvoices(hist.invoices || []);
      }
    } catch {}
    finally { setHistLoading(prev => ({ ...prev, [section]: false })); }
  }


  async function handleCompleteJob() {
    setCompleting(true);
    try {
      // Mirror Android: partner jobs send the split form, non-partner jobs send notes only.
      // payment_method dropped (it was never read by the backend).
      const isPartner = jobData?.agreement_id != null;
      const body = isPartner
        ? {
            parts_paid_by: partsPaidBy,
            parts_amount: partsPaidBy === 'none' ? 0 : (Number(partsAmount) || 0),
            payment_collected_by: paymentCollectedBy,
            cc_fee_amount: hasCcFee ? (Number(ccFeeAmount) || 0) : 0,
            cc_fee_paid_by: ccFeePaidBy,
            ...(completionNotes ? { notes: completionNotes } : {}),
          }
        : (completionNotes ? { notes: completionNotes } : {});
      await jobsApi.complete(id, body);
      setShowComplete(false);
      showSnack('Job completed!', 'success');
      refetch();
    } catch (err) { showSnack(err.response?.data?.error || 'Failed to complete job', 'error'); }
    finally { setCompleting(false); }
  }

  async function handleApproveEarnings() {
    setApprovingEarnings(true);
    try {
      await jobsApi.approveEarnings(id);
      showSnack('Earnings approved', 'success');
      refetch();
    } catch (err) { showSnack(err.response?.data?.error || 'Failed to approve earnings', 'error'); }
    finally { setApprovingEarnings(false); }
  }

  async function handleRestoreJob() {
    try {
      await jobsApi.restore(id);
      showSnack('Job restored!', 'success');
      refetch();
    } catch (err) { showSnack(err.response?.data?.error || 'Failed to restore job', 'error'); }
  }

  async function handleDeleteJob() {
    try {
      await jobsApi.delete(id);
      showSnack('Job archived', 'success');
      navigate('/jobs');
    } catch (err) { showSnack(err.response?.data?.error || 'Failed to delete job', 'error'); }
    setShowDeleteConfirm(false);
  }

  async function handleStatusChange(status) {
    // Mirror Android: "Completed" routes through the Complete flow (/complete), never /status.
    // This applies the >100% guard + partner split + job_completion_details that /status skips.
    if (status === 'completed') {
      setStatusModal(false);
      setShowComplete(true);
      return;
    }
    try {
      await mutate('post', `/jobs/${id}/status`, { status });
      setStatusModal(false);
      refetch();
      showSnack('Status updated', 'success');
    } catch { showSnack('Failed to update status', 'error'); }
  }

  function handleCreateEstimate() {
    const params = new URLSearchParams();
    params.set('job_id', id);
    if (jobData?.customer_id) params.set('customer_id', jobData.customer_id);
    navigate(`/estimates/new?${params.toString()}`);
  }

  async function handleDispatch() {
    // Send the dispatcher's REAL location for a real ETA when available; if
    // geolocation is denied/unavailable (e.g. an office desktop), omit it — the
    // backend skips the ETA gracefully. Don't send fake 0,0 (it's the ocean).
    const getCoords = () => new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ tech_lat: pos.coords.latitude, tech_lng: pos.coords.longitude }),
        () => resolve(null),
        { timeout: 5000, maximumAge: 60000 }
      );
    });
    try {
      const coords = await getCoords();
      const res = await mutate('post', `/jobs/${id}/dispatch`, coords || {});
      setDispatchModal(false);
      refetch();
      const eta = res?.eta || res?.data?.eta;
      showSnack(eta ? `Customer notified. ETA: ${eta}` : 'Tech dispatched', 'success');
    } catch { showSnack('Failed to dispatch', 'error'); }
  }

  async function handleArrived() {
    setArriving(true);
    try {
      await jobsApi.arrived(id);
      showSnack('Arrival notified', 'success');
      refetch();
    } catch (err) { showSnack(err?.response?.data?.error || 'Failed to notify arrival', 'error'); }
    finally { setArriving(false); }
  }

  async function handleSendTo() {
    if (!selectedRecipient) return;
    setSendingTo(true);
    try {
      if (selectedRecipient.type === 'partner') {
        await api.post(`/jobs/${id}/send-to-partner`, {
          partner_company_id: selectedRecipient.id,
          connection_id: selectedRecipient.connection_id,
          notes: '',
          tech_permissions: {
            add_notes: true, collect_payments: true, take_photos: true,
            add_parts: false, edit_details: false, cancel_job: false, view_history: true,
          },
        });
        showSnack(`Job sent to ${selectedRecipient.name}`, 'success');
        refetch();
      } else {
        await api.post('/roster-techs/notify-tech', { job_id: id, tech_id: selectedRecipient.id, tech_type: selectedRecipient.type, method: sendMethod });
        showSnack(`Sent to ${selectedRecipient.name}`, 'success');
      }
      setSendToModal(false);
      setSelectedRecipient(null);
    } catch { showSnack('Failed to send', 'error'); }
    finally { setSendingTo(false); }
  }

  // Charge payment against the job's invoice (POST /invoices/:id/payment). Distinct from the
  // estimate collect-deposit feature — this records a real payment, updates balance/status, ledger.
  async function handleChargePayment() {
    if (!jobInvoice?.id) { showSnack('No invoice to charge — use Add to Invoice first.', 'error'); return; }
    try {
      await mutate('post', `/invoices/${jobInvoice.id}/payment`, {
        method: depositForm.method,
        amount: Number(depositForm.amount),
      });
      setDepositModal(false);
      refetch();
      await loadInvoice();  // reflect new balance/status
      showSnack('Payment recorded', 'success');
    } catch { showSnack('Failed to record payment', 'error'); }
  }

  async function handleReminderChange(e) {
    const method = e.target.value;
    setReminderMethod(method);
    try { await api.patch(`/jobs/${id}/reminder-method`, { reminder_method: method || 'default' }); } catch {}
  }

  async function handleNotesBlur() {
    if (!jobData || notes === (jobData.notes || '')) return;
    setNotesSaving(true);
    try {
      await jobsApi.update(id, { notes });
      showSnack('Notes saved', 'success');
    } catch { showSnack('Failed to save notes', 'error'); }
    finally { setNotesSaving(false); }
  }

  // Load before/after photos from /uploads (mirror Android getUploads: query params + purpose).
  async function loadPhotos() {
    try {
      const [b, a] = await Promise.all([
        api.get('/uploads', { params: { entity_type: 'job', entity_id: id, purpose: 'before_photo' } }),
        api.get('/uploads', { params: { entity_type: 'job', entity_id: id, purpose: 'after_photo' } }),
      ]);
      setBeforePhotos(b.data || []);
      setAfterPhotos(a.data || []);
    } catch { /* keep prior on transient error */ }
  }

  async function handlePhotoUpload(e, type) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      // Mirror Android: file as multipart "file"; entity/purpose as QUERY params (uploads.js reads req.query).
      // purpose: 'before' → 'before_photo', 'after' → 'after_photo'. No /jobs/:id/photos.
      const formData = new FormData();
      formData.append('file', file);
      await api.post('/uploads', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        params: { entity_type: 'job', entity_id: id, purpose: `${type}_photo` },
      });
      await loadPhotos();
      showSnack('Photo uploaded', 'success');
    } catch (err) { showSnack(err?.response?.data?.error || 'Failed to upload photo', 'error'); }
    finally { setUploadingPhoto(false); e.target.value = ''; }
  }

  async function handleSendMessage(e) {
    e.preventDefault();
    if (!messageBody.trim() || !convId) return;
    setSendingMsg(true);
    try {
      await api.post(`/sms/conversations/${convId}/send`, { message: messageBody });
      setMessageBody('');
      const res = await api.get(`/sms/job/${id}/messages`);
      setJobMessages(res.data?.messages || (Array.isArray(res.data) ? res.data : []));
    } catch { showSnack('Failed to send message', 'error'); }
    finally { setSendingMsg(false); }
  }

  // Parts handlers
  async function handleSavePart() {
    if (!partForm.name.trim()) { showSnack('Part name required', 'error'); return; }
    setSavingPart(true);
    try {
      const r = await jobsApi.savePart(id, { name: partForm.name.trim(), cost: Number(partForm.cost)||0, provider: partForm.provider });
      setParts(prev => [...prev, r.data]);
      setPartsModal(false);
      setPartForm({ name: '', cost: '', provider: 'company' });
      showSnack('Part added', 'success');
    } catch { showSnack('Failed to add part', 'error'); }
    finally { setSavingPart(false); }
  }

  async function handleDeletePart(partId) {
    try {
      await jobsApi.deletePart(id, partId);
      setParts(prev => prev.filter(p => p.id !== partId));
      showSnack('Part removed', 'success');
    } catch { showSnack('Failed to remove part', 'error'); }
  }

  // Add to invoice — auto-create blank draft if none exists
  async function handleAddToInvoice() {
    setAddingToInvoice(true);
    try {
      if (!jobInvoice) {
        const r = await api.post('/invoices', {
          customer_id: jobData.customer_id,
          job_id: id,
          line_items: [],
        });
        const inv = r.data?.invoice || r.data;
        setJobInvoice(inv);
        navigate(`/invoices/${inv.id}`);
      } else {
        navigate(`/invoices/${jobInvoice.id}`);
      }
    } catch { showSnack('Failed to create invoice', 'error'); }
    finally { setAddingToInvoice(false); }
  }

  function handleSendReceipt() {
    if (!jobInvoice?.id) { showSnack('No invoice found. Create an invoice first.', 'error'); return; }
    navigate(`/invoices/${jobInvoice.id}`, { state: { openReceipt: true } });
  }

  async function handleCancelJob() {
    try {
      await mutate('post', `/jobs/${id}/status`, { status: 'cancelled' });
      showSnack('Job cancelled', 'success');
      refetch();
    } catch { showSnack('Failed to cancel job', 'error'); }
  }

  function handleNavigate() {
    const addr = jobData?.address || jobData?.service_address || '';
    if (!addr) return;
    window.open('https://maps.google.com/?q=' + encodeURIComponent(addr), '_blank');
  }

  if (loading) return <LoadingSpinner fullPage />;
  if (!jobData) return <div className="p-4 text-muted">Job not found.</div>;

  function openProfitModal() {
    setProfitOverrideEnabled(jobData?.profit_override === true);
    setProfitSourcePct(
      jobData?.override_source_pct != null ? String(jobData.override_source_pct) : ''
    );
    setProfitTechPct(
      jobData?.override_tech_pct != null ? String(jobData.override_tech_pct) : ''
    );
    setShowProfitModal(true);
  }

  async function handleSaveProfitOverride() {
    setProfitSubmitting(true);
    try {
      const body = { profit_override: profitOverrideEnabled };
      if (profitOverrideEnabled) {
        const src = parseFloat(profitSourcePct);
        const tech = parseFloat(profitTechPct);
        if (isNaN(src) || isNaN(tech)) {
          showSnack('Both percentages required when override is on', 'error');
          setProfitSubmitting(false);
          return;
        }
        body.override_source_pct = src;
        body.override_tech_pct = tech;
      }
      await jobsApi.update(id, body);
      showSnack('Profit allocation saved', 'success');
      setShowProfitModal(false);
      refetch();
    } catch (err) {
      showSnack(err?.response?.data?.error || 'Failed to save profit allocation', 'error');
    } finally {
      setProfitSubmitting(false);
    }
  }

  const overrideSum = (parseFloat(profitSourcePct) || 0) + (parseFloat(profitTechPct) || 0);
  const isOverrideConflict = profitOverrideEnabled && overrideSum > 100;

  const isDeletedOrCancelled = ['deleted','cancelled'].includes(jobData.status);
  const hasDeposit   = jobData.deposit_required && !jobData.deposit_collected;
  const address      = jobData.address || jobData.service_address || '';
  const lineItems    = jobData.line_items || jobData.charges || [];
  const lineItemsTotal = lineItems.reduce((s, item) => s + Number(item.total || item.amount || 0), 0);
  const statusColor  = STATUS_COLORS[jobData.status] || 'bg-gray-500';
  const priorityLabel = jobData.priority ? (jobData.priority.charAt(0).toUpperCase() + jobData.priority.slice(1)) : null;
  const priorityStyle = PRIORITY_COLORS[jobData.priority] || 'bg-gray-100 text-gray-600';

  // ── History role-gate (mirrors Android JobScreens.kt:1437-1438) ──
  // isTech = role not in [owner, admin, manager]; default-allow unless view_history is explicitly false.
  const isTech = !['owner', 'admin', 'manager'].includes(user?.role);
  const canViewHistory = !isTech || jobData.tech_permissions?.view_history !== false;
  const visibleTabs = canViewHistory ? tabList : tabList.filter(t => t.id !== 'history');

  // ── Earnings-approval capability (mirrors backend canApproveEarnings) ──
  // Frames an "approve earnings" capability that maps to owner/admin today; this is
  // the web-side seam for the future per-actor permission. Non-approvers still see the
  // pending badge (informational) but get no button.
  const earningsPendingReview = jobData.review_status === 'pending_review';
  const canApproveEarnings = ['owner', 'admin'].includes(user?.role);

  // ── Complete-Job partner split + live calc (mirrors Android CompleteJobScreen 2999-3010) ──
  const isPartnerJob   = jobData.agreement_id != null;
  const calcGross      = Number(jobInvoice?.total || 0);
  const calcParts      = partsPaidBy === 'none' ? 0 : (Number(partsAmount) || 0);
  const calcCc         = hasCcFee ? (Number(ccFeeAmount) || 0) : 0;
  const calcNet        = calcGross - calcParts - calcCc;
  const senderPct      = Number(jobData.sender_keeps_pct || 0);
  const receiverPct    = Number(jobData.receiver_keeps_pct || 0);
  let   calcSender     = calcNet * (senderPct / 100);
  let   calcReceiver   = calcNet * (receiverPct / 100);
  if (hasCcFee) {
    if      (ccFeePaidBy === 'split')    { calcSender -= calcCc / 2; calcReceiver -= calcCc / 2; }
    else if (ccFeePaidBy === 'sender')   { calcSender -= calcCc; }
    else if (ccFeePaidBy === 'receiver') { calcReceiver -= calcCc; }
  }

  return (
    <div className="p-4 max-w-3xl mx-auto pb-8">

      {/* ── Section 1: Top Bar ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3 flex-wrap flex-1 min-w-0">
          <button onClick={() => navigate(-1)}
            className="p-2 -ml-2 rounded-xl hover:bg-background min-h-[44px] min-w-[44px] flex items-center justify-center text-ink">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-bold text-ink">
            #{jobData.job_number || jobData.id?.slice(0,8)}
          </h1>
          {/* Status badge */}
          <button onClick={() => setStatusModal(true)}
            className={`${statusColor} text-white text-xs font-bold px-3 py-1.5 rounded-full min-h-[36px] uppercase`}>
            {(jobData.status||'').replace(/_/g,' ')}
          </button>
          {/* Priority chip */}
          {priorityLabel && jobData.priority !== 'none' && (
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${priorityStyle}`}>
              {priorityLabel}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Dispatch icon — only when unscheduled or scheduled */}
          {['unscheduled', 'scheduled'].includes(jobData.status) && (
            <button onClick={() => setDispatchModal(true)} title="Dispatch"
              className="p-2 rounded-xl hover:bg-blue-50 min-h-[44px] min-w-[44px] flex items-center justify-center text-blue">
              <Navigation size={18} />
            </button>
          )}
          {/* Arrived icon — when en_route */}
          {jobData.status === 'en_route' && (
            <button onClick={handleArrived} disabled={arriving} title="Mark Arrived"
              className="p-2 rounded-xl hover:bg-green-50 min-h-[44px] min-w-[44px] flex items-center justify-center text-green-600 disabled:opacity-50">
              <CheckCircle size={18} />
            </button>
          )}
          {/* Edit */}
          <button onClick={() => navigate(`/jobs/${id}/edit`)}
            className="p-2 rounded-xl hover:bg-background min-h-[44px] min-w-[44px] flex items-center justify-center text-ink">
            <Edit size={20} />
          </button>
          {/* Delete */}
          {jobData.status !== 'deleted' && can('jobs','full') && (
            <button onClick={() => setShowDeleteConfirm(true)}
              className="p-2 rounded-xl hover:bg-red-50 min-h-[44px] min-w-[44px] flex items-center justify-center text-red-500">
              <Trash2 size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Earnings pending-review banner (gate). Approvers (owner/admin) get the
          release button; everyone else sees it as informational. */}
      {earningsPendingReview && (
        <div className="mb-3 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-orange-800">Earnings pending review</p>
            <p className="text-xs text-orange-700 mt-0.5">
              This job was completed by a team member. Earnings are held until an owner or admin approves them.
            </p>
          </div>
          {canApproveEarnings && (
            <button onClick={handleApproveEarnings} disabled={approvingEarnings}
              className="shrink-0 bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold px-4 rounded-xl min-h-[44px] disabled:opacity-50">
              {approvingEarnings ? 'Approving…' : 'Approve Earnings'}
            </button>
          )}
        </div>
      )}

      {/* Partner banners */}
      {jobData.sent_to_company_id && (
        <div className="mb-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
          <p className="text-sm font-semibold text-blue-800">Sent to: {jobData.sent_to_company_name || 'Partner Company'}</p>
          <p className="text-xs text-blue-600">This job was forwarded to a network partner</p>
          {/* P2.31a: the receiver's proposed status change lands in partner_status; the sender
              confirms (applies it + confirms the settlement) or disputes (clears + notes). */}
          {jobData.partner_status && (
            <div className="mt-2">
              <p className="text-xs text-blue-700 mb-1">Partner marked this <strong>{jobData.partner_status}</strong> — review:</p>
              <div className="flex gap-2">
                <button onClick={() => handlePartnerStatus('confirm')} disabled={partnerActing}
                  className="text-xs px-3 py-1.5 rounded-lg border border-green-500 text-green-700 font-medium min-h-[32px] hover:bg-green-50 disabled:opacity-50">Confirm</button>
                <button onClick={() => handlePartnerStatus('dispute')} disabled={partnerActing}
                  className="text-xs px-3 py-1.5 rounded-lg border border-red-400 text-red-600 font-medium min-h-[32px] hover:bg-red-50 disabled:opacity-50">Dispute</button>
              </div>
            </div>
          )}
        </div>
      )}
      {jobData.sent_by_company_id && (
        <div className="mb-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
          <p className="text-sm font-semibold text-green-800">Received from: {jobData.sent_by_company_name || 'Partner Company'}</p>
          <p className="text-xs text-green-600">This job was sent by a network partner</p>
        </div>
      )}
      {jobData.membership_id && (
        <div className="mb-3 bg-amber-50 border border-amber-300 rounded-xl px-4 py-3">
          <p className="text-sm font-semibold text-amber-800">Membership: {jobData.membership_name || 'Active Member'}</p>
          <p className="text-xs text-amber-600">Customer has an active membership plan</p>
        </div>
      )}

      {/* ── Section 2: Tabs ────────────────────────────────────────────────── */}
      <Tabs tabs={visibleTabs} active={activeTab} onChange={setActiveTab} />

      <div className="mt-4 space-y-4">

        {/* ─── DETAILS TAB ──────────────────────────────────────────────────── */}
        {activeTab === 'details' && (
          <>
            {/* Section 3: Compact reminder + schedule row */}
            <Card>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 flex-1 min-w-[180px]">
                  <span className="text-base">🔔</span>
                  <select value={reminderMethod} onChange={handleReminderChange}
                    className="flex-1 rounded-xl border border-hairline px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue bg-card min-h-[36px]">
                    {REMINDER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-2 flex-1 min-w-[180px]">
                  <span className="text-base">📅</span>
                  {jobData.scheduled_start ? (
                    <span className="text-sm text-ink font-medium">
                      {formatInJobZone(jobData.scheduled_start, jobData, 'MMM d, yyyy')}{' '}
                      {/* P2.19: arrival window when a distinct end is present */}
                      {jobData.scheduled_end && jobData.scheduled_end !== jobData.scheduled_start
                        ? `${formatInJobZone(jobData.scheduled_start, jobData, 'h:mm a')} – ${formatInJobZone(jobData.scheduled_end, jobData, 'h:mm a zzz')}`
                        : formatInJobZone(jobData.scheduled_start, jobData, 'h:mm a zzz')}
                    </span>
                  ) : (
                    <span className="text-sm text-muted">Not scheduled</span>
                  )}
                </div>
              </div>
            </Card>

            {/* Section 4: Compact source | type | assigned row */}
            <Card>
              <div className="flex items-center gap-1 divide-x divide-hairline">
                <button onClick={() => navigate(`/jobs/${id}/edit`)}
                  className="flex-1 text-center py-2 min-h-[44px] hover:bg-background rounded-l-xl">
                  <p className="text-[10px] text-muted uppercase font-semibold">Source</p>
                  <p className="text-xs font-medium text-ink truncate px-1">
                    {jobData.job_source_name || jobData.ad_channel_name || 'My Company'}
                  </p>
                </button>
                <button onClick={() => navigate(`/jobs/${id}/edit`)}
                  className="flex-1 text-center py-2 min-h-[44px] hover:bg-background">
                  <p className="text-[10px] text-muted uppercase font-semibold">Type</p>
                  <p className="text-xs font-medium text-ink truncate px-1">
                    {jobData.type ? (jobData.type.charAt(0).toUpperCase() + jobData.type.slice(1)) : '—'}
                  </p>
                </button>
                <button onClick={() => navigate(`/jobs/${id}/edit`)}
                  className="flex-1 text-center py-2 min-h-[44px] hover:bg-background rounded-r-xl">
                  <p className="text-[10px] text-muted uppercase font-semibold">Assigned</p>
                  <p className="text-xs font-medium text-ink truncate px-1">
                    {(jobData.tech_first || jobData.tech_last)
                      ? `${jobData.tech_first || ''} ${jobData.tech_last || ''}`.trim()
                      : jobData.roster_tech_name || 'Unassigned'}
                  </p>
                </button>
              </div>
            </Card>

            {/* Section 5: Customer */}
            {(jobData.customer_id || jobData.customer) && (
              <Card>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold text-blue uppercase tracking-wider">Customer</h3>
                  <button onClick={() => navigate(`/customers/${jobData.customer_id || jobData.customer?.id}`)}
                    className="text-sm text-blue font-medium min-h-[36px] px-2">
                    View
                  </button>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-muted text-sm">👤</span>
                    <span className="text-sm font-medium text-ink">
                      {[jobData.cust_first, jobData.cust_last].filter(Boolean).join(' ') || '—'}
                    </span>
                  </div>
                  {jobData.cust_phone && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-muted text-sm">📱</span>
                        <span className="text-sm text-ink">{jobData.cust_phone}</span>
                      </div>
                      <a href={`tel:${jobData.cust_phone}`} className="text-blue text-lg min-h-[36px] flex items-center">📞</a>
                    </div>
                  )}
                  {jobData.cust_phone2 && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-muted text-sm">📱</span>
                        <span className="text-sm text-ink">{jobData.cust_phone2}</span>
                      </div>
                      <a href={`tel:${jobData.cust_phone2}`} className="text-blue text-lg min-h-[36px] flex items-center">📞</a>
                    </div>
                  )}
                  {jobData.cust_email && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-muted text-sm">✉️</span>
                        <span className="text-sm text-ink">{jobData.cust_email}</span>
                      </div>
                      <a href={`mailto:${jobData.cust_email}`} className="text-blue text-lg min-h-[36px] flex items-center">📧</a>
                    </div>
                  )}
                  {jobData.cust_address && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted text-sm">📍</span>
                      <span className="text-sm text-ink">
                        {jobData.cust_address}
                        {jobData.cust_city ? `, ${jobData.cust_city}` : ''}
                        {jobData.cust_state ? `, ${jobData.cust_state}` : ''}
                        {jobData.cust_zip ? ` ${jobData.cust_zip}` : ''}
                      </span>
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* Section 6: Job Site */}
            {address && (
              <Card>
                {jobData.address_verified === false && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2 mb-3">
                    <span className="text-amber-500 text-lg shrink-0">⚠️</span>
                    <div>
                      <div className="text-sm font-semibold text-amber-800">Address may be inaccurate</div>
                      <div className="text-xs text-amber-600">Please verify and re-save to update coordinates.</div>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-3">
                  <MapPin size={18} className="text-blue mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted font-medium uppercase mb-0.5">Job Site</p>
                    <p className="text-sm text-ink">
                      {address}
                      {jobData.city ? `, ${jobData.city}` : ''}
                      {jobData.state ? `, ${jobData.state}` : ''}
                      {jobData.zip ? ` ${jobData.zip}` : ''}
                    </p>
                  </div>
                  <button onClick={handleNavigate}
                    className="text-sm text-blue font-semibold min-h-[44px] flex items-center px-2">
                    Navigate
                  </button>
                </div>
              </Card>
            )}

            {/* Section 7: Notes */}
            <div>
              <SectionLabel>Notes {notesSaving && <span className="text-blue ml-1">saving...</span>}</SectionLabel>
              <Card>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} onBlur={handleNotesBlur}
                  placeholder="Add job notes..." rows={4}
                  className="w-full text-sm text-ink resize-none focus:outline-none bg-transparent placeholder-muted" />
              </Card>
            </div>

            {/* Section 8: Send to Tech */}
            {!isDeletedOrCancelled && (
              <Button variant="outlined" onClick={() => setSendToModal(true)} className="w-full">
                📤 Send to Tech
              </Button>
            )}

            {/* Section 9: Estimates */}
            <div>
              <SectionLabel>Estimates</SectionLabel>
              <div className="flex gap-2 mb-2">
                <Button variant="outlined" onClick={handleCreateEstimate} loading={mutating} className="flex-1">
                  + Create Estimate
                </Button>
              </div>
              {currentJobEstimates.length > 0 && (
                <Card>
                  <div className="space-y-2">
                    {currentJobEstimates.map(e => (
                      <button key={e.id} onClick={() => navigate(`/estimates/${e.id}`)}
                        className="w-full flex items-center justify-between text-left py-2 hover:bg-background rounded-lg px-1">
                        <div>
                          <p className="text-sm font-medium text-ink">{e.estimate_number || `EST-${e.id?.slice(0,6)}`}</p>
                          <p className="text-xs text-muted">{formatCurrency(e.total)}</p>
                        </div>
                        <Badge status={e.status} label={e.status} />
                      </button>
                    ))}
                  </div>
                </Card>
              )}
            </div>

            {/* Section 10: Invoice */}
            <div>
              <SectionLabel>Invoice</SectionLabel>
              <Button onClick={handleAddToInvoice} loading={addingToInvoice} className="w-full mb-2">
                {jobInvoice ? 'View Invoice' : '+ Add to Invoice'}
              </Button>
              {invoiceLoading && <LoadingSpinner />}
              {jobInvoice && (
                <Card>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-ink">{jobInvoice.invoice_number || `INV-${jobInvoice.id?.slice(0,6)}`}</p>
                    <Badge status={jobInvoice.status} label={jobInvoice.status} />
                  </div>
                  {(jobInvoice.line_items || []).map((item, i) => (
                    <div key={i} className="flex items-start gap-3 py-2 border-b border-hairline last:border-b-0">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt=""
                          className="w-12 h-12 object-cover rounded-lg flex-shrink-0 bg-background"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-background rounded-lg flex-shrink-0 flex items-center justify-center text-gray-300 text-sm">
                          📦
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-ink truncate">{item.name || '(unnamed)'}</p>
                        {item.description && (
                          <p className="text-xs text-muted line-clamp-2">{item.description}</p>
                        )}
                        <div className="flex items-center gap-2 text-xs text-muted mt-0.5">
                          {item.sku && <span>SKU: {item.sku}</span>}
                          {item.sku && <span>·</span>}
                          <span>{item.quantity || item.qty || 1} × {formatCurrency(item.unit_price || item.price || 0)}</span>
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-ink flex-shrink-0 self-center">
                        {formatCurrency(item.total || item.amount || ((item.quantity || item.qty || 1) * (item.unit_price || item.price || 0)))}
                      </span>
                    </div>
                  ))}
                  {(jobInvoice.line_items || []).length > 0 && (
                    <div className="border-t border-hairline pt-2 mt-1 flex justify-between text-sm font-bold">
                      <span>Total</span>
                      <span>{formatCurrency(jobInvoice.total)}</span>
                    </div>
                  )}
                </Card>
              )}
            </div>

            {/* Section 10b: Profit Allocation */}
            <div>
              <SectionLabel>Profit Allocation</SectionLabel>
              <Card>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-ink">
                      {jobData?.profit_override ? 'Custom split' : 'Default split'}
                    </div>
                    {jobData?.profit_override
                      && jobData?.override_source_pct != null
                      && jobData?.override_tech_pct != null ? (
                      (() => {
                        const src = parseFloat(jobData.override_source_pct);
                        const tech = parseFloat(jobData.override_tech_pct);
                        const sum = src + tech;
                        const fmt = (n) => n.toFixed(2).replace(/\.00$/, '');
                        if (sum > 100) {
                          return (
                            <div className="text-xs text-red-600 mt-1 font-medium">
                              Source {fmt(src)}% + Tech {fmt(tech)}% = {fmt(sum)}% (exceeds 100%). Adjust before completing.
                            </div>
                          );
                        }
                        return (
                          <div className="text-xs text-muted mt-1">
                            Source {fmt(src)}%
                            {' · '}Tech {fmt(tech)}%
                            {' · '}Company {fmt(100 - sum)}%
                          </div>
                        );
                      })()
                    ) : (
                      <div className="text-xs text-muted mt-1">
                        From source + tech defaults
                      </div>
                    )}
                  </div>
                  <Button variant="outlined" onClick={openProfitModal}>Edit</Button>
                </div>
              </Card>
            </div>

            {/* Section 11: Before / After photos — card with bordered boxes (FIX 6) */}
            <Card>
              <h3 className="text-xs font-semibold text-blue uppercase tracking-wider mb-3">Photos</h3>
              <div className="grid grid-cols-2 gap-4">
                {/* Before box */}
                <div className="border border-hairline rounded-xl p-3 min-h-[120px]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-muted uppercase">Before</span>
                    <button onClick={() => beforeInputRef.current?.click()} disabled={uploadingPhoto}
                      className="text-blue min-h-[32px] flex items-center">
                      <Camera size={14} />
                    </button>
                  </div>
                  <input ref={beforeInputRef} type="file" accept="image/*" className="hidden"
                    onChange={e => handlePhotoUpload(e, 'before')} />
                  <div className="flex flex-wrap gap-2">
                    {beforePhotos.length > 0 ? (
                      beforePhotos.slice(0,3).map((photo, i) => (
                        <button key={i} onClick={() => setLightbox({ photos: beforePhotos, index: i })}>
                          <img src={photo?.url || photo} alt="" className="w-16 h-16 object-cover rounded-lg" />
                        </button>
                      ))
                    ) : (
                      <p className="text-xs text-muted text-center w-full py-4">No before photos</p>
                    )}
                  </div>
                </div>

                {/* After box */}
                <div className="border border-hairline rounded-xl p-3 min-h-[120px]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-muted uppercase">After</span>
                    <button onClick={() => afterInputRef.current?.click()} disabled={uploadingPhoto}
                      className="text-blue min-h-[32px] flex items-center">
                      <Camera size={14} />
                    </button>
                  </div>
                  <input ref={afterInputRef} type="file" accept="image/*" className="hidden"
                    onChange={e => handlePhotoUpload(e, 'after')} />
                  <div className="flex flex-wrap gap-2">
                    {afterPhotos.length > 0 ? (
                      afterPhotos.slice(0,3).map((photo, i) => (
                        <button key={i} onClick={() => setLightbox({ photos: afterPhotos, index: i })}>
                          <img src={photo?.url || photo} alt="" className="w-16 h-16 object-cover rounded-lg" />
                        </button>
                      ))
                    ) : (
                      <p className="text-xs text-muted text-center w-full py-4">No after photos</p>
                    )}
                  </div>
                </div>
              </div>
            </Card>

            {/* Partner Permissions — mirror Android (JobScreens.kt:1870): editable when YOU sent
                this job to a partner (sent_to set, you're the sender). Toggles → PUT /jobs/:id. */}
            {jobData.sent_to_company_id && !jobData.sent_by_company_id && (
              <Card className="mt-3">
                <h3 className="text-sm font-semibold text-ink">Partner Permissions</h3>
                <p className="text-xs text-muted mb-2">Control what the partner company can do with this job.</p>
                <div className="divide-y divide-hairline">
                  {TECH_PERM_KEYS.map(([key, label]) => (
                    <div key={key} className="flex items-center justify-between py-2 min-h-[44px]">
                      <span className="text-sm text-ink">{label}</span>
                      <Toggle checked={!!techPerms[key]} onChange={e => handleTechPermToggle(key, e.target.checked)} />
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Section 12: Parts — list + Add Parts + Charge Payment in same row (FIX 8) */}
            <div>
              <SectionLabel>Parts</SectionLabel>
              {parts.length > 0 ? (
                <Card className="mb-3">
                  <div className="space-y-2">
                    {parts.map(p => (
                      <div key={p.id} className="flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-ink truncate">{p.name}</p>
                          <p className="text-xs text-muted">{p.provider === 'tech' ? 'Tech supplies' : 'Company supplies'}</p>
                        </div>
                        <p className="text-sm font-semibold">{formatCurrency(p.cost)}</p>
                        <button onClick={() => handleDeletePart(p.id)}
                          className="p-1 text-gray-300 hover:text-red-500 min-w-[32px] min-h-[32px] flex items-center justify-center">
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                    <div className="border-t border-hairline pt-2 flex justify-between text-sm font-bold">
                      <span>Parts Total</span>
                      <span>{formatCurrency(parts.reduce((s,p) => s + Number(p.cost||0), 0))}</span>
                    </div>
                  </div>
                </Card>
              ) : (
                <p className="text-sm text-muted text-center py-3 bg-background rounded-xl mb-3">No parts added</p>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => { setPartsModal(true); setPartForm({ name: '', cost: '', provider: 'company' }); }}
                  className="flex-1 py-3 border border-hairline text-ink rounded-xl font-semibold text-sm min-h-[48px]">
                  🔩 Add Parts
                </button>
                {jobInvoice && jobInvoice.status !== 'paid' && can('payments_refunds','edit_self') && (
                  <button
                    onClick={() => setDepositModal(true)}
                    className="flex-1 py-3 border border-hairline text-ink rounded-xl font-semibold text-sm min-h-[48px]">
                    💳 Charge Payment
                  </button>
                )}
              </div>
            </div>

            {/* Section 13: Bottom action row */}
            <div className="flex gap-2">
              <Button variant="outlined" onClick={handleSendReceipt} className="flex-1 text-sm min-h-[48px]">
                📧 Send Receipt
              </Button>
              {!isDeletedOrCancelled && (
                <Button variant="outlined" onClick={handleCancelJob} className="flex-1 text-sm border-red-300 text-red-600 hover:bg-red-50 min-h-[48px]">
                  Cancel Job
                </Button>
              )}
              {jobData.status === 'deleted' && (
                <Button onClick={handleRestoreJob} className="flex-1 bg-amber-500 hover:bg-amber-600 text-sm min-h-[48px]">
                  ♻️ Restore
                </Button>
              )}
              <Button onClick={() => setShowComplete(true)}
                className="flex-1 bg-green-600 hover:bg-green-700 text-sm min-h-[48px]">
                ✅ Completed
              </Button>
            </div>
          </>
        )}

        {/* ─── HISTORY TAB ──────────────────────────────────────────────────── */}
        {activeTab === 'history' && canViewHistory && (
          <div className="space-y-2">
            {[
              { key: 'past_jobs', label: '📋 Past Jobs' },
              { key: 'estimates', label: '📄 Estimates' },
              { key: 'invoices',  label: '🧾 Invoices'  },
              { key: 'notes',     label: '📝 Notes'     },
              { key: 'photos',    label: '📸 Photos'    },
            ].map(({ key, label }) => (
              <Card key={key}>
                <button onClick={() => key === 'notes' || key === 'photos'
                  ? setHistOpen(prev => ({ ...prev, [key]: !prev[key] }))
                  : toggleHistSection(key)}
                  className="w-full flex items-center justify-between min-h-[44px]">
                  <span className="font-semibold text-ink text-sm">{label}</span>
                  <ChevronDown size={16} className={`text-muted transition-transform ${histOpen[key] ? 'rotate-180' : ''}`} />
                </button>
                {histOpen[key] && (
                  <div className="mt-3 pt-3 border-t border-hairline">
                    {key === 'past_jobs' && (
                      histLoading[key] ? <LoadingSpinner /> :
                      pastJobs.length === 0 ? <p className="text-sm text-muted py-2 text-center">No other jobs for this customer</p> :
                      <div className="space-y-2">
                        {pastJobs.map(j => (
                          <button key={j.id} onClick={() => navigate(`/jobs/${j.id}`)}
                            className="w-full flex items-center justify-between text-left py-2 hover:bg-background rounded-lg px-1">
                            <div>
                              <p className="text-sm font-medium text-ink">#{j.job_number} · {j.title}</p>
                              {j.scheduled_start && <p className="text-xs text-muted">{formatDate(j.scheduled_start)}</p>}
                            </div>
                            <Badge status={j.status} label={j.status?.replace(/_/g,' ')} />
                          </button>
                        ))}
                      </div>
                    )}
                    {key === 'estimates' && (
                      histLoading[key] ? <LoadingSpinner /> :
                      jobEstimates.length === 0 ? <p className="text-sm text-muted py-2 text-center">No estimates</p> :
                      <div className="space-y-2">
                        {jobEstimates.map(e => (
                          <button key={e.id} onClick={() => navigate(`/estimates/${e.id}`)}
                            className="w-full flex items-center justify-between text-left py-2 hover:bg-background rounded-lg px-1">
                            <div>
                              <p className="text-sm font-medium text-ink">{e.estimate_number || `EST-${e.id?.slice(0,6)}`}</p>
                              <p className="text-xs text-muted">{formatCurrency(e.total)}</p>
                            </div>
                            <Badge status={e.status} label={e.status} />
                          </button>
                        ))}
                      </div>
                    )}
                    {key === 'invoices' && (
                      histLoading[key] ? <LoadingSpinner /> :
                      jobInvoices.length === 0 ? <p className="text-sm text-muted py-2 text-center">No invoices</p> :
                      <div className="space-y-2">
                        {jobInvoices.map(inv => (
                          <button key={inv.id} onClick={() => navigate(`/invoices/${inv.id}`)}
                            className="w-full flex items-center justify-between text-left py-2 hover:bg-background rounded-lg px-1">
                            <div>
                              <p className="text-sm font-medium text-ink">{inv.invoice_number || `INV-${inv.id?.slice(0,6)}`}</p>
                              <p className="text-xs text-muted">{formatCurrency(inv.total)}</p>
                            </div>
                            <Badge status={inv.status} label={inv.status} />
                          </button>
                        ))}
                      </div>
                    )}
                    {key === 'notes' && (
                      notes
                        ? <p className="text-sm text-ink whitespace-pre-wrap">{notes}</p>
                        : <p className="text-sm text-muted text-center py-2">No notes added</p>
                    )}
                    {key === 'photos' && (
                      beforePhotos.length === 0 && afterPhotos.length === 0 ? (
                        <p className="text-sm text-muted text-center py-2">No photos added</p>
                      ) : (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-xs font-semibold text-muted uppercase mb-2">Before</p>
                            <div className="space-y-1">
                              {beforePhotos.map((photo, i) => (
                                <button key={i} onClick={() => setLightbox({ photos: beforePhotos, index: i })}
                                  className="aspect-square w-full rounded-xl overflow-hidden bg-background">
                                  <img src={photo?.url||photo} alt="" className="w-full h-full object-cover" />
                                </button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-muted uppercase mb-2">After</p>
                            <div className="space-y-1">
                              {afterPhotos.map((photo, i) => (
                                <button key={i} onClick={() => setLightbox({ photos: afterPhotos, index: i })}
                                  className="aspect-square w-full rounded-xl overflow-hidden bg-background">
                                  <img src={photo?.url||photo} alt="" className="w-full h-full object-cover" />
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}

        {/* ─── MESSAGES TAB ─────────────────────────────────────────────────── */}
        {activeTab === 'messages' && (
          <div className="flex flex-col" style={{ minHeight: '400px' }}>
            <div className="flex-1 space-y-3 pb-4">
              {messagesLoading ? <LoadingSpinner /> :
               jobMessages.length === 0 ? (
                <p className="text-center text-muted text-sm py-8">No messages for this job yet.</p>
               ) : (
                jobMessages.map((msg, i) => {
                  const isOutbound = msg.direction === 'outbound' || msg.type === 'outbound';
                  return (
                    <div key={msg.id||i} className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                        isOutbound ? 'bg-blue text-white rounded-br-sm' : 'bg-background text-ink rounded-bl-sm'
                      }`}>
                        <p className="text-sm">{msg.body||msg.message}</p>
                        <p className={`text-[10px] mt-1 ${isOutbound ? 'text-blue-200' : 'text-muted'}`}>
                          {msg.created_at ? format(new Date(msg.created_at), 'h:mm a') : ''}
                        </p>
                      </div>
                    </div>
                  );
                })
               )}
              <div ref={messagesEndRef} />
            </div>
            {convId ? (
              <form onSubmit={handleSendMessage} className="flex items-center gap-2 pt-3 border-t border-hairline">
                <input type="text" value={messageBody} onChange={e => setMessageBody(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 rounded-full border border-hairline px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue min-h-[44px]" />
                <button type="submit" disabled={sendingMsg || !messageBody.trim()}
                  className="w-11 h-11 bg-blue text-white rounded-full flex items-center justify-center disabled:opacity-50">
                  <Send size={18} />
                </button>
              </form>
            ) : (
              <p className="text-xs text-muted text-center pt-3 border-t border-hairline">
                No SMS conversation linked to this job.
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}

      {/* Add Line Item */}
      <Modal isOpen={addItemModal} onClose={() => { setAddItemModal(false); setPbSearch(''); setPbResults([]); }}
        title="Add Charge"
        footer={
          <>
            <Button variant="outlined" onClick={() => { setAddItemModal(false); setPbSearch(''); setPbResults([]); }}>Cancel</Button>
            <Button loading={addingItem} onClick={handleAddLineItem}>Add</Button>
          </>
        }>
        <div className="space-y-4">
          <div className="relative">
            <Input label="Search pricebook or enter name"
              value={pbSearch}
              onChange={e => { handlePbSearch(e.target.value); setNewItem(prev => ({ ...prev, name: e.target.value })); }}
              placeholder="AC filter, labor..." />
            {pbSearching && <p className="text-xs text-muted mt-1">Searching...</p>}
            {pbResults.length > 0 && (
              <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-card border border-hairline rounded-xl shadow-lg overflow-hidden">
                {pbResults.map(item => (
                  <button key={item.id||item._id} type="button" onClick={() => selectPbItem(item)}
                    className="w-full text-left px-4 py-3 hover:bg-background text-sm border-b last:border-0 flex items-center justify-between">
                    <span className="font-medium">{item.name}</span>
                    <span className="text-muted">${Number(item.unit_price||item.price||0).toFixed(2)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-sm font-medium text-ink mb-1">Qty</p>
              <StepperInput value={newItem.qty} min={1} onChange={v => setNewItem(prev => ({ ...prev, qty: v }))} />
            </div>
            <Input label="Unit Price ($)" type="number" value={newItem.unit_price}
              onChange={e => setNewItem(prev => ({ ...prev, unit_price: e.target.value }))} placeholder="0.00" />
          </div>
        </div>
      </Modal>

      {/* Add Part */}
      <Modal isOpen={partsModal} onClose={() => setPartsModal(false)} title="Add Part"
        footer={
          <>
            <Button variant="outlined" onClick={() => setPartsModal(false)}>Cancel</Button>
            <Button loading={savingPart} onClick={handleSavePart}>Add Part</Button>
          </>
        }>
        <div className="space-y-3">
          <Input label="Part Name *" value={partForm.name}
            onChange={e => setPartForm(prev => ({ ...prev, name: e.target.value }))}
            placeholder="e.g. Capacitor 35/5 MFD" />
          <Input label="Cost ($)" type="number" value={partForm.cost}
            onChange={e => setPartForm(prev => ({ ...prev, cost: e.target.value }))}
            placeholder="0.00" />
          <div>
            <p className="text-sm font-medium text-ink mb-2">Supplied by</p>
            <div className="flex gap-2">
              {[
                { v: 'company', label: 'Company' },
                { v: 'tech',    label: 'Tech'    },
              ].map(({ v, label }) => (
                <button key={v} type="button"
                  onClick={() => setPartForm(prev => ({ ...prev, provider: v }))}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium border min-h-[44px] ${
                    partForm.provider === v
                      ? 'bg-blue text-white border-blue'
                      : 'bg-card text-ink border-hairline'
                  }`}>{label}</button>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* Status */}
      <Modal isOpen={statusModal} onClose={() => setStatusModal(false)} title="Update Status">
        <div className="space-y-2">
          {JOB_STATUSES.map(s => (
            <button key={s.value} onClick={() => handleStatusChange(s.value)}
              className={`w-full text-left px-4 py-3 rounded-xl transition-colors min-h-[44px] flex items-center gap-3 ${
                jobData.status === s.value ? 'bg-blue-50 text-blue font-semibold' : 'hover:bg-background text-ink'
              }`}>
              <Badge status={s.value} label={s.label} />
            </button>
          ))}
        </div>
      </Modal>

      {/* Dispatch */}
      <Modal isOpen={dispatchModal} onClose={() => setDispatchModal(false)} title="Dispatch Tech"
        footer={
          <>
            <Button variant="outlined" onClick={() => setDispatchModal(false)}>Cancel</Button>
            <Button loading={mutating} onClick={handleDispatch}>Dispatch</Button>
          </>
        }>
        <p className="text-ink">Dispatch tech to {jobData.customer_name || 'the customer'}? They will receive an ETA notification.</p>
      </Modal>

      {/* Send To */}
      <Modal isOpen={sendToModal} onClose={() => { setSendToModal(false); setSelectedRecipient(null); }}
        title="Send To"
        footer={
          <>
            <Button variant="outlined" onClick={() => { setSendToModal(false); setSelectedRecipient(null); }}>Cancel</Button>
            <Button loading={sendingTo} disabled={!selectedRecipient} onClick={handleSendTo}>Send</Button>
          </>
        }>
        {sendToLoading ? <LoadingSpinner /> :
         sendToRecipients.length === 0 ? (
          <p className="text-muted text-sm text-center py-4">No recipients available.</p>
         ) : (
          <div className="space-y-4">
            {sendToRecipients.some(r => r.type !== 'partner') && (
              <div>
                <p className="text-xs font-semibold text-muted uppercase mb-2">Technicians</p>
                {sendToRecipients.filter(r => r.type !== 'partner').map(r => (
                  <button key={r.id} onClick={() => { setSelectedRecipient(r); setSendMethod('sms'); }}
                    className={`w-full text-left px-4 py-3 rounded-xl mb-1 flex items-center gap-3 transition-colors border ${
                      selectedRecipient?.id === r.id ? 'bg-blue-50 border-blue' : 'bg-background border-transparent hover:bg-background'
                    }`}>
                    <div className="w-8 h-8 rounded-full bg-blue text-white flex items-center justify-center text-sm font-semibold shrink-0">
                      {(r.name||'?')[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-sm text-ink">{r.name}</p>
                      <p className="text-xs text-muted">SMS / Email</p>
                    </div>
                  </button>
                ))}
                {(selectedRecipient?.type === 'roster_tech' || selectedRecipient?.type === 'app_user') && (
                  <div className="flex gap-2 mt-2">
                    {['sms','email','both'].map(m => (
                      <button key={m} onClick={() => setSendMethod(m)}
                        className={`flex-1 py-2 rounded-xl text-sm font-medium border min-h-[44px] ${
                          sendMethod === m ? 'bg-blue text-white border-blue' : 'bg-card text-ink border-hairline'
                        }`}>
                        {m.charAt(0).toUpperCase()+m.slice(1)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {sendToRecipients.some(r => r.type === 'partner') && (
              <div>
                <p className="text-xs font-semibold text-muted uppercase mb-2">Network Partners</p>
                {sendToRecipients.filter(r => r.type === 'partner').map(r => (
                  <button key={r.id} onClick={() => setSelectedRecipient(r)}
                    className={`w-full text-left px-4 py-3 rounded-xl mb-1 flex items-center gap-3 transition-colors border ${
                      selectedRecipient?.id === r.id ? 'bg-blue-50 border-blue' : 'bg-background border-transparent hover:bg-background'
                    }`}>
                    <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-sm font-semibold shrink-0">
                      {(r.name||'?')[0].toUpperCase()}
                    </div>
                    <p className="font-medium text-sm text-ink">{r.name}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
         )}
      </Modal>

      {/* Complete Job */}
      <Modal isOpen={showComplete} onClose={() => setShowComplete(false)} title="Complete Job"
        footer={
          <>
            <Button variant="outlined" onClick={() => setShowComplete(false)}>Cancel</Button>
            <Button loading={completing} onClick={handleCompleteJob} className="bg-green-600 hover:bg-green-700">Complete Job</Button>
          </>
        }>
        <div className="space-y-4">
          {isPartnerJob && (
            <>
              {/* Parts */}
              <div>
                <label className="block text-xs font-semibold text-ink mb-1">Who provided parts?</label>
                <div className="flex gap-2">
                  {[['sender','Company'],['receiver','Technician'],['none','No Parts']].map(([v, lbl]) => (
                    <button key={v} type="button" onClick={() => setPartsPaidBy(v)}
                      className={`flex-1 px-3 py-2 rounded-xl border text-base min-h-[44px] transition-colors ${
                        partsPaidBy === v ? 'bg-blue text-white border-blue' : 'bg-card text-ink border-hairline'
                      }`}>{lbl}</button>
                  ))}
                </div>
                {partsPaidBy !== 'none' && (
                  <div className="relative mt-2">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">$</span>
                    <input inputMode="decimal" value={partsAmount}
                      onChange={e => setPartsAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                      placeholder="Parts Amount"
                      className="w-full border border-hairline rounded-xl pl-7 pr-4 py-3 text-base min-h-[44px] focus:outline-none focus:ring-2 focus:ring-blue" />
                  </div>
                )}
              </div>

              {/* Payment Collection */}
              <div>
                <label className="block text-xs font-semibold text-ink mb-1">Who collected payment?</label>
                <div className="flex gap-2">
                  {[['sender','Sender'],['receiver','Receiver']].map(([v, lbl]) => (
                    <button key={v} type="button" onClick={() => setPaymentCollectedBy(v)}
                      className={`flex-1 px-3 py-2 rounded-xl border text-base min-h-[44px] transition-colors ${
                        paymentCollectedBy === v ? 'bg-blue text-white border-blue' : 'bg-card text-ink border-hairline'
                      }`}>{lbl}</button>
                  ))}
                </div>
              </div>

              {/* CC Fee */}
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-ink">CC processing fee?</span>
                  <Toggle checked={hasCcFee} onChange={e => setHasCcFee(e.target.checked)} />
                </div>
                {hasCcFee && (
                  <div className="mt-2 space-y-2">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">$</span>
                      <input inputMode="decimal" value={ccFeeAmount}
                        onChange={e => setCcFeeAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                        placeholder="CC Fee Amount"
                        className="w-full border border-hairline rounded-xl pl-7 pr-4 py-3 text-base min-h-[44px] focus:outline-none focus:ring-2 focus:ring-blue" />
                    </div>
                    <label className="block text-xs font-semibold text-ink">Absorbed by:</label>
                    <div className="flex gap-2">
                      {[['sender','Sender'],['receiver','Receiver'],['split','Split 50/50']].map(([v, lbl]) => (
                        <button key={v} type="button" onClick={() => setCcFeePaidBy(v)}
                          className={`flex-1 px-3 py-2 rounded-xl border text-base min-h-[44px] transition-colors ${
                            ccFeePaidBy === v ? 'bg-blue text-white border-blue' : 'bg-card text-ink border-hairline'
                          }`}>{lbl}</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Live Calculation */}
              <div className="rounded-xl bg-blue-50 p-4 space-y-1.5">
                <div className="text-xs font-bold text-blue uppercase tracking-wide">Live Calculation</div>
                {jobInvoice ? (
                  <>
                    <div className="flex justify-between text-sm text-ink"><span>Job Total</span><span>{formatCurrency(calcGross)}</span></div>
                    {calcParts > 0 && (
                      <div className="flex justify-between text-sm text-ink">
                        <span>- Parts ({partsPaidBy === 'sender' ? 'Company' : 'Technician'})</span><span>-{formatCurrency(calcParts)}</span>
                      </div>
                    )}
                    {calcCc > 0 && (
                      <div className="flex justify-between text-sm text-ink">
                        <span>- CC Fee ({ccFeePaidBy})</span><span>-{formatCurrency(calcCc)}</span>
                      </div>
                    )}
                    <div className="border-t border-blue-200 my-1" />
                    <div className="flex justify-between text-sm font-semibold text-ink"><span>Net</span><span>{formatCurrency(calcNet)}</span></div>
                    {senderPct > 0 && (
                      <div className="flex justify-between text-sm font-semibold text-ink">
                        <span>Your share ({Math.trunc(senderPct)}%)</span><span>{formatCurrency(calcSender)}</span>
                      </div>
                    )}
                    {receiverPct > 0 && (
                      <div className="flex justify-between text-sm font-semibold text-ink">
                        <span>Partner share ({Math.trunc(receiverPct)}%)</span><span>{formatCurrency(calcReceiver)}</span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-xs text-muted">No invoice found for this job. You can still submit; the office reconciles the split.</div>
                )}
              </div>
            </>
          )}

          {/* Completion Notes (always) */}
          <div>
            <label className="block text-xs font-semibold text-ink mb-1">Completion Notes</label>
            <textarea className="w-full border border-hairline rounded-xl px-4 py-3 text-base min-h-[80px] focus:outline-none focus:ring-2 focus:ring-blue"
              value={completionNotes} onChange={e => setCompletionNotes(e.target.value)}
              placeholder="Describe the work completed..." />
          </div>
        </div>
      </Modal>

      {/* Profit Allocation */}
      <Modal isOpen={showProfitModal} onClose={() => !profitSubmitting && setShowProfitModal(false)} title="Profit Allocation"
        footer={
          <>
            <Button variant="outlined" disabled={profitSubmitting} onClick={() => setShowProfitModal(false)}>Cancel</Button>
            <Button loading={profitSubmitting} disabled={isOverrideConflict} onClick={handleSaveProfitOverride}>Save</Button>
          </>
        }>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-ink">Override default split</div>
              <div className="text-xs text-muted">For this job only. Doesn't change source or tech defaults.</div>
            </div>
            <Toggle
              checked={profitOverrideEnabled}
              onChange={(e) => setProfitOverrideEnabled(e.target.checked)}
            />
          </div>

          {profitOverrideEnabled && (
            <>
              <Input label="Source %" type="number" value={profitSourcePct}
                onChange={(e) => setProfitSourcePct(e.target.value)} placeholder="0" />
              <Input label="Tech %" type="number" value={profitTechPct}
                onChange={(e) => setProfitTechPct(e.target.value)} placeholder="0" />
              <div className={'text-xs ' + (isOverrideConflict ? 'text-red-600 font-medium' : 'text-ink')}>
                Sum: Source {profitSourcePct || 0}% + Tech {profitTechPct || 0}% = {overrideSum}%
                {isOverrideConflict && (
                  <span className="block mt-1">Exceeds 100%. Adjust before saving.</span>
                )}
                {!isOverrideConflict && overrideSum > 0 && (
                  <span className="block text-muted mt-1">Company keeps: {100 - overrideSum}%</span>
                )}
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Collect Deposit */}
      <Modal isOpen={depositModal} onClose={() => setDepositModal(false)} title="Collect Payment"
        footer={
          <>
            <Button variant="outlined" onClick={() => setDepositModal(false)}>Cancel</Button>
            <Button loading={mutating} onClick={handleChargePayment}>Charge</Button>
          </>
        }>
        <div className="space-y-3">
          {jobInvoice?.balance_due != null && (
            <p className="text-sm text-ink">Balance due: <strong>{formatCurrency(jobInvoice.balance_due)}</strong></p>
          )}
          <Select label="Payment Method" value={depositForm.method}
            onChange={e => setDepositForm(p => ({ ...p, method: e.target.value }))}
            options={PAYMENT_METHODS} />
          <Input label="Amount" type="number" value={depositForm.amount}
            onChange={e => setDepositForm(p => ({ ...p, amount: e.target.value }))}
            placeholder={jobInvoice?.balance_due?.toString() || '0.00'} />
        </div>
      </Modal>

      {/* Lightbox */}
      {lightbox && <Lightbox photos={lightbox.photos} startIndex={lightbox.index} onClose={() => setLightbox(null)} />}

      {/* Archive confirm */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-card rounded-2xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-ink mb-2">Archive this job?</h3>
            <p className="text-sm text-ink mb-6">
              The job will be moved to deleted jobs and can be retrieved from job search. Estimates and invoices will be kept.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-3 border border-hairline rounded-xl text-ink font-medium min-h-[44px]">Cancel</button>
              <button onClick={handleDeleteJob}
                className="flex-1 py-3 bg-red-600 text-white rounded-xl font-semibold min-h-[44px]">Archive</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
