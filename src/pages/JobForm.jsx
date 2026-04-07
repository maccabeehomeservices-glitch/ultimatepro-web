import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import api from '../lib/api';
import { useGet, useMutation } from '../hooks/useApi';
import { Button, Input, Select, Card, LoadingSpinner } from '../components/ui';
import { useSnackbar } from '../components/ui/Snackbar';

const STATUS_OPTIONS = [
  { value: 'unscheduled', label: 'Unscheduled' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'en_route', label: 'En Route' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'holding', label: 'Holding' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function JobForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showSnack } = useSnackbar();
  const isEdit = Boolean(id);

  const [form, setForm] = useState({
    title: '',
    description: '',
    customer_id: '',
    customer_name: '',
    address: '',
    scheduled_date: '',
    scheduled_time: '',
    assigned_tech_id: '',
    status: 'unscheduled',
  });
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState([]);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const searchTimeout = useRef(null);

  const { data: jobData, loading: jobLoading } = useGet(isEdit ? `/jobs/${id}` : null, [id]);
  const { data: techsData } = useGet('/users/technicians');

  useEffect(() => {
    if (isEdit && jobData) {
      const j = jobData.job || jobData;
      setForm({
        title: j.title || j.job_title || '',
        description: j.description || '',
        customer_id: j.customer_id || '',
        customer_name: j.customer_name || j.customer?.name || '',
        address: j.address || j.service_address || '',
        scheduled_date: j.scheduled_date ? j.scheduled_date.slice(0, 10) : '',
        scheduled_time: j.scheduled_time || '',
        assigned_tech_id: j.assigned_tech_id || '',
        status: j.status || 'unscheduled',
      });
    }
  }, [isEdit, jobData]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  }

  function handleCustomerInput(e) {
    const val = e.target.value;
    setCustomerSearch(val);
    setForm((prev) => ({ ...prev, customer_name: val, customer_id: '' }));
    clearTimeout(searchTimeout.current);
    if (val.length > 1) {
      searchTimeout.current = setTimeout(async () => {
        try {
          const res = await api.get(`/customers?search=${encodeURIComponent(val)}&limit=6`);
          setCustomerResults(res.data?.customers || res.data || []);
          setShowCustomerDropdown(true);
        } catch {
          setCustomerResults([]);
        }
      }, 300);
    } else {
      setCustomerResults([]);
      setShowCustomerDropdown(false);
    }
  }

  function selectCustomer(customer) {
    const name = `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || customer.name || '';
    setForm((prev) => ({
      ...prev,
      customer_id: customer.id || customer._id,
      customer_name: name,
      address: prev.address || customer.address || '',
    }));
    setCustomerSearch(name);
    setShowCustomerDropdown(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const newErrors = {};
    if (!form.title.trim()) newErrors.title = 'Title is required';
    if (!form.customer_id) newErrors.customer_name = 'Please select a customer';
    if (Object.keys(newErrors).length) { setErrors(newErrors); return; }

    setSaving(true);
    try {
      const payload = {
        title: form.title,
        description: form.description,
        customer_id: form.customer_id,
        address: form.address,
        scheduled_date: form.scheduled_date || undefined,
        scheduled_time: form.scheduled_time || undefined,
        assigned_tech_id: form.assigned_tech_id || undefined,
        status: form.status,
      };
      if (isEdit) {
        await api.put(`/jobs/${id}`, payload);
        showSnack('Job updated', 'success');
        navigate(`/jobs/${id}`);
      } else {
        const res = await api.post('/jobs', payload);
        showSnack('Job created', 'success');
        navigate(`/jobs/${res.data?.job?.id || res.data?.id}`);
      }
    } catch (err) {
      showSnack(err?.response?.data?.message || 'Failed to save job', 'error');
    } finally {
      setSaving(false);
    }
  }

  const techs = techsData?.technicians || techsData || [];
  const techOptions = techs.map((t) => ({
    value: t.id || t._id,
    label: `${t.first_name || ''} ${t.last_name || ''}`.trim(),
  }));

  if (isEdit && jobLoading) return <LoadingSpinner fullPage />;

  return (
    <div className="p-4 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-600"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-gray-900">{isEdit ? 'Edit Job' : 'New Job'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card>
          <div className="space-y-4">
            <Input
              label="Job Title"
              name="title"
              value={form.title}
              onChange={handleChange}
              placeholder="e.g. AC Repair - Main Unit"
              error={errors.title}
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                rows={3}
                placeholder="Job details..."
                className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1A73E8] focus:border-transparent resize-none"
              />
            </div>
          </div>
        </Card>

        <Card>
          <div className="space-y-4">
            {/* Customer search */}
            <div className="relative">
              <Input
                label="Customer"
                value={form.customer_name || customerSearch}
                onChange={handleCustomerInput}
                placeholder="Search customer..."
                error={errors.customer_name}
              />
              {showCustomerDropdown && customerResults.length > 0 && (
                <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                  {customerResults.map((c) => (
                    <button
                      key={c.id || c._id}
                      type="button"
                      onClick={() => selectCustomer(c)}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 text-sm border-b border-gray-50 last:border-0"
                    >
                      <span className="font-medium">{`${c.first_name || ''} ${c.last_name || ''}`.trim() || c.name}</span>
                      {c.phone && <span className="text-gray-400 ml-2">{c.phone}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Input
              label="Service Address"
              name="address"
              value={form.address}
              onChange={handleChange}
              placeholder="123 Main St, City, State"
            />
          </div>
        </Card>

        <Card>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Date"
                type="date"
                name="scheduled_date"
                value={form.scheduled_date}
                onChange={handleChange}
              />
              <Input
                label="Time"
                type="time"
                name="scheduled_time"
                value={form.scheduled_time}
                onChange={handleChange}
              />
            </div>
            <Select
              label="Assigned Technician"
              name="assigned_tech_id"
              value={form.assigned_tech_id}
              onChange={handleChange}
              options={techOptions}
              placeholder="Select technician..."
            />
            <Select
              label="Status"
              name="status"
              value={form.status}
              onChange={handleChange}
              options={STATUS_OPTIONS}
            />
          </div>
        </Card>

        <div className="flex gap-3 pb-4">
          <Button type="button" variant="outlined" onClick={() => navigate(-1)} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" loading={saving} disabled={saving} className="flex-1">
            {isEdit ? 'Save Changes' : 'Create Job'}
          </Button>
        </div>
      </form>
    </div>
  );
}
