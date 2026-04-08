import { useState } from 'react';
import { ArrowLeft, Plus, Trash2, Edit } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useGet, useMutation } from '../../hooks/useApi';
import { Card, LoadingSpinner, EmptyState, Button, Modal, Input } from '../../components/ui';
import { useSnackbar } from '../../components/ui/Snackbar';

function emptyForm() {
  return { name: '', phone: '', email: '', commission_pct: '', cc_fee_pct: '' };
}

export default function RosterTechs() {
  const navigate = useNavigate();
  const { showSnack } = useSnackbar();
  const { data, loading, refetch } = useGet('/roster-techs');
  const { mutate, loading: saving } = useMutation();
  const [modal, setModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [deleteModal, setDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const techs = data?.techs || data?.technicians || data || [];

  function openAdd() { setEditItem(null); setForm(emptyForm()); setModal(true); }
  function openEdit(t) {
    setEditItem(t);
    setForm({ name: t.name || '', phone: t.phone || '', email: t.email || '', commission_pct: t.commission_pct?.toString() || '', cc_fee_pct: t.cc_fee_pct?.toString() || '' });
    setModal(true);
  }

  function handleChange(e) {
    setForm(p => ({ ...p, [e.target.name]: e.target.value }));
  }

  async function handleSave() {
    if (!form.name.trim()) { showSnack('Name is required', 'error'); return; }
    try {
      const payload = { ...form, commission_pct: Number(form.commission_pct) || 0, cc_fee_pct: Number(form.cc_fee_pct) || 0 };
      if (editItem) {
        await mutate('put', `/roster-techs/${editItem.id || editItem._id}`, payload);
        showSnack('Technician updated', 'success');
      } else {
        await mutate('post', '/roster-techs', payload);
        showSnack('Technician added', 'success');
      }
      setModal(false);
      refetch();
    } catch {
      showSnack('Failed to save', 'error');
    }
  }

  async function handleDelete() {
    try {
      await mutate('delete', `/roster-techs/${deleteTarget.id || deleteTarget._id}`);
      showSnack('Technician deleted', 'success');
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
        <h1 className="text-xl font-bold text-gray-900 flex-1">Roster Technicians</h1>
        <Button onClick={openAdd}><Plus size={16} /> Add</Button>
      </div>

      {loading ? <LoadingSpinner /> : techs.length === 0 ? (
        <EmptyState icon={Plus} title="No technicians" description="Add your first roster tech." action={<Button onClick={openAdd}>Add Tech</Button>} />
      ) : (
        <div className="space-y-2">
          {techs.map(t => (
            <Card key={t.id || t._id}>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">{t.name}</p>
                  <p className="text-sm text-gray-500">{[t.phone, t.email].filter(Boolean).join(' · ')}</p>
                  <p className="text-xs text-gray-400">Commission: {t.commission_pct || 0}% · CC Fee: {t.cc_fee_pct || 0}%</p>
                </div>
                <button onClick={() => openEdit(t)} className="p-2 rounded-xl hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-500">
                  <Edit size={16} />
                </button>
                <button onClick={() => { setDeleteTarget(t); setDeleteModal(true); }} className="p-2 rounded-xl hover:bg-red-50 min-h-[44px] min-w-[44px] flex items-center justify-center text-red-400">
                  <Trash2 size={16} />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal isOpen={modal} onClose={() => setModal(false)} title={editItem ? 'Edit Technician' : 'Add Technician'}
        footer={<><Button variant="outlined" onClick={() => setModal(false)}>Cancel</Button><Button loading={saving} onClick={handleSave}>Save</Button></>}
      >
        <div className="space-y-3">
          <Input label="Name *" name="name" value={form.name} onChange={handleChange} placeholder="John Smith" />
          <Input label="Phone" name="phone" value={form.phone} onChange={handleChange} placeholder="+1 (555) 000-0000" />
          <Input label="Email" name="email" value={form.email} onChange={handleChange} placeholder="john@example.com" />
          <Input label="Commission %" name="commission_pct" type="number" value={form.commission_pct} onChange={handleChange} placeholder="0" />
          <Input label="CC Fee %" name="cc_fee_pct" type="number" value={form.cc_fee_pct} onChange={handleChange} placeholder="0" />
        </div>
      </Modal>

      <Modal isOpen={deleteModal} onClose={() => setDeleteModal(false)} title="Delete Technician"
        footer={<><Button variant="outlined" onClick={() => setDeleteModal(false)}>Cancel</Button><Button variant="danger" loading={saving} onClick={handleDelete}>Delete</Button></>}
      >
        <p className="text-gray-600">Delete <strong>{deleteTarget?.name}</strong>? This cannot be undone.</p>
      </Modal>
    </div>
  );
}
