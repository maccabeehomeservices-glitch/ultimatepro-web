import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import {
  ArrowLeft, Edit, Send, MapPin, Camera, X, ChevronLeft, ChevronRight,
  Plus, ChevronDown, Trash2, Navigation, CheckCircle,
} from 'lucide-react';
import { useGet, useMutation } from '../hooks/useApi';
import api, { formatDate, formatTime, jobsApi } from '../lib/api';
import { Card, Badge, Button, Modal, LoadingSpinner, Tabs, Input, Select, Toggle, StepperInput } from '../components/ui';
import { useSnackbar } from '../components/ui/Snackbar';
import SignaturePad from '../components/SignaturePad';

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

const tabList = [
  { id: 'details',  label: 'Details'  },
  { id: 'history',  label: 'History'  },
  { id: 'messages', label: 'Messages' },
];

function formatCurrency(v) {
  return '$' + Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function SectionLabel({ children }) {
  return <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-2 mt-4">{children}</p>;
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

  // Signature / complete / delete
  const [showSignature, setShowSignature]   = useState(false);
  const [savingSig, setSavingSig]           = useState(false);
  const [showComplete, setShowComplete]     = useState(false);
  const [completionNotes, setCompletionNotes] = useState('');
  const [completionPayment, setCompletionPayment] = useState('');
  const [completing, setCompleting]         = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [arriving, setArriving]             = useState(false);

  // Messages
  const [jobMessages, setJobMessages]   = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [convId, setConvId]             = useState(null);
  const [messageBody, setMessageBody]   = useState('');
  const [sendingMsg, setSendingMsg]     = useState(false);
  const messagesEndRef = useRef(null);

  const jobData = job?.job || job;

  // ── sync notes + photos ────────────────────────────────────────────────────
  useEffect(() => {
    if (!jobData) return;
    if (jobData.notes != null) setNotes(jobData.notes || '');
    setBeforePhotos(jobData.before_photos || []);
    setAfterPhotos(jobData.after_photos  || []);
  }, [jobData?.id]);

  useEffect(() => {
    if (jobData?.reminder_method != null) setReminderMethod(jobData.reminder_method || '');
  }, [jobData?.reminder_method]);

  useEffect(() => {
    if (!jobData) return;
    setTechPerms(jobData.tech_permissions || {
      view_history: true, collect_payments: true, take_photos: true,
      add_parts: false, edit_details: false, cancel_job: false,
    });
  }, [jobData?.id]);

  // ── load job parts ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    jobsApi.getParts(id).then(r => setParts(r.data || [])).catch(() => {});
  }, [id]);

  // ── load job invoice ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    setInvoiceLoading(true);
    api.get(`/invoices?job_id=${id}&limit=1`)
      .then(r => {
        const invList = r.data?.invoices || r.data || [];
        setJobInvoice(invList[0] || null);
      })
      .catch(() => {})
      .finally(() => setInvoiceLoading(false));
  }, [id]);

  // ── messages ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (activeTab !== 'messages' || !id) return;
    setMessagesLoading(true);
    api.get(`/sms/job/${id}/messages`)
      .then(res => {
        setJobMessages(res.data?.messages || (Array.isArray(res.data) ? res.data : []));
        setConvId(res.data?.conversation_id || null);
      })
      .catch(() => setJobMessages([]))
      .finally(() => setMessagesLoading(false));
  }, [activeTab, id]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [jobMessages.length]);

  // ── send-to recipients ────────────────────────────────────────────────────
  useEffect(() => {
    if (!sendToModal || !jobData) return;
    setSendToLoading(true);
    const recipients = [];
    if (jobData.assigned_tech_id) {
      recipients.push({
        id: jobData.assigned_tech_id,
        name: jobData.assigned_tech_name || 'Assigned Tech',
        type: 'roster_tech',
        phone: jobData.assigned_tech_phone || null,
        email: jobData.assigned_tech_email || null,
      });
    }
    api.get('/network/connections/active-simple')
      .then(res => {
        (res.data || []).forEach(c => recipients.push({
          id: c.partner_id,
          name: c.partner_name,
          type: 'partner',
          connection_id: c.connection_id,
        }));
        setSendToRecipients(recipients);
      })
      .catch(() => setSendToRecipients(recipients))
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
    setAddingItem(true);
    try {
      const current = jobData.line_items || jobData.charges || [];
      const updated = [...current, {
        name: newItem.name, quantity: newItem.qty,
        unit_price: Number(newItem.unit_price) || 0,
        total: (Number(newItem.unit_price) || 0) * newItem.qty,
      }];
      await api.patch(`/jobs/${id}`, { line_items: updated });
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
      await api.patch(`/jobs/${id}`, { tech_permissions: updated });
      showSnack('Saved', 'success');
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

  async function handleCaptureSignature(base64) {
    setSavingSig(true);
    try {
      await jobsApi.captureSignature(id, base64);
      setShowSignature(false);
      showSnack('Signature captured!', 'success');
      refetch();
    } catch (err) { showSnack(err.response?.data?.error || 'Failed to save signature', 'error'); }
    finally { setSavingSig(false); }
  }

  async function handleCompleteJob() {
    setCompleting(true);
    try {
      await jobsApi.complete(id, { notes: completionNotes, payment_method: completionPayment || undefined });
      setShowComplete(false);
      showSnack('Job completed!', 'success');
      refetch();
    } catch (err) { showSnack(err.response?.data?.error || 'Failed to complete job', 'error'); }
    finally { setCompleting(false); }
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
    try {
      await mutate('post', `/jobs/${id}/status`, { status });
      setStatusModal(false);
      refetch();
      showSnack('Status updated', 'success');
    } catch { showSnack('Failed to update status', 'error'); }
  }

  async function handleCreateEstimate() {
    try {
      const result = await mutate('post', '/estimates', { job_id: id, customer_id: jobData?.customer_id });
      navigate(`/estimates/${result?.estimate?.id || result?.id}`);
    } catch { showSnack('Failed to create estimate', 'error'); }
  }

  async function handleDispatch() {
    try {
      const res = await mutate('post', `/jobs/${id}/dispatch`, { tech_lat: 0, tech_lng: 0 });
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
        await api.post('/roster-techs/notify-tech', { job_id: id, tech_id: selectedRecipient.id, method: sendMethod });
        showSnack(`Sent to ${selectedRecipient.name}`, 'success');
      }
      setSendToModal(false);
      setSelectedRecipient(null);
    } catch { showSnack('Failed to send', 'error'); }
    finally { setSendingTo(false); }
  }

  async function handleCollectDeposit() {
    const estimateId = jobData?.estimate_id;
    if (!estimateId) { showSnack('No estimate found for this job', 'error'); return; }
    try {
      await mutate('post', `/estimates/${estimateId}/collect-deposit`, {
        method: depositForm.method,
        amount: Number(depositForm.amount),
      });
      setDepositModal(false);
      refetch();
      showSnack('Deposit collected', 'success');
    } catch { showSnack('Failed to collect deposit', 'error'); }
  }

  async function handleReminderChange(e) {
    const method = e.target.value;
    setReminderMethod(method);
    try { await api.patch(`/jobs/${id}/reminder-method`, { method }); } catch {}
  }

  async function handleNotesBlur() {
    if (!jobData || notes === (jobData.notes || '')) return;
    setNotesSaving(true);
    try {
      await api.patch(`/jobs/${id}`, { notes });
      showSnack('Notes saved', 'success');
    } catch { showSnack('Failed to save notes', 'error'); }
    finally { setNotesSaving(false); }
  }

  async function handlePhotoUpload(e, type) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('entity_type', 'job');
      formData.append('entity_id', id);
      formData.append('purpose', type);
      const uploadRes = await api.post('/uploads', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      const photoUrl = uploadRes.data?.url;
      if (!photoUrl) throw new Error('Upload failed');
      await api.post(`/jobs/${id}/photos`, { photo_url: photoUrl });
      refetch();
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

  async function handleSendReceipt() {
    try {
      if (!jobInvoice?.id) { showSnack('No invoice found. Create an invoice first.', 'error'); return; }
      await api.post(`/invoices/${jobInvoice.id}/send`);
      showSnack('Receipt sent', 'success');
    } catch { showSnack('Failed to send receipt', 'error'); }
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
  if (!jobData) return <div className="p-4 text-gray-500">Job not found.</div>;

  const isDeletedOrCancelled = ['deleted','cancelled'].includes(jobData.status);
  const hasDeposit   = jobData.deposit_required && !jobData.deposit_collected;
  const address      = jobData.address || jobData.service_address || '';
  const lineItems    = jobData.line_items || jobData.charges || [];
  const lineItemsTotal = lineItems.reduce((s, item) => s + Number(item.total || item.amount || 0), 0);
  const statusColor  = STATUS_COLORS[jobData.status] || 'bg-gray-500';
  const priorityLabel = jobData.priority ? (jobData.priority.charAt(0).toUpperCase() + jobData.priority.slice(1)) : null;
  const priorityStyle = PRIORITY_COLORS[jobData.priority] || 'bg-gray-100 text-gray-600';

  return (
    <div className="p-4 max-w-3xl mx-auto pb-8">

      {/* ── Section 1: Top Bar ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3 flex-wrap flex-1 min-w-0">
          <button onClick={() => navigate(-1)}
            className="p-2 -ml-2 rounded-xl hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-600">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-bold text-gray-900">
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
              className="p-2 rounded-xl hover:bg-blue-50 min-h-[44px] min-w-[44px] flex items-center justify-center text-[#1A73E8]">
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
            className="p-2 rounded-xl hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-600">
            <Edit size={20} />
          </button>
          {/* Delete */}
          {jobData.status !== 'deleted' && (
            <button onClick={() => setShowDeleteConfirm(true)}
              className="p-2 rounded-xl hover:bg-red-50 min-h-[44px] min-w-[44px] flex items-center justify-center text-red-500">
              <Trash2 size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Partner banners */}
      {jobData.sent_to_company_id && (
        <div className="mb-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
          <p className="text-sm font-semibold text-blue-800">Sent to: {jobData.sent_to_company_name || 'Partner Company'}</p>
          <p className="text-xs text-blue-600">This job was forwarded to a network partner</p>
          {jobData.partner_status === 'pending' && (
            <div className="flex gap-2 mt-2">
              <button onClick={() => handlePartnerStatus('confirm')} disabled={partnerActing}
                className="text-xs px-3 py-1.5 rounded-lg border border-green-500 text-green-700 font-medium min-h-[32px] hover:bg-green-50 disabled:opacity-50">Confirm</button>
              <button onClick={() => handlePartnerStatus('dispute')} disabled={partnerActing}
                className="text-xs px-3 py-1.5 rounded-lg border border-red-400 text-red-600 font-medium min-h-[32px] hover:bg-red-50 disabled:opacity-50">Dispute</button>
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
      <Tabs tabs={tabList} active={activeTab} onChange={setActiveTab} />

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
                    className="flex-1 rounded-xl border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A73E8] bg-white min-h-[36px]">
                    {REMINDER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-2 flex-1 min-w-[180px]">
                  <span className="text-base">📅</span>
                  {jobData.scheduled_start ? (
                    <span className="text-sm text-gray-700 font-medium">
                      {formatDate(jobData.scheduled_start)} {formatTime(jobData.scheduled_start)}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">Not scheduled</span>
                  )}
                </div>
              </div>
            </Card>

            {/* Section 4: Compact source | type | assigned row */}
            <Card>
              <div className="flex items-center gap-1 divide-x divide-gray-100">
                <button onClick={() => navigate(`/jobs/${id}/edit`)}
                  className="flex-1 text-center py-2 min-h-[44px] hover:bg-gray-50 rounded-l-xl">
                  <p className="text-[10px] text-gray-400 uppercase font-semibold">Source</p>
                  <p className="text-xs font-medium text-gray-800 truncate px-1">
                    {jobData.job_source_name || jobData.ad_channel_name || 'My Company'}
                  </p>
                </button>
                <button onClick={() => navigate(`/jobs/${id}/edit`)}
                  className="flex-1 text-center py-2 min-h-[44px] hover:bg-gray-50">
                  <p className="text-[10px] text-gray-400 uppercase font-semibold">Type</p>
                  <p className="text-xs font-medium text-gray-800 truncate px-1">
                    {jobData.type ? (jobData.type.charAt(0).toUpperCase() + jobData.type.slice(1)) : '—'}
                  </p>
                </button>
                <button onClick={() => navigate(`/jobs/${id}/edit`)}
                  className="flex-1 text-center py-2 min-h-[44px] hover:bg-gray-50 rounded-r-xl">
                  <p className="text-[10px] text-gray-400 uppercase font-semibold">Assigned</p>
                  <p className="text-xs font-medium text-gray-800 truncate px-1">
                    {jobData.assigned_tech_name || jobData.assigned_roster_tech_name || 'Unassigned'}
                  </p>
                </button>
              </div>
            </Card>

            {/* Section 5: Customer */}
            {(jobData.customer_id || jobData.customer) && (
              <Card>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Customer</h3>
                  <button onClick={() => navigate(`/customers/${jobData.customer_id || jobData.customer?.id}`)}
                    className="text-sm text-blue-600 font-medium min-h-[36px] px-2">
                    View
                  </button>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 text-sm">👤</span>
                    <span className="text-sm font-medium text-gray-900">
                      {[jobData.cust_first, jobData.cust_last].filter(Boolean).join(' ') || '—'}
                    </span>
                  </div>
                  {jobData.cust_phone && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 text-sm">📱</span>
                        <span className="text-sm text-gray-900">{jobData.cust_phone}</span>
                      </div>
                      <a href={`tel:${jobData.cust_phone}`} className="text-blue-600 text-lg min-h-[36px] flex items-center">📞</a>
                    </div>
                  )}
                  {jobData.cust_email && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 text-sm">✉️</span>
                        <span className="text-sm text-gray-900">{jobData.cust_email}</span>
                      </div>
                      <a href={`mailto:${jobData.cust_email}`} className="text-blue-600 text-lg min-h-[36px] flex items-center">📧</a>
                    </div>
                  )}
                  {jobData.cust_address && (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 text-sm">📍</span>
                      <span className="text-sm text-gray-900">
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
                  <MapPin size={18} className="text-[#1A73E8] mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-400 font-medium uppercase mb-0.5">Job Site</p>
                    <p className="text-sm text-gray-800">
                      {address}
                      {jobData.city ? `, ${jobData.city}` : ''}
                      {jobData.state ? `, ${jobData.state}` : ''}
                      {jobData.zip ? ` ${jobData.zip}` : ''}
                    </p>
                  </div>
                  <button onClick={handleNavigate}
                    className="text-sm text-[#1A73E8] font-semibold min-h-[44px] flex items-center px-2">
                    Navigate
                  </button>
                </div>
              </Card>
            )}

            {/* Section 7: Notes */}
            <div>
              <SectionLabel>Notes {notesSaving && <span className="text-[#1A73E8] ml-1">saving...</span>}</SectionLabel>
              <Card>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} onBlur={handleNotesBlur}
                  placeholder="Add job notes..." rows={4}
                  className="w-full text-sm text-gray-800 resize-none focus:outline-none bg-transparent placeholder-gray-400" />
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
              {jobData.estimates?.length > 0 && (
                <Card>
                  <div className="space-y-2">
                    {(jobData.estimates || []).map(e => (
                      <button key={e.id} onClick={() => navigate(`/estimates/${e.id}`)}
                        className="w-full flex items-center justify-between text-left py-2 hover:bg-gray-50 rounded-lg px-1">
                        <div>
                          <p className="text-sm font-medium text-gray-900">EST-{e.estimate_number || e.id?.slice(0,6)}</p>
                          <p className="text-xs text-gray-400">{formatCurrency(e.total)}</p>
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
                    <p className="text-sm font-semibold text-gray-900">INV-{jobInvoice.invoice_number || jobInvoice.id?.slice(0,6)}</p>
                    <Badge status={jobInvoice.status} label={jobInvoice.status} />
                  </div>
                  {(jobInvoice.line_items || []).map((item, i) => (
                    <div key={i} className="flex items-center justify-between py-1 text-sm">
                      <span className="text-gray-700">{item.name}</span>
                      <span className="font-medium text-gray-900">{formatCurrency(item.total||item.amount||0)}</span>
                    </div>
                  ))}
                  {(jobInvoice.line_items || []).length > 0 && (
                    <div className="border-t border-gray-100 pt-2 mt-1 flex justify-between text-sm font-bold">
                      <span>Total</span>
                      <span>{formatCurrency(jobInvoice.total)}</span>
                    </div>
                  )}
                </Card>
              )}
            </div>

            {/* Section 11: Before / After photos — card with bordered boxes (FIX 6) */}
            <Card>
              <h3 className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-3">Photos</h3>
              <div className="grid grid-cols-2 gap-4">
                {/* Before box */}
                <div className="border border-gray-200 rounded-xl p-3 min-h-[120px]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-gray-500 uppercase">Before</span>
                    <button onClick={() => beforeInputRef.current?.click()} disabled={uploadingPhoto}
                      className="text-[#1A73E8] min-h-[32px] flex items-center">
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
                      <p className="text-xs text-gray-400 text-center w-full py-4">No before photos</p>
                    )}
                  </div>
                </div>

                {/* After box */}
                <div className="border border-gray-200 rounded-xl p-3 min-h-[120px]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-gray-500 uppercase">After</span>
                    <button onClick={() => afterInputRef.current?.click()} disabled={uploadingPhoto}
                      className="text-[#1A73E8] min-h-[32px] flex items-center">
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
                      <p className="text-xs text-gray-400 text-center w-full py-4">No after photos</p>
                    )}
                  </div>
                </div>
              </div>
            </Card>

            {/* Section 12: Parts — list + Add Parts + Charge Payment in same row (FIX 8) */}
            <div>
              <SectionLabel>Parts</SectionLabel>
              {parts.length > 0 ? (
                <Card className="mb-3">
                  <div className="space-y-2">
                    {parts.map(p => (
                      <div key={p.id} className="flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                          <p className="text-xs text-gray-400">{p.provider === 'tech' ? 'Tech supplies' : 'Company supplies'}</p>
                        </div>
                        <p className="text-sm font-semibold">{formatCurrency(p.cost)}</p>
                        <button onClick={() => handleDeletePart(p.id)}
                          className="p-1 text-gray-300 hover:text-red-500 min-w-[32px] min-h-[32px] flex items-center justify-center">
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                    <div className="border-t border-gray-100 pt-2 flex justify-between text-sm font-bold">
                      <span>Parts Total</span>
                      <span>{formatCurrency(parts.reduce((s,p) => s + Number(p.cost||0), 0))}</span>
                    </div>
                  </div>
                </Card>
              ) : (
                <p className="text-sm text-gray-400 text-center py-3 bg-gray-50 rounded-xl mb-3">No parts added</p>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => { setPartsModal(true); setPartForm({ name: '', cost: '', provider: 'company' }); }}
                  className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold text-sm min-h-[48px]">
                  🔩 Add Parts
                </button>
                <button
                  onClick={() => setDepositModal(true)}
                  className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold text-sm min-h-[48px]">
                  💳 Charge Payment
                </button>
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
        {activeTab === 'history' && (
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
                  <span className="font-semibold text-gray-900 text-sm">{label}</span>
                  <ChevronDown size={16} className={`text-gray-400 transition-transform ${histOpen[key] ? 'rotate-180' : ''}`} />
                </button>
                {histOpen[key] && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    {key === 'past_jobs' && (
                      histLoading[key] ? <LoadingSpinner /> :
                      pastJobs.length === 0 ? <p className="text-sm text-gray-400 py-2 text-center">No other jobs for this customer</p> :
                      <div className="space-y-2">
                        {pastJobs.map(j => (
                          <button key={j.id} onClick={() => navigate(`/jobs/${j.id}`)}
                            className="w-full flex items-center justify-between text-left py-2 hover:bg-gray-50 rounded-lg px-1">
                            <div>
                              <p className="text-sm font-medium text-gray-900">#{j.job_number} · {j.title}</p>
                              {j.scheduled_start && <p className="text-xs text-gray-400">{formatDate(j.scheduled_start)}</p>}
                            </div>
                            <Badge status={j.status} label={j.status?.replace(/_/g,' ')} />
                          </button>
                        ))}
                      </div>
                    )}
                    {key === 'estimates' && (
                      histLoading[key] ? <LoadingSpinner /> :
                      jobEstimates.length === 0 ? <p className="text-sm text-gray-400 py-2 text-center">No estimates</p> :
                      <div className="space-y-2">
                        {jobEstimates.map(e => (
                          <button key={e.id} onClick={() => navigate(`/estimates/${e.id}`)}
                            className="w-full flex items-center justify-between text-left py-2 hover:bg-gray-50 rounded-lg px-1">
                            <div>
                              <p className="text-sm font-medium text-gray-900">EST-{e.estimate_number||e.id?.slice(0,6)}</p>
                              <p className="text-xs text-gray-400">{formatCurrency(e.total)}</p>
                            </div>
                            <Badge status={e.status} label={e.status} />
                          </button>
                        ))}
                      </div>
                    )}
                    {key === 'invoices' && (
                      histLoading[key] ? <LoadingSpinner /> :
                      jobInvoices.length === 0 ? <p className="text-sm text-gray-400 py-2 text-center">No invoices</p> :
                      <div className="space-y-2">
                        {jobInvoices.map(inv => (
                          <button key={inv.id} onClick={() => navigate(`/invoices/${inv.id}`)}
                            className="w-full flex items-center justify-between text-left py-2 hover:bg-gray-50 rounded-lg px-1">
                            <div>
                              <p className="text-sm font-medium text-gray-900">INV-{inv.invoice_number||inv.id?.slice(0,6)}</p>
                              <p className="text-xs text-gray-400">{formatCurrency(inv.total)}</p>
                            </div>
                            <Badge status={inv.status} label={inv.status} />
                          </button>
                        ))}
                      </div>
                    )}
                    {key === 'notes' && (
                      notes
                        ? <p className="text-sm text-gray-700 whitespace-pre-wrap">{notes}</p>
                        : <p className="text-sm text-gray-400 text-center py-2">No notes added</p>
                    )}
                    {key === 'photos' && (
                      beforePhotos.length === 0 && afterPhotos.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-2">No photos added</p>
                      ) : (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Before</p>
                            <div className="space-y-1">
                              {beforePhotos.map((photo, i) => (
                                <button key={i} onClick={() => setLightbox({ photos: beforePhotos, index: i })}
                                  className="aspect-square w-full rounded-xl overflow-hidden bg-gray-100">
                                  <img src={photo?.url||photo} alt="" className="w-full h-full object-cover" />
                                </button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-gray-400 uppercase mb-2">After</p>
                            <div className="space-y-1">
                              {afterPhotos.map((photo, i) => (
                                <button key={i} onClick={() => setLightbox({ photos: afterPhotos, index: i })}
                                  className="aspect-square w-full rounded-xl overflow-hidden bg-gray-100">
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
                <p className="text-center text-gray-400 text-sm py-8">No messages for this job yet.</p>
               ) : (
                jobMessages.map((msg, i) => {
                  const isOutbound = msg.direction === 'outbound' || msg.type === 'outbound';
                  return (
                    <div key={msg.id||i} className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                        isOutbound ? 'bg-[#1A73E8] text-white rounded-br-sm' : 'bg-gray-100 text-gray-900 rounded-bl-sm'
                      }`}>
                        <p className="text-sm">{msg.body||msg.message}</p>
                        <p className={`text-[10px] mt-1 ${isOutbound ? 'text-blue-200' : 'text-gray-400'}`}>
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
              <form onSubmit={handleSendMessage} className="flex items-center gap-2 pt-3 border-t border-gray-100">
                <input type="text" value={messageBody} onChange={e => setMessageBody(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 rounded-full border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A73E8] min-h-[44px]" />
                <button type="submit" disabled={sendingMsg || !messageBody.trim()}
                  className="w-11 h-11 bg-[#1A73E8] text-white rounded-full flex items-center justify-center disabled:opacity-50">
                  <Send size={18} />
                </button>
              </form>
            ) : (
              <p className="text-xs text-gray-400 text-center pt-3 border-t border-gray-100">
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
            {pbSearching && <p className="text-xs text-gray-400 mt-1">Searching...</p>}
            {pbResults.length > 0 && (
              <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                {pbResults.map(item => (
                  <button key={item.id||item._id} type="button" onClick={() => selectPbItem(item)}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 text-sm border-b last:border-0 flex items-center justify-between">
                    <span className="font-medium">{item.name}</span>
                    <span className="text-gray-400">${Number(item.unit_price||item.price||0).toFixed(2)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">Qty</p>
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
            <p className="text-sm font-medium text-gray-700 mb-2">Supplied by</p>
            <div className="flex gap-2">
              {[
                { v: 'company', label: 'Company' },
                { v: 'tech',    label: 'Tech'    },
              ].map(({ v, label }) => (
                <button key={v} type="button"
                  onClick={() => setPartForm(prev => ({ ...prev, provider: v }))}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium border min-h-[44px] ${
                    partForm.provider === v
                      ? 'bg-[#1A73E8] text-white border-[#1A73E8]'
                      : 'bg-white text-gray-600 border-gray-300'
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
                jobData.status === s.value ? 'bg-blue-50 text-[#1A73E8] font-semibold' : 'hover:bg-gray-50 text-gray-700'
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
        <p className="text-gray-600">Dispatch tech to {jobData.customer_name || 'the customer'}? They will receive an ETA notification.</p>
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
          <p className="text-gray-400 text-sm text-center py-4">No recipients available.</p>
         ) : (
          <div className="space-y-4">
            {sendToRecipients.some(r => r.type !== 'partner') && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Technicians</p>
                {sendToRecipients.filter(r => r.type !== 'partner').map(r => (
                  <button key={r.id} onClick={() => { setSelectedRecipient(r); setSendMethod('sms'); }}
                    className={`w-full text-left px-4 py-3 rounded-xl mb-1 flex items-center gap-3 transition-colors border ${
                      selectedRecipient?.id === r.id ? 'bg-blue-50 border-[#1A73E8]' : 'bg-gray-50 border-transparent hover:bg-gray-100'
                    }`}>
                    <div className="w-8 h-8 rounded-full bg-[#1A73E8] text-white flex items-center justify-center text-sm font-semibold shrink-0">
                      {(r.name||'?')[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-sm text-gray-900">{r.name}</p>
                      <p className="text-xs text-gray-400">SMS / Email</p>
                    </div>
                  </button>
                ))}
                {selectedRecipient?.type === 'roster_tech' && (
                  <div className="flex gap-2 mt-2">
                    {['sms','email','both'].map(m => (
                      <button key={m} onClick={() => setSendMethod(m)}
                        className={`flex-1 py-2 rounded-xl text-sm font-medium border min-h-[44px] ${
                          sendMethod === m ? 'bg-[#1A73E8] text-white border-[#1A73E8]' : 'bg-white text-gray-600 border-gray-200'
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
                <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Network Partners</p>
                {sendToRecipients.filter(r => r.type === 'partner').map(r => (
                  <button key={r.id} onClick={() => setSelectedRecipient(r)}
                    className={`w-full text-left px-4 py-3 rounded-xl mb-1 flex items-center gap-3 transition-colors border ${
                      selectedRecipient?.id === r.id ? 'bg-blue-50 border-[#1A73E8]' : 'bg-gray-50 border-transparent hover:bg-gray-100'
                    }`}>
                    <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-sm font-semibold shrink-0">
                      {(r.name||'?')[0].toUpperCase()}
                    </div>
                    <p className="font-medium text-sm text-gray-900">{r.name}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
         )}
      </Modal>

      {/* Signature */}
      <Modal isOpen={showSignature} onClose={() => setShowSignature(false)} title="Customer Signature">
        <SignaturePad onSave={handleCaptureSignature} onCancel={() => setShowSignature(false)} />
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
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Completion Notes</label>
            <textarea className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base min-h-[80px] focus:outline-none focus:ring-2 focus:ring-[#1A73E8]"
              value={completionNotes} onChange={e => setCompletionNotes(e.target.value)}
              placeholder="Describe the work completed..." />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Payment Collected</label>
            <select className="w-full border border-gray-300 rounded-xl px-4 py-3 min-h-[44px] text-base focus:outline-none focus:ring-2 focus:ring-[#1A73E8]"
              value={completionPayment} onChange={e => setCompletionPayment(e.target.value)}>
              <option value="">No payment collected</option>
              <option value="cash">Cash</option>
              <option value="check">Check</option>
              <option value="credit_card">Credit Card</option>
              <option value="ach">ACH / Bank Transfer</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
      </Modal>

      {/* Collect Deposit */}
      <Modal isOpen={depositModal} onClose={() => setDepositModal(false)} title="Collect Payment"
        footer={
          <>
            <Button variant="outlined" onClick={() => setDepositModal(false)}>Cancel</Button>
            <Button loading={mutating} onClick={handleCollectDeposit}>Collect</Button>
          </>
        }>
        <div className="space-y-3">
          {jobData.deposit_amount && (
            <p className="text-sm text-gray-600">Amount: <strong>{formatCurrency(jobData.deposit_amount)}</strong></p>
          )}
          <Select label="Payment Method" value={depositForm.method}
            onChange={e => setDepositForm(p => ({ ...p, method: e.target.value }))}
            options={PAYMENT_METHODS} />
          <Input label="Amount" type="number" value={depositForm.amount}
            onChange={e => setDepositForm(p => ({ ...p, amount: e.target.value }))}
            placeholder={jobData.deposit_amount?.toString() || '0.00'} />
        </div>
      </Modal>

      {/* Lightbox */}
      {lightbox && <Lightbox photos={lightbox.photos} startIndex={lightbox.index} onClose={() => setLightbox(null)} />}

      {/* Archive confirm */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Archive this job?</h3>
            <p className="text-sm text-gray-600 mb-6">
              The job will be moved to deleted jobs and can be retrieved from job search. Estimates and invoices will be kept.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-3 border border-gray-300 rounded-xl text-gray-700 font-medium min-h-[44px]">Cancel</button>
              <button onClick={handleDeleteJob}
                className="flex-1 py-3 bg-red-600 text-white rounded-xl font-semibold min-h-[44px]">Archive</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
