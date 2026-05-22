import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { CreditCard, ChevronRight } from 'lucide-react';
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
  const navigate = useNavigate();
  const today = new Date();
  const [from, setFrom] = useState(format(new Date(today.getFullYear(), today.getMonth(), 1), 'yyyy-MM-dd'));
  const [to, setTo] = useState(format(today, 'yyyy-MM-dd'));
  const [exporting, setExporting] = useState(false);

  const url = `/reports/earnings?from=${from}&to=${to}`;
  const { data, loading } = useGet(url, [from, to]);

  // /reports/earnings doesn't expose the underlying user.id (GROUP BY hides it),
  // so we fetch the technicians list separately and resolve user ids by name
  // to power the Bundle 4.6a drill-down into /reports/team/:userId. Roster and
  // Source rows stay non-clickable until 4.6b ships their screens.
  const { data: techsResp } = useGet('/users/technicians', []);
  const techDirectory = useMemo(() => {
    const raw = techsResp?.technicians || (Array.isArray(techsResp) ? techsResp : []);
    const m = new Map();
    for (const t of raw) {
      const key = `${(t.first_name || '').trim().toLowerCase()}|${(t.last_name || '').trim().toLowerCase()}`;
      const id = t.id || t._id;
      if (id) m.set(key, id);
    }
    return m;
  }, [techsResp]);

  function resolveUserId(row) {
    const key = `${(row.first_name || '').trim().toLowerCase()}|${(row.last_name || '').trim().toLowerCase()}`;
    return techDirectory.get(key) || null;
  }

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
              const name = `${tech.first_name || ''} ${tech.last_name || ''}`.trim() || 'Unknown tech';
              const actorColor = tech.color || '#1A73E8';

              // Only team actors (not roster, not source) drill in to Bundle
              // 4.6a TeamReport. Other actor screens land in 4.6b/c.
              const isTeam = !tech.is_roster && !tech.is_source;
              const userId = isTeam ? resolveUserId(tech) : null;
              const clickable = !!userId;

              const cardEl = (
                <Card key={tech.id || tech._id || i}>
                  <div className="flex items-center gap-3">
                    <Avatar name={name} size="md" color={actorColor} />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{name}</p>
                      <p className="text-sm text-gray-500">
                        {tech.job_count || 0} jobs · {tech.type || (tech.is_source ? 'source' : tech.is_roster ? 'roster' : 'tech')}
                      </p>
                    </div>
                    <p className="font-bold text-lg" style={{ color: actorColor }}>
                      {formatCurrency(Number(tech.total || 0))}
                    </p>
                    {clickable && <ChevronRight size={18} className="text-gray-300 -mr-1" />}
                  </div>
                </Card>
              );

              if (!clickable) return cardEl;
              return (
                <button
                  key={tech.id || tech._id || i}
                  type="button"
                  onClick={() => navigate(`/reports/team/${userId}`)}
                  className="block w-full text-left rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#1A73E8]"
                >
                  {cardEl}
                </button>
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
                  const name = `${tech.first_name || ''} ${tech.last_name || ''}`.trim() || 'Unknown tech';
                  const actorColor = tech.color || '#1A73E8';
                  return (
                    <tr key={i} className="border-b border-gray-50 last:border-0">
                      <td className="px-4 py-2.5 text-sm font-medium text-gray-900">{name}</td>
                      <td className="px-4 py-2.5 text-sm text-gray-600">{tech.job_count || 0}</td>
                      <td className="px-4 py-2.5 text-sm font-semibold" style={{ color: actorColor }}>
                        {formatCurrency(Number(tech.total || 0))}
                      </td>
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
