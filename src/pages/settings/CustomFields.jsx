import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Pencil, Trash2, X } from 'lucide-react';
import { companyApi } from '../../lib/api';
import { Button, Input, Card, LoadingSpinner } from '../../components/ui';
import { useSnackbar } from '../../components/ui/Snackbar';

const ENTITY_TYPES = [
  { value: 'job',      label: 'Jobs' },
  { value: 'customer', label: 'Customers' },
  { value: 'estimate', label: 'Estimates' },
  { value: 'invoice',  label: 'Invoices' },
];

const FIELD_TYPES = [
  { value: 'text',     label: 'Text' },
  { value: 'number',   label: 'Number' },
  { value: 'date',     label: 'Date' },
  { value: 'select',   label: 'Dropdown (Select)' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'textarea', label: 'Text Area' },
  { value: 'phone',    label: 'Phone' },
  { value: 'email',    label: 'Email' },
];

const EMPTY_FORM = {
  label: '',
  field_type: 'text',
  entity: 'job',
  options: '',
  required: false,
};

function toFieldKey(label) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

export default function CustomFields() {
  const navigate = useNavigate();
  const { showSnack } = useSnackbar();

  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null); // field being edited (null = new)
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null); // id to delete

  async function load() {
    setLoading(true);
    try {
      const res = await companyApi.getCustomFields();
      setFields(res.data || []);
    } catch (err) {
      showSnack(err?.response?.data?.error || 'Failed to load custom fields', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  }

  function openEdit(field) {
    setEditing(field);
    setForm({
      label: field.label || '',
      field_type: field.field_type || 'text',
      entity: field.entity || 'job',
      options: (field.options || []).join(', '),
      required: field.required || false,
    });
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditing(null);
    setForm(EMPTY_FORM);
  }

  async function handleSave() {
    if (!form.label.trim()) { showSnack('Label is required', 'error'); return; }
    setSaving(true);
    try {
      const options = form.field_type === 'select'
        ? form.options.split(',').map(s => s.trim()).filter(Boolean)
        : [];

      if (editing) {
        // PUT only allows label, options, required, sort_order, active
        await companyApi.updateCustomField(editing.id, {
          label: form.label.trim(),
          options,
          required: form.required,
        });
        showSnack('Field updated', 'success');
      } else {
        const field_key = toFieldKey(form.label);
        if (!field_key) { showSnack('Label must contain letters or numbers', 'error'); setSaving(false); return; }
        await companyApi.createCustomField({
          label: form.label.trim(),
          field_key,
          field_type: form.field_type,
          entity: form.entity,
          options,
          required: form.required,
        });
        showSnack('Custom field created', 'success');
      }
      closeModal();
      load();
    } catch (err) {
      showSnack(err?.response?.data?.error || 'Failed to save field', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    try {
      await companyApi.deleteCustomField(id);
      showSnack('Field removed', 'success');
      setConfirmDelete(null);
      load();
    } catch (err) {
      showSnack(err?.response?.data?.error || 'Failed to remove field', 'error');
    }
  }

  // Group fields by entity
  const grouped = ENTITY_TYPES.map(et => ({
    ...et,
    items: fields.filter(f => f.entity === et.value),
  })).filter(g => g.items.length > 0);

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/settings')}
          className="p-2 rounded-xl hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-600"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-gray-900 flex-1">Custom Fields</h1>
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 bg-[#1A73E8] text-white text-sm font-medium px-4 py-2 rounded-xl min-h-[44px]"
        >
          <Plus size={16} /> Add Field
        </button>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : fields.length === 0 ? (
        <Card>
          <p className="text-center text-gray-400 py-6">No custom fields yet. Add one to get started.</p>
        </Card>
      ) : (
        <div className="space-y-5">
          {grouped.map(group => (
            <div key={group.value}>
              <p className="text-xs font-semibold text-[#1A73E8] uppercase tracking-wider mb-2">{group.label}</p>
              <div className="bg-white rounded-2xl shadow overflow-hidden">
                {group.items.map((field, i) => (
                  <div
                    key={field.id}
                    className={`flex items-center gap-3 px-4 py-3 min-h-[60px] ${i < group.items.length - 1 ? 'border-b border-gray-100' : ''}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900">{field.label}</p>
                      <p className="text-xs text-gray-400">
                        {FIELD_TYPES.find(ft => ft.value === field.field_type)?.label || field.field_type}
                        {field.required ? ' · Required' : ''}
                        {field.field_type === 'select' && field.options?.length > 0
                          ? ` · ${field.options.slice(0, 3).join(', ')}${field.options.length > 3 ? '…' : ''}`
                          : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => openEdit(field)}
                      className="p-2 text-gray-400 hover:text-[#1A73E8] min-h-[44px] min-w-[44px] flex items-center justify-center"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => setConfirmDelete(field.id)}
                      className="p-2 text-gray-400 hover:text-red-500 min-h-[44px] min-w-[44px] flex items-center justify-center"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <h2 className="text-lg font-bold text-gray-900">
                {editing ? 'Edit Custom Field' : 'New Custom Field'}
              </h2>
              <button onClick={closeModal} className="p-2 text-gray-400 hover:text-gray-600 min-h-[44px] min-w-[44px] flex items-center justify-center">
                <X size={20} />
              </button>
            </div>

            <div className="px-5 pb-5 space-y-4">
              <Input
                label="Field Label"
                value={form.label}
                onChange={e => setForm(p => ({ ...p, label: e.target.value }))}
                placeholder="e.g. Gate Code"
              />

              {!editing && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Field Type</label>
                    <select
                      value={form.field_type}
                      onChange={e => setForm(p => ({ ...p, field_type: e.target.value }))}
                      className="w-full rounded-xl border border-gray-300 px-3 py-2.5 min-h-[44px] text-base focus:outline-none focus:ring-2 focus:ring-[#1A73E8] bg-white"
                    >
                      {FIELD_TYPES.map(ft => (
                        <option key={ft.value} value={ft.value}>{ft.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Applies To</label>
                    <select
                      value={form.entity}
                      onChange={e => setForm(p => ({ ...p, entity: e.target.value }))}
                      className="w-full rounded-xl border border-gray-300 px-3 py-2.5 min-h-[44px] text-base focus:outline-none focus:ring-2 focus:ring-[#1A73E8] bg-white"
                    >
                      {ENTITY_TYPES.map(et => (
                        <option key={et.value} value={et.value}>{et.label}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {form.field_type === 'select' && (
                <Input
                  label="Options (comma-separated)"
                  value={form.options}
                  onChange={e => setForm(p => ({ ...p, options: e.target.value }))}
                  placeholder="Option 1, Option 2, Option 3"
                />
              )}

              <label className="flex items-center gap-3 min-h-[44px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.required}
                  onChange={e => setForm(p => ({ ...p, required: e.target.checked }))}
                  className="w-5 h-5 rounded accent-[#1A73E8]"
                />
                <span className="text-sm font-medium text-gray-700">Required field</span>
              </label>

              {!editing && form.label && (
                <p className="text-xs text-gray-400">
                  Field key: <code className="bg-gray-100 px-1 rounded">{toFieldKey(form.label) || '—'}</code>
                </p>
              )}

              <div className="flex gap-3 pt-1">
                <Button variant="outlined" onClick={closeModal} className="flex-1">Cancel</Button>
                <Button onClick={handleSave} loading={saving} disabled={saving} className="flex-1">
                  {editing ? 'Save Changes' : 'Create Field'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-2">Remove Field?</h2>
            <p className="text-sm text-gray-500 mb-5">This field will be hidden from all forms. Existing data is preserved.</p>
            <div className="flex gap-3">
              <Button variant="outlined" onClick={() => setConfirmDelete(null)} className="flex-1">Cancel</Button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                className="flex-1 bg-red-500 text-white font-medium rounded-xl py-2.5 min-h-[44px]"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
