import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { sourcesApi } from '../../lib/api';

const TABS = ['Contacts', 'Ad Channels', 'Commission'];

const EMPTY_CONTACT = {
  name: '', company_name: '', phone: '', email: '',
  profit_allocation_pct: '', send_updates: true, send_closings: true, notes: '',
};
const EMPTY_RULE = {
  rule_type: '', job_source_id: '', ad_channel_id: '', tech_commission_pct: '', notes: '',
};

export default function JobSources() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(0);

  // Data
  const [contacts, setContacts] = useState([]);
  const [channels, setChannels] = useState([]);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);

  // Contact state
  const [showContactForm, setShowContactForm] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [contactForm, setContactForm] = useState(EMPTY_CONTACT);
  const [deleteContactTarget, setDeleteContactTarget] = useState(null);

  // Channel state
  const [showChannelForm, setShowChannelForm] = useState(false);
  const [editingChannel, setEditingChannel] = useState(null);
  const [channelName, setChannelName] = useState('');

  // Rule state
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [ruleForm, setRuleForm] = useState(EMPTY_RULE);
  const [deleteRuleTarget, setDeleteRuleTarget] = useState(null);

  const [saving, setSaving] = useState(false);
  const [snack, setSnack] = useState(null);

  useEffect(() => { loadAll(); }, []);
  useEffect(() => {
    if (!snack) return;
    const t = setTimeout(() => setSnack(null), 3000);
    return () => clearTimeout(t);
  }, [snack]);

  function showMsg(msg, error = false) { setSnack({ msg, error }); }

  async function loadAll() {
    setLoading(true);
    try {
      const [c, ch, r] = await Promise.all([
        sourcesApi.getContacts(),
        sourcesApi.getChannels(),
        sourcesApi.getCommissionRules(),
      ]);
      setContacts(c.data || []);
      setChannels(ch.data || []);
      setRules(r.data || []);
    } catch {
      showMsg('Failed to load', true);
    } finally {
      setLoading(false);
    }
  }

  // ─── Source Contacts ────────────────────────────────────────────────────────

  function openAddContact() {
    setContactForm(EMPTY_CONTACT);
    setEditingContact(null);
    setShowContactForm(true);
  }

  function openEditContact(c) {
    setContactForm({
      name: c.name || '',
      company_name: c.company_name || '',
      phone: c.phone || '',
      email: c.email || '',
      profit_allocation_pct: c.profit_allocation_pct?.toString() || '0',
      send_updates: c.send_updates !== false,
      send_closings: c.send_closings !== false,
      notes: c.notes || '',
    });
    setEditingContact(c);
    setShowContactForm(true);
  }

  async function saveContact() {
    if (!contactForm.name.trim()) { showMsg('Name is required', true); return; }
    setSaving(true);
    try {
      const payload = {
        name: contactForm.name.trim(),
        company_name: contactForm.company_name.trim() || null,
        phone: contactForm.phone.trim() || null,
        email: contactForm.email.trim() || null,
        profit_allocation_pct: parseFloat(contactForm.profit_allocation_pct) || 0,
        send_updates: contactForm.send_updates,
        send_closings: contactForm.send_closings,
        notes: contactForm.notes.trim() || null,
      };
      if (editingContact) {
        await sourcesApi.updateContact(editingContact.id, payload);
        showMsg('Contact updated');
      } else {
        await sourcesApi.createContact(payload);
        showMsg('Contact added');
      }
      setShowContactForm(false);
      const res = await sourcesApi.getContacts();
      setContacts(res.data || []);
    } catch (e) {
      showMsg(e.response?.data?.error || 'Failed to save', true);
    } finally {
      setSaving(false);
    }
  }

  async function doDeleteContact() {
    try {
      await sourcesApi.deleteContact(deleteContactTarget.id);
      setDeleteContactTarget(null);
      showMsg('Contact removed');
      const res = await sourcesApi.getContacts();
      setContacts(res.data || []);
    } catch {
      showMsg('Failed to delete', true);
    }
  }

  // ─── Ad Channels ────────────────────────────────────────────────────────────

  async function toggleChannel(ch) {
    try {
      await sourcesApi.updateChannel(ch.id, { is_active: !ch.is_active });
      const res = await sourcesApi.getChannels();
      setChannels(res.data || []);
    } catch {
      showMsg('Failed to update', true);
    }
  }

  async function saveChannel() {
    if (!channelName.trim()) return;
    setSaving(true);
    try {
      if (editingChannel) {
        await sourcesApi.updateChannel(editingChannel.id, { name: channelName.trim() });
        showMsg('Channel updated');
      } else {
        await sourcesApi.createChannel(channelName.trim());
        showMsg('Channel added');
      }
      setShowChannelForm(false);
      setEditingChannel(null);
      setChannelName('');
      const res = await sourcesApi.getChannels();
      setChannels(res.data || []);
    } catch (e) {
      showMsg(e.response?.data?.error || 'Failed to save', true);
    } finally {
      setSaving(false);
    }
  }

  // ─── Commission Rules ────────────────────────────────────────────────────────

  function openAddRule() {
    setRuleForm(EMPTY_RULE);
    setEditingRule(null);
    setShowRuleForm(true);
  }

  function openEditRule(rule) {
    setRuleForm({
      rule_type: rule.rule_type || '',
      job_source_id: rule.job_source_id || '',
      ad_channel_id: rule.ad_channel_id || '',
      tech_commission_pct: rule.tech_commission_pct?.toString() || '0',
      notes: rule.notes || '',
    });
    setEditingRule(rule);
    setShowRuleForm(true);
  }

  function openSetDefault() {
    const defaultRule = rules.find(r => r.rule_type === 'default');
    if (defaultRule) {
      openEditRule(defaultRule);
    } else {
      setRuleForm({ ...EMPTY_RULE, rule_type: 'default' });
      setEditingRule(null);
      setShowRuleForm(true);
    }
  }

  async function saveRule() {
    if (!ruleForm.rule_type) { showMsg('Select a rule type', true); return; }
    if (ruleForm.rule_type === 'source_contact' && !ruleForm.job_source_id) {
      showMsg('Select a source contact', true); return;
    }
    if (ruleForm.rule_type === 'ad_channel' && !ruleForm.ad_channel_id) {
      showMsg('Select an ad channel', true); return;
    }
    const pct = parseFloat(ruleForm.tech_commission_pct);
    if (isNaN(pct) || pct < 0 || pct > 100) { showMsg('Rate must be 0–100', true); return; }
    setSaving(true);
    try {
      await sourcesApi.saveCommissionRule({
        rule_type: ruleForm.rule_type,
        job_source_id: ruleForm.job_source_id || null,
        ad_channel_id: ruleForm.ad_channel_id || null,
        tech_commission_pct: pct,
        notes: ruleForm.notes.trim() || null,
      });
      showMsg(editingRule ? 'Rule updated' : 'Rule added');
      setShowRuleForm(false);
      const res = await sourcesApi.getCommissionRules();
      setRules(res.data || []);
    } catch (e) {
      showMsg(e.response?.data?.error || 'Failed to save', true);
    } finally {
      setSaving(false);
    }
  }

  async function doDeleteRule() {
    try {
      await sourcesApi.deleteCommissionRule(deleteRuleTarget.id);
      setDeleteRuleTarget(null);
      showMsg('Rule removed');
      const res = await sourcesApi.getCommissionRules();
      setRules(res.data || []);
    } catch {
      showMsg('Failed to delete', true);
    }
  }

  // ─── Derived ─────────────────────────────────────────────────────────────────

  const defaultRule = rules.find(r => r.rule_type === 'default');
  const specificRules = rules.filter(r => r.rule_type !== 'default');

  const ruleTypeLabel = { source_contact: '👤 Contact', ad_channel: '📢 Channel', network: '🤝 Network' };

  function Toggle({ on, onChange }) {
    return (
      <button
        type="button"
        onClick={onChange}
        className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${on ? 'bg-blue-600' : 'bg-gray-300'}`}
      >
        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${on ? 'translate-x-5' : 'translate-x-1'}`} />
      </button>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => navigate('/settings')}
          className="text-gray-400 hover:text-gray-600 text-2xl min-h-[44px] min-w-[44px] flex items-center justify-center"
        >
          ←
        </button>
        <h1 className="text-xl font-bold text-gray-900 flex-1">Job Sources</h1>
        {activeTab === 0 && (
          <button
            onClick={openAddContact}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold min-h-[44px]"
          >
            + Add
          </button>
        )}
        {activeTab === 2 && (
          <button
            onClick={openAddRule}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold min-h-[44px]"
          >
            + Add Rule
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-4">
        {TABS.map((tab, i) => (
          <button
            key={tab}
            onClick={() => setActiveTab(i)}
            className={`flex-1 py-3 text-sm font-semibold text-center border-b-2 transition-colors ${
              activeTab === i ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* ── TAB 0: Source Contacts ─────────────────────────────────────── */}
          {activeTab === 0 && (
            <div className="space-y-3">
              {contacts.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <p className="font-medium">No source contacts</p>
                  <p className="text-sm mt-1">Add referral partners, home warranty companies, or anyone who sends you jobs</p>
                </div>
              ) : contacts.map(c => (
                <div key={c.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900">{c.name}</p>
                      {c.company_name && <p className="text-sm text-gray-500">{c.company_name}</p>}
                      {(c.phone || c.email) && (
                        <p className="text-sm text-gray-500">{[c.phone, c.email].filter(Boolean).join(' · ')}</p>
                      )}
                      {c.profit_allocation_pct > 0 && (
                        <span className="inline-block mt-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                          {c.profit_allocation_pct}% profit allocation
                        </span>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => openEditContact(c)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => setDeleteContactTarget(c)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── TAB 1: Ad Channels ─────────────────────────────────────────── */}
          {activeTab === 1 && (
            <div>
              <div className="space-y-1 mb-4">
                {channels.map(ch => (
                  <div
                    key={ch.id}
                    className="flex items-center justify-between bg-white rounded-xl border border-gray-100 px-4 py-3 min-h-[56px]"
                  >
                    <div>
                      <span className="font-medium text-gray-900">{ch.name}</span>
                      {ch.is_custom && (
                        <span className="ml-2 text-xs text-gray-400 font-medium">Custom</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {ch.is_custom && (
                        <button
                          onClick={() => { setEditingChannel(ch); setChannelName(ch.name); setShowChannelForm(true); }}
                          className="p-1 text-gray-400 hover:text-blue-600 min-h-[36px] min-w-[36px] flex items-center justify-center"
                        >
                          ✏️
                        </button>
                      )}
                      <Toggle on={ch.is_active} onChange={() => toggleChannel(ch)} />
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={() => { setEditingChannel(null); setChannelName(''); setShowChannelForm(true); }}
                className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-blue-400 hover:text-blue-600 font-medium text-sm min-h-[44px]"
              >
                + Add Custom Channel
              </button>
            </div>
          )}

          {/* ── TAB 2: Commission Rules ─────────────────────────────────────── */}
          {activeTab === 2 && (
            <div className="space-y-6">
              {/* Default rule */}
              <div>
                <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-2">DEFAULT COMMISSION</p>
                <div className="bg-white rounded-2xl border border-gray-100 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      {defaultRule ? (
                        <>
                          <p className="font-semibold text-gray-900">Tech keeps {defaultRule.tech_commission_pct}%</p>
                          <p className="text-sm text-gray-500 mt-0.5">Applied to all jobs with no specific source rule</p>
                        </>
                      ) : (
                        <>
                          <p className="font-semibold text-gray-900">No default set</p>
                          <p className="text-sm text-gray-500 mt-0.5">Uses each tech's individual pay settings</p>
                        </>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {defaultRule ? (
                        <>
                          <button
                            onClick={() => openEditRule(defaultRule)}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => setDeleteRuleTarget(defaultRule)}
                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
                          >
                            🗑️
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={openSetDefault}
                          className="px-3 py-2 text-sm text-blue-600 font-semibold border border-blue-200 rounded-lg hover:bg-blue-50 min-h-[44px]"
                        >
                          Set Default
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Source-specific rules */}
              <div>
                <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-2">SOURCE-SPECIFIC RULES</p>
                {specificRules.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 bg-white rounded-2xl border border-gray-100">
                    <p className="text-sm">No source-specific rules yet. Use "+ Add Rule" to override commission for specific sources.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {specificRules.map(rule => {
                      const label = ruleTypeLabel[rule.rule_type] || rule.rule_type;
                      const sourceName = rule.job_source_name || rule.ad_channel_name
                        || (rule.rule_type === 'network' ? 'All Network Jobs' : '');
                      return (
                        <div
                          key={rule.id}
                          className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-medium text-gray-500">{label}</span>
                              {sourceName && (
                                <span className="font-semibold text-gray-900 truncate">{sourceName}</span>
                              )}
                            </div>
                            <p className="text-sm text-blue-700 font-medium mt-0.5">Tech keeps {rule.tech_commission_pct}%</p>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <button
                              onClick={() => openEditRule(rule)}
                              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => setDeleteRuleTarget(rule)}
                              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Contact Form Modal ─────────────────────────────────────────────── */}
      {showContactForm && (
        <div
          className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50"
          onClick={() => setShowContactForm(false)}
        >
          <div
            className="bg-white rounded-t-2xl sm:rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              {editingContact ? 'Edit Source Contact' : 'Add Source Contact'}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Name *</label>
                <input
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Contact name"
                  value={contactForm.name}
                  onChange={e => setContactForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Company</label>
                <input
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Company name (optional)"
                  value={contactForm.company_name}
                  onChange={e => setContactForm(f => ({ ...f, company_name: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Phone</label>
                  <input
                    type="tel"
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="(555) 000-0000"
                    value={contactForm.phone}
                    onChange={e => setContactForm(f => ({ ...f, phone: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Email</label>
                  <input
                    type="email"
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="email@example.com"
                    value={contactForm.email}
                    onChange={e => setContactForm(f => ({ ...f, email: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Profit Allocation %</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0"
                  value={contactForm.profit_allocation_pct}
                  onChange={e => setContactForm(f => ({ ...f, profit_allocation_pct: e.target.value }))}
                />
                <p className="text-xs text-gray-400 mt-1">% of job net given to this contact</p>
              </div>
              <div className="flex items-center justify-between py-1">
                <label className="text-sm font-medium text-gray-700">Send status updates</label>
                <Toggle
                  on={contactForm.send_updates}
                  onChange={() => setContactForm(f => ({ ...f, send_updates: !f.send_updates }))}
                />
              </div>
              <div className="flex items-center justify-between py-1">
                <label className="text-sm font-medium text-gray-700">Send job closings</label>
                <Toggle
                  on={contactForm.send_closings}
                  onChange={() => setContactForm(f => ({ ...f, send_closings: !f.send_closings }))}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Notes</label>
                <textarea
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                  placeholder="Optional notes..."
                  value={contactForm.notes}
                  onChange={e => setContactForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setShowContactForm(false)}
                className="flex-1 py-3 border border-gray-300 rounded-xl text-gray-700 font-medium min-h-[44px]"
              >
                Cancel
              </button>
              <button
                onClick={saveContact}
                disabled={saving}
                className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-semibold disabled:opacity-50 min-h-[44px]"
              >
                {saving ? 'Saving...' : editingContact ? 'Save Changes' : 'Add Contact'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Contact Delete Confirm ─────────────────────────────────────────── */}
      {deleteContactTarget && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setDeleteContactTarget(null)}
        >
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Remove Source Contact?</h3>
            <p className="text-gray-600 mb-6">
              <strong>{deleteContactTarget.name}</strong> will be archived and won't appear in new job forms.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteContactTarget(null)}
                className="flex-1 py-3 border border-gray-300 rounded-xl font-medium text-gray-700 min-h-[44px]"
              >
                Cancel
              </button>
              <button
                onClick={doDeleteContact}
                className="flex-1 py-3 bg-red-600 text-white rounded-xl font-semibold min-h-[44px]"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Channel Form Modal ─────────────────────────────────────────────── */}
      {showChannelForm && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => { setShowChannelForm(false); setEditingChannel(null); }}
        >
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              {editingChannel ? 'Rename Channel' : 'Add Custom Channel'}
            </h3>
            <input
              autoFocus
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Channel name *"
              value={channelName}
              onChange={e => setChannelName(e.target.value)}
            />
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => { setShowChannelForm(false); setEditingChannel(null); }}
                className="flex-1 py-3 border border-gray-300 rounded-xl text-gray-700 font-medium min-h-[44px]"
              >
                Cancel
              </button>
              <button
                onClick={saveChannel}
                disabled={saving || !channelName.trim()}
                className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-semibold disabled:opacity-50 min-h-[44px]"
              >
                {saving ? 'Saving...' : editingChannel ? 'Save' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Commission Rule Modal ──────────────────────────────────────────── */}
      {showRuleForm && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowRuleForm(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              {editingRule ? 'Edit Commission Rule' : 'Add Commission Rule'}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Rule Type</label>
                <select
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={ruleForm.rule_type}
                  disabled={!!editingRule}
                  onChange={e => setRuleForm(f => ({ ...f, rule_type: e.target.value, job_source_id: '', ad_channel_id: '' }))}
                >
                  <option value="">Select type...</option>
                  <option value="default">Default (all jobs)</option>
                  <option value="source_contact">Source Contact</option>
                  <option value="ad_channel">Ad Channel</option>
                  <option value="network">Network Jobs</option>
                </select>
              </div>

              {ruleForm.rule_type === 'source_contact' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Source Contact</label>
                  <select
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={ruleForm.job_source_id}
                    onChange={e => setRuleForm(f => ({ ...f, job_source_id: e.target.value }))}
                  >
                    <option value="">Select contact...</option>
                    {contacts.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {ruleForm.rule_type === 'ad_channel' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Ad Channel</label>
                  <select
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={ruleForm.ad_channel_id}
                    onChange={e => setRuleForm(f => ({ ...f, ad_channel_id: e.target.value }))}
                  >
                    <option value="">Select channel...</option>
                    {channels.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Tech Commission % <span className="font-normal text-gray-400">(tech keeps this %)</span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. 60"
                  value={ruleForm.tech_commission_pct}
                  onChange={e => setRuleForm(f => ({ ...f, tech_commission_pct: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setShowRuleForm(false)}
                className="flex-1 py-3 border border-gray-300 rounded-xl text-gray-700 font-medium min-h-[44px]"
              >
                Cancel
              </button>
              <button
                onClick={saveRule}
                disabled={saving}
                className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-semibold disabled:opacity-50 min-h-[44px]"
              >
                {saving ? 'Saving...' : editingRule ? 'Save Changes' : 'Add Rule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Rule Delete Confirm ────────────────────────────────────────────── */}
      {deleteRuleTarget && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setDeleteRuleTarget(null)}
        >
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Remove Rule?</h3>
            <p className="text-gray-600 mb-6">This commission rule will be permanently deleted.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteRuleTarget(null)}
                className="flex-1 py-3 border border-gray-300 rounded-xl font-medium text-gray-700 min-h-[44px]"
              >
                Cancel
              </button>
              <button
                onClick={doDeleteRule}
                className="flex-1 py-3 bg-red-600 text-white rounded-xl font-semibold min-h-[44px]"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Snackbar */}
      {snack && (
        <div
          onClick={() => setSnack(null)}
          className={`fixed bottom-20 left-1/2 -translate-x-1/2 px-6 py-3 rounded-xl shadow-lg text-white text-sm z-50 cursor-pointer whitespace-nowrap ${
            snack.error ? 'bg-red-600' : 'bg-green-600'
          }`}
        >
          {snack.msg}
        </div>
      )}
    </div>
  );
}
