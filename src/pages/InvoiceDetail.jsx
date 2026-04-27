import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useGet, useMutation } from '../hooks/useApi';
import { invoicesApi, paymentsApi } from '../lib/api';
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

  async function handleSendReceipt() {
    try {
      await invoicesApi.sendReceipt(id);
      showSnack('Receipt sent', 'success');
      refetch();
    } catch {
      showSnack('Failed to send receipt', 'error');
    }
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
          <h1 className="font-bold text-gray-900 text-lg">Invoice #{invoice.invoice_number || invoice.id}</h1>
          <Badge status={invoice.status} label={invoice.status} />
        </div>
      </div>

      {/* Customer */}
      <Card className="mb-4">
        <p className="text-xs text-gray-400 uppercase font-medium mb-1">Bill To</p>
        <p className="font-semibold text-gray-900">{invoice.customer_name || invoice.customer?.name}</p>
      </Card>

      {/* Line Items */}
      <Card className="mb-4">
        <p className="text-xs text-gray-400 uppercase font-medium mb-3">Line Items</p>
        {lineItems.map((item, i) => {
          const qty = Number(item.qty || item.quantity || 1);
          const price = Number(item.unit_price || item.price || 0);
          const itemTotal = Number(item.total || qty * price);
          const isDiscount = item.item_type === 'discount';
          return (
            <div key={i} className="flex items-start justify-between gap-2 py-2 border-b border-gray-50 last:border-0">
              {item.image_url && (
                <img src={item.image_url} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0 border border-gray-100 mt-0.5" />
              )}
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">
                  {item.name || item.description}
                  {isDiscount && (
                    <span className="ml-2 text-[10px] font-semibold text-red-500 bg-red-50 px-1.5 py-0.5 rounded">DISCOUNT</span>
                  )}
                </p>
                <p className="text-xs text-gray-400">{qty} × {formatCurrency(price)}</p>
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
          <Button variant="outlined" onClick={handleSendReceipt} className="w-full">
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
    </div>
  );
}
