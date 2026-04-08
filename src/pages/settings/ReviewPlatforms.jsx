import { useState } from 'react';
import { ArrowLeft, Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useGet, useMutation } from '../../hooks/useApi';
import { Card, LoadingSpinner, EmptyState, Button, Toggle } from '../../components/ui';
import { useSnackbar } from '../../components/ui/Snackbar';

export default function ReviewPlatforms() {
  const navigate = useNavigate();
  const { showSnack } = useSnackbar();
  const { data, loading, refetch } = useGet('/settings/review-platforms');
  const { mutate } = useMutation();
  const [saving, setSaving] = useState({});

  const platforms = data?.platforms || data || [];

  async function handleToggle(platform, enabled) {
    const id = platform.id || platform._id;
    setSaving(p => ({ ...p, [id]: true }));
    try {
      await mutate('put', `/settings/review-platforms/${id}`, { enabled });
      refetch();
    } catch {
      showSnack('Failed to update', 'error');
    } finally {
      setSaving(p => ({ ...p, [id]: false }));
    }
  }

  async function handleSetDefault(platform) {
    const id = platform.id || platform._id;
    try {
      await mutate('put', `/settings/review-platforms/${id}`, { is_default: true });
      showSnack('Default platform set', 'success');
      refetch();
    } catch {
      showSnack('Failed to update', 'error');
    }
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate('/settings')} className="p-2 rounded-xl hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-600">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-gray-900 flex-1">Review Platforms</h1>
      </div>

      {loading ? <LoadingSpinner /> : platforms.length === 0 ? (
        <EmptyState icon={Star} title="No platforms" description="Review platforms will appear here." />
      ) : (
        <div className="space-y-2">
          {platforms.map(p => (
            <Card key={p.id || p._id}>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900">{p.name}</p>
                    {p.is_default && (
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Default</span>
                    )}
                  </div>
                  {p.url && <p className="text-xs text-gray-400 truncate mt-0.5">{p.url}</p>}
                </div>
                {!p.is_default && (
                  <button
                    onClick={() => handleSetDefault(p)}
                    className="text-xs text-[#1A73E8] font-medium px-2 py-1 rounded-lg hover:bg-blue-50 min-h-[36px]"
                  >
                    Set Default
                  </button>
                )}
                <Toggle
                  checked={p.enabled !== false}
                  onChange={(e) => handleToggle(p, e.target.checked)}
                />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
