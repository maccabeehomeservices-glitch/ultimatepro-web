import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Users, Upload } from 'lucide-react';
import { useGet } from '../hooks/useApi';
import { Card, LoadingSpinner, EmptyState } from '../components/ui';

export default function Customers() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const searchTimeout = useRef(null);

  const url = search ? `/customers?search=${encodeURIComponent(search)}` : '/customers';
  const { data, loading } = useGet(url, [search]);
  const customers = data?.customers || data || [];

  function handleSearchChange(e) {
    const val = e.target.value;
    setSearchInput(val);
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => setSearch(val), 300);
  }

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-900">Customers</h1>
        <button
          onClick={() => navigate('/import?type=customers')}
          className="flex items-center gap-1.5 text-sm text-[#1A73E8] font-medium px-3 py-2 rounded-xl border border-[#1A73E8] min-h-[44px] hover:bg-blue-50 transition-colors"
        >
          <Upload size={14} /> Import
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search customers..."
          value={searchInput}
          onChange={handleSearchChange}
          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#1A73E8] min-h-[44px] text-sm"
        />
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : customers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No customers found"
          description="Add your first customer to get started."
          action={
            <button
              onClick={() => navigate('/customers/new')}
              className="px-4 py-2 bg-[#1A73E8] text-white rounded-xl text-sm font-medium min-h-[44px]"
            >
              Add Customer
            </button>
          }
        />
      ) : (
        <div className="space-y-2">
          {customers.map((c) => {
            const name = `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.name || c.company_name || 'Unknown';
            const id = c.id || c._id;
            return (
              <Card key={id} onClick={() => navigate(`/customers/${id}`)}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#1A73E8] flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                    {name[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{name}</p>
                    {c.phone && <p className="text-sm text-gray-500">{c.phone}</p>}
                    {(c.address || c.city) && (
                      <p className="text-xs text-gray-400 truncate">
                        {[c.address, c.city, c.state].filter(Boolean).join(', ')}
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => navigate('/customers/new')}
        className="fixed bottom-20 md:bottom-6 right-4 md:right-6 w-14 h-14 bg-[#1A73E8] text-white rounded-full shadow-lg flex items-center justify-center hover:bg-blue-700 transition-colors z-10"
      >
        <Plus size={24} />
      </button>
    </div>
  );
}
