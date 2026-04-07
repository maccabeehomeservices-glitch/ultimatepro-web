import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import api from '../lib/api';
import { useGet } from '../hooks/useApi';
import { Button, Input, Card, LoadingSpinner } from '../components/ui';
import { useSnackbar } from '../components/ui/Snackbar';

export default function CustomerForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showSnack } = useSnackbar();
  const isEdit = Boolean(id);

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    state: '',
    zip: '',
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const { data, loading } = useGet(isEdit ? `/customers/${id}` : null, [id]);

  useEffect(() => {
    if (isEdit && data) {
      const c = data.customer || data;
      setForm({
        first_name: c.first_name || '',
        last_name: c.last_name || '',
        phone: c.phone || '',
        email: c.email || '',
        address: c.address || '',
        city: c.city || '',
        state: c.state || '',
        zip: c.zip || '',
      });
    }
  }, [isEdit, data]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const newErrors = {};
    if (!form.first_name.trim()) newErrors.first_name = 'First name is required';
    if (!form.phone.trim() && !form.email.trim()) newErrors.phone = 'Phone or email required';
    if (Object.keys(newErrors).length) { setErrors(newErrors); return; }

    setSaving(true);
    try {
      if (isEdit) {
        await api.put(`/customers/${id}`, form);
        showSnack('Customer updated', 'success');
        navigate(`/customers/${id}`);
      } else {
        const res = await api.post('/customers', form);
        showSnack('Customer created', 'success');
        navigate(`/customers/${res.data?.customer?.id || res.data?.id}`);
      }
    } catch (err) {
      showSnack(err?.response?.data?.message || 'Failed to save customer', 'error');
    } finally {
      setSaving(false);
    }
  }

  if (isEdit && loading) return <LoadingSpinner fullPage />;

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-600">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-gray-900">{isEdit ? 'Edit Customer' : 'New Customer'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Input label="First Name" name="first_name" value={form.first_name} onChange={handleChange} placeholder="John" error={errors.first_name} />
              <Input label="Last Name" name="last_name" value={form.last_name} onChange={handleChange} placeholder="Doe" />
            </div>
            <Input label="Phone" type="tel" name="phone" value={form.phone} onChange={handleChange} placeholder="+1 (555) 000-0000" error={errors.phone} />
            <Input label="Email" type="email" name="email" value={form.email} onChange={handleChange} placeholder="john@example.com" />
          </div>
        </Card>

        <Card>
          <div className="space-y-4">
            <Input label="Address" name="address" value={form.address} onChange={handleChange} placeholder="123 Main St" />
            <div className="grid grid-cols-3 gap-3">
              <Input label="City" name="city" value={form.city} onChange={handleChange} placeholder="Tampa" className="col-span-1" />
              <Input label="State" name="state" value={form.state} onChange={handleChange} placeholder="FL" />
              <Input label="Zip" name="zip" value={form.zip} onChange={handleChange} placeholder="33601" />
            </div>
          </div>
        </Card>

        <div className="flex gap-3 pb-4">
          <Button type="button" variant="outlined" onClick={() => navigate(-1)} className="flex-1">Cancel</Button>
          <Button type="submit" loading={saving} disabled={saving} className="flex-1">
            {isEdit ? 'Save Changes' : 'Create Customer'}
          </Button>
        </div>
      </form>
    </div>
  );
}
