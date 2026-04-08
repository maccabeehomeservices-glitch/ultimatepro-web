import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useGet, useMutation } from '../hooks/useApi';
import { Card, Badge, Button, LoadingSpinner } from '../components/ui';
import { useSnackbar } from '../components/ui/Snackbar';

function formatCurrency(v) {
  return '$' + Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function TierCard({ tier }) {
  const items = tier.line_items || tier.items || [];
  const total = tier.total || items.reduce((s, i) => s + (Number(i.total || 0) || Number(i.unit_price || 0) * Number(i.qty || 1)), 0);
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
      {items.length > 0 && (
        <div className="space-y-1 mb-3">
          {items.map((item, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="text-gray-700">{item.name || item.description}</span>
              <span className="text-gray-500">{formatCurrency(item.total || Number(item.unit_price || 0) * Number(item.qty || 1))}</span>
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
    data?.estimate?.presentation_mode === 'good_better_best' || data?.presentation_mode === 'good_better_best'
      ? `/estimates/${id}/tiers`
      : null,
    [id, data]
  );
  const { mutate, loading: acting } = useMutation();

  const estimate = data?.estimate || data;

  async function handleSend() {
    try {
      await mutate('post', `/estimates/${id}/send`);
      showSnack('Estimate sent', 'success');
      refetch();
    } catch {
      showSnack('Failed to send estimate', 'error');
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

  if (loading) return <LoadingSpinner fullPage />;
  if (!estimate) return <div className="p-4 text-gray-500">Estimate not found.</div>;

  const isGbb = ['gbb', 'good_better_best'].includes(estimate.presentation_mode);
  const tiers = tiersData?.tiers || (Array.isArray(tiersData) ? tiersData : []);
  const lineItems = estimate.line_items || estimate.items || [];
  const total = estimate.total || lineItems.reduce((s, i) => s + (Number(i.total || 0) || Number(i.unit_price || 0) * Number(i.qty || i.quantity || 1)), 0);

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-600">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="font-bold text-gray-900 text-lg">Estimate #{estimate.estimate_number || estimate.id}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge status={estimate.status} label={estimate.status} />
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
                  <p className="font-semibold text-sm text-gray-900">{formatCurrency(itemTotal)}</p>
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

      {/* Deposit */}
      {estimate.deposit_required && (
        <Card className="mb-4">
          <p className="text-xs text-gray-400 uppercase font-medium mb-1">Deposit Required</p>
          <p className="font-semibold text-gray-900">{formatCurrency(estimate.deposit_amount)}</p>
          {estimate.deposit_collected && (
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium mt-1 inline-block">Collected</span>
          )}
        </Card>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-2 pb-4">
        {!['sent', 'approved'].includes(estimate.status) && (
          <Button onClick={handleSend} loading={acting} className="w-full">Send for Signature</Button>
        )}
        {estimate.status === 'approved' && (
          <Button onClick={handleConvert} loading={acting} variant="outlined" className="w-full">Convert to Invoice</Button>
        )}
        <Button variant="outlined" onClick={() => navigate(`/estimates/${id}/edit`)} className="w-full">Edit Estimate</Button>
      </div>
    </div>
  );
}
