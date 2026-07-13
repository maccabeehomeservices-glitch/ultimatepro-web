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

// Same layout as TeamReport — different actorType, no bonuses/deductions
// detail tables (roster_techs has no bonuses/deductions tables backend-side,
// so the response's bonuses[] / deductions[] are always empty). The
// Compensation Summary block still renders; with zero bonus/deduction, Net
// Pay equals Period Tech Profit which is the right number for roster.

function CompRow({ label, value, bold = false }) {
  return (
    <div
      className={`flex justify-between py-1.5 text-sm ${
        bold ? 'text-base font-bold text-blue' : 'text-ink'
      }`}
    >
      <span>{label}</span>
      <span>${Number(value || 0).toFixed(2)}</span>
    </div>
  );
}

function CompensationSummary({ summary, allTime }) {
  const periodProfit = Number(summary?.total_tech_profit || 0);
  // Roster has no bonuses/deductions, so Net Pay = Period Tech Profit.
  const netPay = periodProfit;

  return (
    <div className="space-y-4 mb-4">
      <div className="bg-card rounded-2xl shadow p-4 border-l-4 border-blue">
        <h3 className="font-semibold text-blue mb-3">Compensation Summary</h3>
        <CompRow label="Period Tech Profit (from jobs)" value={periodProfit} />
        <div className="border-t-2 border-blue mt-3 pt-3">
          <CompRow label="Net Pay for Period" value={netPay} bold />
        </div>
      </div>

      <div className="bg-card rounded-2xl shadow p-4 border-l-4 border-gray-400">
        <h3 className="font-semibold text-ink mb-3">All-Time Balance</h3>
        <CompRow label="Lifetime Owed (Unpaid)" value={Number(allTime?.unpaid || 0)} />
        <CompRow label="Lifetime Paid"          value={Number(allTime?.paid   || 0)} />
      </div>
    </div>
  );
}

export default function RosterReport() {
  const { rosterId } = useParams();
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
      .getRosterReport(rosterId, period)
      .then((data) => {
        if (!cancelled) setReport(data);
      })
      .catch((err) => {
        console.error('[RosterReport]', err);
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
  }, [rosterId, period.from, period.to]);

  const actor   = report?.actor   || {};
  const summary = report?.summary || {};
  const jobs    = report?.jobs    || [];
  const allTime = report?.all_time_balance || { unpaid: 0, paid: 0 };
  const allTimeBalanceUnpaid = Number(allTime.unpaid || 0);

  const actorColor = actor.color || '#6B7280';

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-blue text-sm mb-3 min-h-[44px]"
      >
        <ArrowLeft size={16} />
        Back
      </button>

      <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar name={actor.name || 'Roster'} size="md" color={actorColor} />
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-ink truncate">
              {actor.name || 'Pay Statement'}
            </h1>
            <p className="text-sm text-muted">Pay Statement (Roster)</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <ExportReportMenu actorType="roster" actorId={rosterId} period={period} />
          <button
            onClick={() => setSendOpen(true)}
            className="px-3 py-2 bg-blue text-white rounded-xl text-sm font-medium flex items-center gap-1 hover:bg-blue-ink min-h-[44px]"
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
                    ? 'bg-blue text-white'
                    : 'bg-card text-ink border border-hairline'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted mt-2">
          {period.from} to {period.to}
        </p>
      </Card>

      {loading ? (
        <LoadingSpinner />
      ) : !report ? (
        <EmptyState
          icon={CreditCard}
          title="Report unavailable"
          description="No data for this roster tech in the selected period."
        />
      ) : (
        <>
          {/* P2.27 Tech Balance Sheet (same shared component as TeamReport + the PDF). */}
          <TechBalanceSheet jobs={jobs} summary={summary} />
        </>
      )}

      <SendReportModal
        isOpen={sendOpen}
        onClose={() => setSendOpen(false)}
        actorType="roster"
        actorId={rosterId}
        actorName={actor.name || 'Roster Tech'}
        defaultEmail={actor.email}
        defaultPhone={actor.phone}
        period={period}
      />
    </div>
  );
}
