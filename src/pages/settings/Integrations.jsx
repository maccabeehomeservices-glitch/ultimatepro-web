import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Link, CheckCircle, XCircle, RefreshCw, Unlink } from 'lucide-react';
import { quickbooksApi } from '../../lib/api';
import { Card, LoadingSpinner } from '../../components/ui';
import { useSnackbar } from '../../components/ui/Snackbar';

function SyncResult({ label, result }) {
  if (!result) return null;
  return (
    <div className="text-xs text-gray-500 mt-1">
      {label}: <span className="text-green-600 font-medium">{result.synced} synced</span>
      {result.errors > 0 && <span className="text-red-500 font-medium ml-1">{result.errors} errors</span>}
      {result.total != null && <span className="ml-1">/ {result.total} total</span>}
    </div>
  );
}

export default function Integrations() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { showSnack } = useSnackbar();

  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResults, setSyncResults] = useState(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [connectLoading, setConnectLoading] = useState(false);

  useEffect(() => {
    const qboParam = searchParams.get('qbo');
    if (qboParam === 'connected') showSnack('QuickBooks connected successfully!', 'success');
    if (qboParam === 'error') showSnack(searchParams.get('msg') || 'QuickBooks connection failed', 'error');
    loadStatus();
  }, []);

  async function loadStatus() {
    setLoading(true);
    try {
      const res = await quickbooksApi.getStatus();
      setStatus(res.data);
    } catch {
      setStatus({ connected: false });
    } finally {
      setLoading(false);
    }
  }

  async function handleConnect() {
    setConnectLoading(true);
    try {
      const res = await quickbooksApi.getConnectUrl();
      window.location.href = res.data.url;
    } catch (err) {
      showSnack(err?.response?.data?.error || 'Failed to get connect URL', 'error');
      setConnectLoading(false);
    }
  }

  async function handleSyncAll() {
    setSyncing(true);
    setSyncResults(null);
    try {
      const res = await quickbooksApi.syncAll();
      setSyncResults(res.data);
      showSnack('Sync complete', 'success');
    } catch (err) {
      showSnack(err?.response?.data?.error || 'Sync failed', 'error');
    } finally {
      setSyncing(false);
    }
  }

  async function handleDisconnect() {
    if (!window.confirm('Disconnect QuickBooks Online? Your data will remain but will no longer sync.')) return;
    setDisconnecting(true);
    try {
      await quickbooksApi.disconnect();
      showSnack('QuickBooks disconnected', 'success');
      setStatus({ connected: false });
      setSyncResults(null);
    } catch (err) {
      showSnack(err?.response?.data?.error || 'Failed to disconnect', 'error');
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <div className="p-4 max-w-2xl mx-auto pb-20">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-600"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-gray-900">Integrations</h1>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="space-y-4">
          {/* QuickBooks Online Card */}
          <Card>
            <div className="flex items-start gap-4 mb-4">
              <div className="w-12 h-12 rounded-xl bg-[#2CA01C] flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-lg">QB</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-gray-900">QuickBooks Online</p>
                  {status?.connected ? (
                    <span className="flex items-center gap-1 text-xs text-green-600 font-medium bg-green-50 px-2 py-0.5 rounded-full">
                      <CheckCircle size={12} /> Connected
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-gray-500 font-medium bg-gray-100 px-2 py-0.5 rounded-full">
                      <XCircle size={12} /> Not connected
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-0.5">
                  Sync customers, invoices, and payments to QuickBooks Online
                </p>
                {status?.connected && status?.company_name && (
                  <p className="text-xs text-gray-400 mt-1">
                    Connected to: <span className="font-medium text-gray-600">{status.company_name}</span>
                  </p>
                )}
              </div>
            </div>

            {status?.connected ? (
              <div className="space-y-3">
                {/* Sync All */}
                <button
                  onClick={handleSyncAll}
                  disabled={syncing}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#1A73E8] text-white font-medium min-h-[44px] hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
                  {syncing ? 'Syncing...' : 'Sync All to QuickBooks'}
                </button>

                {syncResults && (
                  <div className="bg-gray-50 rounded-xl p-3 space-y-1">
                    <p className="text-xs font-semibold text-gray-600 mb-2">Last Sync Results</p>
                    <SyncResult label="Customers" result={syncResults.customers} />
                    <SyncResult label="Invoices"  result={syncResults.invoices} />
                    <SyncResult label="Payments"  result={syncResults.payments} />
                  </div>
                )}

                {/* Individual sync buttons */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Customers', fn: quickbooksApi.syncCustomers },
                    { label: 'Invoices',  fn: quickbooksApi.syncInvoices },
                    { label: 'Payments',  fn: quickbooksApi.syncPayments },
                  ].map(({ label, fn }) => (
                    <button
                      key={label}
                      disabled={syncing}
                      onClick={async () => {
                        setSyncing(true);
                        try {
                          const res = await fn();
                          showSnack(`${label} sync: ${res.data.synced} synced`, 'success');
                        } catch (err) {
                          showSnack(err?.response?.data?.error || `${label} sync failed`, 'error');
                        } finally {
                          setSyncing(false);
                        }
                      }}
                      className="py-2 px-3 rounded-xl border border-gray-200 text-sm text-gray-700 font-medium min-h-[44px] hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* Disconnect */}
                <button
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl border border-red-200 text-red-600 font-medium text-sm min-h-[44px] hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  <Unlink size={14} />
                  {disconnecting ? 'Disconnecting...' : 'Disconnect QuickBooks'}
                </button>
              </div>
            ) : (
              <button
                onClick={handleConnect}
                disabled={connectLoading}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#2CA01C] text-white font-medium min-h-[44px] hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                <Link size={16} />
                {connectLoading ? 'Connecting...' : 'Connect QuickBooks Online'}
              </button>
            )}
          </Card>

          {/* Future integrations placeholder */}
          <Card>
            <div className="flex items-center gap-4 opacity-50">
              <div className="w-12 h-12 rounded-xl bg-gray-200 flex items-center justify-center flex-shrink-0">
                <span className="text-gray-500 font-bold text-sm">Str</span>
              </div>
              <div>
                <p className="font-semibold text-gray-900">Stripe</p>
                <p className="text-xs text-gray-500">Coming soon — online payment processing</p>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
