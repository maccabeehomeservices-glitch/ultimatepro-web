import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { settingsApi } from '../../lib/api';

const PLATFORM_TEMPLATES = [
  { name: 'Google',    icon: '🔍', url_prefix: 'https://g.page/r/' },
  { name: 'Yelp',     icon: '⭐', url_prefix: 'https://www.yelp.com/writeareview/biz/' },
  { name: 'Facebook', icon: '📘', url_prefix: 'https://www.facebook.com/' },
  { name: 'Thumbtack',icon: '📌', url_prefix: 'https://www.thumbtack.com/' },
  { name: 'Angi',     icon: '🏠', url_prefix: 'https://www.angi.com/' },
  { name: 'BBB',      icon: '🏛️', url_prefix: 'https://www.bbb.org/' },
];

const EMPTY_FORM = { name: '', url: '' };

function getPlatformName(p) { return p.platform_name || p.name || ''; }
function getPlatformIcon(p) {
  const name = getPlatformName(p);
  return PLATFORM_TEMPLATES.find(t => t.name === name)?.icon || '🌐';
}

export default function ReviewPlatforms() {
  const navigate = useNavigate();
  const [platforms, setPlatforms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPlatform, setEditingPlatform] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [snack, setSnack] = useState(null);

  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (!snack) return;
    const t = setTimeout(() => setSnack(null), 3000);
    return () => clearTimeout(t);
  }, [snack]);

  async function load() {
    try {
      const res = await settingsApi.getReviewPlatforms();
      setPlatforms(res.data || []);
    } catch {
      setSnack({ msg: 'Failed to load platforms', error: true });
    } finally {
      setLoading(false);
    }
  }

  const availableTemplates = PLATFORM_TEMPLATES.filter(
    t => !platforms.some(p => getPlatformName(p) === t.name)
  );

  function openAdd() {
    setForm(EMPTY_FORM);
    setEditingPlatform(null);
    setShowForm(true);
  }

  function openTemplate(t) {
    setForm({ name: t.name, url: t.url_prefix });
    setEditingPlatform(null);
    setShowForm(true);
  }

  function openEdit(platform) {
    setForm({ name: getPlatformName(platform), url: platform.url || '' });
    setEditingPlatform(platform);
    setShowForm(true);
  }

  async function toggleEnabled(platform) {
    try {
      await settingsApi.updateReviewPlatform(platform.id, { is_active: !platform.is_active });
      load();
    } catch {
      setSnack({ msg: 'Failed to update', error: true });
    }
  }

  async function setAsDefault(platform) {
    try {
      await settingsApi.updateReviewPlatform(platform.id, { is_default: true });
      load();
      setSnack({ msg: 'Default platform set', error: false });
    } catch {
      setSnack({ msg: 'Failed to update', error: true });
    }
  }

  async function handleSave() {
    if (!form.name.trim()) { setSnack({ msg: 'Platform name is required', error: true }); return; }
    if (!form.url.trim()) { setSnack({ msg: 'Review URL is required', error: true }); return; }
    setSaving(true);
    try {
      const payload = { name: form.name.trim(), url: form.url.trim() };
      if (editingPlatform) {
        await settingsApi.updateReviewPlatform(editingPlatform.id, payload);
        setSnack({ msg: 'Platform updated', error: false });
      } else {
        await settingsApi.createReviewPlatform(payload);
        setSnack({ msg: 'Platform added', error: false });
      }
      setShowForm(false);
      load();
    } catch (e) {
      setSnack({ msg: e.response?.data?.error || 'Failed to save', error: true });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    try {
      await settingsApi.deleteReviewPlatform(id);
      setShowDeleteConfirm(null);
      load();
      setSnack({ msg: 'Platform removed', error: false });
    } catch (e) {
      setSnack({ msg: e.response?.data?.error || 'Failed to delete', error: true });
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-4 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/settings')}
          className="text-gray-400 hover:text-gray-600 text-2xl min-h-[44px] min-w-[44px] flex items-center justify-center"
        >
          ←
        </button>
        <h1 className="text-xl font-bold text-gray-900 flex-1">Review Platforms</h1>
        <button
          onClick={openAdd}
          className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold min-h-[44px]"
        >
          + Add
        </button>
      </div>

      {/* Quick-add templates */}
      {availableTemplates.length > 0 && (
        <div className="mb-6">
          <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-2">QUICK ADD</p>
          <div className="flex flex-wrap gap-2">
            {availableTemplates.map(t => (
              <button
                key={t.name}
                onClick={() => openTemplate(t)}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-full text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-blue-300 min-h-[44px]"
              >
                <span>{t.icon}</span>
                <span>{t.name}</span>
                <span className="text-blue-500">+</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Platform list */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : platforms.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-lg font-medium">No platforms yet</p>
          <p className="text-sm mt-1">Add review platforms to include links in payment receipts</p>
        </div>
      ) : (
        <div className="space-y-3">
          {platforms.map(platform => (
            <div
              key={platform.id}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-2xl shrink-0">{getPlatformIcon(platform)}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900">{getPlatformName(platform)}</span>
                      {platform.is_default && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold shrink-0">
                          Default
                        </span>
                      )}
                    </div>
                    {platform.url && (
                      <div className="text-xs text-gray-400 mt-0.5 truncate max-w-[200px]">
                        {platform.url}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {/* Enabled toggle */}
                  <button
                    onClick={() => toggleEnabled(platform)}
                    className={`relative w-10 h-6 rounded-full transition-colors ${
                      platform.is_active !== false ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                  >
                    <div
                      className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                        platform.is_active !== false ? 'translate-x-5' : 'translate-x-1'
                      }`}
                    />
                  </button>

                  {/* Set default */}
                  {!platform.is_default && platform.is_active !== false && (
                    <button
                      onClick={() => setAsDefault(platform)}
                      className="text-xs text-blue-600 font-semibold px-2 min-h-[44px] hover:underline"
                    >
                      Default
                    </button>
                  )}

                  {/* Edit */}
                  <button
                    onClick={() => openEdit(platform)}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
                  >
                    ✏️
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => setShowDeleteConfirm(platform)}
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

      {/* Add / Edit Modal */}
      {showForm && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowForm(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 max-w-md w-full"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              {editingPlatform ? 'Edit Platform' : 'Add Review Platform'}
            </h3>
            <div className="space-y-3">
              <input
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Platform Name *"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
              <input
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Review URL * (full link to your review page)"
                value={form.url}
                onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
              />
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 py-3 border border-gray-300 rounded-xl text-gray-700 font-medium min-h-[44px]"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-semibold disabled:opacity-50 min-h-[44px]"
              >
                {saving ? 'Saving...' : editingPlatform ? 'Save Changes' : 'Add Platform'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowDeleteConfirm(null)}
        >
          <div
            className="bg-white rounded-2xl p-6 max-w-sm w-full"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-gray-900 mb-2">Remove Platform?</h3>
            <p className="text-gray-600 mb-6">
              <strong>{getPlatformName(showDeleteConfirm)}</strong> will be removed.
              Receipts will no longer include a review link from this platform.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 py-3 border border-gray-300 rounded-xl font-medium text-gray-700 min-h-[44px]"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm.id)}
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
