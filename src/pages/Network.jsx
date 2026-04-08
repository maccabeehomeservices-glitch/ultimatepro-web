import { useState } from 'react';
import { Copy, Check, Handshake, Search } from 'lucide-react';
import { useGet, useMutation } from '../hooks/useApi';
import { Card, LoadingSpinner, EmptyState, Badge, Button, Input } from '../components/ui';
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
  const [searchTab, setSearchTab] = useState('phone');
  const [searchInput, setSearchInput] = useState('');
  const [searchResults, setSearchResults] = useState(null);

  const { data: myIdData } = useGet('/network/my-id');
  const { data: connectionsData, loading, refetch: refetchConnections } = useGet('/network/connections');
  const { mutate, loading: searching } = useMutation();

  const ucmId = myIdData?.ucm_id || myIdData?.id || '';
  const connections = connectionsData?.connections || connectionsData || [];

  function handleCopy() {
    navigator.clipboard.writeText(ucmId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
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

  const activeTabConfig = SEARCH_TABS.find(t => t.id === searchTab);

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

        {/* 3 Search Tabs */}
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
            {connections.map((conn) => (
              <Card key={conn.id || conn._id}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">{conn.company_name || conn.partner_name || conn.name}</p>
                    <p className="text-xs text-gray-400">{conn.ucm_id || conn.ultimatecrm_id || ''}</p>
                    {conn.latest_agreement_status && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        Agreement: {conn.latest_agreement_status}
                        {conn.latest_sender_keeps_pct != null && ` · ${conn.latest_sender_keeps_pct}% / ${conn.latest_receiver_keeps_pct}%`}
                      </p>
                    )}
                  </div>
                  <Badge status={conn.status} label={conn.status || 'active'} />
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
