import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Send, Briefcase } from 'lucide-react';
import { reportsApi, formatMoney } from '../lib/api';
import { Card, LoadingSpinner, EmptyState, Avatar } from '../components/ui';
import { useSnackbar } from '../components/ui/Snackbar';
import SendReportModal from '../components/SendReportModal';
import ExportReportMenu from '../components/ExportReportMenu';
import { buildPeriods, PERIOD_CHIPS } from '../lib/reportPeriods';

// Source Settlement Statement. Different model than Pay Statement:
// - No bonuses/deductions/comp model (sources are external contacts; we
//   settle a fixed cut per job per the source's allocation rate).
// - No lifetime owed/paid tracking yet (backend doesn't emit
//   all_time_balance for sources). "Source Balance" = sum of source_earned
//   for the period (i.e. what we owe the source for jobs in range).
//
// Backend summary key names (from utils/report-csv.js computeJobsSummary):
//   - jobs_count
//   - total_total_sale  (col 'total_sale' → 'total_' prefix double-applied)
//   - total_parts
//   - total_source_earned
//   - total_balance     (renamed in UI to "Source Balance")

function KPI({ label, value, accent }) {
  return (
    <Card>
      <p className="text-xs text-gray-400 uppercase">{label}</p>
      <p
        className="text-xl font-bold mt-1"
        style={accent ? { color: accent } : { color: '#111827' }}
      >
        {value}
      </p>
    </Card>
  );
}

export default function SourceReport() {
  const { sourceId } = useParams();
  const navigate = useNavigate();
  const { showSnack } = useSnackbar();

  const periods = useMemo(() => buildPeriods(), []);
  const [chip, setChip] = useState('this_month');
  const period = periods[chip] || periods.this_month;

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sendOpen, setSendOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    reportsApi
      .getSourceReportV2(sourceId, period)
      .then((data) => {
        if (!cancelled) setReport(data);
      })
      .catch((err) => {
        console.error('[SourceReport]', err);
        if (!cancelled) {
          setReport(null);
          showSnack(err?.response?.data?.error || 'Failed to load report', 'error');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sourceId, period.from, period.to]);

  const actor   = report?.actor   || {};
  const summary = report?.summary || {};
  const jobs    = report?.jobs    || [];

  const actorColor = actor.color || '#10B981';
  const sourceBalance = Number(summary.total_balance || 0);

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-[#1A73E8] text-sm mb-3 min-h-[44px]"
      >
        <ArrowLeft size={16} />
        Back
      </button>

      <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar name={actor.name || 'Source'} size="md" color={actorColor} />
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-900 truncate">
              {actor.name || 'Settlement Statement'}
            </h1>
            <p className="text-sm text-gray-500">Settlement Statement</p>
            {actor.company_name && actor.company_name !== actor.name && (
              <p className="text-xs text-gray-400">{actor.company_name}</p>
            )}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <ExportReportMenu actorType="source" actorId={sourceId} period={period} />
          <button
            onClick={() => setSendOpen(true)}
            className="px-3 py-2 bg-[#1A73E8] text-white rounded-xl text-sm font-medium flex items-center gap-1 hover:bg-blue-700 min-h-[44px]"
          >
            <Send size={16} />
            Send Report
          </button>
        </div>
      </div>

      <Card className="mb-4">
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {PERIOD_CHIPS.map(({ id, label }) => {
            const selected = chip === id;
            return (
              <button
                key={id}
                onClick={() => setChip(id)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors min-h-[36px] flex-shrink-0 ${
                  selected
                    ? 'bg-[#1A73E8] text-white'
                    : 'bg-white text-gray-600 border border-gray-200'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-gray-400 mt-2">
          {period.from} to {period.to}
        </p>
      </Card>

      {loading ? (
        <LoadingSpinner />
      ) : !report ? (
        <EmptyState
          icon={Briefcase}
          title="Report unavailable"
          description="No data for this source in the selected period."
        />
      ) : (
        <>
          {/* Source Balance — prominent (replaces All-Time card; sources have
              no lifetime ledger yet) */}
          <Card className="mb-4 border-l-4" style={{ borderColor: actorColor }}>
            <p className="text-xs text-gray-400 uppercase tracking-wide">
              Source Balance
            </p>
            <p className="text-3xl font-bold mt-1" style={{ color: actorColor }}>
              {formatMoney(sourceBalance)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Owed to source for jobs in the selected period.
            </p>
          </Card>

          {/* 5 KPI cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
            <KPI label="Jobs"          value={summary.jobs_count || 0} />
            <KPI label="Revenue"       value={formatMoney(summary.total_total_sale)} />
            <KPI label="Parts"         value={formatMoney(summary.total_parts)} />
            <KPI label="Source Earned" value={formatMoney(summary.total_source_earned)} accent={actorColor} />
            <KPI label="Source Balance" value={formatMoney(sourceBalance)} />
          </div>

          {/* Jobs table — 10 cols matching ACTOR_COLUMNS.source */}
          <div className="bg-white rounded-2xl shadow overflow-hidden mb-4">
            <div className="px-4 py-3 border-b border-gray-100 font-semibold text-gray-900">
              Jobs ({jobs.length})
            </div>
            {jobs.length === 0 ? (
              <div className="px-4 py-6 text-center text-gray-400 text-sm">
                No jobs in this period.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">Ticket</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">Customer</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">Address</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">Date</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">Job Info</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">Total</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">Parts</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">Rate</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">Source Earned</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map((j, i) => (
                      <tr key={j.job_id || i} className="border-b border-gray-50 last:border-0">
                        <td className="px-4 py-2.5 font-mono text-xs text-gray-700">{j.ticket || '—'}</td>
                        <td className="px-4 py-2.5 text-gray-700">{j.customer_name || '—'}</td>
                        <td className="px-4 py-2.5 text-gray-500 max-w-[180px] truncate">{j.address || '—'}</td>
                        <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">
                          {j.date ? new Date(j.date).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-gray-700 max-w-[160px] truncate">{j.job_info || '—'}</td>
                        <td className="px-4 py-2.5 text-right text-gray-700">
                          {formatMoney(j.total_sale)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-gray-700">
                          {formatMoney(j.parts)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-gray-700">
                          {Number(j.rate || 0).toFixed(1)}%
                        </td>
                        <td
                          className="px-4 py-2.5 text-right font-semibold"
                          style={{ color: actorColor }}
                        >
                          {formatMoney(j.source_earned)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-gray-700">
                          {formatMoney(j.balance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      <SendReportModal
        isOpen={sendOpen}
        onClose={() => setSendOpen(false)}
        actorType="source"
        actorId={sourceId}
        actorName={actor.name || 'Source'}
        defaultEmail={actor.email}
        defaultPhone={actor.phone}
        period={period}
      />
    </div>
  );
}
