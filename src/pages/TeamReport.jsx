import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Send, CreditCard } from 'lucide-react';
import { reportsApi, formatMoney } from '../lib/api';
import { Card, LoadingSpinner, EmptyState, Avatar } from '../components/ui';
import { useSnackbar } from '../components/ui/Snackbar';
import SendReportModal from '../components/SendReportModal';
import ExportReportMenu from '../components/ExportReportMenu';
import TechBalanceSheet from '../components/TechBalanceSheet';
import { buildPeriods, PERIOD_CHIPS } from '../lib/reportPeriods';

function CompRow({ label, value, bold = false }) {
  return (
    <div
      className={`flex justify-between py-1.5 text-sm ${
        bold ? 'text-base font-bold text-[#1A73E8]' : 'text-gray-700'
      }`}
    >
      <span>{label}</span>
      <span>${Number(value || 0).toFixed(2)}</span>
    </div>
  );
}

function CompensationSummary({ summary, bonuses, deductions, allTime }) {
  const periodProfit = Number(summary?.total_tech_profit || 0);
  const bonusTotal = (bonuses || []).reduce(
    (s, b) => s + Number(b.amount || 0),
    0
  );
  const deductionTotal = (deductions || []).reduce(
    (s, d) => s + Number(d.amount || 0),
    0
  );
  const netPay = periodProfit + bonusTotal - deductionTotal;

  return (
    <div className="space-y-4 mb-4">
      <div className="bg-white rounded-2xl shadow p-4 border-l-4 border-[#1A73E8]">
        <h3 className="font-semibold text-[#1A73E8] mb-3">Compensation Summary</h3>
        <CompRow label="Period Tech Profit (from jobs)" value={periodProfit} />
        <CompRow label="+ Bonuses"    value={bonusTotal} />
        <CompRow label="- Deductions" value={deductionTotal} />
        <div className="border-t-2 border-[#1A73E8] mt-3 pt-3">
          <CompRow label="Net Pay for Period" value={netPay} bold />
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow p-4 border-l-4 border-gray-400">
        <h3 className="font-semibold text-gray-700 mb-3">All-Time Balance</h3>
        <CompRow label="Lifetime Owed (Unpaid)" value={Number(allTime?.unpaid || 0)} />
        <CompRow label="Lifetime Paid"          value={Number(allTime?.paid   || 0)} />
      </div>
    </div>
  );
}

export default function TeamReport() {
  const { userId } = useParams();
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
      .getTechReport(userId, period)
      .then((data) => {
        if (!cancelled) setReport(data);
      })
      .catch((err) => {
        console.error('[TeamReport]', err);
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
    // period values are primitives so this fires on chip change.
  }, [userId, period.from, period.to]);

  const actor      = report?.actor      || {};
  const summary    = report?.summary    || {};
  const jobs       = report?.jobs       || [];
  const bonuses    = report?.bonuses    || [];
  const deductions = report?.deductions || [];
  // all_time_balance shape: { unpaid, paid } (Bundle 4.6b). The prominent
  // top card still shows "owed" (matches the original Report Balance);
  // the CompensationSummary block below the jobs table shows both sides.
  const allTime = report?.all_time_balance || { unpaid: 0, paid: 0 };
  const allTimeBalanceUnpaid = Number(allTime.unpaid || 0);

  const actorColor = actor.color || '#1A73E8';

  return (
    <div className="p-4 max-w-3xl mx-auto">
      {/* Header */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-[#1A73E8] text-sm mb-3 min-h-[44px]"
      >
        <ArrowLeft size={16} />
        Back
      </button>

      <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar name={actor.name || 'Tech'} size="md" color={actorColor} />
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-900 truncate">
              {actor.name || 'Pay Statement'}
            </h1>
            <p className="text-sm text-gray-500">Pay Statement</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <ExportReportMenu actorType="tech" actorId={userId} period={period} />
          <button
            onClick={() => setSendOpen(true)}
            className="px-3 py-2 bg-[#1A73E8] text-white rounded-xl text-sm font-medium flex items-center gap-1 hover:bg-blue-700 min-h-[44px]"
          >
            <Send size={16} />
            Send Report
          </button>
        </div>
      </div>

      {/* Period chips */}
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
          icon={CreditCard}
          title="Report unavailable"
          description="No data for this tech in the selected period."
        />
      ) : (
        <>
          {/* P2.27 Tech Balance Sheet — per-job settlement (Payment/Parts&Fees/Balance) +
              bottom TOTAL + REPORT BALANCE. Replaces the old all-time headline + 7-col table
              + Compensation Summary per David's spec (no top headline, no all-time line). */}
          <TechBalanceSheet jobs={jobs} summary={summary} />

          {/* Bonuses */}
          {bonuses.length > 0 && (
            <div className="bg-white rounded-2xl shadow overflow-hidden mb-4">
              <div className="px-4 py-3 border-b border-gray-100 font-semibold text-green-700">
                Bonuses ({bonuses.length})
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {bonuses.map((b, i) => (
                    <tr key={b.id || i} className="border-b border-gray-50 last:border-0">
                      <td className="px-4 py-2.5 text-gray-700">
                        {b.reason || b.description || '—'}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-400 whitespace-nowrap">
                        {b.created_at
                          ? new Date(b.created_at).toLocaleDateString()
                          : ''}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold text-green-600 whitespace-nowrap">
                        +{formatMoney(b.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Deductions */}
          {deductions.length > 0 && (
            <div className="bg-white rounded-2xl shadow overflow-hidden mb-4">
              <div className="px-4 py-3 border-b border-gray-100 font-semibold text-red-700">
                Deductions ({deductions.length})
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {deductions.map((d, i) => (
                    <tr key={d.id || i} className="border-b border-gray-50 last:border-0">
                      <td className="px-4 py-2.5 text-gray-700">
                        {d.reason || d.description || '—'}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-400 whitespace-nowrap">
                        {d.created_at
                          ? new Date(d.created_at).toLocaleDateString()
                          : ''}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold text-red-600 whitespace-nowrap">
                        -{formatMoney(d.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <SendReportModal
        isOpen={sendOpen}
        onClose={() => setSendOpen(false)}
        actorType="tech"
        actorId={userId}
        actorName={actor.name || 'Technician'}
        defaultEmail={actor.email}
        defaultPhone={actor.phone}
        period={period}
      />
    </div>
  );
}
