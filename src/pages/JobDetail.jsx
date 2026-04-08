import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowLeft, Edit, Send } from 'lucide-react';
import { useGet, useMutation } from '../hooks/useApi';
import api from '../lib/api';
import { Card, Badge, Button, Modal, LoadingSpinner, Tabs, Input, Select } from '../components/ui';
import { useSnackbar } from '../components/ui/Snackbar';

const JOB_STATUSES = [
  { value: 'unscheduled', label: 'Unscheduled' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'en_route', label: 'En Route' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'holding', label: 'Holding' },
  { value: 'cancelled', label: 'Cancelled' },
];

const REMINDER_OPTIONS = [
  { value: '', label: 'Default' },
  { value: 'email', label: 'Email' },
  { value: 'sms', label: 'SMS' },
  { value: 'both', label: 'Both' },
  { value: 'none', label: 'None' },
];

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'check', label: 'Check' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'ach', label: 'ACH' },
];

const tabList = [
  { id: 'details', label: 'Details' },
  { id: 'history', label: 'History' },
  { id: 'messages', label: 'Messages' },
];

function formatCurrency(v) {
  return '$' + Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function JobDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showSnack } = useSnackbar();
  const { data: job, loading, refetch } = useGet(`/jobs/${id}`);
  const { mutate, loading: mutating } = useMutation();

  const [activeTab, setActiveTab] = useState('details');
  const [statusModal, setStatusModal] = useState(false);
  const [dispatchModal, setDispatchModal] = useState(false);
  const [sendToModal, setSendToModal] = useState(false);
  const [depositModal, setDepositModal] = useState(false);
  const [depositForm, setDepositForm] = useState({ method: 'cash', amount: '' });
  const [reminderMethod, setReminderMethod] = useState('');

  // Send To state
  const [sendToRecipients, setSendToRecipients] = useState([]);
  const [sendToLoading, setSendToLoading] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState(null);
  const [sendMethod, setSendMethod] = useState('sms');
  const [sendingTo, setSendingTo] = useState(false);

  // History state
  const [jobHistory, setJobHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Messages state
  const [jobMessages, setJobMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [convId, setConvId] = useState(null);
  const [messageBody, setMessageBody] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const messagesEndRef = useRef(null);

  const jobData = job?.job || job;

  // Sync reminder method from job
  useEffect(() => {
    if (jobData?.reminder_method != null) {
      setReminderMethod(jobData.reminder_method || '');
    }
  }, [jobData?.reminder_method]);

  // Load history when tab = 'history'
  useEffect(() => {
    if (activeTab !== 'history' || !id) return;
    setHistoryLoading(true);
    api.get(`/jobs/${id}/history`)
      .then(res => setJobHistory(res.data?.history || (Array.isArray(res.data) ? res.data : [])))
      .catch(() => setJobHistory([]))
      .finally(() => setHistoryLoading(false));
  }, [activeTab, id]);

  // Load messages when tab = 'messages'
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

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [jobMessages.length]);

  // Load Send To recipients when modal opens
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

  async function handleStatusChange(status) {
    try {
      await mutate('put', `/jobs/${id}`, { status });
      setStatusModal(false);
      refetch();
      showSnack('Status updated', 'success');
    } catch {
      showSnack('Failed to update status', 'error');
    }
  }

  async function handleCreateEstimate() {
    try {
      const result = await mutate('post', '/estimates', { job_id: id, customer_id: jobData?.customer_id });
      navigate(`/estimates/${result?.estimate?.id || result?.id}`);
    } catch {
      showSnack('Failed to create estimate', 'error');
    }
  }

  async function handleDispatch() {
    try {
      await mutate('post', `/jobs/${id}/dispatch`, { tech_lat: 0, tech_lng: 0 });
      setDispatchModal(false);
      refetch();
      showSnack('Tech dispatched', 'success');
    } catch {
      showSnack('Failed to dispatch', 'error');
    }
  }

  async function handleSendTo() {
    if (!selectedRecipient) return;
    setSendingTo(true);
    try {
      if (selectedRecipient.type === 'partner') {
        await api.post(`/jobs/${id}/send-to-partner`, {
          partner_id: selectedRecipient.id,
          connection_id: selectedRecipient.connection_id,
        });
        showSnack(`Job sent to ${selectedRecipient.name}`, 'success');
        refetch();
      } else if (selectedRecipient.type === 'app_user') {
        showSnack(`Notification sent to ${selectedRecipient.name}`, 'success');
      } else {
        // roster_tech
        await api.post('/roster-techs/notify-tech', {
          job_id: id,
          tech_id: selectedRecipient.id,
          method: sendMethod,
        });
        showSnack(`Sent to ${selectedRecipient.name}`, 'success');
      }
      setSendToModal(false);
      setSelectedRecipient(null);
    } catch {
      showSnack('Failed to send', 'error');
    } finally {
      setSendingTo(false);
    }
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
    } catch {
      showSnack('Failed to collect deposit', 'error');
    }
  }

  async function handleReminderChange(e) {
    const method = e.target.value;
    setReminderMethod(method);
    try {
      await api.patch(`/jobs/${id}/reminder-method`, { method });
    } catch {
      // silent
    }
  }

  async function handleSendMessage(e) {
    e.preventDefault();
    if (!messageBody.trim() || !convId) return;
    setSendingMsg(true);
    try {
      await api.post(`/sms/conversations/${convId}/send`, { body: messageBody });
      setMessageBody('');
      const res = await api.get(`/sms/job/${id}/messages`);
      setJobMessages(res.data?.messages || (Array.isArray(res.data) ? res.data : []));
    } catch {
      showSnack('Failed to send message', 'error');
    } finally {
      setSendingMsg(false);
    }
  }

  if (loading) return <LoadingSpinner fullPage />;
  if (!jobData) return <div className="p-4 text-gray-500">Job not found.</div>;

  const isDeletedOrCancelled = ['deleted', 'cancelled'].includes(jobData.status);
  const hasDeposit = jobData.deposit_required && !jobData.deposit_collected;

  return (
    <div className="p-4 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-600"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-gray-900 text-lg truncate">{jobData.title || jobData.job_title}</h1>
          <p className="text-sm text-gray-400">#{jobData.job_number || jobData.id}</p>
        </div>
        <button
          onClick={() => navigate(`/jobs/${id}/edit`)}
          className="p-2 rounded-xl hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-600"
        >
          <Edit size={20} />
        </button>
      </div>

      <Tabs tabs={tabList} active={activeTab} onChange={setActiveTab} />

      <div className="mt-4 space-y-4">
        {/* DETAILS TAB */}
        {activeTab === 'details' && (
          <>
            <Card>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge status={jobData.status} label={jobData.status?.replace(/_/g, ' ')} />
                </div>
                {jobData.description && (
                  <p className="text-sm text-gray-600">{jobData.description}</p>
                )}
                {(jobData.scheduled_date || jobData.scheduled_at) && (
                  <div>
                    <p className="text-xs text-gray-400 font-medium uppercase">Scheduled</p>
                    <p className="text-sm text-gray-800">
                      {format(new Date(jobData.scheduled_date || jobData.scheduled_at), 'PPp')}
                    </p>
                  </div>
                )}
                {(jobData.address || jobData.service_address) && (
                  <div>
                    <p className="text-xs text-gray-400 font-medium uppercase">Address</p>
                    <p className="text-sm text-gray-800">{jobData.address || jobData.service_address}</p>
                  </div>
                )}
                {/* Reminder override */}
                {(jobData.scheduled_date || jobData.scheduled_at) && (
                  <div>
                    <p className="text-xs text-gray-400 font-medium uppercase mb-1">Reminder</p>
                    <Select
                      value={reminderMethod}
                      onChange={handleReminderChange}
                      options={REMINDER_OPTIONS}
                    />
                  </div>
                )}
              </div>
            </Card>

            {/* Customer Card */}
            {(jobData.customer_id || jobData.customer) && (
              <Card onClick={() => navigate(`/customers/${jobData.customer_id || jobData.customer?.id}`)}>
                <p className="text-xs text-gray-400 font-medium uppercase mb-1">Customer</p>
                <p className="font-semibold text-gray-900">
                  {jobData.customer_name || jobData.customer?.name || 'View Customer'}
                </p>
                {jobData.customer?.phone && (
                  <p className="text-sm text-gray-500">{jobData.customer.phone}</p>
                )}
              </Card>
            )}

            {/* Actions */}
            <div className="flex flex-col gap-2">
              <Button onClick={() => setStatusModal(true)} className="w-full">
                Update Status
              </Button>
              {jobData.status === 'scheduled' && (
                <Button onClick={() => setDispatchModal(true)} className="w-full">
                  Dispatch Tech
                </Button>
              )}
              {!isDeletedOrCancelled && (
                <Button variant="outlined" onClick={() => setSendToModal(true)} className="w-full">
                  Send To
                </Button>
              )}
              {hasDeposit && (
                <Button variant="outlined" onClick={() => setDepositModal(true)} className="w-full">
                  Collect Deposit
                </Button>
              )}
              {!jobData.has_estimate && (
                <Button variant="outlined" onClick={handleCreateEstimate} loading={mutating} className="w-full">
                  Create Estimate
                </Button>
              )}
            </div>
          </>
        )}

        {/* HISTORY TAB */}
        {activeTab === 'history' && (
          historyLoading ? <LoadingSpinner /> : (
            <Card>
              {jobHistory.length > 0 ? (
                <div className="space-y-4">
                  {jobHistory.map((event, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-[#1A73E8] mt-1.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {event.description || event.event || event.action || event.note}
                        </p>
                        {event.created_at && (
                          <p className="text-xs text-gray-400">
                            {format(new Date(event.created_at), 'PPp')}
                          </p>
                        )}
                        {event.user_name && (
                          <p className="text-xs text-gray-400">{event.user_name}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {jobData.created_at && (
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-green-400 mt-1.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Job Created</p>
                        <p className="text-xs text-gray-400">{format(new Date(jobData.created_at), 'PPp')}</p>
                      </div>
                    </div>
                  )}
                  {jobData.status && (
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          Current Status: {jobData.status?.replace(/_/g, ' ')}
                        </p>
                      </div>
                    </div>
                  )}
                  {jobData.has_estimate && (
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-purple-400 mt-1.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Estimate created</p>
                      </div>
                    </div>
                  )}
                  {jobData.has_invoice && (
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-amber-400 mt-1.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Invoice created</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Card>
          )
        )}

        {/* MESSAGES TAB */}
        {activeTab === 'messages' && (
          <div className="flex flex-col" style={{ minHeight: '400px' }}>
            <div className="flex-1 space-y-3 pb-4">
              {messagesLoading ? (
                <LoadingSpinner />
              ) : jobMessages.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-8">No messages for this job yet.</p>
              ) : (
                jobMessages.map((msg, i) => {
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
                No SMS conversation linked to this job.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Status Modal */}
      <Modal isOpen={statusModal} onClose={() => setStatusModal(false)} title="Update Status">
        <div className="space-y-2">
          {JOB_STATUSES.map(s => (
            <button
              key={s.value}
              onClick={() => handleStatusChange(s.value)}
              className={`w-full text-left px-4 py-3 rounded-xl transition-colors min-h-[44px] flex items-center gap-3 ${
                jobData.status === s.value ? 'bg-blue-50 text-[#1A73E8] font-semibold' : 'hover:bg-gray-50 text-gray-700'
              }`}
            >
              <Badge status={s.value} label={s.label} />
            </button>
          ))}
        </div>
      </Modal>

      {/* Dispatch Modal */}
      <Modal
        isOpen={dispatchModal}
        onClose={() => setDispatchModal(false)}
        title="Dispatch Tech"
        footer={
          <>
            <Button variant="outlined" onClick={() => setDispatchModal(false)}>Cancel</Button>
            <Button loading={mutating} onClick={handleDispatch}>Dispatch</Button>
          </>
        }
      >
        <p className="text-gray-600">
          Dispatch tech to {jobData.customer_name || 'the customer'}? They will receive an ETA notification.
        </p>
      </Modal>

      {/* Send To Modal */}
      <Modal
        isOpen={sendToModal}
        onClose={() => { setSendToModal(false); setSelectedRecipient(null); }}
        title="Send To"
        footer={
          <>
            <Button variant="outlined" onClick={() => { setSendToModal(false); setSelectedRecipient(null); }}>Cancel</Button>
            <Button loading={sendingTo} disabled={!selectedRecipient} onClick={handleSendTo}>Send</Button>
          </>
        }
      >
        {sendToLoading ? (
          <LoadingSpinner />
        ) : sendToRecipients.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-4">
            No recipients available. Add roster techs or network connections.
          </p>
        ) : (
          <div className="space-y-4">
            {sendToRecipients.some(r => r.type !== 'partner') && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Technicians</p>
                {sendToRecipients.filter(r => r.type !== 'partner').map(r => (
                  <button
                    key={r.id}
                    onClick={() => { setSelectedRecipient(r); setSendMethod('sms'); }}
                    className={`w-full text-left px-4 py-3 rounded-xl mb-1 flex items-center gap-3 transition-colors border ${
                      selectedRecipient?.id === r.id
                        ? 'bg-blue-50 border-[#1A73E8]'
                        : 'bg-gray-50 border-transparent hover:bg-gray-100'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-[#1A73E8] text-white flex items-center justify-center text-sm font-semibold flex-shrink-0">
                      {(r.name || '?')[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-sm text-gray-900">{r.name}</p>
                      <p className="text-xs text-gray-400">{r.type === 'app_user' ? 'App notification' : 'SMS / Email'}</p>
                    </div>
                  </button>
                ))}
                {selectedRecipient && selectedRecipient.type === 'roster_tech' && (
                  <div className="flex gap-2 mt-2">
                    {['sms', 'email', 'both'].map(m => (
                      <button
                        key={m}
                        onClick={() => setSendMethod(m)}
                        className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors min-h-[44px] ${
                          sendMethod === m ? 'bg-[#1A73E8] text-white border-[#1A73E8]' : 'bg-white text-gray-600 border-gray-200'
                        }`}
                      >
                        {m.charAt(0).toUpperCase() + m.slice(1)}
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
                  <button
                    key={r.id}
                    onClick={() => setSelectedRecipient(r)}
                    className={`w-full text-left px-4 py-3 rounded-xl mb-1 flex items-center gap-3 transition-colors border ${
                      selectedRecipient?.id === r.id
                        ? 'bg-blue-50 border-[#1A73E8]'
                        : 'bg-gray-50 border-transparent hover:bg-gray-100'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-sm font-semibold flex-shrink-0">
                      {(r.name || '?')[0].toUpperCase()}
                    </div>
                    <p className="font-medium text-sm text-gray-900">{r.name}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Collect Deposit Modal */}
      <Modal
        isOpen={depositModal}
        onClose={() => setDepositModal(false)}
        title="Collect Deposit"
        footer={
          <>
            <Button variant="outlined" onClick={() => setDepositModal(false)}>Cancel</Button>
            <Button loading={mutating} onClick={handleCollectDeposit}>Collect</Button>
          </>
        }
      >
        <div className="space-y-3">
          {jobData.deposit_amount && (
            <p className="text-sm text-gray-600">
              Deposit amount: <strong>{formatCurrency(jobData.deposit_amount)}</strong>
            </p>
          )}
          <Select
            label="Payment Method"
            value={depositForm.method}
            onChange={e => setDepositForm(p => ({ ...p, method: e.target.value }))}
            options={PAYMENT_METHODS}
          />
          <Input
            label="Amount"
            type="number"
            value={depositForm.amount}
            onChange={e => setDepositForm(p => ({ ...p, amount: e.target.value }))}
            placeholder={jobData.deposit_amount?.toString() || '0.00'}
          />
        </div>
      </Modal>
    </div>
  );
}
