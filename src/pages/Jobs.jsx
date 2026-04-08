import { useState, useRef } from 'react';
import { formatDate, formatTime } from '../lib/api';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, X } from 'lucide-react';
import { useGet } from '../hooks/useApi';
import { Card, Badge, LoadingSpinner, EmptyState } from '../components/ui';

const filters = [
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

function buildUrl(filter, search) {
  let url = '/jobs';
  const params = [];
  if (filter === 'received') {
    params.push('partner_view=true');
  } else if (filter) {
    params.push(`status=${filter}`);
  }
  if (search) params.push(`search=${encodeURIComponent(search)}`);
  params.push('page=1', 'limit=50');
  url += '?' + params.join('&');
  return url;
}

export default function Jobs() {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const searchTimeout = useRef(null);

  const url = buildUrl(activeFilter, search);
  const { data, loading } = useGet(url, [activeFilter, search]);
  const jobs = data?.jobs || (Array.isArray(data) ? data : []);

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
    <div className="p-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-900">Jobs</h1>
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
          <button onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
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
      {loading ? (
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
