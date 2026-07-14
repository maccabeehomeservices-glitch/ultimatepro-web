import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Users, Upload, X } from 'lucide-react';
import { UpPlus } from '../components/ui/icons';
import { customersApi } from '../lib/api';
import { Card, Button, LoadingSpinner, EmptyState } from '../components/ui';
import { useSnackbar } from '../components/ui/Snackbar';
import { useAuth } from '../hooks/useAuth';

const LIMIT = 50;

function avatarColor(name) {
  const colors = ['#1A73E8', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1'];
  const idx = (name?.charCodeAt(0) || 0) % colors.length;
  return colors[idx];
}

export default function Customers() {
  const navigate = useNavigate();
  const { showSnack } = useSnackbar();
  const { can } = useAuth();
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const searchTimeout = useRef(null);

  const fetchCustomers = useCallback(async (pageNum) => {
    setLoading(true);
    try {
      const params = { page: pageNum, limit: LIMIT };
      if (search) params.search = search;
      if (typeFilter) params.type = typeFilter;
      const res = await customersApi.list(params);
      const newCustomers = res.data?.customers || (Array.isArray(res.data) ? res.data : []);
      if (pageNum === 1) {
        setCustomers(newCustomers);
      } else {
        setCustomers(prev => [...prev, ...newCustomers]);
      }
      setHasMore(newCustomers.length === LIMIT);
    } catch {
      showSnack('Failed to load customers', 'error');
    } finally {
      setLoading(false);
    }
  }, [search, typeFilter]);

  useEffect(() => {
    setPage(1);
    fetchCustomers(1);
  }, [search, typeFilter]);

  useEffect(() => {
    if (page > 1) fetchCustomers(page);
  }, [page]);

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


  // P2.1l Part A: customers are permanent — bulk delete removed (no delete/archive path).

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4 gap-2">
        <h1 className="text-xl font-bold text-ink">Customers</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => { setPage(1); fetchCustomers(1); }}
            disabled={loading}
            className="text-blue text-sm font-medium flex items-center gap-1 min-h-[44px] px-2"
          >
            {loading ? '⟳ Loading...' : '⟳ Refresh'}
          </button>
          <button
            onClick={() => navigate('/import?type=customers')}
            className="flex items-center gap-1.5 text-sm text-blue font-medium px-3 py-2 rounded-xl border border-blue min-h-[44px] hover:bg-blue-50 transition-colors"
          >
            <Upload size={14} /> Import
          </button>
        </div>
      </div>


      {/* Type filter */}
      <div className="flex gap-2 mb-3">
        {['', 'residential', 'commercial'].map(t => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border min-h-[36px] transition-colors ${
              typeFilter === t ? 'bg-blue text-white border-blue' : 'bg-card text-ink border-hairline'
            }`}
          >
            {t ? t.charAt(0).toUpperCase() + t.slice(1) : 'All'}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="text"
          placeholder="Search customers..."
          value={searchInput}
          onChange={handleSearchChange}
          className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-hairline bg-card focus:outline-none focus:ring-2 focus:ring-blue min-h-[44px] text-sm"
        />
        {searchInput && (
          <button onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted min-h-[44px] min-w-[44px] flex items-center justify-center">
            <X size={16} />
          </button>
        )}
      </div>

      {loading && customers.length === 0 ? (
        <LoadingSpinner />
      ) : customers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No customers found"
          description="Add your first customer to get started."
          action={can('customers','edit_self') ? (
            <Button onClick={() => navigate('/customers/new')}>
              Add Customer
            </Button>
          ) : null}
        />
      ) : (
        <div className="space-y-2">
          {customers.map((c) => {
            const name = `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.name || c.company_name || 'Unknown';
            const id = c.id || c._id;
            const color = avatarColor(name);
            const isReturning = (c.job_count || c.total_jobs || 0) >= 2;
            const isMember = Boolean(c.has_membership || c.membership_id || c.active_membership);
            return (
              <Card
                key={id}
                onClick={() => navigate(`/customers/${id}`)}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0"
                    style={{ backgroundColor: color }}
                  >
                    {name[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                      <p className="font-semibold text-ink">{name}</p>
                      {isMember && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">⭐ Member</span>
                      )}
                      {isReturning && !isMember && (
                        <span className="text-xs bg-blue-50 text-blue px-1.5 py-0.5 rounded-full font-medium">↩ Returning</span>
                      )}
                    </div>
                    {c.phone && <p className="text-sm text-muted">📱 {c.phone}</p>}
                    {(c.address || c.city) && (
                      <p className="text-xs text-muted truncate">
                        📍 {[c.address, c.city, c.state].filter(Boolean).join(', ')}
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
          {loading && customers.length > 0 && <LoadingSpinner />}
          {!loading && hasMore && (
            <button
              onClick={() => setPage(p => p + 1)}
              className="w-full py-3 text-blue font-medium mt-3 min-h-[44px]"
            >
              Load more customers...
            </button>
          )}
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => navigate('/customers/new')}
        className="fixed bottom-20 md:bottom-6 right-4 md:right-6 w-14 h-14 bg-blue text-white rounded-full shadow-lg flex items-center justify-center hover:bg-blue-ink transition-colors z-10"
      >
        <UpPlus size={24} />
      </button>
    </div>
  );
}
