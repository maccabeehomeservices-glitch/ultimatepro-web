import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useGet, useMutation } from '../hooks/useApi';
import api, { invoicesApi, paymentsApi, customersApi } from '../lib/api';
import { Card, Badge, Button, LoadingSpinner, Modal, Input, Select } from '../components/ui';
import { useSnackbar } from '../components/ui/Snackbar';
import { format } from 'date-fns';
import SignaturePad from '../components/SignaturePad';

function formatCurrency(v) {
  return '$' + Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(d) {
  if (!d) return '';
  try { return format(new Date(d), 'MMM d, yyyy'); } catch { return d; }
}

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'check', label: 'Check' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'ach', label: 'ACH / Bank Transfer' },
  { value: 'other', label: 'Other' },
];

export default function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showSnack } = useSnackbar();
  const { data, loading, refetch } = useGet(`/invoices/${id}`);
  const { mutate, loading: acting } = useMutation();
  const [paymentModal, setPaymentModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ amount: '', method: 'cash', notes: '' });
  const [stopModal, setStopModal] = useState(false);
  const [resumeModal, setResumeModal] = useState(false);
  const [showSignature, setShowSignature] = useState(false);
  const [savingSig, setSavingSig] = useState(false);
  const [scanpayLoading, setScanpayLoading] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendEmails, setSendEmails] = useState([]);
  const [sendPhones, setSendPhones] = useState([]);
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [saveContactsToProfile, setSaveContactsToProfile] = useState(true);
  const [sending, setSending] = useState(false);

  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptEmails, setReceiptEmails] = useState([]);
  const [receiptPhones, setReceiptPhones] = useState([]);
  const [receiptNewEmail, setReceiptNewEmail] = useState('');
  const [receiptNewPhone, setReceiptNewPhone] = useState('');
  const [receiptSendEmail, setReceiptSendEmail] = useState(true);
  const [receiptSendSms, setReceiptSendSms] = useState(true);
  const [receiptSaveToProfile, setReceiptSaveToProfile] = useState(true);
  const [receiptSendReview, setReceiptSendReview] = useState(false);
  const [receiptSubmitting, setReceiptSubmitting] = useState(false);

  // Track which recipients were already on the customer profile when each
  // modal was opened. Newly-added recipients (not in these sets) are
  // persisted to the profile only after a successful send, when the
  // save-to-profile toggle is still on at that moment.
  const originalSendEmailsRef = useRef(new Set());
  const originalSendPhonesRef = useRef(new Set());
  const originalReceiptEmailsRef = useRef(new Set());
  const originalReceiptPhonesRef = useRef(new Set());

  const location = useLocation();
  const invoice = data?.invoice || data;

  async function handlePayment() {
    try {
      await mutate('post', `/invoices/${id}/payment`, {
        amount: Number(paymentForm.amount),
        method: paymentForm.method,
        notes: paymentForm.notes,
      });
      showSnack('Payment recorded', 'success');
      setPaymentModal(false);
      refetch();
    } catch {
      showSnack('Failed to record payment', 'error');
    }
  }

  async function handleCaptureSignature(base64) {
    setSavingSig(true);
    try {
      await invoicesApi.captureSignature(id, base64);
      setShowSignature(false);
      showSnack('Signature captured!', 'success');
      refetch();
    } catch (err) {
      showSnack(err.response?.data?.error || 'Failed to save signature', 'error');
    } finally {
      setSavingSig(false);
    }
  }

  async function handleScanpayCharge() {
    setScanpayLoading(true);
    try {
      const amt = Number(invoice.total || 0) - Number(invoice.total_paid || invoice.amount_paid || 0);
      await paymentsApi.scanpayCharge(id, amt, invoice.customer_email || invoice.cust_email);
      showSnack('ScanPay charge initiated!', 'success');
      refetch();
    } catch (err) {
      showSnack(err.response?.data?.error || 'Charge failed', 'error');
    } finally {
      setScanpayLoading(false);
    }
  }

  async function handleStopReminders() {
    try {
      await mutate('patch', `/invoices/${id}/stop-followup`);
      showSnack('Reminders stopped', 'success');
      setStopModal(false);
      refetch();
    } catch {
      showSnack('Failed to stop reminders', 'error');
    }
  }

  async function handleResumeReminders() {
    try {
      await mutate('patch', `/invoices/${id}/reset-followup`);
      showSnack('Reminders resumed', 'success');
      setResumeModal(false);
      refetch();
    } catch {
      showSnack('Failed to resume reminders', 'error');
    }
  }

  async function openReceiptModal() {
    if (!invoice?.customer_id) { showSnack('No customer on invoice', 'error'); return; }
    try {
      const res = await customersApi.get(invoice.customer_id);
      const customer = res.data?.customer || res.data;
      const primaryEmail = customer?.email;
      const primaryPhone = customer?.phone;
      const extraEmails = (customer?.emails || []).filter(e => e && e !== primaryEmail);
      const extraPhones = (customer?.phones || []).filter(p => p && p !== primaryPhone);
      const emails = [
        ...(primaryEmail ? [{ value: primaryEmail, checked: true }] : []),
        ...extraEmails.map(e => ({ value: e, checked: true })),
      ];
      const phones = [
        ...(primaryPhone ? [{ value: primaryPhone, checked: true }] : []),
        ...extraPhones.map(p => ({ value: p, checked: true })),
      ];
      setReceiptEmails(emails);
      setReceiptPhones(phones);
      originalReceiptEmailsRef.current = new Set(emails.map(e => e.value));
      originalReceiptPhonesRef.current = new Set(phones.map(p => p.value));
      setReceiptNewEmail('');
      setReceiptNewPhone('');
      setReceiptSendEmail(true);
      setReceiptSendSms(true);
      setReceiptSaveToProfile(true);
      setReceiptSendReview(false);
      setShowReceiptModal(true);
    } catch {
      showSnack('Failed to load customer contacts', 'error');
    }
  }

  async function handleSendReceipt() {
    const emails = receiptEmails.filter(e => e.checked).map(e => e.value);
    const phones = receiptPhones.filter(p => p.checked).map(p => p.value);
    if (emails.length === 0 && phones.length === 0) {
      showSnack('Pick at least one recipient', 'error');
      return;
    }
    setReceiptSubmitting(true);
    try {
      await invoicesApi.sendReceipt(id, {
        emails,
        phones,
        send_email: receiptSendEmail && emails.length > 0,
        send_sms: receiptSendSms && phones.length > 0,
        send_review_request: receiptSendReview,
      });
      showSnack('Receipt sent', 'success');
      setShowReceiptModal(false);
      refetch();

      // Persist newly-added recipients to the customer profile, only when
      // the toggle is still on at Send-click. Failures aggregate into a
      // single non-blocking snackbar; the send already succeeded.
      if (receiptSaveToProfile && invoice?.customer_id) {
        const newEmails = receiptEmails
          .filter(e => e.checked && !originalReceiptEmailsRef.current.has(e.value))
          .map(e => e.value);
        const newPhones = receiptPhones
          .filter(p => p.checked && !originalReceiptPhonesRef.current.has(p.value))
          .map(p => p.value);
        const failures = [];
        for (const email of newEmails) {
          try {
            await api.post(`/customers/${invoice.customer_id}/contacts`, { type: 'email', value: email });
          } catch {
            failures.push(`email ${email}`);
          }
        }
        for (const phone of newPhones) {
          try {
            await api.post(`/customers/${invoice.customer_id}/contacts`, { type: 'phone', value: phone });
          } catch {
            failures.push(`phone ${phone}`);
          }
        }
        if (failures.length > 0) {
          showSnack(
            `Sent, but failed to save ${failures.length} contact${failures.length > 1 ? 's' : ''} to profile`,
            'error'
          );
        }
      }
    } catch (err) {
      showSnack(err?.response?.data?.error || 'Failed to send receipt', 'error');
    } finally {
      setReceiptSubmitting(false);
    }
  }

  function handleAddReceiptEmail() {
    const v = receiptNewEmail.trim();
    if (!v) return;
    setReceiptEmails(prev => [...prev, { value: v, checked: true }]);
    setReceiptNewEmail('');
  }

  function handleAddReceiptPhone() {
    const v = receiptNewPhone.trim();
    if (!v) return;
    setReceiptPhones(prev => [...prev, { value: v, checked: true }]);
    setReceiptNewPhone('');
  }

  useEffect(() => {
    if (location.state?.openReceipt && invoice?.customer_id && !showReceiptModal) {
      openReceiptModal();
      navigate(location.pathname, { replace: true, state: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoice?.customer_id]);

  async function openSendModal() {
    if (!invoice?.customer_id) { showSnack('No customer on invoice', 'error'); return; }
    try {
      const res = await customersApi.get(invoice.customer_id);
      const customer = res.data?.customer || res.data;
      const primaryEmail = customer?.email;
      const primaryPhone = customer?.phone;
      const extraEmails = (customer?.emails || []).filter(e => e && e !== primaryEmail);
      const extraPhones = (customer?.phones || []).filter(p => p && p !== primaryPhone);
      const emails = [
        ...(primaryEmail ? [{ value: primaryEmail, checked: true }] : []),
        ...extraEmails.map(e => ({ value: e, checked: true })),
      ];
      const phones = [
        ...(primaryPhone ? [{ value: primaryPhone, checked: true }] : []),
        ...extraPhones.map(p => ({ value: p, checked: true })),
      ];
      setSendEmails(emails);
      setSendPhones(phones);
      originalSendEmailsRef.current = new Set(emails.map(e => e.value));
      originalSendPhonesRef.current = new Set(phones.map(p => p.value));
      setNewEmail('');
      setNewPhone('');
      setShowSendModal(true);
    } catch {
      showSnack('Failed to load customer contacts', 'error');
    }
  }

  async function handleSendConfirm() {
    const emails = sendEmails.filter(e => e.checked).map(e => e.value);
    const phones = sendPhones.filter(p => p.checked).map(p => p.value);
    if (emails.length === 0 && phones.length === 0) {
      showSnack('Pick at least one recipient', 'error');
      return;
    }
    setSending(true);
    try {
      await invoicesApi.send(id, {
        emails,
        phones,
        send_email: emails.length > 0,
        send_sms: phones.length > 0,
      });
      showSnack('Invoice sent', 'success');
      setShowSendModal(false);
      refetch();

      // Persist newly-added recipients to the customer profile, only when
      // the toggle is still on at Send-click. Failures aggregate into a
      // single non-blocking snackbar; the send already succeeded.
      if (saveContactsToProfile && invoice?.customer_id) {
        const newEmails = sendEmails
          .filter(e => e.checked && !originalSendEmailsRef.current.has(e.value))
          .map(e => e.value);
        const newPhones = sendPhones
          .filter(p => p.checked && !originalSendPhonesRef.current.has(p.value))
          .map(p => p.value);
        const failures = [];
        for (const email of newEmails) {
          try {
            await api.post(`/customers/${invoice.customer_id}/contacts`, { type: 'email', value: email });
          } catch {
            failures.push(`email ${email}`);
          }
        }
        for (const phone of newPhones) {
          try {
            await api.post(`/customers/${invoice.customer_id}/contacts`, { type: 'phone', value: phone });
          } catch {
            failures.push(`phone ${phone}`);
          }
        }
        if (failures.length > 0) {
          showSnack(
            `Sent, but failed to save ${failures.length} contact${failures.length > 1 ? 's' : ''} to profile`,
            'error'
          );
        }
      }
    } catch (err) {
      showSnack(err?.response?.data?.error || 'Failed to send invoice', 'error');
    } finally {
      setSending(false);
    }
  }

  function handleAddSendEmail() {
    const v = newEmail.trim();
    if (!v) return;
    setSendEmails(prev => [...prev, { value: v, checked: true }]);
    setNewEmail('');
  }

  function handleAddSendPhone() {
    const v = newPhone.trim();
    if (!v) return;
    setSendPhones(prev => [...prev, { value: v, checked: true }]);
    setNewPhone('');
  }

  if (loading) return <LoadingSpinner fullPage />;
  if (!invoice) return <div className="p-4 text-gray-500">Invoice not found.</div>;

  const lineItems = invoice.line_items || invoice.items || [];
  const payments = invoice.payments || [];
  const isPaid = invoice.status === 'paid';
  const isPartiallyPaid = invoice.status === 'partial' || invoice.status === 'partially_paid';
  const hasFollowup = invoice.followup_count != null;

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-600">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="font-bold text-gray-900 text-lg">
            {`Invoice ${invoice.invoice_number || invoice.id?.slice(0,8)}`}
          </h1>
          {(invoice.cust_first || invoice.cust_last) && (
            <p className="text-sm text-gray-500">
              {[invoice.cust_first, invoice.cust_last].filter(Boolean).join(' ')}
            </p>
          )}
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <Badge status={invoice.status} label={invoice.status} />
          </div>
        </div>
      </div>

      {/* Customer */}
      {(invoice.cust_first || invoice.cust_last || invoice.cust_phone || invoice.cust_email || invoice.cust_address) && (
        <Card className="mb-4">
          <p className="text-xs text-blue-600 uppercase font-semibold tracking-wider mb-2">Bill To</p>
          <div className="space-y-1">
            <p className="font-semibold text-gray-900 text-base">
              {[invoice.cust_first, invoice.cust_last].filter(Boolean).join(' ') || '-'}
            </p>
            {invoice.cust_phone && (
              <a
                href={`tel:${invoice.cust_phone}`}
                className="block text-sm text-blue-600 hover:underline"
              >
                📞 {invoice.cust_phone}
              </a>
            )}
            {invoice.cust_email && (
              <a
                href={`mailto:${invoice.cust_email}`}
                className="block text-sm text-blue-600 hover:underline truncate"
              >
                ✉️ {invoice.cust_email}
              </a>
            )}
            {(invoice.cust_address || invoice.cust_city) && (
              <p className="text-sm text-gray-600">
                📍 {[invoice.cust_address, invoice.cust_city, invoice.cust_state, invoice.cust_zip]
                      .filter(Boolean)
                      .join(', ')}
              </p>
            )}
          </div>
        </Card>
      )}

      {/* Line Items */}
      <Card className="mb-4">
        <p className="text-xs text-gray-400 uppercase font-medium mb-3">Line Items</p>
        {lineItems.map((item, i) => {
          const qty = Number(item.qty || item.quantity || 1);
          const price = Number(item.unit_price || item.price || 0);
          const itemTotal = Number(item.total || qty * price);
          const isDiscount = item.item_type === 'discount';
          return (
            <div key={i} className="flex items-start justify-between gap-3 py-2 border-b border-gray-50 last:border-0">
              {item.image_url && (
                <img src={item.image_url} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0 border border-gray-100" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">
                  {item.name}
                  {isDiscount && (
                    <span className="ml-2 text-[10px] font-semibold text-red-500 bg-red-50 px-1.5 py-0.5 rounded">DISCOUNT</span>
                  )}
                </p>
                {item.description && (
                  <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
                )}
                <p className="text-xs text-gray-400 mt-0.5">
                  {item.sku && <span className="mr-2">SKU: {item.sku}</span>}
                  {qty} × {formatCurrency(price)}
                </p>
              </div>
              <p className={`font-semibold text-sm ${isDiscount ? 'text-red-500' : 'text-gray-900'}`}>
                {isDiscount ? '-' : ''}{formatCurrency(itemTotal)}
              </p>
            </div>
          );
        })}
        <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between">
          <p className="font-bold">Total</p>
          <p className="font-bold text-xl text-[#1A73E8]">{formatCurrency(invoice.total)}</p>
        </div>
      </Card>

      {/* Payment History */}
      {payments.length > 0 && (
        <Card className="mb-4">
          <p className="text-xs text-gray-400 uppercase font-medium mb-3">Payment History</p>
          {payments.map((p, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
              <div>
                <p className="text-sm font-medium text-gray-900">{p.method || 'Payment'}</p>
                <p className="text-xs text-gray-400">{formatDate(p.date || p.created_at)}</p>
              </div>
              <p className="font-semibold text-green-600">{formatCurrency(p.amount)}</p>
            </div>
          ))}
        </Card>
      )}

      {/* Follow-up reminders */}
      {!isPaid && hasFollowup && (
        <Card className="mb-4">
          <p className="text-xs text-gray-400 uppercase font-medium mb-2">Follow-up Reminders</p>
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm text-gray-700">
              <strong>{invoice.followup_count || 0}</strong> reminder{invoice.followup_count !== 1 ? 's' : ''} sent
            </p>
            {invoice.followup_stopped && (
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">Stopped</span>
            )}
          </div>
          {invoice.followup_last_sent_at && (
            <p className="text-xs text-gray-400 mb-3">
              Last sent: {formatDate(invoice.followup_last_sent_at)}
            </p>
          )}
          <div className="flex gap-2">
            {!invoice.followup_stopped ? (
              <Button size="sm" variant="outlined" onClick={() => setStopModal(true)} className="flex-1">
                Stop Reminders
              </Button>
            ) : (
              <Button size="sm" variant="outlined" onClick={() => setResumeModal(true)} className="flex-1">
                Resume Reminders
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* Unpaid reminder */}
      {!isPaid && (
        <Card className="mb-4 border border-amber-200 bg-amber-50">
          <p className="text-sm font-medium text-amber-800">This invoice has an outstanding balance.</p>
          {invoice.due_date && (
            <p className="text-xs text-amber-600 mt-0.5">Due: {formatDate(invoice.due_date)}</p>
          )}
        </Card>
      )}

      {/* Actions */}
      {(invoice.status === 'draft' || invoice.status === 'sent') && (
        <div className="mb-4">
          <Button onClick={openSendModal} className="w-full">
            Send Invoice
          </Button>
        </div>
      )}
      {!isPaid && (
        <div className="flex flex-col gap-2 mb-4">
          <Button onClick={() => setPaymentModal(true)} className="w-full">
            Charge Payment
          </Button>
          <button
            onClick={handleScanpayCharge}
            disabled={scanpayLoading}
            className="w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-50 min-h-[44px]"
          >
            {scanpayLoading ? 'Processing...' : '💳 Charge via ScanPay'}
          </button>
        </div>
      )}
      {(isPaid || isPartiallyPaid) && (
        <div className="mb-4">
          <Button variant="outlined" onClick={openReceiptModal} className="w-full">
            Send Receipt
          </Button>
        </div>
      )}
      <div className="mb-4">
        <button
          onClick={() => setShowSignature(true)}
          className="w-full py-3 border-2 border-[#1A73E8] text-[#1A73E8] rounded-xl font-semibold min-h-[44px]"
        >
          ✍️ Capture Signature
        </button>
      </div>

      {/* Payment Modal */}
      <Modal
        isOpen={paymentModal}
        onClose={() => setPaymentModal(false)}
        title="Record Payment"
        footer={
          <>
            <Button variant="outlined" onClick={() => setPaymentModal(false)}>Cancel</Button>
            <Button loading={acting} onClick={handlePayment}>Record</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Amount"
            type="number"
            value={paymentForm.amount}
            onChange={e => setPaymentForm(p => ({ ...p, amount: e.target.value }))}
            placeholder="0.00"
          />
          <Select
            label="Payment Method"
            value={paymentForm.method}
            onChange={e => setPaymentForm(p => ({ ...p, method: e.target.value }))}
            options={PAYMENT_METHODS}
          />
          <Input
            label="Notes (optional)"
            value={paymentForm.notes}
            onChange={e => setPaymentForm(p => ({ ...p, notes: e.target.value }))}
            placeholder="Check #1234..."
          />
        </div>
      </Modal>

      {/* Signature Modal */}
      <Modal
        isOpen={showSignature}
        onClose={() => setShowSignature(false)}
        title="Capture Signature"
      >
        <SignaturePad
          onSave={handleCaptureSignature}
          onCancel={() => setShowSignature(false)}
        />
      </Modal>

      {/* Stop Reminders Modal */}
      <Modal
        isOpen={stopModal}
        onClose={() => setStopModal(false)}
        title="Stop Reminders"
        footer={
          <>
            <Button variant="outlined" onClick={() => setStopModal(false)}>Cancel</Button>
            <Button variant="danger" loading={acting} onClick={handleStopReminders}>Stop</Button>
          </>
        }
      >
        <p className="text-gray-600">Stop all follow-up reminders for this invoice?</p>
      </Modal>

      {/* Resume Reminders Modal */}
      <Modal
        isOpen={resumeModal}
        onClose={() => setResumeModal(false)}
        title="Resume Reminders"
        footer={
          <>
            <Button variant="outlined" onClick={() => setResumeModal(false)}>Cancel</Button>
            <Button loading={acting} onClick={handleResumeReminders}>Resume</Button>
          </>
        }
      >
        <p className="text-gray-600">Resume automatic follow-up reminders for this invoice?</p>
      </Modal>

      {/* Send Invoice Modal */}
      <Modal
        isOpen={showSendModal}
        onClose={() => !sending && setShowSendModal(false)}
        title="Send Invoice"
        footer={
          <>
            <Button variant="outlined" disabled={sending} onClick={() => setShowSendModal(false)}>Cancel</Button>
            <Button loading={sending} onClick={handleSendConfirm}>Send Invoice</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <p className="text-xs text-gray-400 uppercase font-medium mb-2">Email Recipients</p>
            {sendEmails.length === 0 && <p className="text-sm text-gray-400">No emails on file.</p>}
            {sendEmails.map((entry, i) => (
              <label key={i} className="flex items-center gap-2 py-1">
                <input
                  type="checkbox"
                  checked={entry.checked}
                  onChange={e => setSendEmails(prev => prev.map((p, idx) => idx === i ? { ...p, checked: e.target.checked } : p))}
                />
                <span className="text-sm text-gray-700">{entry.value}</span>
              </label>
            ))}
            <div className="flex items-center gap-2 mt-2">
              <input
                type="email"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                placeholder="Add email..."
                className="flex-1 rounded-xl border border-gray-300 px-3 py-2 text-sm min-h-[40px] focus:outline-none focus:ring-2 focus:ring-[#1A73E8]"
              />
              <Button variant="outlined" onClick={handleAddSendEmail} className="text-sm">Add</Button>
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase font-medium mb-2">SMS / Phone Recipients</p>
            {sendPhones.length === 0 && <p className="text-sm text-gray-400">No phones on file.</p>}
            {sendPhones.map((entry, i) => (
              <label key={i} className="flex items-center gap-2 py-1">
                <input
                  type="checkbox"
                  checked={entry.checked}
                  onChange={e => setSendPhones(prev => prev.map((p, idx) => idx === i ? { ...p, checked: e.target.checked } : p))}
                />
                <span className="text-sm text-gray-700">{entry.value}</span>
              </label>
            ))}
            <div className="flex items-center gap-2 mt-2">
              <input
                type="tel"
                value={newPhone}
                onChange={e => setNewPhone(e.target.value)}
                placeholder="Add phone..."
                className="flex-1 rounded-xl border border-gray-300 px-3 py-2 text-sm min-h-[40px] focus:outline-none focus:ring-2 focus:ring-[#1A73E8]"
              />
              <Button variant="outlined" onClick={handleAddSendPhone} className="text-sm">Add</Button>
            </div>
          </div>
          <label className="flex items-center gap-2 pt-2 border-t border-gray-100">
            <input
              type="checkbox"
              checked={saveContactsToProfile}
              onChange={e => setSaveContactsToProfile(e.target.checked)}
            />
            <span className="text-xs text-gray-600">Save new contacts to customer profile</span>
          </label>
        </div>
      </Modal>

      {/* Send Receipt Modal */}
      <Modal
        isOpen={showReceiptModal}
        onClose={() => !receiptSubmitting && setShowReceiptModal(false)}
        title="Send Receipt"
        footer={
          <>
            <Button variant="outlined" disabled={receiptSubmitting} onClick={() => setShowReceiptModal(false)}>Cancel</Button>
            <Button loading={receiptSubmitting} onClick={handleSendReceipt}>Send Receipt</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <p className="text-xs text-gray-400 uppercase font-medium mb-2">Email Recipients</p>
            {receiptEmails.length === 0 && <p className="text-sm text-gray-400">No emails on file.</p>}
            {receiptEmails.map((entry, i) => (
              <label key={i} className="flex items-center gap-2 py-1">
                <input
                  type="checkbox"
                  checked={entry.checked}
                  onChange={e => setReceiptEmails(prev => prev.map((p, idx) => idx === i ? { ...p, checked: e.target.checked } : p))}
                />
                <span className="text-sm text-gray-700">{entry.value}</span>
              </label>
            ))}
            <div className="flex items-center gap-2 mt-2">
              <input
                type="email"
                value={receiptNewEmail}
                onChange={e => setReceiptNewEmail(e.target.value)}
                placeholder="Add email..."
                className="flex-1 rounded-xl border border-gray-300 px-3 py-2 text-sm min-h-[40px] focus:outline-none focus:ring-2 focus:ring-[#1A73E8]"
              />
              <Button variant="outlined" onClick={handleAddReceiptEmail} className="text-sm">Add</Button>
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase font-medium mb-2">SMS / Phone Recipients</p>
            {receiptPhones.length === 0 && <p className="text-sm text-gray-400">No phones on file.</p>}
            {receiptPhones.map((entry, i) => (
              <label key={i} className="flex items-center gap-2 py-1">
                <input
                  type="checkbox"
                  checked={entry.checked}
                  onChange={e => setReceiptPhones(prev => prev.map((p, idx) => idx === i ? { ...p, checked: e.target.checked } : p))}
                />
                <span className="text-sm text-gray-700">{entry.value}</span>
              </label>
            ))}
            <div className="flex items-center gap-2 mt-2">
              <input
                type="tel"
                value={receiptNewPhone}
                onChange={e => setReceiptNewPhone(e.target.value)}
                placeholder="Add phone..."
                className="flex-1 rounded-xl border border-gray-300 px-3 py-2 text-sm min-h-[40px] focus:outline-none focus:ring-2 focus:ring-[#1A73E8]"
              />
              <Button variant="outlined" onClick={handleAddReceiptPhone} className="text-sm">Add</Button>
            </div>
          </div>
          <label className="flex items-center gap-2 pt-2 border-t border-gray-100">
            <input
              type="checkbox"
              checked={receiptSaveToProfile}
              onChange={e => setReceiptSaveToProfile(e.target.checked)}
            />
            <span className="text-xs text-gray-600">Save new contacts to customer profile</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={receiptSendReview}
              onChange={e => setReceiptSendReview(e.target.checked)}
            />
            <span className="text-xs text-gray-600">Include review request link</span>
          </label>
        </div>
      </Modal>
    </div>
  );
}
