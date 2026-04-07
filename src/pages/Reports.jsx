import { useState } from 'react';
import { format } from 'date-fns';
import { BarChart2 } from 'lucide-react';
import { useGet } from '../hooks/useApi';
import { Card, LoadingSpinner, EmptyState, Tabs } from '../components/ui';

const tabList = [
  { id: 'revenue', label: 'Revenue' },
  { id: 'sources', label: 'Job Sources' },
];

function formatCurrency(v) {
  return '$' + Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function Reports() {
  const today = new Date();
  const [activeTab, setActiveTab] = useState('revenue');
  const [from, setFrom] = useState(format(new Date(today.getFullYear(), today.getMonth(), 1), 'yyyy-MM-dd'));
  const [to, setTo] = useState(format(today, 'yyyy-MM-dd'));

  const { data: revenueData, loading: revenueLoading } = useGet(
    activeTab === 'revenue' ? `/reports/revenue?from=${from}&to=${to}` : null, [activeTab, from, to]
  );
  const { data: sourcesData, loading: sourcesLoading } = useGet(
    activeTab === 'sources' ? `/reports/jobs?from=${from}&to=${to}` : null, [activeTab, from, to]
  );

  const revenueStats = revenueData?.stats || revenueData || {};
  const revenueList = revenueData?.data || revenueData?.items || [];
  const sources = sourcesData?.sources || sourcesData || [];

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-4">Reports</h1>

      {/* Date Range */}
      <Card className="mb-4">
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A73E8] min-h-[44px]" />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A73E8] min-h-[44px]" />
          </div>
        </div>
      </Card>

      <Tabs tabs={tabList} active={activeTab} onChange={setActiveTab} />

      <div className="mt-4">
        {activeTab === 'revenue' && (
          revenueLoading ? <LoadingSpinner /> : (
            <div className="space-y-4">
              {/* Stats */}
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
              {/* Table */}
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

        {activeTab === 'sources' && (
          sourcesLoading ? <LoadingSpinner /> :
          sources.length === 0 ? (
            <EmptyState icon={BarChart2} title="No data" description="Job source data will appear here." />
          ) : (
            <div className="space-y-2">
              {sources.map((s, i) => (
                <Card key={i}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{s.source || s.name || 'Unknown'}</p>
                      <p className="text-sm text-gray-500">{s.count || s.jobs || 0} jobs</p>
                    </div>
                    <p className="font-bold text-[#1A73E8]">{formatCurrency(s.revenue || s.total || 0)}</p>
                  </div>
                </Card>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
