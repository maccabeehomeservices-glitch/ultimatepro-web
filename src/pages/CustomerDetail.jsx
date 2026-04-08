import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, Trash2, Briefcase, FileText, Receipt, Phone, Mail, MapPin, MessageSquare, Send, Copy, Check } from 'lucide-react';
import { useGet, useMutation } from '../hooks/useApi';
import api from '../lib/api';
import { Card, Badge, Button, LoadingSpinner, Tabs, EmptyState, Modal } from '../components/ui';
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
  const [portalCopied, setPortalCopied] = useState(false);
  const { mutate, loading: deleting } = useMutation();

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

  if (loading) return <LoadingSpinner fullPage />;
  if (!customer) return <div className="p-4 text-gray-500">Customer not found.</div>;

  const name = `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || customer.name || 'Customer';
  const jobs = jobsData?.jobs || (Array.isArray(jobsData) ? jobsData : []);
  const estimates = estimatesData?.estimates || (Array.isArray(estimatesData) ? estimatesData : []);
  const invoices = invoicesData?.invoices || (Array.isArray(invoicesData) ? invoicesData : []);

  const portalUrl = customer.portal_token
    ? `${import.meta.env.VITE_API_URL?.replace('/api', '') || ''}/portal/${customer.portal_token}`
    : null;

  return (
    <div className="p-4 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-600">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-bold text-gray-900 text-lg flex-1 truncate">{name}</h1>
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
          {customer.phone && (
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <Phone size={14} className="text-gray-400" />
              {customer.phone}
            </div>
          )}
          {customer.email && (
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <Mail size={14} className="text-gray-400" />
              {customer.email}
            </div>
          )}
          {(customer.address || customer.city) && (
            <div className="flex items-start gap-2 text-sm text-gray-700">
              <MapPin size={14} className="text-gray-400 mt-0.5" />
              <span>{[customer.address, customer.city, customer.state, customer.zip].filter(Boolean).join(', ')}</span>
            </div>
          )}
        </div>
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
          jobs.length === 0 ? <EmptyState icon={Briefcase} title="No jobs" description="No jobs found for this customer." /> :
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
