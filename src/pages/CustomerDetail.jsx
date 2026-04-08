import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, Trash2, Briefcase, FileText, Receipt, Phone, Mail, MapPin, MessageSquare, Send, Copy, Check, Plus } from 'lucide-react';
import { useGet, useMutation } from '../hooks/useApi';
import api from '../lib/api';
import { Card, Badge, Button, LoadingSpinner, Tabs, EmptyState, Modal, Input, Select } from '../components/ui';
import { useSnackbar } from '../components/ui/Snackbar';
import { format } from 'date-fns';

const tabList = [
  { id: 'jobs', label: 'Jobs' },
  { id: 'estimates', label: 'Estimates' },
  { id: 'invoices', label: 'Invoices' },
  { id: 'messages', label: 'Messages' },
];

function formatCurrency(v) {
  return '$' + Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showSnack } = useSnackbar();
  const { data, loading } = useGet(`/customers/${id}`);
  const [activeTab, setActiveTab] = useState('jobs');
  const [deleteModal, setDeleteModal] = useState(false);
  const [addMembershipModal, setAddMembershipModal] = useState(false);
  const [membershipPlanId, setMembershipPlanId] = useState('');
  const [addingMembership, setAddingMembership] = useState(false);
  const [portalCopied, setPortalCopied] = useState(false);
  const { mutate, loading: deleting } = useMutation();

  // Notes
  const [notes, setNotes] = useState('');
  const [notesSaving, setNotesSaving] = useState(false);

  // Messages state
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [convId, setConvId] = useState(null);
  const [messageBody, setMessageBody] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const messagesEndRef = useRef(null);

  const customer = data?.customer || data;

  const { data: jobsData, loading: jobsLoading } = useGet(
    activeTab === 'jobs' ? `/jobs?customer_id=${id}` : null, [activeTab, id]
  );
  const { data: estimatesData, loading: estimatesLoading } = useGet(
    activeTab === 'estimates' ? `/estimates?customer_id=${id}` : null, [activeTab, id]
  );
  const { data: invoicesData, loading: invoicesLoading } = useGet(
    activeTab === 'invoices' ? `/invoices?customer_id=${id}` : null, [activeTab, id]
  );
  const { data: membershipsData, refetch: refetchMemberships } = useGet(`/customers/${id}/memberships`);
  const { data: plansData } = useGet('/memberships/plans');

  const memberships = membershipsData?.memberships || (Array.isArray(membershipsData) ? membershipsData : []);
  const plans = plansData?.plans || (Array.isArray(plansData) ? plansData : []);

  // Sync notes from customer
  useEffect(() => {
    if (customer?.notes != null) setNotes(customer.notes || '');
  }, [customer?.id]);

  // Load messages when tab = 'messages'
  useEffect(() => {
    if (activeTab !== 'messages' || !id) return;
    setMessagesLoading(true);
    api.get(`/sms/customer/${id}/messages`)
      .then(res => {
        setMessages(res.data?.messages || (Array.isArray(res.data) ? res.data : []));
        setConvId(res.data?.conversation_id || null);
      })
      .catch(() => setMessages([]))
      .finally(() => setMessagesLoading(false));
  }, [activeTab, id]);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  async function handleDelete() {
    try {
      await mutate('delete', `/customers/${id}`);
      showSnack('Customer deleted', 'success');
      navigate('/customers');
    } catch {
      showSnack('Failed to delete customer', 'error');
    }
  }

  async function handleNotesBlur() {
    if (!customer || notes === (customer.notes || '')) return;
    setNotesSaving(true);
    try {
      await api.patch(`/customers/${id}`, { notes });
      showSnack('Notes saved', 'success');
    } catch {
      showSnack('Failed to save notes', 'error');
    } finally {
      setNotesSaving(false);
    }
  }

  async function handleAddMembership() {
    if (!membershipPlanId) { showSnack('Select a plan', 'error'); return; }
    setAddingMembership(true);
    try {
      await api.post(`/customers/${id}/memberships`, { plan_id: membershipPlanId });
      showSnack('Membership added', 'success');
      setAddMembershipModal(false);
      setMembershipPlanId('');
      refetchMemberships();
    } catch {
      showSnack('Failed to add membership', 'error');
    } finally {
      setAddingMembership(false);
    }
  }

  async function handleSendMessage(e) {
    e.preventDefault();
    if (!messageBody.trim() || !convId) return;
    setSendingMsg(true);
    try {
      await api.post(`/sms/conversations/${convId}/send`, { body: messageBody });
      setMessageBody('');
      const res = await api.get(`/sms/customer/${id}/messages`);
      setMessages(res.data?.messages || (Array.isArray(res.data) ? res.data : []));
    } catch {
      showSnack('Failed to send message', 'error');
    } finally {
      setSendingMsg(false);
    }
  }

  function handleCopyPortal(url) {
    navigator.clipboard.writeText(url).then(() => {
      setPortalCopied(true);
      setTimeout(() => setPortalCopied(false), 2000);
    });
  }

  function handleNavigate() {
    const addr = [customer?.address, customer?.city, customer?.state, customer?.zip].filter(Boolean).join(', ');
    if (!addr) return;
    window.open('https://maps.google.com/?q=' + encodeURIComponent(addr), '_blank');
  }

  if (loading) return <LoadingSpinner fullPage />;
  if (!customer) return <div className="p-4 text-gray-500">Customer not found.</div>;

  const name = `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || customer.name || 'Customer';
  const jobs = jobsData?.jobs || (Array.isArray(jobsData) ? jobsData : []);
  const estimates = estimatesData?.estimates || (Array.isArray(estimatesData) ? estimatesData : []);
  const invoices = invoicesData?.invoices || (Array.isArray(invoicesData) ? invoicesData : []);

  const portalUrl = customer.portal_token
    ? `${import.meta.env.VITE_API_URL?.replace('/api', '') || ''}/portal/${customer.portal_token}`
    : null;

  const hasAddress = customer.address || customer.city;

  return (
    <div className="p-4 max-w-3xl mx-auto pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-600">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-bold text-gray-900 text-lg flex-1 truncate">{name}</h1>
        <button
          onClick={() => navigate('/jobs/new', { state: { customer: { id, name } } })}
          className="p-2 rounded-xl hover:bg-blue-50 min-h-[44px] min-w-[44px] flex items-center justify-center text-[#1A73E8]"
          title="Add Job"
        >
          <Plus size={20} />
        </button>
        <button onClick={() => navigate(`/customers/${id}/edit`)} className="p-2 rounded-xl hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-600">
          <Edit size={20} />
        </button>
        <button onClick={() => setDeleteModal(true)} className="p-2 rounded-xl hover:bg-red-50 min-h-[44px] min-w-[44px] flex items-center justify-center text-red-500">
          <Trash2 size={20} />
        </button>
      </div>

      {/* Info Card */}
      <Card className="mb-4">
        <div className="space-y-2">
          {customer.customer_type && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-[#1A73E8]">
              {customer.customer_type}
            </span>
          )}
          {customer.phone && (
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <Phone size={14} className="text-gray-400" />
              {customer.phone}
            </div>
          )}
          {(customer.extra_phones || []).map((ph, i) => ph ? (
            <div key={i} className="flex items-center gap-2 text-sm text-gray-700">
              <Phone size={14} className="text-gray-400" />
              {ph}
            </div>
          ) : null)}
          {customer.email && (
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <Mail size={14} className="text-gray-400" />
              {customer.email}
            </div>
          )}
          {(customer.extra_emails || []).map((em, i) => em ? (
            <div key={i} className="flex items-center gap-2 text-sm text-gray-700">
              <Mail size={14} className="text-gray-400" />
              {em}
            </div>
          ) : null)}
        </div>
      </Card>

      {/* Address card with Navigate */}
      {hasAddress && (
        <Card className="mb-4">
          <div className="flex items-start gap-3">
            <MapPin size={18} className="text-[#1A73E8] mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-400 font-medium uppercase mb-0.5">Address</p>
              <p className="text-sm text-gray-800">
                {[customer.address, customer.city, customer.state, customer.zip].filter(Boolean).join(', ')}
              </p>
            </div>
            <button
              onClick={handleNavigate}
              className="text-sm text-[#1A73E8] font-semibold min-h-[44px] flex items-center px-2"
            >
              Navigate
            </button>
          </div>
        </Card>
      )}

      {/* Memberships card */}
      <Card className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-gray-400 font-medium uppercase">Memberships</p>
          <button
            onClick={() => setAddMembershipModal(true)}
            className="flex items-center gap-1 text-xs text-[#1A73E8] font-semibold min-h-[44px] px-2"
          >
            <Plus size={14} /> Add
          </button>
        </div>
        {memberships.length === 0 ? (
          <p className="text-sm text-gray-400">No active memberships.</p>
        ) : (
          <div className="space-y-2">
            {memberships.map((m, i) => (
              <div key={m.id || i} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{m.plan_name || 'Membership'}</p>
                  {m.renewal_date && (
                    <p className="text-xs text-gray-400">Renews {m.renewal_date}</p>
                  )}
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  m.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {m.status || 'active'}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Notes card */}
      <Card className="mb-4">
        <p className="text-xs text-gray-400 font-medium uppercase mb-2">
          Notes {notesSaving && <span className="text-[#1A73E8] ml-1">saving...</span>}
        </p>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          onBlur={handleNotesBlur}
          placeholder="Add customer notes..."
          rows={3}
          className="w-full text-sm text-gray-800 resize-none focus:outline-none bg-transparent placeholder-gray-400"
        />
      </Card>

      {/* Customer Portal */}
      {portalUrl && (
        <Card className="mb-4 border border-blue-100 bg-blue-50">
          <p className="text-xs font-semibold text-blue-700 uppercase mb-2">Customer Portal</p>
          <p className="text-xs text-blue-500 truncate mb-3">{portalUrl}</p>
          <div className="flex gap-2">
            <button
              onClick={() => handleCopyPortal(portalUrl)}
              className="flex items-center gap-1.5 text-sm text-[#1A73E8] font-medium px-3 py-2 rounded-xl border border-[#1A73E8] min-h-[44px] hover:bg-blue-50 transition-colors"
            >
              {portalCopied ? <Check size={14} /> : <Copy size={14} />}
              {portalCopied ? 'Copied' : 'Copy Link'}
            </button>
            <a
              href={portalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-white bg-[#1A73E8] font-medium px-3 py-2 rounded-xl min-h-[44px] hover:bg-blue-700 transition-colors"
            >
              Open Portal
            </a>
          </div>
        </Card>
      )}

      <Tabs tabs={tabList} active={activeTab} onChange={setActiveTab} />

      <div className="mt-4 space-y-2">
        {/* Jobs tab */}
        {activeTab === 'jobs' && (
          jobsLoading ? <LoadingSpinner /> :
          jobs.length === 0 ? (
            <EmptyState
              icon={Briefcase}
              title="No jobs"
              description="No jobs found for this customer."
              action={
                <Button onClick={() => navigate('/jobs/new', { state: { customer: { id, name } } })} size="sm">
                  Add Job
                </Button>
              }
            />
          ) :
          jobs.map(job => (
            <Card key={job.id || job._id} onClick={() => navigate(`/jobs/${job.id || job._id}`)}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{job.title || job.job_title}</p>
                  <p className="text-xs text-gray-400">#{job.job_number || job.id}</p>
                </div>
                <Badge status={job.status} label={job.status?.replace(/_/g, ' ')} />
              </div>
            </Card>
          ))
        )}

        {/* Estimates tab */}
        {activeTab === 'estimates' && (
          estimatesLoading ? <LoadingSpinner /> :
          estimates.length === 0 ? <EmptyState icon={FileText} title="No estimates" /> :
          estimates.map(est => (
            <Card key={est.id || est._id} onClick={() => navigate(`/estimates/${est.id || est._id}`)}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">#{est.estimate_number || est.id}</p>
                  <p className="text-sm text-gray-500">{est.title || 'Estimate'}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{formatCurrency(est.total)}</p>
                  <Badge status={est.status} label={est.status} />
                </div>
              </div>
            </Card>
          ))
        )}

        {/* Invoices tab */}
        {activeTab === 'invoices' && (
          invoicesLoading ? <LoadingSpinner /> :
          invoices.length === 0 ? <EmptyState icon={Receipt} title="No invoices" /> :
          invoices.map(inv => (
            <Card key={inv.id || inv._id} onClick={() => navigate(`/invoices/${inv.id || inv._id}`)}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">#{inv.invoice_number || inv.id}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{formatCurrency(inv.total)}</p>
                  <Badge status={inv.status} label={inv.status} />
                </div>
              </div>
            </Card>
          ))
        )}

        {/* Messages tab */}
        {activeTab === 'messages' && (
          <div className="flex flex-col" style={{ minHeight: '400px' }}>
            <div className="flex-1 space-y-3 pb-4">
              {messagesLoading ? (
                <LoadingSpinner />
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <MessageSquare size={40} className="text-gray-200 mb-3" />
                  <p className="text-gray-400 text-sm">No messages with this customer yet.</p>
                </div>
              ) : (
                messages.map((msg, i) => {
                  const isOutbound = msg.direction === 'outbound' || msg.type === 'outbound';
                  return (
                    <div key={msg.id || i} className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                        isOutbound ? 'bg-[#1A73E8] text-white rounded-br-sm' : 'bg-gray-100 text-gray-900 rounded-bl-sm'
                      }`}>
                        <p className="text-sm">{msg.body || msg.message}</p>
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
                <input
                  type="text"
                  value={messageBody}
                  onChange={e => setMessageBody(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 rounded-full border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A73E8] min-h-[44px]"
                />
                <button
                  type="submit"
                  disabled={sendingMsg || !messageBody.trim()}
                  className="w-11 h-11 bg-[#1A73E8] text-white rounded-full flex items-center justify-center disabled:opacity-50"
                >
                  <Send size={18} />
                </button>
              </form>
            ) : (
              <p className="text-xs text-gray-400 text-center pt-3 border-t border-gray-100">
                No SMS conversation found for this customer.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Add Membership Modal */}
      <Modal
        isOpen={addMembershipModal}
        onClose={() => setAddMembershipModal(false)}
        title="Add Membership"
        footer={
          <>
            <Button variant="outlined" onClick={() => setAddMembershipModal(false)}>Cancel</Button>
            <Button loading={addingMembership} onClick={handleAddMembership}>Add</Button>
          </>
        }
      >
        <Select
          label="Membership Plan"
          value={membershipPlanId}
          onChange={e => setMembershipPlanId(e.target.value)}
          options={[
            { value: '', label: 'Select a plan...' },
            ...plans.map(p => ({ value: p.id || p._id, label: p.name })),
          ]}
        />
      </Modal>

      {/* Delete Modal */}
      <Modal
        isOpen={deleteModal}
        onClose={() => setDeleteModal(false)}
        title="Delete Customer"
        footer={
          <>
            <Button variant="outlined" onClick={() => setDeleteModal(false)}>Cancel</Button>
            <Button variant="danger" loading={deleting} onClick={handleDelete}>Delete</Button>
          </>
        }
      >
        <p className="text-gray-600">
          Are you sure you want to delete <strong>{name}</strong>? This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
