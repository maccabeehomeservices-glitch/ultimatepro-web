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
      const res = await networkApi.getConnectionReport(conn.id || conn._id, from, to);
      setPartnerReport(res.data);
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
      <h1 className="text-xl font-bold text-gray-900 mb-4">Reports</h1>

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
                  selected ? 'bg-[#1A73E8] text-white' : 'bg-white text-gray-600 border border-gray-200'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
            <input
              type="date"
              value={from}
              onChange={e => { setFrom(e.target.value); setDateRange('custom'); }}
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A73E8] min-h-[44px]"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
            <input
              type="date"
              value={to}
              onChange={e => { setTo(e.target.value); setDateRange('custom'); }}
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A73E8] min-h-[44px]"
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
                  className="px-4 py-2 border border-[#1A73E8] text-[#1A73E8] rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-blue-50 disabled:opacity-50 min-h-[44px]"
                >
                  {exporting ? '⟳ Exporting...' : '📥 Export CSV'}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Card>
                  <p className="text-xs text-gray-400 uppercase">Total Revenue</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(totalRevenue)}</p>
                </Card>
                <Card>
                  <p className="text-xs text-gray-400 uppercase">Payments</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{totalPayments}</p>
                </Card>
                <Card>
                  <p className="text-xs text-gray-400 uppercase">Cash</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(totalCash)}</p>
                </Card>
                <Card>
                  <p className="text-xs text-gray-400 uppercase">Card + Online</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(totalElectronic)}</p>
                </Card>
              </div>
              {revenueRows.length > 0 && (
                <div className="bg-white rounded-2xl shadow overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50">
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">Date</th>
                          <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">Cash</th>
                          <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">Card</th>
                          <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">Check</th>
                          <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">Online</th>
                          <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">Total</th>
                          <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">Payments</th>
                        </tr>
                      </thead>
                      <tbody>
                        {revenueRows.map((row, i) => (
                          <tr key={i} className="border-b border-gray-50 last:border-0">
                            <td className="px-4 py-2.5 text-gray-700 whitespace-nowrap">{row.period ? format(new Date(row.period), 'MMM d, yyyy') : ''}</td>
                            <td className="px-4 py-2.5 text-gray-600 text-right">{formatCurrency(row.cash)}</td>
                            <td className="px-4 py-2.5 text-gray-600 text-right">{formatCurrency(row.card)}</td>
                            <td className="px-4 py-2.5 text-gray-600 text-right">{formatCurrency(row.check)}</td>
                            <td className="px-4 py-2.5 text-gray-600 text-right">{formatCurrency(row.online)}</td>
                            <td className="px-4 py-2.5 font-semibold text-gray-900 text-right">{formatCurrency(row.total)}</td>
                            <td className="px-4 py-2.5 text-gray-600 text-right">{row.payment_count || 0}</td>
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
                  className="px-4 py-2 border border-[#1A73E8] text-[#1A73E8] rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-blue-50 disabled:opacity-50 min-h-[44px]"
                >
                  {exporting ? '⟳ Exporting...' : '📥 Export CSV'}
                </button>
              </div>
              {allSources.map((s, i) => (
                <Card key={i}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{s.source_name || 'Unknown'}</p>
                      <p className="text-xs text-gray-400">{s._category}</p>
                      <p className="text-sm text-gray-500">{s.job_count || 0} jobs</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-[#1A73E8]">{formatCurrency(s.total_revenue || 0)}</p>
                      {s.profit_allocation_pct != null && (
                        <p className="text-xs text-gray-400">Allocation: {s.profit_allocation_pct}%</p>
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
                      <p className="font-bold text-[#1A73E8]">{formatCurrency(partnerReport.summary?.our_total_earnings || 0)}</p>
                    </div>
                  </div>
                  {(partnerReport.jobs || []).length > 0 && (
                    <div className="space-y-1 mb-3">
                      {(partnerReport.jobs || []).map((j, i) => (
                        <div key={j.job_id || j.id || i} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-gray-700 truncate">{j.job_number || `Job ${i + 1}`}</p>
                            {j.customer_name && (
                              <p className="text-xs text-gray-400 truncate">{j.customer_name}</p>
                            )}
                          </div>
                          <p className="text-sm font-medium text-gray-900 ml-3 flex-shrink-0">{formatCurrency(j.our_earnings || 0)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2 pt-2 border-t border-gray-100">
                    <button
                      onClick={() => { setSendRecipient(''); setShowSendModal(true); }}
                      className="flex-1 py-2 bg-[#1A73E8] text-white rounded-xl text-sm font-medium hover:bg-blue-700 min-h-[44px]"
                    >
                      📧 Send Report
                    </button>
                    <button
                      onClick={() => {
                        const partnerName = selectedConnection.company_name || selectedConnection.partner_name || 'partner';
                        const jobs = partnerReport.jobs || [];
                        const summary = partnerReport.summary || {};
                        const headers = ['Job Number', 'Customer', 'Address', 'Date', 'Total', 'Parts', 'CC Fee', 'Net', 'Our Earnings', 'Their Earnings'];
                        const lines = [headers.join(',')];
                        jobs.forEach(j => {
                          const date = j.completed_at ? String(j.completed_at).slice(0, 10) : '';
                          lines.push([
                            csvCell(j.job_number),
                            csvCell(j.customer_name),
                            csvCell(j.address),
                            csvCell(date),
                            csvCell(j.job_total),
                            csvCell(j.parts_amount),
                            csvCell(j.cc_fee_amount),
                            csvCell(j.net_amount),
                            csvCell(j.our_earnings),
                            csvCell(j.their_earnings),
                          ].join(','));
                        });
                        // Summary row
                        lines.push([
                          'TOTAL', '', '', '',
                          csvCell(summary.total_gross),
                          csvCell(summary.total_parts),
                          csvCell(summary.total_cc_fees),
                          csvCell(summary.total_net),
                          csvCell(summary.our_total_earnings),
                          csvCell(summary.their_total_earnings),
                        ].join(','));
                        const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
                        const safeName = partnerName.replace(/[^a-zA-Z0-9]+/g, '-');
                        downloadBlob(blob, `partner-report-${safeName}-${from}-to-${to}.csv`);
                        showSnack('Report downloaded!', 'success');
                      }}
                      className="flex-1 py-2 border border-[#1A73E8] text-[#1A73E8] rounded-xl text-sm font-medium hover:bg-blue-50 min-h-[44px]"
                    >
                      📥 Export CSV
                    </button>
                  </div>
                </Card>
              )}
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
                className="px-4 py-2 border border-[#1A73E8] text-[#1A73E8] rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-blue-50 disabled:opacity-50 min-h-[44px]"
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
            <p className="text-xs text-gray-400 uppercase font-medium mb-1">Period</p>
            <p className="text-sm text-gray-700">
              {selectedConnection?.company_name || selectedConnection?.partner_name} · {from} to {to}
            </p>
          </div>
          <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
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
