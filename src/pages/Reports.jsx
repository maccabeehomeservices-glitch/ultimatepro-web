import { useState } from 'react';
import { format } from 'date-fns';
import { BarChart2 } from 'lucide-react';
import { useGet } from '../hooks/useApi';
import { Card, LoadingSpinner, EmptyState, Tabs, Select, Button, Modal, Input } from '../components/ui';
import { useSnackbar } from '../components/ui/Snackbar';
import { networkApi, reportsApi, sourcesApi, timesheetsApi } from '../lib/api';

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

// Wrap a value in CSV-safe form: quote when it contains delimiter/newline/quote,
// double up internal quotes per RFC 4180.
function csvCell(v) {
  const s = (v == null ? '' : String(v));
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Build the five date-range presets used by the chip row. Each preset returns
// 'yyyy-MM-dd' strings via date-fns format(). 'custom' carries no preset
// values; the user manipulates the date inputs directly.
function buildDatePresets() {
  const today = new Date();
  const fmt = (d) => format(d, 'yyyy-MM-dd');
  // Monday-anchored week start (Sunday treated as end of prior week).
  const dayIdx = (today.getDay() + 6) % 7;
  const weekStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - dayIdx);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
  const yearStart = new Date(today.getFullYear(), 0, 1);
  return [
    { id: 'week',       label: 'This Week',  from: fmt(weekStart),      to: fmt(today) },
    { id: 'month',      label: 'This Month', from: fmt(monthStart),     to: fmt(today) },
    { id: 'last-month', label: 'Last Month', from: fmt(lastMonthStart), to: fmt(lastMonthEnd) },
    { id: 'ytd',        label: 'YTD',        from: fmt(yearStart),      to: fmt(today) },
    { id: 'custom',     label: 'Custom' },
  ];
}

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
  const { showSnack } = useSnackbar();
  const datePresets = buildDatePresets();
  const monthPreset = datePresets.find(p => p.id === 'month');

  const [activeTab, setActiveTab] = useState('revenue');
  const [dateRange, setDateRange] = useState('month');
  const [from, setFrom] = useState(monthPreset.from);
  const [to, setTo] = useState(monthPreset.to);
  const [techFilter, setTechFilter] = useState('');

  function pickDateChip(id) {
    setDateRange(id);
    if (id === 'custom') return;
    const preset = datePresets.find(p => p.id === id);
    if (preset) { setFrom(preset.from); setTo(preset.to); }
  }

  // Send Partner Report modal
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendRecipient, setSendRecipient] = useState('');
  const [sending, setSending] = useState(false);

  // Build the per-job CSV from in-memory partnerReport data + summary totals
  // and trigger download. Named function (rather than inline arrow) so the
  // symbol survives minification with a stable shape.
  function handleExportPartner() {
    if (!partnerReport || !selectedConnection) {
      showSnack('Load a partner report first', 'error');
      return;
    }
    const partnerName = selectedConnection.company_name || selectedConnection.partner_name || 'partner';
    // P2.34: build from the /reports/partner settlement shape (we_sent/they_sent + net_balance).
    const summary = partnerReport.summary || {};
    const rows = [
      ...(partnerReport.we_sent || []).map((j) => ['We Sent', j]),
      ...(partnerReport.they_sent || []).map((j) => ['They Sent', j]),
    ];
    const headers = ['Direction', 'Ticket', 'Customer', 'Total', 'Their %', 'Their Profit', 'Our Profit', 'Balance'];
    const lines = [headers.join(',')];
    rows.forEach(([dir, j]) => {
      lines.push([
        csvCell(dir),
        csvCell(j.job_number || j.ticket),
        csvCell(j.customer_name || j.customer),
        csvCell(j.total),
        csvCell(j.their_share_pct),
        csvCell(j.their_profit),
        csvCell(j.our_profit),
        csvCell(j.balance),
      ].join(','));
    });
    lines.push(['NET BALANCE', '', '', '', '', '', '', csvCell(summary.net_balance)].join(','));
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const safeName = partnerName.replace(/[^a-zA-Z0-9]+/g, '-');
    downloadBlob(blob, `partner-report-${safeName}-${from}-to-${to}.csv`);
    showSnack('Report downloaded!', 'success');
  }

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

  const [exporting, setExporting] = useState(false);
  const [partnerReport, setPartnerReport] = useState(null);
  const [partnerReportLoading, setPartnerReportLoading] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState(null);

  async function loadConnectionReport(conn) {
    setSelectedConnection(conn);
    setPartnerReport(null);
    setPartnerReportLoading(true);
    try {
      // P2.34: the /reports/partner bidirectional SETTLEMENT (we_sent/they_sent/net_balance) —
      // NOT the old /network report, which showed $0 because it never reflected confirmed
      // partner-job settlements. Parity with the settlement PDF (507/333 → net ∓333).
      const data = await reportsApi.getPartnerReport(conn.id || conn._id, { from, to });
      setPartnerReport(data);
    } catch {
      setPartnerReport(null);
    } finally {
      setPartnerReportLoading(false);
    }
  }

  const connections = connectionsData?.connections || (Array.isArray(connectionsData) ? connectionsData : []);

  // /reports/revenue returns a flat array of per-period rows:
  // [{ period, cash, check, card, online, total, payment_count }, ...]
  // KPIs are derived by summing across rows; per-period rows feed the table below.
  const revenueRows  = Array.isArray(revenueData) ? revenueData : [];
  const totalRevenue = revenueRows.reduce((s, r) => s + Number(r.total || 0), 0);
  const totalPayments = revenueRows.reduce((s, r) => s + Number(r.payment_count || 0), 0);
  const totalCash    = revenueRows.reduce((s, r) => s + Number(r.cash || 0), 0);
  const totalCard    = revenueRows.reduce((s, r) => s + Number(r.card || 0), 0);
  const totalCheck   = revenueRows.reduce((s, r) => s + Number(r.check || 0), 0);
  const totalOnline  = revenueRows.reduce((s, r) => s + Number(r.online || 0), 0);
  const totalElectronic = totalCard + totalOnline;

  // Sources: combine network[], external_contacts[], own_company[]
  const sourceNetwork = sourcesData?.network || [];
  const sourceExternal = sourcesData?.external_contacts || [];
  const sourceOwn = sourcesData?.own_company || [];
  const allSources = [
    ...sourceNetwork.map(s => ({ ...s, _category: 'Network' })),
    ...sourceExternal.map(s => ({ ...s, _category: 'Source Contact' })),
    ...sourceOwn.map(s => ({ ...s, _category: 'Own Company' })),
  ];

  const tsRows = tsData?.timesheets || (Array.isArray(tsData) ? tsData : []);
  const tsSummary = tsData?.summary || [];
  const techs = techsData?.technicians || (Array.isArray(techsData) ? techsData : []);
  const techOptions = [
    { value: '', label: 'All Technicians' },
    ...techs.map(t => ({ value: t.id || t._id, label: `${t.first_name || ''} ${t.last_name || ''}`.trim() })),
  ];

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <h1 className="text-xl font-bold text-ink mb-4">Reports</h1>

      {/* Date Range: chips + inputs. Inputs are always visible so the user
           can see the active range; manually editing either input flips the
           selection to 'custom'. Chip styling matches Jobs.jsx. */}
      <Card className="mb-4">
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 mb-3">
          {datePresets.map(({ id, label }) => {
            const selected = dateRange === id;
            return (
              <button
                key={id}
                onClick={() => pickDateChip(id)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors min-h-[36px] flex-shrink-0 ${
                  selected ? 'bg-blue text-white' : 'bg-card text-ink border border-hairline'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-muted mb-1">From</label>
            <input
              type="date"
              value={from}
              onChange={e => { setFrom(e.target.value); setDateRange('custom'); }}
              className="w-full rounded-xl border border-hairline px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue min-h-[44px]"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-muted mb-1">To</label>
            <input
              type="date"
              value={to}
              onChange={e => { setTo(e.target.value); setDateRange('custom'); }}
              className="w-full rounded-xl border border-hairline px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue min-h-[44px]"
            />
          </div>
        </div>
      </Card>

      <Tabs tabs={tabList} active={activeTab} onChange={setActiveTab} />

      <div className="mt-4">
        {/* Revenue tab */}
        {activeTab === 'revenue' && (
          revenueLoading ? <LoadingSpinner /> : (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button
                  onClick={async () => {
                    try {
                      setExporting(true);
                      const res = await reportsApi.exportRevenue(from, to);
                      downloadBlob(res.data, `revenue-report-${from}-to-${to}.csv`);
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
              <div className="grid grid-cols-2 gap-3">
                <Card>
                  <p className="text-xs text-muted uppercase">Total Revenue</p>
                  <p className="text-2xl font-bold text-ink mt-1">{formatCurrency(totalRevenue)}</p>
                </Card>
                <Card>
                  <p className="text-xs text-muted uppercase">Payments</p>
                  <p className="text-2xl font-bold text-ink mt-1">{totalPayments}</p>
                </Card>
                <Card>
                  <p className="text-xs text-muted uppercase">Cash</p>
                  <p className="text-2xl font-bold text-ink mt-1">{formatCurrency(totalCash)}</p>
                </Card>
                <Card>
                  <p className="text-xs text-muted uppercase">Card + Online</p>
                  <p className="text-2xl font-bold text-ink mt-1">{formatCurrency(totalElectronic)}</p>
                </Card>
              </div>
              {revenueRows.length > 0 && (
                <div className="bg-card rounded-2xl shadow overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-hairline bg-background">
                          <th className="text-left px-4 py-3 text-xs font-semibold text-muted whitespace-nowrap">Date</th>
                          <th className="text-right px-4 py-3 text-xs font-semibold text-muted whitespace-nowrap">Cash</th>
                          <th className="text-right px-4 py-3 text-xs font-semibold text-muted whitespace-nowrap">Card</th>
                          <th className="text-right px-4 py-3 text-xs font-semibold text-muted whitespace-nowrap">Check</th>
                          <th className="text-right px-4 py-3 text-xs font-semibold text-muted whitespace-nowrap">Online</th>
                          <th className="text-right px-4 py-3 text-xs font-semibold text-muted whitespace-nowrap">Total</th>
                          <th className="text-right px-4 py-3 text-xs font-semibold text-muted whitespace-nowrap">Payments</th>
                        </tr>
                      </thead>
                      <tbody>
                        {revenueRows.map((row, i) => (
                          <tr key={i} className="border-b border-hairline last:border-0">
                            <td className="px-4 py-2.5 text-ink whitespace-nowrap">{row.period ? format(new Date(row.period), 'MMM d, yyyy') : ''}</td>
                            <td className="px-4 py-2.5 text-ink text-right">{formatCurrency(row.cash)}</td>
                            <td className="px-4 py-2.5 text-ink text-right">{formatCurrency(row.card)}</td>
                            <td className="px-4 py-2.5 text-ink text-right">{formatCurrency(row.check)}</td>
                            <td className="px-4 py-2.5 text-ink text-right">{formatCurrency(row.online)}</td>
                            <td className="px-4 py-2.5 font-semibold text-ink text-right">{formatCurrency(row.total)}</td>
                            <td className="px-4 py-2.5 text-ink text-right">{row.payment_count || 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
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
              <div className="flex justify-end mb-2">
                <button
                  onClick={async () => {
                    try {
                      setExporting(true);
                      const res = await sourcesApi.exportReport(from, to);
                      downloadBlob(res.data, `sources-report-${from}-to-${to}.csv`);
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
              {allSources.map((s, i) => (
                <Card key={i}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-ink">{s.source_name || 'Unknown'}</p>
                      <p className="text-xs text-muted">{s._category}</p>
                      <p className="text-sm text-muted">{s.job_count || 0} jobs</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-blue">{formatCurrency(s.total_revenue || 0)}</p>
                      {s.profit_allocation_pct != null && (
                        <p className="text-xs text-muted">Allocation: {s.profit_allocation_pct}%</p>
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
                        <p className="font-semibold text-ink">{conn.company_name || conn.partner_name || conn.name}</p>
                        <p className="text-xs text-muted">{conn.status || 'active'}</p>
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

              {partnerReport && selectedConnection && (() => {
                // P2.34: /reports/partner bidirectional settlement. Net balance mirrors the PDF:
                // negative = we owe them, positive = they owe us.
                const net = Number(partnerReport.summary?.net_balance || 0);
                const weSent = partnerReport.we_sent || [];
                const theySent = partnerReport.they_sent || [];
                const totalJobs = weSent.length + theySent.length;
                const jobRow = (j, i) => (
                  <div key={j.job_id || i} className="flex items-center justify-between py-1.5 border-b border-hairline last:border-0">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-ink truncate">{j.job_number || j.ticket || `Job ${i + 1}`}</p>
                      {(j.customer_name || j.customer) && <p className="text-xs text-muted truncate">{j.customer_name || j.customer}</p>}
                    </div>
                    <div className="text-right ml-3 flex-shrink-0">
                      <p className="text-sm font-medium text-ink">{formatCurrency(j.our_profit || 0)}</p>
                      <p className={`text-xs ${Number(j.balance) < 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(j.balance || 0)}</p>
                    </div>
                  </div>
                );
                return (
                <Card>
                  <p className="text-xs text-muted uppercase font-medium mb-2">
                    {selectedConnection.company_name || selectedConnection.partner_name} — {from} to {to}
                  </p>
                  {/* Net balance headline — mirrors the settlement PDF */}
                  <div className={`rounded-xl px-4 py-3 mb-3 ${net < 0 ? 'bg-red-50 border border-red-200' : net > 0 ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'}`}>
                    <p className="text-xs uppercase font-medium text-muted">{net < 0 ? 'You Owe Them' : net > 0 ? 'They Owe You' : 'Settled'}</p>
                    <p className={`text-2xl font-bold ${net < 0 ? 'text-red-600' : net > 0 ? 'text-green-700' : 'text-gray-700'}`}>{formatCurrency(Math.abs(net))}</p>
                  </div>
                  <p className="text-xs text-muted mb-3">{totalJobs} settled job{totalJobs === 1 ? '' : 's'}</p>
                  {weSent.length > 0 && (
                    <div className="mb-3"><p className="text-xs font-semibold text-ink mb-1">Jobs We Sent</p>{weSent.map(jobRow)}</div>
                  )}
                  {theySent.length > 0 && (
                    <div className="mb-3"><p className="text-xs font-semibold text-ink mb-1">Jobs They Sent</p>{theySent.map(jobRow)}</div>
                  )}
                  {totalJobs === 0 && <p className="text-sm text-muted mb-3">No confirmed partner jobs in this range.</p>}
                  <div className="flex gap-2 pt-2 border-t border-hairline">
                    <button
                      onClick={() => { setSendRecipient(''); setShowSendModal(true); }}
                      className="flex-1 py-2 bg-blue text-white rounded-xl text-sm font-medium hover:bg-blue-ink min-h-[44px]"
                    >
                      📧 Send Report
                    </button>
                    <button
                      onClick={handleExportPartner}
                      className="flex-1 py-2 border border-blue text-blue rounded-xl text-sm font-medium hover:bg-blue-50 min-h-[44px]"
                    >
                      📥 Export CSV
                    </button>
                  </div>
                </Card>
                );
              })()}
            </div>
          )
        )}

        {/* Timesheets tab */}
        {activeTab === 'timesheets' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              {techs.length > 0 && (
                <div className="flex-1">
                  <Select value={techFilter} onChange={e => setTechFilter(e.target.value)} options={techOptions} />
                </div>
              )}
              <button
                onClick={async () => {
                  try {
                    setExporting(true);
                    const res = await timesheetsApi.exportReport(from, to, techFilter || undefined);
                    downloadBlob(res.data, `timesheets-${from}-to-${to}.csv`);
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
                              <p className="font-semibold text-ink">{name}</p>
                              <p className="text-sm text-muted">
                                {tech.days_worked || 0} days · {tech.total_jobs || 0} jobs
                              </p>
                            </div>
                            <p className="font-bold text-blue text-lg">
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
                  <div className="bg-card rounded-2xl shadow overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-hairline bg-background">
                          <th className="text-left px-4 py-3 text-xs font-semibold text-muted">Tech</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-muted">Date</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-muted">In</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-muted">Out</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-muted">Hours</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tsRows.map((row, i) => {
                          const name = `${row.first_name || ''} ${row.last_name || ''}`.trim() || row.name || row.tech_name || '';
                          return (
                            <tr key={i} className="border-b border-hairline last:border-0">
                              <td className="px-4 py-2.5 text-sm font-medium text-ink">{name}</td>
                              <td className="px-4 py-2.5 text-sm text-ink">{row.date || row.work_date || ''}</td>
                              <td className="px-4 py-2.5 text-sm text-ink">{row.clock_in || row.clocked_in_at || '—'}</td>
                              <td className="px-4 py-2.5 text-sm text-ink">{row.clock_out || row.clocked_out_at || '—'}</td>
                              <td className="px-4 py-2.5 text-sm font-semibold text-blue">
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

      {/* Send Partner Report modal */}
      <Modal
        isOpen={showSendModal}
        onClose={() => !sending && setShowSendModal(false)}
        title="Send Partner Report"
        footer={
          <>
            <Button variant="outlined" disabled={sending} onClick={() => setShowSendModal(false)}>Cancel</Button>
            <Button
              loading={sending}
              onClick={async () => {
                if (!selectedConnection) return;
                setSending(true);
                try {
                  await networkApi.sendConnectionReport(
                    selectedConnection.id || selectedConnection._id,
                    from,
                    to,
                    sendRecipient.trim() || null
                  );
                  showSnack('Report sent', 'success');
                  setShowSendModal(false);
                } catch (err) {
                  showSnack(err?.response?.data?.error || 'Failed to send report', 'error');
                } finally {
                  setSending(false);
                }
              }}
            >
              Send
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <p className="text-xs text-muted uppercase font-medium mb-1">Period</p>
            <p className="text-sm text-ink">
              {selectedConnection?.company_name || selectedConnection?.partner_name} · {from} to {to}
            </p>
          </div>
          <div className="text-xs text-muted bg-background rounded-lg p-3">
            A PDF copy is always sent to your office email. Add a partner address below if you also want them to receive it.
          </div>
          <Input
            label="Also send to (optional)"
            type="email"
            value={sendRecipient}
            onChange={e => setSendRecipient(e.target.value)}
            placeholder="partner@example.com"
          />
        </div>
      </Modal>
    </div>
  );
}
