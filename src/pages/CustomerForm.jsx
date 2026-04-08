import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, X } from 'lucide-react';
import { customersApi } from '../lib/api';
import { useGet } from '../hooks/useApi';
import { Button, Input, Card, LoadingSpinner } from '../components/ui';
import { useSnackbar } from '../components/ui/Snackbar';

const CUSTOMER_TYPES = ['Residential', 'Commercial'];

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
    customer_type: 'Residential',
    notes: '',
  });
  const [extraPhones, setExtraPhones] = useState([]);
  const [extraEmails, setExtraEmails] = useState([]);
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
        customer_type: c.customer_type || 'Residential',
        notes: c.notes || '',
      });
      setExtraPhones(c.extra_phones || []);
      setExtraEmails(c.extra_emails || []);
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
      const payload = { ...form, extra_phones: extraPhones, extra_emails: extraEmails };
      if (isEdit) {
        await customersApi.update(id, payload);
        showSnack('Customer updated', 'success');
        navigate(`/customers/${id}`);
      } else {
        const res = await customersApi.create(payload);
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
        {/* Customer Type chips */}
        <Card>
          <p className="text-xs text-gray-400 font-medium uppercase mb-2">Customer Type</p>
          <div className="flex gap-2 flex-wrap">
            {CUSTOMER_TYPES.map(type => (
              <button
                key={type}
                type="button"
                onClick={() => setForm(p => ({ ...p, customer_type: type }))}
                className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors min-h-[44px] ${
                  form.customer_type === type
                    ? 'bg-[#1A73E8] text-white border-[#1A73E8]'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-[#1A73E8]'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </Card>

        {/* Name + Contact */}
        <Card>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Input label="First Name" name="first_name" value={form.first_name} onChange={handleChange} placeholder="John" error={errors.first_name} />
              <Input label="Last Name" name="last_name" value={form.last_name} onChange={handleChange} placeholder="Doe" />
            </div>

            {/* Primary phone */}
            <Input label="Phone" type="tel" name="phone" value={form.phone} onChange={handleChange} placeholder="+1 (555) 000-0000" error={errors.phone} />

            {/* Extra phones */}
            {extraPhones.map((ph, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="flex-1">
                  <Input
                    label={`Phone ${i + 2}`}
                    type="tel"
                    value={ph}
                    onChange={e => setExtraPhones(prev => prev.map((v, j) => j === i ? e.target.value : v))}
                    placeholder="+1 (555) 000-0000"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setExtraPhones(prev => prev.filter((_, j) => j !== i))}
                  className="mt-5 p-2 text-gray-400 hover:text-red-500 min-h-[44px]"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setExtraPhones(p => [...p, ''])}
              className="flex items-center gap-1.5 text-sm text-[#1A73E8] font-medium min-h-[44px]"
            >
              <Plus size={14} /> Add Phone
            </button>

            {/* Primary email */}
            <Input label="Email" type="email" name="email" value={form.email} onChange={handleChange} placeholder="john@example.com" />

            {/* Extra emails */}
            {extraEmails.map((em, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="flex-1">
                  <Input
                    label={`Email ${i + 2}`}
                    type="email"
                    value={em}
                    onChange={e => setExtraEmails(prev => prev.map((v, j) => j === i ? e.target.value : v))}
                    placeholder="other@example.com"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setExtraEmails(prev => prev.filter((_, j) => j !== i))}
                  className="mt-5 p-2 text-gray-400 hover:text-red-500 min-h-[44px]"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setExtraEmails(p => [...p, ''])}
              className="flex items-center gap-1.5 text-sm text-[#1A73E8] font-medium min-h-[44px]"
            >
              <Plus size={14} /> Add Email
            </button>
          </div>
        </Card>

        {/* Address */}
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

        {/* Notes */}
        <Card>
          <p className="text-xs text-gray-400 font-medium uppercase mb-2">Notes</p>
          <textarea
            name="notes"
            value={form.notes}
            onChange={handleChange}
            rows={4}
            placeholder="Customer notes..."
            className="w-full text-sm text-gray-800 resize-none focus:outline-none bg-transparent placeholder-gray-400"
          />
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
