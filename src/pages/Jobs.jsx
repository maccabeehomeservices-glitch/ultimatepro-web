import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, X, Filter, MapPin, Calendar as CalendarIcon, Inbox } from 'lucide-react';
import { jobsApi, usersApi, statusColor } from '../lib/api';
import { Card, Badge, LoadingSpinner, EmptyState } from '../components/ui';
import { useSnackbar } from '../components/ui/Snackbar';
import { dateBoundsFor, sortFor, humanizeScheduled, DATE_CHIPS, STATUS_OPTIONS } from '../lib/dateRanges';

const LIMIT = 20;

export default function Jobs() {
  const navigate = useNavigate();
  const { showSnack } = useSnackbar();
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [dateRange, setDateRange] = useState('all');
  const [customFrom, setCustomFrom] = useState(null);
  const [customTo, setCustomTo] = useState(null);
  const [showCustomDialog, setShowCustomDialog] = useState(false);
  const [customDraftFrom, setCustomDraftFrom] = useState('');
  const [customDraftTo, setCustomDraftTo] = useState('');
  const [selectedStatuses, setSelectedStatuses] = useState(
    new Set(['scheduled', 'en_route', 'in_progress', 'unscheduled', 'holding'])
  );
  const [selectedTechIds, setSelectedTechIds] = useState(new Set());
  const [partnerView, setPartnerView] = useState(false);
  const [showFilterDialog, setShowFilterDialog] = useState(false);
  const [page, setPage] = useState(1);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [techs, setTechs] = useState([]);
  const searchTimeout = useRef(null);

  const activeFilterCount = selectedStatuses.size + selectedTechIds.size + (partnerView ? 1 : 0);

  const fetchJobs = useCallback(async (pageNum) => {
    setLoading(true);
    try {
      const [from, to] = dateBoundsFor(dateRange, customFrom, customTo);
      const sort = sortFor(dateRange, customTo);
      const params = { page: pageNum, limit: LIMIT, sort };
      if (partnerView) params.partner_view = true;
      if (selectedStatuses.size > 0) {
        params.status = [...selectedStatuses].join(',');
        if (selectedStatuses.has('deleted')) params.include_all_statuses = true;
      }
      if (selectedTechIds.size > 0) params.assigned_to = [...selectedTechIds].join(',');
      // All date chips use activity_from / activity_to.
      // Backend's activity_date CASE pivots per status:
      //   - forward statuses (scheduled, en_route, in_progress, holding) → scheduled_start
      //   - terminal statuses (completed, cancelled, deleted) → updated_at
      //   - else (unscheduled) → created_at
      // This means an unscheduled job created Apr 5 appears under "This Month",
      // a Mar 17 scheduled job cancelled Apr 3 appears under "This Month",
      // and an Apr 17 scheduled job appears under "This Month".
      if (from) params.activity_from = from;
      if (to)   params.activity_to   = to;
      if (search) params.search = search;

      const res = await jobsApi.list(params);
      const newJobs = res.data?.jobs || (Array.isArray(res.data) ? res.data : []);
      if (pageNum === 1) setJobs(newJobs);
      else setJobs(prev => [...prev, ...newJobs]);
      setHasMore(newJobs.length === LIMIT);
    } catch {
      showSnack('Failed to load jobs', 'error');
    } finally {
      setLoading(false);
    }
  }, [dateRange, customFrom, customTo, selectedStatuses, selectedTechIds, partnerView, search, showSnack]);

  useEffect(() => {
    usersApi.getTechnicians()
      .then(r => setTechs(r.data?.technicians || r.data || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setPage(1);
    fetchJobs(1);
  }, [fetchJobs]);

  useEffect(() => {
    if (page > 1) fetchJobs(page);
  }, [page, fetchJobs]);

  useEffect(() => {
    const interval = setInterval(() => { fetchJobs(1).catch(() => {}); }, 60000);
    return () => clearInterval(interval);
  }, [fetchJobs]);

  function handleSearchChange(e) {
    const val = e.target.value;
    setSearchInput(val);
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => setSearch(val), 300);
  }

  function clearSearch() { setSearchInput(''); setSearch(''); }

  function toggleStatus(s) {
    setSelectedStatuses(prev => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s); else next.add(s);
      return next;
    });
  }
  function toggleTech(id) {
    setSelectedTechIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function clearAllFilters() {
    setSelectedStatuses(new Set());
    setSelectedTechIds(new Set());
    setPartnerView(false);
    setShowFilterDialog(false);
  }

  function pickDateChip(id) {
    if (id === 'custom') {
      setCustomDraftFrom(customFrom || '');
      setCustomDraftTo(customTo || '');
      setShowCustomDialog(true);
    } else {
      setDateRange(id);
      setCustomFrom(null);
      setCustomTo(null);
    }
  }

  function applyCustomDate() {
    if (customDraftFrom && customDraftTo) {
      setCustomFrom(customDraftFrom);
      setCustomTo(customDraftTo);
      setDateRange('custom');
      setShowCustomDialog(false);
    }
  }

  return (
    <div className="p-4 max-w-5xl mx-auto pb-24">
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

      {/* Date chip row + filter dropdown trigger */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 flex-1">
          {DATE_CHIPS.map(({ id, label }) => {
            const displayLabel = id === 'custom' && customFrom && customTo
              ? `${customFrom} → ${customTo}` : label;
            const selected = dateRange === id;
            return (
              <button
                key={id}
                onClick={() => pickDateChip(id)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors min-h-[36px] flex-shrink-0 ${
                  selected ? 'bg-[#1A73E8] text-white' : 'bg-white text-gray-600 border border-gray-200'
                }`}
              >
                {displayLabel}
              </button>
            );
          })}
        </div>
        <button
          onClick={() => setShowFilterDialog(true)}
          className="relative p-2.5 rounded-full bg-white border border-gray-200 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-600"
          aria-label="Filters"
        >
          <Filter size={18} />
          {activeFilterCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-[#1A73E8] text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Content */}
      {loading && jobs.length === 0 ? (
        <LoadingSpinner />
      ) : jobs.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No jobs found"
          description="Try a different filter or date range."
        />
      ) : (
        <>
          {/* Mobile cards */}
          <div className="space-y-2 md:hidden">
            {jobs.map(job => (
              <JobCard key={job.id || job._id} job={job} onClick={() => navigate(`/jobs/${job.id || job._id}`)} />
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block bg-white rounded-2xl shadow overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Job #</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Customer</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Scheduled</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Address</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Tech</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job, i) => {
                  const tech = [job.tech_first, job.tech_last].filter(Boolean).join(' ') || job.roster_tech_name || '';
                  return (
                    <tr
                      key={job.id || job._id}
                      onClick={() => navigate(`/jobs/${job.id || job._id}`)}
                      className={`cursor-pointer hover:bg-gray-50 transition-colors ${i !== jobs.length - 1 ? 'border-b border-gray-100' : ''}`}
                    >
                      <td className="px-4 py-3 text-sm text-gray-500 font-medium">#{job.job_number || (job.id || '').slice(0, 8)}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {[job.cust_first, job.cust_last].filter(Boolean).join(' ') || '—'}
                        {job.membership_id && <span className="ml-1 text-amber-500">⭐</span>}
                        {job.sent_by_company_id && <span className="ml-1 text-xs text-green-600">📥</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{(job.type || 'service').replace(/^\w/, c => c.toUpperCase())}</td>
                      <td className="px-4 py-3"><Badge status={job.status} label={job.status?.replace(/_/g, ' ')} /></td>
                      <td className="px-4 py-3 text-sm text-gray-500">{humanizeScheduled(job.scheduled_start)}</td>
                      <td className="px-4 py-3 text-sm text-gray-500 truncate max-w-[200px]">
                        {[job.address, job.cust_city || job.city].filter(Boolean).join(', ') || '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">{tech || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

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

      {/* Custom date dialog */}
      {showCustomDialog && (
        <div className="fixed inset-0 z-30 flex items-end md:items-center justify-center bg-black/40" onClick={() => setShowCustomDialog(false)}>
          <div className="bg-white rounded-t-2xl md:rounded-2xl shadow-lg w-full md:max-w-md p-5" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-900 mb-4">Custom Date Range</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">From</label>
                <input
                  type="date"
                  value={customDraftFrom}
                  onChange={e => setCustomDraftFrom(e.target.value)}
                  className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2 text-sm min-h-[44px] focus:outline-none focus:ring-2 focus:ring-[#1A73E8]"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">To</label>
                <input
                  type="date"
                  value={customDraftTo}
                  onChange={e => setCustomDraftTo(e.target.value)}
                  className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2 text-sm min-h-[44px] focus:outline-none focus:ring-2 focus:ring-[#1A73E8]"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setShowCustomDialog(false)} className="px-4 py-2 text-sm text-gray-600 min-h-[44px]">Cancel</button>
              <button
                onClick={applyCustomDate}
                disabled={!customDraftFrom || !customDraftTo}
                className="px-4 py-2 text-sm font-medium bg-[#1A73E8] text-white rounded-lg min-h-[44px] disabled:opacity-50"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status + Tech filter dialog */}
      {showFilterDialog && (
        <div className="fixed inset-0 z-30 flex items-end md:items-center justify-center bg-black/40" onClick={() => setShowFilterDialog(false)}>
          <div className="bg-white rounded-t-2xl md:rounded-2xl shadow-lg w-full md:max-w-md p-5 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-900 mb-4">Filters</h2>

            <p className="text-xs font-bold uppercase tracking-wider text-[#1A73E8] mb-2">Status</p>
            <div className="space-y-1 mb-4">
              {STATUS_OPTIONS.map(({ id, label }) => (
                <label key={id} className="flex items-center gap-3 cursor-pointer min-h-[36px]">
                  <input
                    type="checkbox"
                    checked={selectedStatuses.has(id)}
                    onChange={() => toggleStatus(id)}
                    className="w-4 h-4"
                  />
                  <span className="w-2 h-2 rounded-full" style={{ background: statusColor(id) }} />
                  <span className="text-sm text-gray-700">{label}</span>
                </label>
              ))}
              <label className="flex items-center gap-3 cursor-pointer min-h-[36px]">
                <input
                  type="checkbox"
                  checked={partnerView}
                  onChange={() => setPartnerView(v => !v)}
                  className="w-4 h-4"
                />
                <Inbox size={14} className="text-green-600" />
                <span className="text-sm text-gray-700">Received (from partners)</span>
              </label>
            </div>

            <p className="text-xs font-bold uppercase tracking-wider text-[#1A73E8] mb-2">Technician</p>
            <div className="space-y-1 mb-4">
              {techs.length === 0 ? (
                <p className="text-sm text-gray-500 py-1">No technicians</p>
              ) : (
                techs.map(t => {
                  const name = `${t.first_name || ''} ${t.last_name || ''}`.trim() || t.email || (t.id || '').slice(0, 8);
                  return (
                    <label key={t.id} className="flex items-center gap-3 cursor-pointer min-h-[36px]">
                      <input
                        type="checkbox"
                        checked={selectedTechIds.has(t.id)}
                        onChange={() => toggleTech(t.id)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm text-gray-700">{name}</span>
                    </label>
                  );
                })
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button onClick={clearAllFilters} className="px-4 py-2 text-sm text-gray-600 min-h-[44px]">Clear All</button>
              <button onClick={() => setShowFilterDialog(false)} className="px-4 py-2 text-sm text-gray-600 min-h-[44px]">Cancel</button>
              <button
                onClick={() => setShowFilterDialog(false)}
                className="px-4 py-2 text-sm font-medium bg-[#1A73E8] text-white rounded-lg min-h-[44px]"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function JobCard({ job, onClick }) {
  const isDeleted = job.status === 'deleted';
  const accentColor = isDeleted ? '#DC2626' : statusColor(job.status);
  const customer = [job.cust_first, job.cust_last].filter(Boolean).join(' ') || job.customer_name || '—';
  const addrParts = [job.address, job.cust_city || job.city].filter(Boolean);
  const tech = [job.tech_first, job.tech_last].filter(Boolean).join(' ') || job.roster_tech_name || '';
  const showPriority = !isDeleted && (job.priority === 'urgent' || job.priority === 'high');
  const priorityClass = job.priority === 'urgent'
    ? 'bg-red-100 text-red-700'
    : 'bg-orange-100 text-orange-700';

  return (
    <Card onClick={onClick} className="!p-0 overflow-hidden">
      <div className="flex">
        <div style={{ background: accentColor, width: 4 }} className="flex-shrink-0" />
        <div className="flex-1 p-3.5 space-y-1">
          {job.sent_by_company_name && (
            <div className="inline-flex items-center gap-1 bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-medium">
              <Inbox size={10} />
              From {job.sent_by_company_name}
            </div>
          )}
          {!job.sent_by_company_name && job.sent_to_company_name && (
            <div className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-medium">
              Sent to {job.sent_to_company_name}
            </div>
          )}

          {/* Row 1: number + type chip + (priority/archived right) */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-500">#{job.job_number}</span>
            <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">
              {(job.type || 'service').replace(/^\w/, c => c.toUpperCase())}
            </span>
            <div className="flex-1" />
            {isDeleted && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">Archived</span>}
            {showPriority && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${priorityClass}`}>
                {job.priority.charAt(0).toUpperCase() + job.priority.slice(1)}
              </span>
            )}
          </div>

          {/* Row 2: customer + member */}
          <div className="flex items-center gap-2">
            <p className="font-semibold text-gray-900 text-base truncate flex-1">{customer}</p>
            {job.membership_id && (
              <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap">
                ⭐ Member
              </span>
            )}
          </div>

          {/* Row 3: address */}
          {addrParts.length > 0 && (
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <MapPin size={12} />
              <span className="truncate">{addrParts.join(', ')}</span>
            </div>
          )}

          {/* Row 4: scheduled + status + tech */}
          <div className="flex items-center gap-2 text-xs">
            <CalendarIcon size={12} className="text-gray-400 flex-shrink-0" />
            <span className={`truncate ${humanizeScheduled(job.scheduled_start) === 'Unscheduled' ? 'text-gray-400' : 'text-gray-700 font-medium'}`}>
              {humanizeScheduled(job.scheduled_start)}
            </span>
            <span className="flex-1" />
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: accentColor }} />
            <span style={{ color: accentColor }} className="font-medium whitespace-nowrap">
              {(job.status === 'holding' ? 'Holding' : job.status?.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase())) || ''}
            </span>
            {tech && <span className="text-gray-400 truncate">· {tech}</span>}
          </div>
        </div>
      </div>
    </Card>
  );
}
