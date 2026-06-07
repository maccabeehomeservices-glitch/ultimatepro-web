import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { Card, LoadingSpinner, Button, Input, Toggle, Select } from '../../components/ui';
import { useSnackbar } from '../../components/ui/Snackbar';

const METHOD_OPTIONS = [
  { value: 'email', label: 'Email' },
  { value: 'sms', label: 'SMS' },
  { value: 'both', label: 'Both' },
];

const ZIP_RE = /^\d{5}$/;

export default function OnlineBooking() {
  const navigate = useNavigate();
  const { showSnack } = useSnackbar();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // State mirrors the backend booking_settings FLAT schema (same keys as Android),
  // so save/load round-trip with no nested translation. Fields the UI doesn't have
  // controls for (working_days, time_windows, services, primary_color, etc.) are
  // loaded into state and passed back unchanged on save — never nulled.
  const [settings, setSettings] = useState({
    enabled: false,
    company_display_name: '',
    company_tagline: '',
    service_areas: [],
    reminder_enabled: false,
    reminder_hours_before: 24,
    reminder_method: 'both',
    followup_enabled: false,
    followup_days_after: 1,
    followup_repeat_every: 3,
    followup_max_reminders: 3,
    followup_method: 'email',
  });
  const [newZip, setNewZip] = useState('');
  const [newRadius, setNewRadius] = useState(25);

  useEffect(() => {
    api.get('/settings/booking')
      .then(res => {
        const d = res.data?.settings || res.data || {};
        // Merge only non-null backend values so a never-configured company keeps the
        // form defaults; existing saved settings (flat keys) display correctly.
        const clean = Object.fromEntries(Object.entries(d).filter(([, v]) => v !== null));
        setSettings(prev => ({ ...prev, ...clean }));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function set(key, value) {
    setSettings(prev => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    // Guard service_areas client-side so a bad zip is caught with a clear message
    // instead of a raw backend 400 (the backend validates the same rules).
    for (const sa of settings.service_areas || []) {
      if (!ZIP_RE.test(String(sa.zip_code || ''))) {
        showSnack(`Invalid ZIP code: ${sa.zip_code || '(empty)'} — must be 5 digits`, 'error');
        return;
      }
      if (typeof sa.radius_miles !== 'number' || sa.radius_miles < 1 || sa.radius_miles > 100) {
        showSnack(`Radius for ${sa.zip_code} must be between 1 and 100 miles`, 'error');
        return;
      }
    }
    setSaving(true);
    try {
      await api.put('/settings/booking', settings);
      showSnack('Settings saved', 'success');
    } catch (err) {
      showSnack(err.response?.data?.error || 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  }

  function addArea() {
    const zip = newZip.trim();
    if (!ZIP_RE.test(zip)) {
      showSnack('Enter a valid 5-digit ZIP code', 'error');
      return;
    }
    // Backend schema: { zip_code, radius_miles:Number, label } (mirrors Android).
    set('service_areas', [...(settings.service_areas || []), { zip_code: zip, radius_miles: Number(newRadius), label: null }]);
    setNewZip('');
    setNewRadius(25);
  }

  function removeArea(i) {
    set('service_areas', (settings.service_areas || []).filter((_, idx) => idx !== i));
  }

  if (loading) return <LoadingSpinner fullPage />;

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate('/settings')} className="p-2 rounded-xl hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-600">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-gray-900 flex-1">Online Booking</h1>
      </div>

      <div className="space-y-4">
        {/* General */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <span className="font-semibold text-gray-900">Enable Online Booking</span>
            <Toggle checked={settings.enabled} onChange={e => set('enabled', e.target.checked)} />
          </div>
          <div className="space-y-3">
            <Input label="Business Name" value={settings.company_display_name || ''} onChange={e => set('company_display_name', e.target.value)} placeholder="Your Company Name" />
            <Input label="Tagline" value={settings.company_tagline || ''} onChange={e => set('company_tagline', e.target.value)} placeholder="Professional service you can trust" />
          </div>
        </Card>

        {/* Appointment Reminders */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <span className="font-semibold text-gray-900">Appointment Reminders</span>
            <Toggle checked={settings.reminder_enabled} onChange={e => set('reminder_enabled', e.target.checked)} />
          </div>
          {settings.reminder_enabled && (
            <div className="space-y-3">
              <Input label="Hours Before Appointment" type="number" value={settings.reminder_hours_before ?? 24} onChange={e => set('reminder_hours_before', Number(e.target.value))} placeholder="24" />
              <Select label="Method" value={settings.reminder_method || 'both'} onChange={e => set('reminder_method', e.target.value)} options={METHOD_OPTIONS} />
            </div>
          )}
        </Card>

        {/* Follow-up Reminders */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <span className="font-semibold text-gray-900">Follow-up Reminders</span>
            <Toggle checked={settings.followup_enabled} onChange={e => set('followup_enabled', e.target.checked)} />
          </div>
          {settings.followup_enabled && (
            <div className="space-y-3">
              <Input label="Days After Service" type="number" value={settings.followup_days_after ?? 1} onChange={e => set('followup_days_after', Number(e.target.value))} placeholder="1" />
              <Input label="Repeat Every (days)" type="number" value={settings.followup_repeat_every ?? 3} onChange={e => set('followup_repeat_every', Number(e.target.value))} placeholder="3" />
              <Input label="Max Reminders" type="number" value={settings.followup_max_reminders ?? 3} onChange={e => set('followup_max_reminders', Number(e.target.value))} placeholder="3" />
              <Select label="Method" value={settings.followup_method || 'email'} onChange={e => set('followup_method', e.target.value)} options={METHOD_OPTIONS} />
            </div>
          )}
        </Card>

        {/* Service Areas */}
        <Card>
          <p className="font-semibold text-gray-900 mb-3">Service Areas</p>
          {(settings.service_areas || []).map((area, i) => (
            <div key={i} className="flex items-center gap-3 mb-2">
              <p className="flex-1 text-sm text-gray-700">{area.zip_code} — {area.radius_miles} mi radius</p>
              <button onClick={() => removeArea(i)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg min-h-[36px] min-w-[36px] flex items-center justify-center">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <div className="flex gap-2 mt-3">
            <Input value={newZip} onChange={e => setNewZip(e.target.value)} placeholder="ZIP code" />
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">Radius: {newRadius} mi</label>
              <input type="range" min={1} max={100} value={newRadius} onChange={e => setNewRadius(Number(e.target.value))} className="w-full" />
            </div>
            <button onClick={addArea} className="p-2 rounded-xl bg-[#1A73E8] text-white min-h-[44px] min-w-[44px] flex items-center justify-center">
              <Plus size={18} />
            </button>
          </div>
        </Card>

        <Button onClick={handleSave} loading={saving} className="w-full">Save Settings</Button>
      </div>
    </div>
  );
}
