import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Receipt } from 'lucide-react';
import { useGet } from '../hooks/useApi';
import { Card, Badge, LoadingSpinner, EmptyState } from '../components/ui';

const filters = [
  { id: 'unpaid', label: 'Unpaid' },
  { id: 'paid', label: 'Paid' },
  { id: '', label: 'All' },
];

function formatCurrency(v) {
  return '$' + Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function Invoices() {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState('unpaid');
  const url = activeFilter ? `/invoices?status=${activeFilter}` : '/invoices';
  const { data, loading } = useGet(url, [activeFilter]);
  const invoices = data?.invoices || data || [];

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-900">Invoices</h1>
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => setActiveFilter(f.id)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap min-h-[36px] transition-colors ${
              activeFilter === f.id ? 'bg-[#1A73E8] text-white' : 'bg-white text-gray-600 border border-gray-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : invoices.length === 0 ? (
        <EmptyState icon={Receipt} title="No invoices found" description="Invoices will appear here once created." />
      ) : (
        <div className="space-y-2">
          {invoices.map((inv) => (
            <Card key={inv.id || inv._id} onClick={() => navigate(`/invoices/${inv.id || inv._id}`)}>
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400">#{inv.invoice_number || inv.id}</p>
                  <p className="font-semibold text-gray-900 truncate">{inv.customer_name || inv.customer?.name}</p>
                </div>
                <div className="text-right ml-3 flex-shrink-0">
                  <p className="font-bold text-gray-900">{formatCurrency(inv.total)}</p>
                  <Badge status={inv.status} label={inv.status} />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
