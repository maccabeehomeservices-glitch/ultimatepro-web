import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useGet, useMutation } from '../hooks/useApi';
import api from '../lib/api';
import { Card, Badge, Button, LoadingSpinner, Modal, Input, Select } from '../components/ui';
import { useSnackbar } from '../components/ui/Snackbar';

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'check', label: 'Check' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'ach', label: 'ACH' },
];

function formatCurrency(v) {
  return '$' + Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function TierCard({ tier }) {
  const items = tier.line_items || tier.items || [];
  const services = (tier.services || items.filter(i => i.item_type !== 'material' && i.item_type !== 'discount'));
  const materials = tier.materials || items.filter(i => i.item_type === 'material');
  const discounts = tier.discounts || items.filter(i => i.item_type === 'discount');
  const allItems = [...services, ...materials, ...discounts];
  const total = tier.total || allItems.reduce((s, i) => s + (Number(i.total || 0) || Number(i.unit_price || 0) * Number(i.qty || 1)), 0);

  return (
    <div className={`rounded-2xl border-2 p-4 transition-colors ${
      tier.is_selected ? 'border-[#1A73E8] bg-blue-50' : 'border-gray-200 bg-white'
    }`}>
      <div className="flex items-center justify-between mb-2">
        <p className="font-bold text-gray-900">{tier.name || tier.tier_name}</p>
        {tier.is_selected && (
          <span className="text-xs bg-[#1A73E8] text-white px-2 py-0.5 rounded-full font-medium">✓ Selected</span>
        )}
      </div>
      {tier.description && <p className="text-sm text-gray-500 mb-3">{tier.description}</p>}
      {allItems.length > 0 && (
        <div className="space-y-1 mb-3">
          {allItems.map((item, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="text-gray-700">{item.name || item.description}</span>
              <span className={item.item_type === 'discount' ? 'text-red-500' : 'text-gray-500'}>
                {item.item_type === 'discount' ? '-' : ''}{formatCurrency(item.total || Number(item.unit_price || 0) * Number(item.qty || 1))}
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        <p className="font-semibold text-gray-900">Total</p>
        <p className="font-bold text-lg text-[#1A73E8]">{formatCurrency(total)}</p>
      </div>
    </div>
  );
}

export default function EstimateDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showSnack } = useSnackbar();
  const { data, loading, refetch } = useGet(`/estimates/${id}`);
  const { data: tiersData } = useGet(
    data?.estimate?.presentation_mode === 'gbb' || data?.presentation_mode === 'gbb' ||
    data?.estimate?.presentation_mode === 'good_better_best' || data?.presentation_mode === 'good_better_best' ||
    data?.estimate?.gbb_mode || data?.gbb_mode
      ? `/estimates/${id}/tiers`
      : null,
    [id, data]
  );
  const { mutate, loading: acting } = useMutation();

  const [depositModal, setDepositModal] = useState(false);
  const [depositForm, setDepositForm] = useState({ method: 'cash', amount: '' });
  const [collectingDeposit, setCollectingDeposit] = useState(false);

  // Polling when status = 'sent'
  const pollRef = useRef(null);
  const estimate = data?.estimate || data;

  useEffect(() => {
    if (!estimate) return;
    if (estimate.status === 'sent') {
      pollRef.current = setInterval(() => refetch(), 10000);
    } else {
      clearInterval(pollRef.current);
    }
    return () => clearInterval(pollRef.current);
  }, [estimate?.status]);

  async function handleSend() {
    try {
      await mutate('post', `/estimates/${id}/send`);
      showSnack('Estimate sent', 'success');
      refetch();
    } catch {
      showSnack('Failed to send estimate', 'error');
    }
  }

  async function handleGetSignature() {
    try {
      await mutate('post', `/estimates/${id}/get-signature`);
      showSnack('Signature request sent', 'success');
      refetch();
    } catch {
      showSnack('Failed to request signature', 'error');
    }
  }

  async function handleConvert() {
    try {
      const res = await mutate('post', `/estimates/${id}/convert-to-invoice`);
      showSnack('Invoice created', 'success');
      navigate(`/invoices/${res?.invoice?.id || res?.id}`);
    } catch {
      showSnack('Failed to convert estimate', 'error');
    }
  }

  async function handleCollectDeposit() {
    setCollectingDeposit(true);
    try {
      await api.post(`/estimates/${id}/collect-deposit`, {
        method: depositForm.method,
        amount: Number(depositForm.amount),
      });
      showSnack('Deposit collected', 'success');
      setDepositModal(false);
      refetch();
    } catch {
      showSnack('Failed to collect deposit', 'error');
    } finally {
      setCollectingDeposit(false);
    }
  }

  if (loading) return <LoadingSpinner fullPage />;
  if (!estimate) return <div className="p-4 text-gray-500">Estimate not found.</div>;

  const isGbb = ['gbb', 'good_better_best'].includes(estimate.presentation_mode) || estimate.gbb_mode;
  const tiers = tiersData?.tiers || (Array.isArray(tiersData) ? tiersData : []);
  const isSigned = Boolean(estimate.signature || estimate.signed_at || estimate.status === 'approved');
  const lineItems = estimate.line_items || estimate.items || [];
  const total = estimate.total || lineItems.reduce((s, i) => s + (Number(i.total || 0) || Number(i.unit_price || 0) * Number(i.qty || i.quantity || 1)), 0);

  // Status-dependent buttons
  const showPresent = isGbb && !isSigned && estimate.status !== 'sent';
  const showSend = !isSigned;
  const showGetSig = !isGbb && !isSigned;
  const showConvert = isSigned;
  const showCollectDeposit = isSigned && estimate.deposit_required && !estimate.deposit_collected;

  return (
    <div className="p-4 max-w-3xl mx-auto pb-8">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-600">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="font-bold text-gray-900 text-lg">Estimate #{estimate.estimate_number || estimate.id}</h1>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <Badge status={estimate.status} label={estimate.status} />
            {estimate.status === 'sent' && (
              <span className="text-xs text-amber-600 font-medium animate-pulse">Waiting for signature...</span>
            )}
          </div>
        </div>
      </div>

      {/* Customer */}
      <Card className="mb-4">
        <p className="text-xs text-gray-400 uppercase font-medium mb-1">Customer</p>
        <p className="font-semibold text-gray-900">{estimate.customer_name || estimate.customer?.name}</p>
      </Card>

      {/* GBB Tiers */}
      {isGbb && (
        <div className="mb-4">
          <p className="text-xs text-gray-400 uppercase font-medium mb-3">Options</p>
          {tiers.length === 0 ? (
            <Card>
              <p className="text-sm text-gray-400 text-center py-4">Customer hasn't selected an option yet.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {tiers.map((tier, i) => (
                <TierCard key={tier.id || tier._id || i} tier={tier} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Line Items (non-GBB) */}
      {!isGbb && (
        <Card className="mb-4">
          <p className="text-xs text-gray-400 uppercase font-medium mb-3">Line Items</p>
          <div className="space-y-2">
            {lineItems.length === 0 && <p className="text-sm text-gray-400">No line items.</p>}
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
                  <p className={`font-semibold text-sm ${item.item_type === 'discount' ? 'text-red-500' : 'text-gray-900'}`}>
                    {item.item_type === 'discount' ? '-' : ''}{formatCurrency(itemTotal)}
                  </p>
                </div>
              );
            })}
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between">
            <p className="font-bold text-gray-900">Total</p>
            <p className="font-bold text-xl text-[#1A73E8]">{formatCurrency(total)}</p>
          </div>
        </Card>
      )}

      {/* Signature display */}
      {(estimate.signature) && (
        <Card className="mb-4">
          <p className="text-xs text-gray-400 uppercase font-medium mb-2">Signature</p>
          <img
            src={estimate.signature.startsWith('data:') ? estimate.signature : `data:image/png;base64,${estimate.signature}`}
            alt="Customer signature"
            className="max-h-24 border border-gray-100 rounded-xl bg-gray-50 p-2"
          />
          {estimate.signed_at && (
            <p className="text-xs text-gray-400 mt-1">
              Signed {new Date(estimate.signed_at).toLocaleDateString()}
            </p>
          )}
        </Card>
      )}

      {/* Deposit */}
      {estimate.deposit_required && (
        <Card className="mb-4">
          <p className="text-xs text-gray-400 uppercase font-medium mb-1">Deposit Required</p>
          <p className="font-semibold text-gray-900">{formatCurrency(estimate.deposit_amount)}</p>
          {estimate.deposit_collected ? (
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium mt-1 inline-block">
              Collected
            </span>
          ) : (
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium mt-1 inline-block">
              Not collected
            </span>
          )}
        </Card>
      )}

      {/* Notes */}
      {estimate.notes && (
        <Card className="mb-4">
          <p className="text-xs text-gray-400 uppercase font-medium mb-1">Notes</p>
          <p className="text-sm text-gray-700">{estimate.notes}</p>
        </Card>
      )}

      {/* Terms */}
      {estimate.terms && (
        <Card className="mb-4">
          <p className="text-xs text-gray-400 uppercase font-medium mb-1">Terms</p>
          <p className="text-sm text-gray-700">{estimate.terms}</p>
        </Card>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-2 pb-4">
        {showPresent && (
          <Button onClick={handleGetSignature} loading={acting} className="w-full">
            Present to Customer
          </Button>
        )}
        {showSend && (
          <Button onClick={handleSend} loading={acting} className="w-full">
            Send for Signature
          </Button>
        )}
        {showGetSig && !showPresent && (
          <Button onClick={handleGetSignature} loading={acting} variant="outlined" className="w-full">
            Get Signature
          </Button>
        )}
        {showConvert && (
          <Button onClick={handleConvert} loading={acting} className="w-full">
            Convert to Invoice
          </Button>
        )}
        {showCollectDeposit && (
          <Button variant="outlined" onClick={() => setDepositModal(true)} className="w-full">
            Collect Deposit
          </Button>
        )}
        <Button variant="outlined" onClick={() => navigate(`/estimates/${id}/edit`)} className="w-full">
          Edit Estimate
        </Button>
      </div>

      {/* Collect Deposit Modal */}
      <Modal
        isOpen={depositModal}
        onClose={() => setDepositModal(false)}
        title="Collect Deposit"
        footer={
          <>
            <Button variant="outlined" onClick={() => setDepositModal(false)}>Cancel</Button>
            <Button loading={collectingDeposit} onClick={handleCollectDeposit}>Collect</Button>
          </>
        }
      >
        <div className="space-y-3">
          {estimate.deposit_amount && (
            <p className="text-sm text-gray-600">
              Deposit amount: <strong>{formatCurrency(estimate.deposit_amount)}</strong>
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
            placeholder={estimate.deposit_amount?.toString() || '0.00'}
          />
        </div>
      </Modal>
    </div>
  );
}
