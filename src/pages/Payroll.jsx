import { useState } from 'react';
import { format } from 'date-fns';
import { CreditCard } from 'lucide-react';
import { useGet } from '../hooks/useApi';
import { Card, LoadingSpinner, EmptyState, Avatar } from '../components/ui';
import { reportsApi } from '../lib/api';
import { useSnackbar } from '../components/ui/Snackbar';

function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

function formatCurrency(v) {
  return '$' + Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function Payroll() {
  const { showSnack } = useSnackbar();
  const today = new Date();
  const [from, setFrom] = useState(format(new Date(today.getFullYear(), today.getMonth(), 1), 'yyyy-MM-dd'));
  const [to, setTo] = useState(format(today, 'yyyy-MM-dd'));
  const [exporting, setExporting] = useState(false);

  const url = `/reports/earnings?from=${from}&to=${to}`;
  const { data, loading } = useGet(url, [from, to]);

  const rawTechs = data?.earnings || data?.technicians || data?.payroll || data;
  const techs = Array.isArray(rawTechs) ? rawTechs : [];

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-900">Payroll</h1>
        <button
          onClick={async () => {
            try {
              setExporting(true);
              const res = await reportsApi.exportEarnings(from, to);
              downloadBlob(res.data, `payroll-${from}-to-${to}.csv`);
              showSnack('Report downloaded!', 'success');
            } catch { showSnack('Export failed', 'error'); }
            finally { setExporting(false); }
          }}
          disabled={exporting}
          className="px-4 py-2 border border-[#1A73E8] text-[#1A73E8] rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-blue-50 disabled:opacity-50 min-h-[44px]"
        >
          {exporting ? '⟳ Exporting...' : '📥 Export CSV'}
        </button>
      </div>

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

      {loading ? (
        <LoadingSpinner />
      ) : techs.length === 0 ? (
        <EmptyState icon={CreditCard} title="No payroll data" description="Payroll summary will appear here." />
      ) : (
        <>
          <div className="space-y-2 mb-4">
            {techs.map((tech, i) => {
              const name = `${tech.first_name || ''} ${tech.last_name || ''}`.trim() || tech.name || 'Tech';
              return (
                <Card key={tech.id || tech._id || i}>
                  <div className="flex items-center gap-3">
                    <Avatar name={name} size="md" color="#1A73E8" />
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">{name}</p>
                      <p className="text-sm text-gray-500">{tech.total_jobs || tech.jobs_completed || 0} jobs completed</p>
                    </div>
                    <p className="font-bold text-[#1A73E8] text-lg">{formatCurrency(tech.total_earned || tech.net_pay || tech.earnings || tech.total_pay || 0)}</p>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Summary Table */}
          <div className="bg-white rounded-2xl shadow overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Technician</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Jobs</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Earnings</th>
                </tr>
              </thead>
              <tbody>
                {techs.map((tech, i) => {
                  const name = `${tech.first_name || ''} ${tech.last_name || ''}`.trim() || tech.name || 'Tech';
                  return (
                    <tr key={i} className="border-b border-gray-50 last:border-0">
                      <td className="px-4 py-2.5 text-sm font-medium text-gray-900">{name}</td>
                      <td className="px-4 py-2.5 text-sm text-gray-600">{tech.total_jobs || tech.jobs_completed || 0}</td>
                      <td className="px-4 py-2.5 text-sm font-semibold text-[#1A73E8]">{formatCurrency(tech.total_earned || tech.net_pay || tech.earnings || tech.total_pay || 0)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
