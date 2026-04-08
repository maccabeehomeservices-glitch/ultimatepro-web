import { useState } from 'react';
import { ArrowLeft, Plus, Trash2, Edit } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useGet, useMutation } from '../../hooks/useApi';
import { Card, LoadingSpinner, EmptyState, Button, Modal, Input } from '../../components/ui';
import { useSnackbar } from '../../components/ui/Snackbar';

function emptyForm() {
  return { name: '', commission_pct: '' };
}

export default function JobSources() {
  const navigate = useNavigate();
  const { showSnack } = useSnackbar();
  const { data, loading, refetch } = useGet('/sources/contacts');
  const { mutate, loading: saving } = useMutation();
  const [modal, setModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [deleteModal, setDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const sources = data?.contacts || data?.sources || (Array.isArray(data) ? data : []);

  function openAdd() { setEditItem(null); setForm(emptyForm()); setModal(true); }
  function openEdit(s) {
    setEditItem(s);
    setForm({ name: s.name || '', commission_pct: s.commission_pct?.toString() || '' });
    setModal(true);
  }

  function handleChange(e) { setForm(p => ({ ...p, [e.target.name]: e.target.value })); }

  async function handleSave() {
    if (!form.name.trim()) { showSnack('Name required', 'error'); return; }
    try {
      const payload = { name: form.name, commission_pct: Number(form.commission_pct) || 0 };
      if (editItem) {
        await mutate('put', `/sources/contacts/${editItem.id || editItem._id}`, payload);
        showSnack('Source updated', 'success');
      } else {
        await mutate('post', '/sources/contacts', payload);
        showSnack('Source added', 'success');
      }
      setModal(false);
      refetch();
    } catch {
      showSnack('Failed to save', 'error');
    }
  }

  async function handleDelete() {
    try {
      await mutate('delete', `/sources/contacts/${deleteTarget.id || deleteTarget._id}`);
      showSnack('Source deleted', 'success');
      setDeleteModal(false);
      refetch();
    } catch {
      showSnack('Failed to delete', 'error');
    }
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate('/settings')} className="p-2 rounded-xl hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-600">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-gray-900 flex-1">Job Sources</h1>
        <Button onClick={openAdd}><Plus size={16} /> Add</Button>
      </div>

      {loading ? <LoadingSpinner /> : sources.length === 0 ? (
        <EmptyState icon={Plus} title="No sources" description="Add job sources like Google, Yelp, Referral." action={<Button onClick={openAdd}>Add Source</Button>} />
      ) : (
        <div className="space-y-2">
          {sources.map(s => (
            <Card key={s.id || s._id}>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">{s.name}</p>
                  {s.commission_pct != null && <p className="text-sm text-gray-500">Commission: {s.commission_pct}%</p>}
                </div>
                <button onClick={() => openEdit(s)} className="p-2 rounded-xl hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-500">
                  <Edit size={16} />
                </button>
                <button onClick={() => { setDeleteTarget(s); setDeleteModal(true); }} className="p-2 rounded-xl hover:bg-red-50 min-h-[44px] min-w-[44px] flex items-center justify-center text-red-400">
                  <Trash2 size={16} />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal isOpen={modal} onClose={() => setModal(false)} title={editItem ? 'Edit Source' : 'Add Source'}
        footer={<><Button variant="outlined" onClick={() => setModal(false)}>Cancel</Button><Button loading={saving} onClick={handleSave}>Save</Button></>}
      >
        <div className="space-y-3">
          <Input label="Source Name *" name="name" value={form.name} onChange={handleChange} placeholder="e.g. Google, Yelp, Referral" />
          <Input label="Commission %" name="commission_pct" type="number" value={form.commission_pct} onChange={handleChange} placeholder="0" />
        </div>
      </Modal>

      <Modal isOpen={deleteModal} onClose={() => setDeleteModal(false)} title="Delete Source"
        footer={<><Button variant="outlined" onClick={() => setDeleteModal(false)}>Cancel</Button><Button variant="danger" loading={saving} onClick={handleDelete}>Delete</Button></>}
      >
        <p className="text-gray-600">Delete <strong>{deleteTarget?.name}</strong>? This cannot be undone.</p>
      </Modal>
    </div>
  );
}
