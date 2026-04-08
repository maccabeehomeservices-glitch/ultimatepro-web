import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useGet, useMutation } from '../../hooks/useApi';
import { Card, LoadingSpinner } from '../../components/ui';
import { Toggle } from '../../components/ui';
import { useSnackbar } from '../../components/ui/Snackbar';

const PREF_KEYS = [
  { key: 'new_jobs', label: 'New Jobs', description: 'Notify when a new job is created' },
  { key: 'job_status_updates', label: 'Job Status Updates', description: 'Notify when a job status changes' },
  { key: 'partner_jobs', label: 'Partner Jobs', description: 'Notify when a partner sends a job' },
  { key: 'new_bookings', label: 'New Bookings', description: 'Notify when an online booking is received' },
  { key: 'estimate_signed', label: 'Estimate Signed', description: 'Notify when a customer signs an estimate' },
];

export default function Notifications() {
  const navigate = useNavigate();
  const { showSnack } = useSnackbar();
  const { data, loading } = useGet('/settings/notifications');
  const { mutate, loading: saving } = useMutation();

  const [prefs, setPrefs] = useState({
    new_jobs: true,
    job_status_updates: true,
    partner_jobs: true,
    new_bookings: true,
    estimate_signed: true,
  });

  useEffect(() => {
    if (data?.preferences) {
      setPrefs(prev => ({ ...prev, ...data.preferences }));
    }
  }, [data]);

  async function handleToggle(key, value) {
    const updated = { ...prefs, [key]: value };
    setPrefs(updated);
    try {
      await mutate('put', '/settings/notifications', { preferences: updated });
      showSnack('Saved', 'success');
    } catch {
      showSnack('Failed to save', 'error');
      setPrefs(prev => ({ ...prev, [key]: !value }));
    }
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => navigate('/settings')}
          className="p-2 text-gray-500 hover:text-gray-900 min-h-[44px] min-w-[44px] flex items-center justify-center"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-gray-900">Notifications</h1>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <Card>
          <div className="divide-y divide-gray-100">
            {PREF_KEYS.map(({ key, label, description }) => (
              <div key={key} className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
                <div className="flex-1 min-w-0 pr-4">
                  <p className="font-medium text-gray-900">{label}</p>
                  <p className="text-sm text-gray-500">{description}</p>
                </div>
                <Toggle
                  checked={Boolean(prefs[key])}
                  onChange={e => handleToggle(key, e.target.checked)}
                  disabled={saving}
                />
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
