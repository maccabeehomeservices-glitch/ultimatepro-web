import { useState } from 'react';
import { Copy, Check, Handshake, Search } from 'lucide-react';
import { useGet, useMutation } from '../hooks/useApi';
import { Card, LoadingSpinner, EmptyState, Badge, Button, Input, Select } from '../components/ui';
import { useSnackbar } from '../components/ui/Snackbar';

const SEARCH_TYPE_OPTIONS = [
  { value: 'phone', label: 'Phone Number' },
  { value: 'email', label: 'Email Address' },
  { value: 'ucm_id', label: 'UCM ID' },
];

export default function Network() {
  const { showSnack } = useSnackbar();
  const [copied, setCopied] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [searchType, setSearchType] = useState('phone');
  const [searchResults, setSearchResults] = useState(null);

  const { data: myIdData } = useGet('/network/my-id');
  const { data: connectionsData, loading } = useGet('/network/connections');
  const { mutate, loading: searching } = useMutation();

  const ucmId = myIdData?.ucm_id || myIdData?.id || '';
  const connections = connectionsData?.connections || connectionsData || [];

  function handleCopy() {
    navigator.clipboard.writeText(ucmId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function handleSearch() {
    if (!searchInput.trim()) return;
    try {
      const res = await mutate('post', '/network/search', { query: searchInput, type: searchType });
      setSearchResults(res?.results || res || []);
    } catch {
      showSnack('Search failed', 'error');
    }
  }

  async function handleConnect(partnerId) {
    try {
      await mutate('post', '/network/connect', { partner_id: partnerId });
      showSnack('Connection request sent', 'success');
    } catch {
      showSnack('Failed to send request', 'error');
    }
  }

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
        <div className="space-y-3">
          <Select
            label="Search by"
            value={searchType}
            onChange={(e) => setSearchType(e.target.value)}
            options={SEARCH_TYPE_OPTIONS}
          />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={searchType === 'phone' ? '+1 (555) 000-0000' : searchType === 'email' ? 'partner@company.com' : 'UCM ID...'}
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
                    <Button size="sm" onClick={() => handleConnect(r.id || r._id)}>Connect</Button>
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
                    <p className="text-xs text-gray-400">{conn.ucm_id || ''}</p>
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
