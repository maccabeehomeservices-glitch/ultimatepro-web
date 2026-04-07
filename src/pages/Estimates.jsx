import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FileText } from 'lucide-react';
import { useGet } from '../hooks/useApi';
import { Card, Badge, LoadingSpinner, EmptyState } from '../components/ui';

const filters = [
  { id: '', label: 'All' },
  { id: 'draft', label: 'Draft' },
  { id: 'sent', label: 'Sent' },
  { id: 'approved', label: 'Approved' },
];

function formatCurrency(v) {
  return '$' + Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function Estimates() {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState('');
  const url = activeFilter ? `/estimates?status=${activeFilter}` : '/estimates';
  const { data, loading } = useGet(url, [activeFilter]);
  const estimates = data?.estimates || data || [];

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-900">Estimates</h1>
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
      ) : estimates.length === 0 ? (
        <EmptyState icon={FileText} title="No estimates found" description="Create your first estimate to get started." />
      ) : (
        <div className="space-y-2">
          {estimates.map((est) => (
            <Card key={est.id || est._id} onClick={() => navigate(`/estimates/${est.id || est._id}`)}>
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400">#{est.estimate_number || est.id}</p>
                  <p className="font-semibold text-gray-900 truncate">{est.customer_name || est.customer?.name || 'Customer'}</p>
                  {est.title && <p className="text-sm text-gray-500 truncate">{est.title}</p>}
                </div>
                <div className="text-right ml-3 flex-shrink-0">
                  <p className="font-bold text-gray-900">{formatCurrency(est.total)}</p>
                  <Badge status={est.status} label={est.status} />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => navigate('/estimates/new')}
        className="fixed bottom-20 md:bottom-6 right-4 md:right-6 w-14 h-14 bg-[#1A73E8] text-white rounded-full shadow-lg flex items-center justify-center hover:bg-blue-700 transition-colors z-10"
      >
        <Plus size={24} />
      </button>
    </div>
  );
}
