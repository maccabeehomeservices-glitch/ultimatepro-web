import { useState } from 'react';
import { ArrowLeft, Plus, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useGet, useMutation } from '../../hooks/useApi';
import { Card, LoadingSpinner, Button, Input } from '../../components/ui';
import { useSnackbar } from '../../components/ui/Snackbar';

// P3.8: pick the trades the company does → toggle suggested job types + add custom.
// The resulting set drives the new-job form chips (GET /company/job-types).
export default function JobTypes() {
  const navigate = useNavigate();
  const { showSnack } = useSnackbar();
  const { data: tradesData, loading: tradesLoading, refetch: refetchTrades } = useGet('/company/trades');
  const { data: jobTypes, loading: typesLoading, refetch: refetchTypes } = useGet('/company/job-types');
  const { mutate, loading: saving } = useMutation();
  const [custom, setCustom] = useState('');

  const registry = tradesData?.registry || {};
  const selected = tradesData?.selected || [];
  const active = Array.isArray(jobTypes) ? jobTypes : [];
  const activeKeys = new Set(active.map((t) => t.key));

  async function toggleTrade(key) {
    const next = selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key];
    try { await mutate('put', '/company/trades', { trades: next }); refetchTrades(); }
    catch { showSnack('Failed to update trades', 'error'); }
  }

  async function addType(label) {
    if (!String(label || '').trim()) return;
    try { await mutate('post', '/company/job-types', { label: label.trim() }); setCustom(''); refetchTypes(); showSnack(`Added "${label.trim()}"`, 'success'); }
    catch { showSnack('Failed to add job type', 'error'); }
  }

  async function removeType(id) {
    try { await mutate('delete', `/company/job-types/${id}`); refetchTypes(); }
    catch { showSnack('Failed to remove job type', 'error'); }
  }

  if (tradesLoading || typesLoading) return <LoadingSpinner />;

  return (
    <div className="max-w-2xl mx-auto pb-10">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate('/settings')} className="p-2 -ml-2 text-gray-500 hover:text-gray-900"><ArrowLeft size={20} /></button>
        <h1 className="text-xl font-bold text-gray-900">Job Types</h1>
      </div>

      {/* Trades */}
      <Card className="mb-4">
        <p className="text-sm font-semibold text-gray-700 mb-1">Your trades</p>
        <p className="text-xs text-gray-400 mb-3">Pick the trades you do — each suggests common job types below.</p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(registry).map(([key, t]) => (
            <button key={key} type="button" onClick={() => toggleTrade(key)} disabled={saving}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border min-h-[36px] transition-colors ${
                selected.includes(key) ? 'bg-[#1A73E8] text-white border-[#1A73E8]' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
              }`}>{t.label}</button>
          ))}
        </div>
      </Card>

      {/* Suggested types for selected trades */}
      {selected.length > 0 && (
        <Card className="mb-4">
          <p className="text-sm font-semibold text-gray-700 mb-1">Suggested job types</p>
          <p className="text-xs text-gray-400 mb-3">Tap to add. Already-added types are marked.</p>
          {selected.map((tradeKey) => (
            <div key={tradeKey} className="mb-3">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-1.5">{registry[tradeKey]?.label}</p>
              <div className="flex flex-wrap gap-2">
                {(registry[tradeKey]?.jobTypes || []).map((label) => {
                  const added = activeKeys.has(label.trim().toLowerCase());
                  return (
                    <button key={label} type="button" disabled={added || saving} onClick={() => addType(label)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium border min-h-[36px] flex items-center gap-1 ${
                        added ? 'bg-green-50 text-green-700 border-green-200 cursor-default' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}>
                      {!added && <Plus size={14} />}{label}{added && ' ✓'}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* Active set + custom add */}
      <Card>
        <p className="text-sm font-semibold text-gray-700 mb-1">Your job types</p>
        <p className="text-xs text-gray-400 mb-3">These are the chips shown when creating a job.</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {active.map((t) => (
            <span key={t.id} className="px-3 py-1.5 rounded-full text-sm font-medium bg-gray-100 text-gray-800 border border-gray-200 flex items-center gap-1.5 min-h-[36px]">
              {t.label}
              <button type="button" onClick={() => removeType(t.id)} className="text-gray-400 hover:text-red-500" aria-label={`Remove ${t.label}`}><X size={14} /></button>
            </span>
          ))}
          {active.length === 0 && <span className="text-sm text-gray-400">No job types yet — add one below.</span>}
        </div>
        <div className="flex gap-2">
          <Input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Add a custom job type…"
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addType(custom); } }} className="flex-1" />
          <Button onClick={() => addType(custom)} disabled={saving || !custom.trim()}>Add</Button>
        </div>
      </Card>
    </div>
  );
}
