import { useState } from 'react';
import { Copy, Check, Handshake, Search } from 'lucide-react';
import { useGet, useMutation } from '../hooks/useApi';
import { Card, LoadingSpinner, EmptyState, Badge, Button, Input, Modal } from '../components/ui';
import { useSnackbar } from '../components/ui/Snackbar';
import { networkApi } from '../lib/api';

const SEARCH_TABS = [
  { id: 'phone', label: '📱 By Phone', type: 'tel', placeholder: '+1 (555) 000-0000' },
  { id: 'email', label: '✉️ By Email', type: 'email', placeholder: 'partner@company.com' },
  { id: 'ucm_id', label: '🔑 By UCM ID', type: 'text', placeholder: 'UCM ID...' },
];

export default function Network() {
  const { showSnack } = useSnackbar();
  const [copied, setCopied] = useState(false);
  const [ucmCopied, setUcmCopied] = useState(false);
  const [searchTab, setSearchTab] = useState('phone');
  const [searchInput, setSearchInput] = useState('');
  const [searchResults, setSearchResults] = useState(null);

  // Detail modal
  const [detailConn, setDetailConn] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [agreements, setAgreements] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailView, setDetailView] = useState('main'); // 'main' | 'propose' | 'report' | 'pause'

  // Propose form
  const [proposeSenderPct, setProposeSenderPct] = useState(70);
  const [proposeReviewTo, setProposeReviewTo] = useState('sender');
  const [proposeNotes, setProposeNotes] = useState('');
  const [proposing, setProposing] = useState(false);

  // Pause
  const [pausing, setPausing] = useState(false);

  // Report
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  const [reportFrom, setReportFrom] = useState(monthStart);
  const [reportTo, setReportTo] = useState(today);
  const [reportData, setReportData] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);

  // Agreement respond
  const [responding, setResponding] = useState(false);

  const { data: myIdData } = useGet('/network/my-id');
  const { data: connectionsData, loading, refetch: refetchConnections } = useGet('/network/connections');
  const { loading: searching } = useMutation();

  const ucmId = myIdData?.ultimatecrm_id || myIdData?.ucm_id || myIdData?.id || '';
  const connections = connectionsData?.connections || connectionsData || [];

  function handleCopy() {
    navigator.clipboard.writeText(ucmId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function copyPartnerUcm(id) {
    navigator.clipboard.writeText(id).then(() => {
      setUcmCopied(true);
      setTimeout(() => setUcmCopied(false), 2000);
    });
  }

  function handleTabChange(tab) {
    setSearchTab(tab);
    setSearchInput('');
    setSearchResults(null);
  }

  async function handleSearch() {
    if (!searchInput.trim()) return;
    try {
      const res = await networkApi.search(searchInput, searchTab);
      setSearchResults(res.data?.results || res.data || []);
    } catch {
      showSnack('Search failed', 'error');
    }
  }

  async function handleConnect(result) {
    try {
      await networkApi.invite(searchInput, searchTab);
      showSnack('Connection request sent!', 'success');
      setSearchResults(null);
      setSearchInput('');
      refetchConnections();
    } catch {
      showSnack('Failed to send request', 'error');
    }
  }

  async function openDetail(conn) {
    setDetailConn(conn);
    setDetailView('main');
    setDetailData(null);
    setAgreements([]);
    setReportData(null);
    setDetailLoading(true);
    try {
      const [connRes, agreeRes] = await Promise.all([
        networkApi.getConnection(conn.id || conn._id),
        networkApi.getAgreements(conn.id || conn._id),
      ]);
      setDetailData(connRes.data?.connection || connRes.data);
      setAgreements(agreeRes.data?.agreements || agreeRes.data || []);
    } catch {
      showSnack('Failed to load connection details', 'error');
    } finally {
      setDetailLoading(false);
    }
  }

  function closeDetail() {
    setDetailConn(null);
    setDetailData(null);
    setAgreements([]);
    setDetailView('main');
    setReportData(null);
    setProposeSenderPct(70);
    setProposeNotes('');
  }

  async function reloadDetail() {
    if (!detailConn) return;
    try {
      const [connRes, agreeRes] = await Promise.all([
        networkApi.getConnection(detailConn.id || detailConn._id),
        networkApi.getAgreements(detailConn.id || detailConn._id),
      ]);
      setDetailData(connRes.data?.connection || connRes.data);
      setAgreements(agreeRes.data?.agreements || agreeRes.data || []);
      refetchConnections();
    } catch {}
  }

  async function handlePropose() {
    const connId = detailConn?.id || detailConn?._id;
    const senderPct = Number(proposeSenderPct);
    const receiverPct = 100 - senderPct;
    setProposing(true);
    try {
      await networkApi.proposeAgreement(connId, senderPct, receiverPct, proposeReviewTo, proposeNotes);
      showSnack('Agreement proposal sent!', 'success');
      setDetailView('main');
      await reloadDetail();
    } catch (err) {
      showSnack(err.response?.data?.error || 'Failed to send proposal', 'error');
    } finally {
      setProposing(false);
    }
  }

  async function handleRespond(agreementId, action) {
    setResponding(true);
    try {
      await networkApi.respondToAgreement(agreementId, action);
      showSnack(action === 'accept' ? 'Agreement accepted!' : 'Agreement declined', 'success');
      await reloadDetail();
    } catch (err) {
      showSnack(err.response?.data?.error || 'Failed', 'error');
    } finally {
      setResponding(false);
    }
  }

  async function handlePause() {
    const connId = detailConn?.id || detailConn?._id;
    setPausing(true);
    try {
      await networkApi.pause(connId);
      showSnack('Partnership paused', 'success');
      setDetailView('main');
      await reloadDetail();
    } catch (err) {
      showSnack(err.response?.data?.error || 'Failed to pause', 'error');
    } finally {
      setPausing(false);
    }
  }

  async function handleRunReport() {
    const connId = detailConn?.id || detailConn?._id;
    setReportLoading(true);
    try {
      const res = await networkApi.getConnectionReport(connId, reportFrom, reportTo);
      setReportData(res.data?.report || res.data);
    } catch (err) {
      showSnack(err.response?.data?.error || 'Failed to load report', 'error');
    } finally {
      setReportLoading(false);
    }
  }

  const activeTabConfig = SEARCH_TABS.find(t => t.id === searchTab);
  const activeAgreement = agreements.find(a => a.status === 'active');
  const pendingAgreement = agreements.find(a => a.status === 'pending');
  const conn = detailData || detailConn;
  const partnerUcmId = conn?.partner_ucm_id || conn?.ucm_id || conn?.ultimatecrm_id || '';

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-4">Network</h1>

      {/* My UCM ID */}
      <Card className="mb-4">
        <p className="text-xs text-gray-400 uppercase font-medium mb-2">Your UCM ID</p>
        <div className="flex items-center gap-3">
          <p className="font-mono font-bold text-lg text-gray-900 flex-1">{ucmId || 'Loading...'}</p>
          <button
            onClick={handleCopy}
            disabled={!ucmId}
            className="flex items-center gap-1.5 text-sm text-[#1A73E8] font-medium min-h-[44px] px-3 rounded-lg hover:bg-blue-50 transition-colors"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-1">Share your UCM ID to receive work from network partners.</p>
      </Card>

      {/* Find Contractor */}
      <Card className="mb-4">
        <p className="text-sm font-semibold text-gray-900 mb-3">Find a Contractor</p>

        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-3">
          {SEARCH_TABS.map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabChange(tab.id)}
              className={`flex-1 py-2 px-1 rounded-lg text-xs font-semibold transition-colors min-h-[36px] ${
                searchTab === tab.id ? 'bg-white text-[#1A73E8] shadow-sm' : 'text-gray-500'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          <input
            type={activeTabConfig?.type}
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder={activeTabConfig?.placeholder}
            className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm min-h-[44px] focus:outline-none focus:ring-2 focus:ring-[#1A73E8]"
          />
          <Button onClick={handleSearch} loading={searching} className="w-full">
            <Search size={16} /> Search
          </Button>
        </div>

        {searchResults !== null && (
          <div className="mt-3">
            {searchResults.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-2">No contractors found.</p>
            ) : (
              <div className="space-y-2">
                {searchResults.map((r) => (
                  <div key={r.id || r._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <div>
                      <p className="font-medium text-gray-900">{r.company_name || r.name}</p>
                      <p className="text-xs text-gray-400">{r.ucm_id}</p>
                    </div>
                    <Button size="sm" onClick={() => handleConnect(r)}>Connect</Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Connections */}
      <div>
        <h2 className="font-semibold text-gray-900 mb-3">My Connections</h2>
        {loading ? (
          <LoadingSpinner />
        ) : connections.length === 0 ? (
          <EmptyState icon={Handshake} title="No connections" description="Connect with other contractors to grow your network." />
        ) : (
          <div className="space-y-2">
            {connections.map((c) => (
              <Card key={c.id || c._id} onClick={() => openDetail(c)}>
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900">{c.company_name || c.partner_name || c.name}</p>
                    <p className="text-xs text-gray-400">{c.ucm_id || c.ultimatecrm_id || ''}</p>
                    {c.latest_agreement_status && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        Agreement: {c.latest_agreement_status}
                        {c.latest_sender_keeps_pct != null && ` · ${c.latest_sender_keeps_pct}% / ${c.latest_receiver_keeps_pct}%`}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge status={c.status} label={c.status || 'active'} />
                    <span className="text-gray-300 text-lg">›</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Connection Detail Modal */}
      <Modal
        isOpen={Boolean(detailConn)}
        onClose={closeDetail}
        title={conn ? (conn.company_name || conn.partner_name || conn.name || 'Connection') : 'Connection Details'}
      >
        {detailLoading ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
          </div>
        ) : detailView === 'main' ? (
          <div className="space-y-4">
            {/* Partner Info */}
            <div>
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-2">Partner Info</p>
              <div className="bg-gray-50 rounded-xl p-3 space-y-2">
                <p className="font-bold text-gray-900 text-lg">{conn?.company_name || conn?.partner_name || conn?.name}</p>
                {partnerUcmId && (
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-gray-500 font-mono flex-1">{partnerUcmId}</p>
                    <button
                      onClick={() => copyPartnerUcm(partnerUcmId)}
                      className="text-xs text-[#1A73E8] font-medium min-h-[36px] px-2 flex items-center gap-1"
                    >
                      {ucmCopied ? <Check size={14} /> : <Copy size={14} />}
                      {ucmCopied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                )}
                {(conn?.city || conn?.state) && (
                  <p className="text-sm text-gray-500">📍 {[conn.city, conn.state].filter(Boolean).join(', ')}</p>
                )}
                <div className="flex items-center gap-2">
                  <Badge status={conn?.status} label={conn?.status || 'active'} />
                </div>
              </div>
            </div>

            {/* Revenue Split */}
            {activeAgreement && (
              <div>
                <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-2">Revenue Split</p>
                <div className="bg-gray-50 rounded-xl p-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">You keep</span>
                    <span className="font-bold text-gray-900">{activeAgreement.sender_keeps_pct ?? activeAgreement.you_keep_pct ?? '—'}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Partner keeps</span>
                    <span className="font-bold text-gray-900">{activeAgreement.receiver_keeps_pct ?? activeAgreement.partner_keeps_pct ?? '—'}%</span>
                  </div>
                  {activeAgreement.review_goes_to && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Reviews go to</span>
                      <span className="font-medium text-gray-900 capitalize">{activeAgreement.review_goes_to}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Active</span>
                  </div>
                </div>
              </div>
            )}

            {/* Pending agreement — respond */}
            {pendingAgreement && (
              <div>
                <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-2">Pending Agreement</p>
                <div className="bg-amber-50 rounded-xl p-3 space-y-2 border border-amber-200">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Sender keeps</span>
                    <span className="font-bold">{pendingAgreement.sender_keeps_pct ?? '—'}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Receiver keeps</span>
                    <span className="font-bold">{pendingAgreement.receiver_keeps_pct ?? '—'}%</span>
                  </div>
                  {pendingAgreement.notes && (
                    <p className="text-xs text-gray-500 italic">{pendingAgreement.notes}</p>
                  )}
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => handleRespond(pendingAgreement.id || pendingAgreement._id, 'accept')}
                      disabled={responding}
                      className="flex-1 py-2 bg-green-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50 min-h-[44px]"
                    >
                      {responding ? '...' : 'Accept'}
                    </button>
                    <button
                      onClick={() => handleRespond(pendingAgreement.id || pendingAgreement._id, 'decline')}
                      disabled={responding}
                      className="flex-1 py-2 bg-red-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50 min-h-[44px]"
                    >
                      {responding ? '...' : 'Decline'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="space-y-2 pt-2">
              {!activeAgreement && !pendingAgreement && (
                <button
                  onClick={() => setDetailView('propose')}
                  className="w-full py-3 bg-[#1A73E8] text-white rounded-xl text-sm font-semibold min-h-[44px]"
                >
                  📋 Propose Agreement
                </button>
              )}
              <button
                onClick={() => { setReportData(null); setDetailView('report'); }}
                className="w-full py-3 border border-gray-300 text-gray-700 rounded-xl text-sm font-semibold min-h-[44px]"
              >
                📊 View Report
              </button>
              {conn?.status !== 'paused' && (
                <button
                  onClick={() => setDetailView('pause')}
                  className="w-full py-3 border border-red-300 text-red-600 rounded-xl text-sm font-semibold min-h-[44px]"
                >
                  ⏸ Pause Partnership
                </button>
              )}
            </div>
          </div>

        ) : detailView === 'propose' ? (
          <div className="space-y-4">
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Propose Agreement</p>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Your percentage (you keep)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={proposeSenderPct}
                onChange={e => setProposeSenderPct(Math.min(100, Math.max(0, Number(e.target.value))))}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-400 mt-1">Partner keeps: {100 - Number(proposeSenderPct)}%</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Reviews go to</label>
              <select
                value={proposeReviewTo}
                onChange={e => setProposeReviewTo(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="sender">Sender (you)</option>
                <option value="receiver">Receiver (partner)</option>
                <option value="both">Both</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Notes (optional)</label>
              <textarea
                value={proposeNotes}
                onChange={e => setProposeNotes(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base min-h-[80px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Any notes for the partner..."
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setDetailView('main')}
                className="flex-1 py-3 border border-gray-300 rounded-xl font-semibold text-gray-700 min-h-[44px]"
              >
                Cancel
              </button>
              <button
                onClick={handlePropose}
                disabled={proposing}
                className="flex-1 py-3 bg-[#1A73E8] text-white rounded-xl font-semibold disabled:opacity-50 min-h-[44px]"
              >
                {proposing ? 'Sending...' : 'Send Proposal'}
              </button>
            </div>
          </div>

        ) : detailView === 'pause' ? (
          <div className="space-y-4">
            <p className="text-gray-600">
              Pause your partnership with <strong>{conn?.company_name || conn?.partner_name || conn?.name}</strong>?
              You can resume it at any time.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDetailView('main')}
                className="flex-1 py-3 border border-gray-300 rounded-xl font-semibold text-gray-700 min-h-[44px]"
              >
                Cancel
              </button>
              <button
                onClick={handlePause}
                disabled={pausing}
                className="flex-1 py-3 bg-red-600 text-white rounded-xl font-semibold disabled:opacity-50 min-h-[44px]"
              >
                {pausing ? 'Pausing...' : 'Pause Partnership'}
              </button>
            </div>
          </div>

        ) : detailView === 'report' ? (
          <div className="space-y-4">
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Connection Report</p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">From</label>
                <input
                  type="date"
                  value={reportFrom}
                  onChange={e => setReportFrom(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm min-h-[44px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">To</label>
                <input
                  type="date"
                  value={reportTo}
                  onChange={e => setReportTo(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm min-h-[44px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <button
              onClick={handleRunReport}
              disabled={reportLoading}
              className="w-full py-3 bg-[#1A73E8] text-white rounded-xl font-semibold disabled:opacity-50 min-h-[44px]"
            >
              {reportLoading ? 'Loading...' : 'Run Report'}
            </button>

            {reportData && (
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Total Jobs</span>
                  <span className="font-bold text-gray-900">{reportData.total_jobs ?? reportData.job_count ?? 0}</span>
                </div>
                {reportData.sender_earnings != null && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">You earn</span>
                    <span className="font-bold text-green-600">
                      ${Number(reportData.sender_earnings).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                {reportData.receiver_earnings != null && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Partner earns</span>
                    <span className="font-bold text-gray-900">
                      ${Number(reportData.receiver_earnings).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                {reportData.total_revenue != null && (
                  <div className="flex justify-between text-sm border-t border-gray-200 pt-2">
                    <span className="text-gray-600 font-semibold">Total Revenue</span>
                    <span className="font-bold text-gray-900">
                      ${Number(reportData.total_revenue).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => setDetailView('main')}
              className="w-full py-3 border border-gray-300 rounded-xl font-semibold text-gray-700 min-h-[44px]"
            >
              Back
            </button>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
