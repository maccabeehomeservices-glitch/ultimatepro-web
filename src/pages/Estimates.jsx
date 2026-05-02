import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FileText, Search, X } from 'lucide-react';
import { useGet } from '../hooks/useApi';
import { Card, Badge, LoadingSpinner, EmptyState } from '../components/ui';

const filters = [
  { id: '', label: 'All' },
  { id: 'draft', label: 'Draft' },
  { id: 'sent', label: 'Sent' },
  { id: 'signed', label: 'Signed' },
  { id: 'approved', label: 'Approved' },
];

function formatCurrency(v) {
  return '$' + Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function Estimates() {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const searchTimeout = useRef(null);

  let url = activeFilter ? `/estimates?status=${activeFilter}` : '/estimates';
  if (search) url += `${url.includes('?') ? '&' : '?'}search=${encodeURIComponent(search)}`;
  const { data, loading, refetch } = useGet(url, [activeFilter, search]);
  const estimates = data?.estimates || (Array.isArray(data) ? data : []);

  function handleSearchChange(e) {
    const val = e.target.value;
    setSearchInput(val);
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => setSearch(val), 300);
  }

  function clearSearch() {
    setSearchInput('');
    setSearch('');
  }

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-900">Estimates</h1>
        <button
          onClick={() => refetch()}
          disabled={loading}
          className="text-blue-600 text-sm font-medium flex items-center gap-1 min-h-[44px] px-2"
        >
          {loading ? '⟳ Loading...' : '⟳ Refresh'}
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search estimates..."
          value={searchInput}
          onChange={handleSearchChange}
          className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#1A73E8] min-h-[44px] text-sm"
        />
        {searchInput && (
          <button onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 min-h-[44px] min-w-[44px] flex items-center justify-center">
            <X size={16} />
          </button>
        )}
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-4 px-4">
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => setActiveFilter(f.id)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap min-h-[36px] flex-shrink-0 transition-colors ${
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
          {estimates.map((est) => {
            const depositDue = est.deposit_required && !est.deposit_collected;
            return (
              <Card key={est.id || est._id} onClick={() => navigate(`/estimates/${est.id || est._id}`)}>
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-400">{est.estimate_number || `EST-${(est.id || '').slice(0,6)}`}</p>
                    <p className="font-semibold text-gray-900 truncate">{`${est.cust_first || ''} ${est.cust_last || ''}`.trim() || '-'}</p>
                    {est.title && <p className="text-sm text-gray-500 truncate">{est.title}</p>}
                    {est.created_at && (
                      <p className="text-xs text-gray-400">
                        {new Date(est.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    )}
                    {depositDue && (
                      <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium mt-0.5 inline-block">
                        Deposit Due
                      </span>
                    )}
                  </div>
                  <div className="text-right ml-3 flex-shrink-0">
                    <p className="font-bold text-gray-900">{formatCurrency(est.total)}</p>
                    <Badge status={est.status} label={est.status} />
                  </div>
                </div>
              </Card>
            );
          })}
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
