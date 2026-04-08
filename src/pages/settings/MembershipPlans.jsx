import { useState } from 'react';
import { ArrowLeft, Plus, Trash2, Edit } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useGet, useMutation } from '../../hooks/useApi';
import { Card, LoadingSpinner, EmptyState, Button, Modal, Input, Select } from '../../components/ui';
import { useSnackbar } from '../../components/ui/Snackbar';

const FREQUENCY_OPTIONS = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'semi_annual', label: 'Semi-Annual' },
  { value: 'annual', label: 'Annual' },
];

function emptyForm() {
  return { name: '', frequency: 'annual', price: '', description: '' };
}

function formatCurrency(v) {
  return '$' + Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function MembershipPlans() {
  const navigate = useNavigate();
  const { showSnack } = useSnackbar();
  const { data, loading, refetch } = useGet('/memberships/plans');
  const { mutate, loading: saving } = useMutation();
  const [modal, setModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [deleteModal, setDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const plans = data?.plans || data || [];

  function openAdd() { setEditItem(null); setForm(emptyForm()); setModal(true); }
  function openEdit(p) {
    setEditItem(p);
    setForm({ name: p.name || '', frequency: p.frequency || 'annual', price: p.price?.toString() || '', description: p.description || '' });
    setModal(true);
  }

  function handleChange(e) { setForm(prev => ({ ...prev, [e.target.name]: e.target.value })); }

  async function handleSave() {
    if (!form.name.trim()) { showSnack('Plan name required', 'error'); return; }
    try {
      const payload = { ...form, price: Number(form.price) || 0 };
      if (editItem) {
        await mutate('put', `/memberships/plans/${editItem.id || editItem._id}`, payload);
        showSnack('Plan updated', 'success');
      } else {
        await mutate('post', '/memberships/plans', payload);
        showSnack('Plan created', 'success');
      }
      setModal(false);
      refetch();
    } catch {
      showSnack('Failed to save', 'error');
    }
  }

  async function handleDelete() {
    try {
      await mutate('delete', `/memberships/plans/${deleteTarget.id || deleteTarget._id}`);
      showSnack('Plan deleted', 'success');
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
        <h1 className="text-xl font-bold text-gray-900 flex-1">Membership Plans</h1>
        <Button onClick={openAdd}><Plus size={16} /> Add</Button>
      </div>

      {loading ? <LoadingSpinner /> : plans.length === 0 ? (
        <EmptyState icon={Plus} title="No plans" description="Create your first membership plan." action={<Button onClick={openAdd}>Add Plan</Button>} />
      ) : (
        <div className="space-y-2">
          {plans.map(p => (
            <Card key={p.id || p._id}>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">{p.name}</p>
                  <p className="text-sm text-gray-500">{formatCurrency(p.price)} · {p.frequency}</p>
                  {p.description && <p className="text-xs text-gray-400">{p.description}</p>}
                </div>
                <button onClick={() => openEdit(p)} className="p-2 rounded-xl hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-500">
                  <Edit size={16} />
                </button>
                <button onClick={() => { setDeleteTarget(p); setDeleteModal(true); }} className="p-2 rounded-xl hover:bg-red-50 min-h-[44px] min-w-[44px] flex items-center justify-center text-red-400">
                  <Trash2 size={16} />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal isOpen={modal} onClose={() => setModal(false)} title={editItem ? 'Edit Plan' : 'Add Plan'}
        footer={<><Button variant="outlined" onClick={() => setModal(false)}>Cancel</Button><Button loading={saving} onClick={handleSave}>Save</Button></>}
      >
        <div className="space-y-3">
          <Input label="Plan Name *" name="name" value={form.name} onChange={handleChange} placeholder="Annual Maintenance" />
          <Select label="Frequency" name="frequency" value={form.frequency} onChange={handleChange} options={FREQUENCY_OPTIONS} />
          <Input label="Price" name="price" type="number" value={form.price} onChange={handleChange} placeholder="0.00" />
          <Input label="Description" name="description" value={form.description} onChange={handleChange} placeholder="What's included..." />
        </div>
      </Modal>

      <Modal isOpen={deleteModal} onClose={() => setDeleteModal(false)} title="Delete Plan"
        footer={<><Button variant="outlined" onClick={() => setDeleteModal(false)}>Cancel</Button><Button variant="danger" loading={saving} onClick={handleDelete}>Delete</Button></>}
      >
        <p className="text-gray-600">Delete <strong>{deleteTarget?.name}</strong>? This cannot be undone.</p>
      </Modal>
    </div>
  );
}
