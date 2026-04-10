import { useState, useRef, useEffect, useCallback } from 'react';
import { formatDate, formatTime } from '../lib/api';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, X } from 'lucide-react';
import { jobsApi, usersApi } from '../lib/api';
import { Card, Badge, LoadingSpinner, EmptyState } from '../components/ui';
import { useSnackbar } from '../components/ui/Snackbar';

const STATUS_FILTERS = [
  { id: '', label: 'All' },
  { id: 'unscheduled', label: 'Unscheduled' },
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'en_route', label: 'En Route' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
  { id: 'holding', label: 'Holding' },
  { id: 'received', label: 'Received' },
];

const PRIORITY_FILTERS = ['', 'low', 'medium', 'high', 'urgent'];

const LIMIT = 20;

export default function Jobs() {
  const navigate = useNavigate();
  const { showSnack } = useSnackbar();
  const [activeFilter, setActiveFilter] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [techFilter, setTechFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [page, setPage] = useState(1);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [techs, setTechs] = useState([]);
  const searchTimeout = useRef(null);

  // Declare fetchJobs FIRST — before any useEffect that references it
  const fetchJobs = useCallback(async (pageNum) => {
    setLoading(true);
    try {
      const params = { page: pageNum, limit: LIMIT };
      if (activeFilter === 'received') {
        params.partner_view = true;
      } else if (activeFilter) {
        params.status = activeFilter;
      }
      if (search) params.search = search;
      if (dateFrom) params.from = dateFrom;
      if (dateTo) params.to = dateTo;
      if (techFilter) params.assigned_to = techFilter;
      if (priorityFilter) params.priority = priorityFilter;

      const res = await jobsApi.list(params);
      const newJobs = res.data?.jobs || (Array.isArray(res.data) ? res.data : []);
      if (pageNum === 1) {
        setJobs(newJobs);
      } else {
        setJobs(prev => [...prev, ...newJobs]);
      }
      setHasMore(newJobs.length === LIMIT);
    } catch {
      showSnack('Failed to load jobs', 'error');
    } finally {
      setLoading(false);
    }
  }, [activeFilter, search, dateFrom, dateTo, techFilter, priorityFilter, showSnack]);

  // Load technicians (no fetchJobs dependency)
  useEffect(() => {
    usersApi.getTechnicians()
      .then(r => setTechs(r.data?.technicians || r.data || []))
      .catch(() => {});
  }, []);

  // Fetch jobs whenever filters change — depend on fetchJobs (which closes over all filter values)
  useEffect(() => {
    setPage(1);
    fetchJobs(1);
  }, [fetchJobs]);

  // Load next page when page increments past 1
  useEffect(() => {
    if (page > 1) fetchJobs(page);
  }, [page, fetchJobs]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchJobs(1).catch(() => {});
    }, 60000);
    return () => clearInterval(interval);
  }, [fetchJobs]);

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

  function clearDates() {
    setDateFrom('');
    setDateTo('');
  }

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-900">Jobs</h1>
        <button
          onClick={() => { setPage(1); fetchJobs(1); }}
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
          placeholder="Search jobs..."
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

      {/* Date range filter */}
      <div className="flex flex-wrap gap-2 items-center mb-3">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">From</label>
          <input
            type="date"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm min-h-[44px] focus:outline-none focus:ring-2 focus:ring-[#1A73E8]"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">To</label>
          <input
            type="date"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm min-h-[44px] focus:outline-none focus:ring-2 focus:ring-[#1A73E8]"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
          />
        </div>
        {(dateFrom || dateTo) && (
          <button onClick={clearDates} className="text-red-500 text-sm font-medium min-h-[44px] px-2">
            Clear dates
          </button>
        )}
      </div>

      {/* Tech filter */}
      <div className="flex flex-wrap gap-2 mb-3">
        <select
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm min-h-[44px] focus:outline-none focus:ring-2 focus:ring-[#1A73E8] bg-white"
          value={techFilter}
          onChange={e => setTechFilter(e.target.value)}
        >
          <option value="">All Techs</option>
          {techs.map(t => (
            <option key={t.id} value={t.id}>{t.first_name || t.name} {t.last_name || ''}</option>
          ))}
        </select>
      </div>

      {/* Priority filter chips */}
      <div className="flex gap-2 flex-wrap mb-3">
        {PRIORITY_FILTERS.map(p => (
          <button
            key={p}
            onClick={() => setPriorityFilter(p)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border min-h-[36px] transition-colors ${
              priorityFilter === p
                ? 'bg-[#1A73E8] text-white border-[#1A73E8]'
                : 'bg-white text-gray-600 border-gray-300'
            }`}
          >
            {p ? p.charAt(0).toUpperCase() + p.slice(1) : 'All Priorities'}
          </button>
        ))}
      </div>

      {/* Status filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-4 px-4">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setActiveFilter(f.id)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors min-h-[36px] flex-shrink-0 ${
              activeFilter === f.id
                ? 'bg-[#1A73E8] text-white'
                : 'bg-white text-gray-600 border border-gray-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading && jobs.length === 0 ? (
        <LoadingSpinner />
      ) : jobs.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No jobs found"
          description="Try adjusting your filters or search."
        />
      ) : (
        <>
          {/* Mobile: cards */}
          <div className="space-y-2 md:hidden">
            {jobs.map((job) => (
              <Card key={job.id || job._id} onClick={() => navigate(`/jobs/${job.id || job._id}`)}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="text-xs text-gray-400">#{job.job_number || job.id}</span>
                      <Badge status={job.status} label={job.status?.replace(/_/g, ' ')} />
                      {job.membership_id && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">⭐ Member</span>
                      )}
                      {job.sent_by_company_id && (
                        <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">
                          📥 {job.sent_by_company_name || 'Partner'}
                        </span>
                      )}
                    </div>
                    <p className="font-medium text-gray-900 truncate">{job.title || job.job_title}</p>
                    <p className="text-sm text-gray-500 truncate">{job.customer_name || job.customer?.name || 'No customer'}</p>
                    {job.scheduled_start && (
                      <p className="text-xs text-gray-400 truncate">
                        {formatDate(job.scheduled_start)} {formatTime(job.scheduled_start)}
                      </p>
                    )}
                    {(job.address || job.service_address) && (
                      <p className="text-xs text-gray-400 truncate">{job.address || job.service_address}</p>
                    )}
                    {job.source_name && (
                      <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full mt-0.5 inline-block">{job.source_name}</span>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden md:block bg-white rounded-2xl shadow overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">#</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Title</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Customer</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Scheduled</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Address</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job, i) => (
                  <tr
                    key={job.id || job._id}
                    onClick={() => navigate(`/jobs/${job.id || job._id}`)}
                    className={`cursor-pointer hover:bg-gray-50 transition-colors ${i !== jobs.length - 1 ? 'border-b border-gray-100' : ''}`}
                  >
                    <td className="px-4 py-3 text-sm text-gray-400">#{job.job_number || job.id}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {job.title || job.job_title}
                      {job.membership_id && <span className="ml-1 text-amber-500">⭐</span>}
                      {job.sent_by_company_id && <span className="ml-1 text-xs text-green-600">📥</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{job.customer_name || job.customer?.name}</td>
                    <td className="px-4 py-3"><Badge status={job.status} label={job.status?.replace(/_/g, ' ')} /></td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {job.scheduled_start ? formatDate(job.scheduled_start) : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 truncate max-w-[200px]">{job.address || job.service_address}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Load more */}
          {loading && jobs.length > 0 && <LoadingSpinner />}
          {!loading && hasMore && (
            <button
              onClick={() => setPage(p => p + 1)}
              className="w-full py-3 text-[#1A73E8] font-medium mt-3 min-h-[44px]"
            >
              Load more jobs...
            </button>
          )}
        </>
      )}

      {/* FAB */}
      <button
        onClick={() => navigate('/jobs/new')}
        className="fixed bottom-20 md:bottom-6 right-4 md:right-6 w-14 h-14 bg-[#1A73E8] text-white rounded-full shadow-lg flex items-center justify-center hover:bg-blue-700 transition-colors z-10"
      >
        <Plus size={24} />
      </button>
    </div>
  );
}
