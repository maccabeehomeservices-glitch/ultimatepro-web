import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react';
import { companyApi } from '../../lib/api';
import { Card, LoadingSpinner } from '../../components/ui';
import { useSnackbar } from '../../components/ui/Snackbar';

const TRIGGER_LABELS = {
  'job_completed':      'When a job is completed',
  'estimate_signed':    'When an estimate is signed',
  'invoice_sent':       'When an invoice is sent',
  'invoice_overdue':    'When an invoice becomes overdue',
  'booking_received':   'When a new booking is received',
  'job_status_changed': 'When a job status changes',
  'job_assigned':       'When a job is assigned',
};

const ACTION_LABELS = {
  'create_invoice':    'Automatically create an invoice',
  'notify_office':     'Send notification to office',
  'notify_team':       'Notify all team members',
  'schedule_followup': 'Schedule a follow-up reminder',
  'send_email':        'Send an email',
  'send_sms':          'Send an SMS',
  'auto_dispatch':     'Auto-dispatch to nearest technician',
  'notification':      'Send a notification',
};

function Toggle({ checked, onChange }) {
  return (
    <label className="relative inline-flex items-center cursor-pointer">
      <input type="checkbox" className="sr-only peer" checked={checked} onChange={onChange} />
      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1A73E8]" />
    </label>
  );
}

function RuleCard({ rule, onToggle }) {
  const [expanded, setExpanded] = useState(false);

  const triggerLabel = TRIGGER_LABELS[rule.trigger_event] || rule.trigger_event || '—';
  const actionLabel = ACTION_LABELS[rule.type] || rule.type || '—';

  return (
    <div className="bg-white rounded-2xl shadow overflow-hidden mb-3">
      <div className="px-4 py-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900">{rule.name || actionLabel}</p>
            <p className="text-sm text-gray-500 mt-0.5">{triggerLabel}</p>
            <p className="text-xs text-[#1A73E8] mt-0.5">{actionLabel}</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Toggle
              checked={rule.active || false}
              onChange={() => onToggle(rule)}
            />
            <button
              onClick={() => setExpanded(e => !e)}
              className="p-2 text-gray-400 min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 px-4 py-4 bg-gray-50 space-y-3">
          {rule.delay_minutes > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Delay</span>
              <span className="text-gray-800 font-medium">{rule.delay_minutes} min</span>
            </div>
          )}
          {rule.notify_customer !== undefined && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Notify customer</span>
              <span className="text-gray-800 font-medium">{rule.notify_customer ? 'Yes' : 'No'}</span>
            </div>
          )}
          {rule.notify_tech !== undefined && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Notify technician</span>
              <span className="text-gray-800 font-medium">{rule.notify_tech ? 'Yes' : 'No'}</span>
            </div>
          )}
          {rule.notify_owner !== undefined && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Notify owner</span>
              <span className="text-gray-800 font-medium">{rule.notify_owner ? 'Yes' : 'No'}</span>
            </div>
          )}
          {rule.dispatch_logic && rule.dispatch_logic !== 'manual' && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Dispatch logic</span>
              <span className="text-gray-800 font-medium capitalize">{rule.dispatch_logic}</span>
            </div>
          )}
          {rule.sms_template && (
            <div className="text-sm">
              <p className="text-gray-500 mb-1">SMS template</p>
              <p className="text-gray-800 bg-white rounded-xl px-3 py-2 border border-gray-200 text-xs leading-relaxed">{rule.sms_template}</p>
            </div>
          )}
          {rule.email_template && (
            <div className="text-sm">
              <p className="text-gray-500 mb-1">Email template</p>
              <p className="text-gray-800 bg-white rounded-xl px-3 py-2 border border-gray-200 text-xs leading-relaxed">{rule.email_template}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AutomationRules() {
  const navigate = useNavigate();
  const { showSnack } = useSnackbar();

  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await companyApi.getJobyRules();
      setRules(res.data || []);
    } catch (err) {
      showSnack(err?.response?.data?.error || 'Failed to load Ailot rules', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line

  async function handleToggle(rule) {
    const newActive = !rule.active;
    // Optimistic update
    setRules(prev => prev.map(r => r.id === rule.id ? { ...r, active: newActive } : r));
    try {
      await companyApi.updateJobyRule(rule.id, { active: newActive });
    } catch (err) {
      // Revert on failure
      setRules(prev => prev.map(r => r.id === rule.id ? { ...r, active: rule.active } : r));
      showSnack(err?.response?.data?.error || 'Failed to update rule', 'error');
    }
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/settings')}
          className="p-2 rounded-xl hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-600"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">⚡ Ailot</h1>
          <p className="text-xs text-gray-500">Smart Automation Rules</p>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : rules.length === 0 ? (
        <Card>
          <p className="text-center text-gray-400 py-6">No automation rules configured yet. Ailot runs tasks automatically when events happen in your workflow.</p>
        </Card>
      ) : (
        <div>
          {rules.map(rule => (
            <RuleCard key={rule.id} rule={rule} onToggle={handleToggle} />
          ))}
        </div>
      )}
    </div>
  );
}
