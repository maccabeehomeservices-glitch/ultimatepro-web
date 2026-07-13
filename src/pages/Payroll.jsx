import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { CreditCard, ChevronRight } from 'lucide-react';
import { useGet } from '../hooks/useApi';
import { Card, LoadingSpinner, EmptyState, Avatar } from '../components/ui';
import Modal from '../components/ui/Modal';
import { reportsApi, payrollApi } from '../lib/api';
import { useSnackbar } from '../components/ui/Snackbar';
import { useAuth } from '../hooks/useAuth';

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
  const { can } = useAuth();
  const navigate = useNavigate();
  const today = new Date();
  const [from, setFrom] = useState(format(new Date(today.getFullYear(), today.getMonth(), 1), 'yyyy-MM-dd'));
  const [to, setTo] = useState(format(today, 'yyyy-MM-dd'));
  const [exporting, setExporting] = useState(false);
  const [showMarkPaid, setShowMarkPaid] = useState(false);
  const [marking, setMarking] = useState(false);

  const url = `/reports/earnings?from=${from}&to=${to}`;
  const { data, loading, refetch } = useGet(url, [from, to]);

  async function handleMarkPaid() {
    setMarking(true);
    try {
      const res = await payrollApi.markEarningsPaid({ from, to });
      setShowMarkPaid(false);
      showSnack(res.data?.message || 'Earnings marked paid', 'success');
      refetch();
    } catch (err) {
      showSnack(err.response?.data?.error || 'Failed to mark paid', 'error');
    } finally { setMarking(false); }
  }

  // /reports/earnings groups by id but doesn't expose the underlying ids
  // (u.id / rt.id / js.id). Resolve them by name from each actor's directory
  // endpoint so the Payroll cards can drill into:
  //   /reports/team/:userId   (Bundle 4.6a — team rows)
  //   /reports/roster/:id     (Bundle 4.6b — roster rows)
  //   /reports/source/:id     (Bundle 4.6b — source rows)
  const { data: techsResp }   = useGet('/users/technicians', []);
  const { data: rosterResp }  = useGet('/roster-techs', []);
  const { data: sourcesResp } = useGet('/sources/contacts', []);

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

  // Roster + source rows in /reports/earnings carry the actor's display name
  // in first_name (rt.name / js.name) and the last_name is a literal tag
  // string ('(Roster)' / '(Source)'). Match on first_name alone here.
  const rosterDirectory = useMemo(() => {
    const raw = rosterResp?.roster_techs || rosterResp?.techs
      || (Array.isArray(rosterResp) ? rosterResp : []);
    const m = new Map();
    for (const r of raw) {
      const key = (r.name || '').trim().toLowerCase();
      const id = r.id || r._id;
      if (key && id) m.set(key, id);
    }
    return m;
  }, [rosterResp]);

  const sourceDirectory = useMemo(() => {
    const raw = sourcesResp?.contacts || sourcesResp?.sources
      || (Array.isArray(sourcesResp) ? sourcesResp : []);
    const m = new Map();
    for (const s of raw) {
      const key = (s.name || '').trim().toLowerCase();
      const id = s.id || s._id;
      if (key && id) m.set(key, id);
    }
    return m;
  }, [sourcesResp]);

  function resolveUserId(row) {
    const key = `${(row.first_name || '').trim().toLowerCase()}|${(row.last_name || '').trim().toLowerCase()}`;
    return techDirectory.get(key) || null;
  }
  function resolveRosterId(row) {
    return rosterDirectory.get((row.first_name || '').trim().toLowerCase()) || null;
  }
  function resolveSourceId(row) {
    return sourceDirectory.get((row.first_name || '').trim().toLowerCase()) || null;
  }

  const rawTechs = data?.earnings || data?.technicians || data?.payroll || data;
  const techs = Array.isArray(rawTechs) ? rawTechs : [];

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-ink">Payroll</h1>
        <div className="flex gap-2">
          {can('accounting_earnings','full') && (
          <button
            onClick={() => setShowMarkPaid(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-green-700 min-h-[44px]"
          >
            ✓ Mark Paid
          </button>
          )}
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
            className="px-4 py-2 border border-blue text-blue rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-blue-50 disabled:opacity-50 min-h-[44px]"
          >
            {exporting ? '⟳ Exporting...' : '📥 Export CSV'}
          </button>
        </div>
      </div>

      {/* Date Range */}
      <Card className="mb-4">
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-muted mb-1">From</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-full rounded-xl border border-hairline px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue min-h-[44px]" />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-muted mb-1">To</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-full rounded-xl border border-hairline px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue min-h-[44px]" />
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

              // Bundle 4.6a (team) + 4.6b (roster/source) drill-downs.
              let targetPath = null;
              if (tech.is_roster) {
                const rid = resolveRosterId(tech);
                if (rid) targetPath = `/reports/roster/${rid}`;
              } else if (tech.is_source) {
                const sid = resolveSourceId(tech);
                if (sid) targetPath = `/reports/source/${sid}`;
              } else {
                const uid = resolveUserId(tech);
                if (uid) targetPath = `/reports/team/${uid}`;
              }
              const clickable = !!targetPath;

              const cardEl = (
                <Card key={tech.id || tech._id || i}>
                  <div className="flex items-center gap-3">
                    <Avatar name={name} size="md" color={actorColor} />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-ink truncate">{name}</p>
                      <p className="text-sm text-muted">
                        {tech.job_count || 0} jobs · {tech.type || (tech.is_source ? 'source' : tech.is_roster ? 'roster' : 'tech')}
                      </p>
                    </div>
                    <p className="font-bold text-lg" style={{ color: actorColor }}>
                      {formatCurrency(Number(tech.total || 0))}
                    </p>
                    {clickable && <ChevronRight size={18} className="text-muted -mr-1" />}
                  </div>
                </Card>
              );

              if (!clickable) return cardEl;
              return (
                <button
                  key={tech.id || tech._id || i}
                  type="button"
                  onClick={() => navigate(targetPath)}
                  className="block w-full text-left rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue"
                >
                  {cardEl}
                </button>
              );
            })}
          </div>

          {/* Summary Table */}
          <div className="bg-card rounded-2xl shadow overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-hairline bg-background">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted">Technician</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted">Jobs</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted">Earnings</th>
                </tr>
              </thead>
              <tbody>
                {techs.map((tech, i) => {
                  const name = `${tech.first_name || ''} ${tech.last_name || ''}`.trim() || 'Unknown tech';
                  const actorColor = tech.color || '#1A73E8';
                  return (
                    <tr key={i} className="border-b border-hairline last:border-0">
                      <td className="px-4 py-2.5 text-sm font-medium text-ink">{name}</td>
                      <td className="px-4 py-2.5 text-sm text-ink">{tech.job_count || 0}</td>
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

      {/* Mark range paid confirm (money action) */}
      <Modal isOpen={showMarkPaid} onClose={() => setShowMarkPaid(false)} title="Mark range paid">
        <p className="text-ink mb-6">
          Mark all earnings from <strong>{from}</strong> to <strong>{to}</strong> as paid? This records that the team was paid for this range and lowers balance owed. Earnings can still recompute if a payment or refund lands later.
        </p>
        <div className="flex gap-3">
          <button onClick={() => setShowMarkPaid(false)}
            className="flex-1 py-3 border border-hairline rounded-xl font-semibold text-ink min-h-[44px]">
            Cancel
          </button>
          <button onClick={handleMarkPaid} disabled={marking}
            className="flex-1 py-3 bg-green-600 text-white rounded-xl font-semibold disabled:opacity-50 min-h-[44px]">
            {marking ? 'Marking…' : 'Mark Paid'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
