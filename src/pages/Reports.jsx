import { useState } from 'react';
import { format } from 'date-fns';
import { BarChart2 } from 'lucide-react';
import { useGet } from '../hooks/useApi';
import { Card, LoadingSpinner, EmptyState, Tabs, Select, Button } from '../components/ui';
import { networkApi } from '../lib/api';

const tabList = [
  { id: 'revenue', label: 'Revenue' },
  { id: 'sources', label: 'Job Sources' },
  { id: 'timesheets', label: 'Timesheets' },
  { id: 'partners', label: 'Partners' },
];

function formatCurrency(v) {
  return '$' + Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDuration(minutes) {
  if (!minutes && minutes !== 0) return '—';
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs === 0) return `${mins}m`;
  return `${hrs}h ${mins}m`;
}

export default function Reports() {
  const today = new Date();
  const [activeTab, setActiveTab] = useState('revenue');
  const [from, setFrom] = useState(format(new Date(today.getFullYear(), today.getMonth(), 1), 'yyyy-MM-dd'));
  const [to, setTo] = useState(format(today, 'yyyy-MM-dd'));
  const [techFilter, setTechFilter] = useState('');

  const { data: revenueData, loading: revenueLoading } = useGet(
    activeTab === 'revenue' ? `/reports/revenue?from=${from}&to=${to}` : null, [activeTab, from, to]
  );
  const { data: sourcesData, loading: sourcesLoading } = useGet(
    activeTab === 'sources' ? `/sources/report?date_from=${from}&date_to=${to}` : null, [activeTab, from, to]
  );
  const { data: tsData, loading: tsLoading } = useGet(
    activeTab === 'timesheets'
      ? `/timesheets/report?start_date=${from}&end_date=${to}${techFilter ? `&user_id=${techFilter}` : ''}`
      : null,
    [activeTab, from, to, techFilter]
  );
  const { data: techsData } = useGet(activeTab === 'timesheets' ? '/users/technicians' : null, [activeTab]);
  const { data: connectionsData, loading: connectionsLoading } = useGet(
    activeTab === 'partners' ? '/network/connections' : null, [activeTab]
  );

  const [partnerReport, setPartnerReport] = useState(null);
  const [partnerReportLoading, setPartnerReportLoading] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState(null);

  async function loadConnectionReport(conn) {
    setSelectedConnection(conn);
    setPartnerReport(null);
    setPartnerReportLoading(true);
    try {
      const res = await networkApi.getConnectionReport(conn.id || conn._id, from, to);
      setPartnerReport(res.data);
    } catch {
      setPartnerReport(null);
    } finally {
      setPartnerReportLoading(false);
    }
  }

  const connections = connectionsData?.connections || (Array.isArray(connectionsData) ? connectionsData : []);
  const revenueStats = revenueData?.stats || revenueData || {};
  const revenueList = revenueData?.data || revenueData?.items || [];

  // Sources: combine network[], external_contacts[], own_company[]
  const sourceNetwork = sourcesData?.network || [];
  const sourceExternal = sourcesData?.external_contacts || [];
  const sourceOwn = sourcesData?.own_company || [];
  const allSources = [
    ...sourceNetwork.map(s => ({ ...s, _category: 'Network' })),
    ...sourceExternal.map(s => ({ ...s, _category: 'Source Contact' })),
    ...sourceOwn.map(s => ({ ...s, _category: 'Own Company' })),
  ];

  const tsRows = tsData?.rows || tsData?.entries || (Array.isArray(tsData) ? tsData : []);
  const tsSummary = tsData?.summary || tsData?.technicians || [];
  const techs = techsData?.technicians || (Array.isArray(techsData) ? techsData : []);
  const techOptions = [
    { value: '', label: 'All Technicians' },
    ...techs.map(t => ({ value: t.id || t._id, label: `${t.first_name || ''} ${t.last_name || ''}`.trim() })),
  ];

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-4">Reports</h1>

      {/* Date Range */}
      <Card className="mb-4">
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A73E8] min-h-[44px]" />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A73E8] min-h-[44px]" />
          </div>
        </div>
      </Card>

      <Tabs tabs={tabList} active={activeTab} onChange={setActiveTab} />

      <div className="mt-4">
        {/* Revenue tab */}
        {activeTab === 'revenue' && (
          revenueLoading ? <LoadingSpinner /> : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Card>
                  <p className="text-xs text-gray-400 uppercase">Total Revenue</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(revenueStats.total_revenue || revenueStats.total)}</p>
                </Card>
                <Card>
                  <p className="text-xs text-gray-400 uppercase">Jobs Completed</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{revenueStats.jobs_completed || revenueStats.total_jobs || 0}</p>
                </Card>
                <Card>
                  <p className="text-xs text-gray-400 uppercase">Invoiced</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(revenueStats.invoiced || 0)}</p>
                </Card>
                <Card>
                  <p className="text-xs text-gray-400 uppercase">Collected</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(revenueStats.collected || revenueStats.paid || 0)}</p>
                </Card>
              </div>
              {revenueList.length > 0 && (
                <div className="bg-white rounded-2xl shadow overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Date</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Revenue</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Jobs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {revenueList.map((row, i) => (
                        <tr key={i} className="border-b border-gray-50 last:border-0">
                          <td className="px-4 py-2.5 text-sm text-gray-700">{row.date || row.period}</td>
                          <td className="px-4 py-2.5 text-sm font-medium text-gray-900">{formatCurrency(row.revenue || row.amount)}</td>
                          <td className="px-4 py-2.5 text-sm text-gray-600">{row.jobs || row.count || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        )}

        {/* Sources tab */}
        {activeTab === 'sources' && (
          sourcesLoading ? <LoadingSpinner /> :
          allSources.length === 0 ? (
            <EmptyState icon={BarChart2} title="No data" description="Job source data will appear here." />
          ) : (
            <div className="space-y-2">
              {allSources.map((s, i) => (
                <Card key={i}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{s.name || s.source || 'Unknown'}</p>
                      <p className="text-xs text-gray-400">{s._category}</p>
                      <p className="text-sm text-gray-500">{s.jobs_count || s.count || s.jobs || 0} jobs</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-[#1A73E8]">{formatCurrency(s.revenue || s.total || 0)}</p>
                      {s.commission != null && (
                        <p className="text-xs text-gray-400">Commission: {formatCurrency(s.commission)}</p>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )
        )}

        {/* Partners tab */}
        {activeTab === 'partners' && (
          connectionsLoading ? <LoadingSpinner /> :
          connections.length === 0 ? (
            <EmptyState icon={BarChart2} title="No connections" description="Connect with partners to see revenue reports." />
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                {connections.map((conn) => (
                  <Card key={conn.id || conn._id}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-gray-900">{conn.company_name || conn.partner_name || conn.name}</p>
                        <p className="text-xs text-gray-400">{conn.status || 'active'}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="outlined"
                        onClick={() => loadConnectionReport(conn)}
                      >
                        View Report
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>

              {partnerReportLoading && <LoadingSpinner />}

              {partnerReport && selectedConnection && (
                <Card>
                  <p className="text-xs text-gray-400 uppercase font-medium mb-3">
                    {selectedConnection.company_name || selectedConnection.partner_name} — {from} to {to}
                  </p>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <p className="text-xs text-gray-400">Total Jobs</p>
                      <p className="font-bold text-gray-900">{partnerReport.summary?.total_jobs || 0}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">You Earn</p>
                      <p className="font-bold text-[#1A73E8]">{formatCurrency(partnerReport.summary?.sender_earns || partnerReport.summary?.receiver_earns || 0)}</p>
                    </div>
                  </div>
                  {(partnerReport.jobs || []).length > 0 && (
                    <div className="space-y-1">
                      {(partnerReport.jobs || []).map((j, i) => (
                        <div key={j.id || i} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                          <p className="text-sm text-gray-700">{j.title || j.job_number || `Job ${i + 1}`}</p>
                          <p className="text-sm font-medium text-gray-900">{formatCurrency(j.amount || j.revenue || 0)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              )}
            </div>
          )
        )}

        {/* Timesheets tab */}
        {activeTab === 'timesheets' && (
          <div className="space-y-4">
            {techs.length > 0 && (
              <Select value={techFilter} onChange={e => setTechFilter(e.target.value)} options={techOptions} />
            )}
            {tsLoading ? <LoadingSpinner /> : (
              <>
                {/* Summary cards */}
                {tsSummary.length > 0 && (
                  <div className="space-y-2 mb-2">
                    {tsSummary.map((tech, i) => {
                      const name = `${tech.first_name || ''} ${tech.last_name || ''}`.trim() || tech.name || 'Tech';
                      return (
                        <Card key={tech.id || tech._id || i}>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-semibold text-gray-900">{name}</p>
                              <p className="text-sm text-gray-500">
                                {tech.days_worked || 0} days · {tech.total_jobs || 0} jobs
                              </p>
                            </div>
                            <p className="font-bold text-[#1A73E8] text-lg">
                              {formatDuration(tech.total_minutes || tech.total_hours * 60)}
                            </p>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}

                {/* Detail table */}
                {tsRows.length === 0 ? (
                  <EmptyState icon={BarChart2} title="No timesheet data" description="No clock-in records found for this period." />
                ) : (
                  <div className="bg-white rounded-2xl shadow overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50">
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Tech</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Date</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">In</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Out</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Hours</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tsRows.map((row, i) => {
                          const name = `${row.first_name || ''} ${row.last_name || ''}`.trim() || row.name || row.tech_name || '';
                          return (
                            <tr key={i} className="border-b border-gray-50 last:border-0">
                              <td className="px-4 py-2.5 text-sm font-medium text-gray-900">{name}</td>
                              <td className="px-4 py-2.5 text-sm text-gray-600">{row.date || row.work_date || ''}</td>
                              <td className="px-4 py-2.5 text-sm text-gray-600">{row.clock_in || row.clocked_in_at || '—'}</td>
                              <td className="px-4 py-2.5 text-sm text-gray-600">{row.clock_out || row.clocked_out_at || '—'}</td>
                              <td className="px-4 py-2.5 text-sm font-semibold text-[#1A73E8]">
                                {formatDuration(row.total_minutes || row.duration_minutes)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
