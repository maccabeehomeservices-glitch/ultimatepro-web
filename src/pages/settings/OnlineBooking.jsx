import { useState, useEffect } from 'react';
import { Trash2, Copy, Share2, X } from 'lucide-react';
import { UpBack, UpPlus } from '../../components/ui/icons';
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

const ALL_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DEFAULT_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
const DEFAULT_WINDOWS = [
  { id: 'morning', label: 'Morning', time: '8:00 AM - 12:00 PM', enabled: true },
  { id: 'afternoon', label: 'Afternoon', time: '12:00 PM - 5:00 PM', enabled: true },
  { id: 'evening', label: 'Evening', time: '5:00 PM - 8:00 PM', enabled: false },
];

// The public booking page is served by the BACKEND (book.js GET /book), not the web
// SPA — mirror Android exactly so the link actually works.
// P2.10: use VITE_API_URL (was a hardcoded prod URL that ignored the env).
const BOOKING_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3000') + '/book';

export default function OnlineBooking() {
  const navigate = useNavigate();
  const { showSnack } = useSnackbar();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ucmId, setUcmId] = useState('');
  // State mirrors the backend booking_settings FLAT schema (same keys as Android),
  // so save/load round-trip with no translation. Every backend field is represented
  // here, so an Android-saved config displays in full on web.
  const [settings, setSettings] = useState({
    enabled: false,
    company_display_name: '',
    company_tagline: '',
    working_days: DEFAULT_DAYS,
    time_windows: DEFAULT_WINDOWS,
    max_bookings_per_window: 3,
    service_areas: [],
    services: [],
    confirmation_message: 'Thank you! We will confirm your appointment shortly.',
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
  const [newLabel, setNewLabel] = useState('');
  const [newService, setNewService] = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/settings/booking').catch(() => null),
      api.get('/network/my-id').catch(() => null),
    ]).then(([bookingRes, idRes]) => {
      const d = bookingRes?.data?.settings || bookingRes?.data || {};
      // Merge only non-null backend values so a never-configured company keeps the
      // form defaults; existing saved settings (flat keys) display correctly.
      const clean = Object.fromEntries(Object.entries(d).filter(([, v]) => v !== null));
      setSettings(prev => {
        const merged = { ...prev, ...clean };
        // Empty arrays from the backend shouldn't blank the day/window controls.
        if (!Array.isArray(merged.working_days) || merged.working_days.length === 0) merged.working_days = DEFAULT_DAYS;
        if (!Array.isArray(merged.time_windows) || merged.time_windows.length === 0) merged.time_windows = DEFAULT_WINDOWS;
        return merged;
      });
      const id = idRes?.data?.ultimatecrm_id || idRes?.data?.ucm_id || idRes?.data?.id || '';
      setUcmId(id);
    }).finally(() => setLoading(false));
  }, []);

  function set(key, value) {
    setSettings(prev => ({ ...prev, [key]: value }));
  }

  const bookingUrl = ucmId ? `${BOOKING_BASE}?company=${ucmId}` : '';

  async function copyLink() {
    try { await navigator.clipboard.writeText(bookingUrl); showSnack('Link copied', 'success'); }
    catch { showSnack('Could not copy', 'error'); }
  }
  async function shareLink() {
    if (navigator.share) {
      try { await navigator.share({ title: 'Book an appointment', text: 'Book an appointment online:', url: bookingUrl }); }
      catch { /* user cancelled */ }
    } else {
      copyLink();
    }
  }

  function toggleDay(day) {
    const on = (settings.working_days || []).includes(day);
    set('working_days', on ? settings.working_days.filter(d => d !== day) : [...(settings.working_days || []), day]);
  }
  function toggleWindow(i, on) {
    set('time_windows', (settings.time_windows || []).map((w, idx) => idx === i ? { ...w, enabled: on } : w));
  }
  function stepMax(delta) {
    set('max_bookings_per_window', Math.min(10, Math.max(1, (settings.max_bookings_per_window || 1) + delta)));
  }

  function addService() {
    const s = newService.trim();
    if (!s) return;
    set('services', [...(settings.services || []), s]);
    setNewService('');
  }
  function removeService(i) {
    set('services', (settings.services || []).filter((_, idx) => idx !== i));
  }

  function addArea() {
    const zip = newZip.trim();
    if (!ZIP_RE.test(zip)) { showSnack('Enter a valid 5-digit ZIP code', 'error'); return; }
    // Backend schema: { zip_code, radius_miles:Number, label } (mirrors Android).
    set('service_areas', [...(settings.service_areas || []), { zip_code: zip, radius_miles: Number(newRadius), label: newLabel.trim() || null }]);
    setNewZip(''); setNewRadius(25); setNewLabel('');
  }
  function removeArea(i) {
    set('service_areas', (settings.service_areas || []).filter((_, idx) => idx !== i));
  }

  async function handleSave() {
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

  if (loading) return <LoadingSpinner fullPage />;

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate('/settings')} className="p-2 rounded-xl hover:bg-background min-h-[44px] min-w-[44px] flex items-center justify-center text-ink">
          <UpBack size={20} />
        </button>
        <h1 className="text-xl font-bold text-ink flex-1">Online Booking</h1>
      </div>

      <div className="space-y-4">
        {/* Master toggle */}
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <span className="font-semibold text-ink">Enable Online Booking</span>
              <p className="text-xs text-muted mt-0.5">Customers can request appointments online</p>
            </div>
            <Toggle checked={settings.enabled} onChange={e => set('enabled', e.target.checked)} />
          </div>
        </Card>

        {/* Booking link card */}
        {settings.enabled && ucmId && (
          <Card>
            <p className="text-xs font-semibold text-blue uppercase tracking-wider mb-2">Your Booking Link</p>
            <div className="bg-background rounded-xl p-3 text-xs text-ink break-all mb-3 font-mono">{bookingUrl}</div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={copyLink} className="flex-1">
                <Copy size={16} /> Copy
              </Button>
              <Button onClick={shareLink} className="flex-1">
                <Share2 size={16} /> Share
              </Button>
            </div>
          </Card>
        )}

        {settings.enabled && (
          <>
            {/* Appearance */}
            <Card>
              <p className="font-semibold text-ink mb-3">Appearance</p>
              <div className="space-y-3">
                <Input label="Display Name" value={settings.company_display_name || ''} onChange={e => set('company_display_name', e.target.value)} placeholder="Shown on your booking page" />
                <Input label="Tagline (optional)" value={settings.company_tagline || ''} onChange={e => set('company_tagline', e.target.value)} placeholder="e.g. Fast, reliable service" />
              </div>
            </Card>

            {/* Availability */}
            <Card>
              <p className="font-semibold text-ink mb-3">Availability</p>
              <p className="text-sm font-medium text-ink mb-2">Working Days</p>
              <div className="flex flex-wrap gap-2 mb-4">
                {ALL_DAYS.map(day => {
                  const on = (settings.working_days || []).includes(day);
                  return (
                    <button key={day} onClick={() => toggleDay(day)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border min-h-[36px] capitalize transition-colors ${on ? 'bg-blue text-white border-blue' : 'bg-card text-ink border-hairline'}`}>
                      {day.slice(0, 3)}
                    </button>
                  );
                })}
              </div>
              <p className="text-sm font-medium text-ink mb-2">Time Windows</p>
              <div className="space-y-1 mb-4">
                {(settings.time_windows || []).map((w, i) => (
                  <div key={w.id || i} className="flex items-center justify-between py-1.5">
                    <div>
                      <p className="text-sm font-medium text-ink">{w.label}</p>
                      <p className="text-xs text-muted">{w.time}</p>
                    </div>
                    <Toggle checked={!!w.enabled} onChange={e => toggleWindow(i, e.target.checked)} />
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between border-t border-hairline pt-3">
                <span className="text-sm text-ink">Max bookings per window</span>
                <div className="flex items-center gap-3">
                  <button onClick={() => stepMax(-1)} className="w-9 h-9 rounded-lg border border-hairline text-ink flex items-center justify-center">−</button>
                  <span className="font-bold text-ink w-6 text-center">{settings.max_bookings_per_window}</span>
                  <button onClick={() => stepMax(1)} className="w-9 h-9 rounded-lg border border-hairline text-ink flex items-center justify-center">+</button>
                </div>
              </div>
            </Card>

            {/* Service Areas */}
            <Card>
              <p className="font-semibold text-ink mb-3">Service Area</p>
              {(settings.service_areas || []).length === 0 && (
                <p className="text-sm text-muted mb-2">No service areas added — all locations accepted.</p>
              )}
              {(settings.service_areas || []).map((area, i) => (
                <div key={i} className="flex items-center gap-3 mb-2">
                  <p className="flex-1 text-sm text-ink">
                    ZIP: {area.zip_code} &nbsp;|&nbsp; {area.radius_miles} mi{area.label ? ` | ${area.label}` : ''}
                  </p>
                  <button onClick={() => removeArea(i)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg min-h-[36px] min-w-[36px] flex items-center justify-center">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <div className="flex gap-2 mt-3">
                <Input value={newZip} onChange={e => setNewZip(e.target.value)} placeholder="ZIP code" />
                <div className="flex-1">
                  <label className="block text-xs text-muted mb-1">Radius: {newRadius} mi</label>
                  <input type="range" min={1} max={100} value={newRadius} onChange={e => setNewRadius(Number(e.target.value))} className="w-full" />
                </div>
                <button onClick={addArea} className="p-2 rounded-xl bg-[#A9812E] text-pearl hover:bg-[#8A6A3B] min-h-[44px] min-w-[44px] flex items-center justify-center">
                  <UpPlus size={18} />
                </button>
              </div>
              <Input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="Label (optional, e.g. Virginia Beach)" className="mt-2" />
            </Card>

            {/* Services Offered */}
            <Card>
              <p className="font-semibold text-ink mb-3">Services Offered</p>
              {(settings.services || []).length === 0 && (
                <p className="text-sm text-muted mb-2">No services added yet.</p>
              )}
              {(settings.services || []).map((svc, i) => (
                <div key={i} className="flex items-center gap-2 py-1">
                  <p className="flex-1 text-sm text-ink">{svc}</p>
                  <button onClick={() => removeService(i)} className="p-1.5 text-muted hover:bg-background rounded-lg min-h-[36px] min-w-[36px] flex items-center justify-center">
                    <X size={14} />
                  </button>
                </div>
              ))}
              <div className="flex gap-2 mt-3">
                <Input value={newService} onChange={e => setNewService(e.target.value)} placeholder="Add a service type" />
                <button onClick={addService} className="p-2 rounded-xl bg-[#A9812E] text-pearl hover:bg-[#8A6A3B] min-h-[44px] min-w-[44px] flex items-center justify-center">
                  <UpPlus size={18} />
                </button>
              </div>
            </Card>

            {/* Confirmation */}
            <Card>
              <p className="font-semibold text-ink mb-3">Confirmation Message</p>
              <textarea
                value={settings.confirmation_message || ''}
                onChange={e => set('confirmation_message', e.target.value)}
                rows={3}
                placeholder="Shown to customers after they book."
                className="w-full px-3 py-2.5 rounded-xl border border-hairline bg-card focus:outline-none focus:ring-2 focus:ring-blue text-sm"
              />
            </Card>
          </>
        )}

        {/* Appointment Reminders */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <span className="font-semibold text-ink">Appointment Reminders</span>
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
            <span className="font-semibold text-ink">Follow-up Reminders</span>
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

        <Button onClick={handleSave} loading={saving} className="w-full">Save Settings</Button>
      </div>
    </div>
  );
}
