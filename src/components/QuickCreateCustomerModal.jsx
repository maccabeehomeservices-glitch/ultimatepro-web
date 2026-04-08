import { useState } from 'react';
import { X } from 'lucide-react';
import { customersApi } from '../lib/api';
import { Button, Input } from './ui';
import { useSnackbar } from './ui/Snackbar';

export default function QuickCreateCustomerModal({ isOpen, onClose, onCreated, prefill = {} }) {
  const { showSnack } = useSnackbar();
  const [form, setForm] = useState({
    first_name: prefill.first_name || '',
    last_name: prefill.last_name || '',
    phone: prefill.phone || '',
    email: prefill.email || '',
    address: prefill.address || '',
    city: prefill.city || '',
    state: prefill.state || '',
    zip: prefill.zip || '',
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  if (!isOpen) return null;

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const newErrors = {};
    if (!form.first_name.trim()) newErrors.first_name = 'Required';
    if (!form.phone.trim() && !form.email.trim()) newErrors.phone = 'Phone or email required';
    if (Object.keys(newErrors).length) { setErrors(newErrors); return; }

    setSaving(true);
    try {
      const res = await customersApi.create({
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        address: form.address.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        zip: form.zip.trim(),
      });
      const customer = res.data?.customer || res.data;
      showSnack(`Customer created: ${form.first_name} ${form.last_name}`.trim(), 'success');
      onCreated(customer);
    } catch (err) {
      showSnack(err?.response?.data?.message || 'Failed to create customer', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <h2 className="text-lg font-bold text-gray-900">New Customer</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 min-h-[44px] min-w-[44px] flex items-center justify-center">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-4 pb-6 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="First Name" name="first_name" value={form.first_name} onChange={handleChange} placeholder="John" error={errors.first_name} />
            <Input label="Last Name" name="last_name" value={form.last_name} onChange={handleChange} placeholder="Doe" />
          </div>
          <Input label="Phone" type="tel" name="phone" value={form.phone} onChange={handleChange} placeholder="+1 (555) 000-0000" error={errors.phone} />
          <Input label="Email" type="email" name="email" value={form.email} onChange={handleChange} placeholder="john@example.com" />
          <Input label="Address" name="address" value={form.address} onChange={handleChange} placeholder="123 Main St" />
          <div className="grid grid-cols-3 gap-2">
            <Input label="City" name="city" value={form.city} onChange={handleChange} placeholder="Tampa" />
            <Input label="State" name="state" value={form.state} onChange={handleChange} placeholder="FL" />
            <Input label="Zip" name="zip" value={form.zip} onChange={handleChange} placeholder="33601" />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outlined" onClick={onClose} className="flex-1">Cancel</Button>
            <Button type="submit" loading={saving} disabled={saving} className="flex-1">Create Customer</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
