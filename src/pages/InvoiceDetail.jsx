import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useGet, useMutation } from '../hooks/useApi';
import { Card, Badge, Button, LoadingSpinner, Modal, Input, Select } from '../components/ui';
import { useSnackbar } from '../components/ui/Snackbar';

function formatCurrency(v) {
  return '$' + Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

  if (loading) return <LoadingSpinner fullPage />;
  if (!invoice) return <div className="p-4 text-gray-500">Invoice not found.</div>;

  const lineItems = invoice.line_items || invoice.items || [];
  const payments = invoice.payments || [];
  const isPaid = invoice.status === 'paid';

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
          return (
            <div key={i} className="flex items-start justify-between gap-2 py-2 border-b border-gray-50 last:border-0">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{item.name || item.description}</p>
                <p className="text-xs text-gray-400">{qty} × {formatCurrency(price)}</p>
              </div>
              <p className="font-semibold text-sm">{formatCurrency(itemTotal)}</p>
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
                <p className="text-xs text-gray-400">{p.date || p.created_at}</p>
              </div>
              <p className="font-semibold text-green-600">{formatCurrency(p.amount)}</p>
            </div>
          ))}
        </Card>
      )}

      {/* Unpaid reminder */}
      {!isPaid && (
        <Card className="mb-4 border border-amber-200 bg-amber-50">
          <p className="text-sm font-medium text-amber-800">This invoice has an outstanding balance.</p>
          {invoice.due_date && (
            <p className="text-xs text-amber-600 mt-0.5">Due: {invoice.due_date}</p>
          )}
        </Card>
      )}

      {/* Actions */}
      {!isPaid && (
        <Button onClick={() => setPaymentModal(true)} className="w-full mb-4">
          Charge Payment
        </Button>
      )}

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
            onChange={(e) => setPaymentForm((p) => ({ ...p, amount: e.target.value }))}
            placeholder="0.00"
          />
          <Select
            label="Payment Method"
            value={paymentForm.method}
            onChange={(e) => setPaymentForm((p) => ({ ...p, method: e.target.value }))}
            options={PAYMENT_METHODS}
          />
          <Input
            label="Notes (optional)"
            value={paymentForm.notes}
            onChange={(e) => setPaymentForm((p) => ({ ...p, notes: e.target.value }))}
            placeholder="Check #1234..."
          />
        </div>
      </Modal>
    </div>
  );
}
