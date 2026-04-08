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

export default function OnlineBooking() {
  const navigate = useNavigate();
  const { showSnack } = useSnackbar();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    enabled: false,
    business_name: '',
    tagline: '',
    appointment_reminders: { enabled: false, hours_before: 24, method: 'both' },
    followup_reminders: { enabled: false, days_after: 1, repeat_every: 3, max_reminders: 3, method: 'email' },
    service_areas: [],
  });
  const [newZip, setNewZip] = useState('');
  const [newRadius, setNewRadius] = useState(25);

  useEffect(() => {
    api.get('/settings/booking')
      .then(res => {
        const d = res.data?.settings || res.data || {};
        setSettings(prev => ({ ...prev, ...d }));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function set(path, value) {
    const keys = path.split('.');
    setSettings(prev => {
      const next = { ...prev };
      let obj = next;
      for (let i = 0; i < keys.length - 1; i++) {
        obj[keys[i]] = { ...obj[keys[i]] };
        obj = obj[keys[i]];
      }
      obj[keys[keys.length - 1]] = value;
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api.put('/settings/booking', settings);
      showSnack('Settings saved', 'success');
    } catch {
      showSnack('Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  }

  function addArea() {
    if (!newZip.trim()) return;
    set('service_areas', [...(settings.service_areas || []), { zip: newZip, radius: newRadius }]);
    setNewZip('');
    setNewRadius(25);
  }

  function removeArea(i) {
    set('service_areas', settings.service_areas.filter((_, idx) => idx !== i));
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
            <Input label="Business Name" value={settings.business_name} onChange={e => set('business_name', e.target.value)} placeholder="Your Company Name" />
            <Input label="Tagline" value={settings.tagline} onChange={e => set('tagline', e.target.value)} placeholder="Professional service you can trust" />
          </div>
        </Card>

        {/* Appointment Reminders */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <span className="font-semibold text-gray-900">Appointment Reminders</span>
            <Toggle checked={settings.appointment_reminders?.enabled} onChange={e => set('appointment_reminders.enabled', e.target.checked)} />
          </div>
          {settings.appointment_reminders?.enabled && (
            <div className="space-y-3">
              <Input label="Hours Before Appointment" type="number" value={settings.appointment_reminders.hours_before} onChange={e => set('appointment_reminders.hours_before', Number(e.target.value))} placeholder="24" />
              <Select label="Method" value={settings.appointment_reminders.method} onChange={e => set('appointment_reminders.method', e.target.value)} options={METHOD_OPTIONS} />
            </div>
          )}
        </Card>

        {/* Follow-up Reminders */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <span className="font-semibold text-gray-900">Follow-up Reminders</span>
            <Toggle checked={settings.followup_reminders?.enabled} onChange={e => set('followup_reminders.enabled', e.target.checked)} />
          </div>
          {settings.followup_reminders?.enabled && (
            <div className="space-y-3">
              <Input label="Days After Service" type="number" value={settings.followup_reminders.days_after} onChange={e => set('followup_reminders.days_after', Number(e.target.value))} placeholder="1" />
              <Input label="Repeat Every (days)" type="number" value={settings.followup_reminders.repeat_every} onChange={e => set('followup_reminders.repeat_every', Number(e.target.value))} placeholder="3" />
              <Input label="Max Reminders" type="number" value={settings.followup_reminders.max_reminders} onChange={e => set('followup_reminders.max_reminders', Number(e.target.value))} placeholder="3" />
              <Select label="Method" value={settings.followup_reminders.method} onChange={e => set('followup_reminders.method', e.target.value)} options={METHOD_OPTIONS} />
            </div>
          )}
        </Card>

        {/* Service Areas */}
        <Card>
          <p className="font-semibold text-gray-900 mb-3">Service Areas</p>
          {(settings.service_areas || []).map((area, i) => (
            <div key={i} className="flex items-center gap-3 mb-2">
              <p className="flex-1 text-sm text-gray-700">{area.zip} — {area.radius} mi radius</p>
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
