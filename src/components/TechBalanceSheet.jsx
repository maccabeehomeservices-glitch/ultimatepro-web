import { formatMoney } from '../lib/api';

// P2.27 Tech Balance Sheet (David's spec) — shared by TeamReport + RosterReport so both
// platforms + the report PDF render identical rows. Columns: Ticket # | Client Info
// (name+address) | Date Closed | Job Type | Total | Payment ("Method (Collector)", one line
// per payment) | Parts & Fees (T.Part/C.Part/Fees) | Tech Profit (Cut + Rate/Hours adaptive) |
// Balance (per-job settlement; +ve = tech owes company, −ve = company owes tech).
const METHOD_MAP = {
  credit_card: 'CC', card: 'CC', scanpay: 'CC', venmo: 'CC', cashapp: 'CC',
  payment_link: 'CC', paypal: 'CC', zelle: 'Check', check: 'Check', cash: 'Cash',
};
const bsMethod = (m) => METHOD_MAP[m] || 'Other';
const bsCollector = (c) => (c === 'tech' ? 'Tech' : 'Co.');
const cap = (s) => (s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : '');
const signed = (v) => { const n = Number(v) || 0; return (n < 0 ? '-' : '') + formatMoney(Math.abs(n)); };
// Parse the company-day 'YYYY-MM-DD' directly — `new Date('2026-07-06')` is UTC-midnight and
// `.toLocaleDateString()` shifts it a day back in negative-UTC timezones (F11/P2.20 class).
const fmtDate = (d) => {
  if (!d) return '—';
  const [y, m, dd] = String(d).slice(0, 10).split('-');
  return (y && m && dd) ? `${Number(m)}/${Number(dd)}/${y}` : String(d).slice(0, 10);
};

function paymentLines(j) {
  const ps = Array.isArray(j.payments) ? j.payments : [];
  if (!ps.length) return ['—'];
  return ps.map((p) => `${bsMethod(p.method)} (${bsCollector(p.collected_by)})  ${formatMoney(p.amount)}`);
}
function partsFeesLines(j) {
  const out = [];
  const tp = Number(j.tech_parts) || 0, cp = Number(j.company_parts) || 0, fe = Number(j.fees) || 0;
  if (tp > 0) out.push(`T.Part: ${formatMoney(tp)}`);
  if (cp > 0) out.push(`C.Part: ${formatMoney(cp)}`);
  if (fe > 0) out.push(`Fees: ${formatMoney(fe)}`);
  return out.length ? out : ['—'];
}
function techProfitLines(j) {
  const hours = Number(j.hours) || 0, rate = Number(j.hourly_rate) || 0, pct = Number(j.commission_pct) || 0;
  const lines = [`Cut: ${formatMoney(j.tech_profit)}`];
  if (hours > 0 && rate > 0) lines.push(`Hours: ${hours % 1 ? hours.toFixed(1) : hours} @ ${formatMoney(rate)}/hr`);
  if (pct > 0) lines.push(`Rate: ${Number(pct).toFixed(0)}%`);
  if (!(hours > 0 && rate > 0) && !(pct > 0)) lines.push('Rate: —');
  return lines;
}

const Stacked = ({ lines }) => (
  <>{lines.map((l, k) => <div key={k} className="whitespace-nowrap">{l}</div>)}</>
);

export default function TechBalanceSheet({ jobs = [], summary = {} }) {
  const reportBalance = Number(summary.total_balance || 0);
  const owed = reportBalance < 0;
  return (
    <div className="bg-white rounded-2xl shadow overflow-hidden mb-4">
      <div className="px-4 py-3 border-b border-gray-100 font-semibold text-gray-900">
        Tech Balance Sheet
      </div>
      {jobs.length === 0 ? (
        <div className="px-4 py-6 text-center text-gray-400 text-sm">No jobs in this period.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500">
                <th className="text-left px-3 py-3 whitespace-nowrap">Ticket #</th>
                <th className="text-left px-3 py-3">Client Info</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Date Closed</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Job Type</th>
                <th className="text-right px-3 py-3 whitespace-nowrap">Total</th>
                <th className="text-left px-3 py-3">Payment</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Parts &amp; Fees</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Tech Profit</th>
                <th className="text-right px-3 py-3">Balance</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j, i) => {
                const bal = Number(j.balance) || 0;
                return (
                  <tr key={j.job_id || i} className="border-b border-gray-50 last:border-0 align-top">
                    <td className="px-3 py-2.5 font-mono text-xs text-gray-700 whitespace-nowrap">{j.ticket || '—'}</td>
                    <td className="px-3 py-2.5 text-gray-700">
                      <div className="font-medium">{j.customer_name || '—'}</div>
                      {j.address ? <div className="text-xs text-gray-400">{j.address}</div> : null}
                    </td>
                    <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{fmtDate(j.date)}</td>
                    <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{cap(j.job_type)}</td>
                    <td className="px-3 py-2.5 text-right text-gray-700 whitespace-nowrap">{formatMoney(j.total_sale)}</td>
                    <td className="px-3 py-2.5 text-gray-600 text-xs"><Stacked lines={paymentLines(j)} /></td>
                    <td className="px-3 py-2.5 text-gray-600 text-xs"><Stacked lines={partsFeesLines(j)} /></td>
                    <td className="px-3 py-2.5 text-gray-600 text-xs"><Stacked lines={techProfitLines(j)} /></td>
                    <td className="px-3 py-2.5 text-right font-semibold whitespace-nowrap" style={{ color: bal < 0 ? '#059669' : '#EA580C' }}>{signed(bal)}</td>
                  </tr>
                );
              })}
              <tr className="bg-gray-50 font-semibold text-gray-800">
                <td className="px-3 py-3">TOTAL</td>
                <td /><td /><td />
                <td className="px-3 py-3 text-right whitespace-nowrap">{formatMoney(summary.total_total_sale)}</td>
                <td /><td />
                <td className="px-3 py-3 text-xs whitespace-nowrap">Cut: {formatMoney(summary.total_tech_profit)}</td>
                <td className="px-3 py-3 text-right whitespace-nowrap">{signed(reportBalance)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <div className="px-4 py-4 border-t border-gray-100 flex items-center justify-between">
        <div>
          <div className="text-sm font-bold text-gray-900">REPORT BALANCE</div>
          <div className="text-xs text-gray-500">{owed ? 'Company owes tech' : 'Tech owes company'}</div>
        </div>
        <div className="text-2xl font-bold" style={{ color: owed ? '#059669' : '#EA580C' }}>{signed(reportBalance)}</div>
      </div>
    </div>
  );
}
