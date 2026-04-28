import { useState } from 'react';
import { DollarSign } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useGet } from '../hooks/useApi';
import { Card, LoadingSpinner, EmptyState } from '../components/ui';
import { format } from 'date-fns';

function formatCurrency(v) {
  return '$' + Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function methodBadgeClass(method) {
  return ({
    cash: 'bg-green-100 text-green-700',
    check: 'bg-blue-100 text-blue-700',
    credit_card: 'bg-purple-100 text-purple-700',
    ach: 'bg-indigo-100 text-indigo-700',
  }[method] || 'bg-gray-100 text-gray-600');
}

export default function Payments() {
  const navigate = useNavigate();
  const today = new Date();
  const [from, setFrom] = useState(format(new Date(today.getFullYear(), today.getMonth(), 1), 'yyyy-MM-dd'));
  const [to, setTo] = useState(format(today, 'yyyy-MM-dd'));

  const url = `/payments?from=${from}&to=${to}&page=1&limit=50`;
  const { data, loading } = useGet(url, [from, to]);
  const payments = data?.payments || (Array.isArray(data) ? data : []);
  const totalCollected = data?.total_collected ?? payments.reduce((s, p) => s + Number(p.amount || 0), 0);

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-4">Payments</h1>

      {/* Date range */}
      <Card className="mb-4">
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A73E8] min-h-[44px]"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A73E8] min-h-[44px]"
            />
          </div>
        </div>
      </Card>

      {loading ? (
        <LoadingSpinner />
      ) : payments.length === 0 ? (
        <EmptyState icon={DollarSign} title="No payments found" description="No payments recorded in this date range." />
      ) : (
        <div className="space-y-2">
          {payments.map((p, i) => (
            <Card key={p.id || p._id || i}>
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{p.customer_name || p.customer?.name || 'Customer'}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {p.method && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${methodBadgeClass(p.method)}`}>
                        {p.method.replace(/_/g, ' ')}
                      </span>
                    )}
                    <span className="text-xs text-gray-400">
                      {(p.processed_at || p.created_at) ? format(new Date(p.processed_at || p.created_at), 'MMM d, yyyy') : ''}
                    </span>
                  </div>
                  {p.invoice_id && (
                    <button
                      onClick={() => navigate(`/invoices/${p.invoice_id}`)}
                      className="text-xs text-[#1A73E8] font-medium mt-0.5"
                    >
                      {p.invoice_number || `INV-${(p.invoice_id || '').slice(0,6)}`}
                    </button>
                  )}
                </div>
                <p className="font-bold text-green-600 ml-3">{formatCurrency(p.amount)}</p>
              </div>
            </Card>
          ))}
          {/* Summary */}
          <div className="mt-4 p-4 bg-gray-100 rounded-2xl flex justify-between">
            <span className="font-semibold text-gray-700">Total</span>
            <span className="font-bold text-gray-900">
              {formatCurrency(totalCollected)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
