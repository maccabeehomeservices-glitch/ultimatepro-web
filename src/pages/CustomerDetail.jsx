import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, Trash2, Briefcase, FileText, Receipt, Phone, Mail, MapPin } from 'lucide-react';
import { useGet, useMutation } from '../hooks/useApi';
import { Card, Badge, Button, LoadingSpinner, Tabs, EmptyState, Modal } from '../components/ui';
import { useSnackbar } from '../components/ui/Snackbar';

const tabList = [
  { id: 'jobs', label: 'Jobs' },
  { id: 'estimates', label: 'Estimates' },
  { id: 'invoices', label: 'Invoices' },
];

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showSnack } = useSnackbar();
  const { data, loading } = useGet(`/customers/${id}`);
  const [activeTab, setActiveTab] = useState('jobs');
  const [deleteModal, setDeleteModal] = useState(false);
  const { mutate, loading: deleting } = useMutation();

  const customer = data?.customer || data;

  const { data: jobsData, loading: jobsLoading } = useGet(activeTab === 'jobs' ? `/jobs?customer_id=${id}` : null, [activeTab, id]);
  const { data: estimatesData, loading: estimatesLoading } = useGet(activeTab === 'estimates' ? `/estimates?customer_id=${id}` : null, [activeTab, id]);
  const { data: invoicesData, loading: invoicesLoading } = useGet(activeTab === 'invoices' ? `/invoices?customer_id=${id}` : null, [activeTab, id]);

  async function handleDelete() {
    try {
      await mutate('delete', `/customers/${id}`);
      showSnack('Customer deleted', 'success');
      navigate('/customers');
    } catch {
      showSnack('Failed to delete customer', 'error');
    }
  }

  if (loading) return <LoadingSpinner fullPage />;
  if (!customer) return <div className="p-4 text-gray-500">Customer not found.</div>;

  const name = `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || customer.name || 'Customer';

  const jobs = jobsData?.jobs || jobsData || [];
  const estimates = estimatesData?.estimates || estimatesData || [];
  const invoices = invoicesData?.invoices || invoicesData || [];

  function formatCurrency(v) {
    return '$' + Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  return (
    <div className="p-4 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-600">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-bold text-gray-900 text-lg flex-1 truncate">{name}</h1>
        <button onClick={() => navigate(`/customers/${id}/edit`)} className="p-2 rounded-xl hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-600">
          <Edit size={20} />
        </button>
        <button onClick={() => setDeleteModal(true)} className="p-2 rounded-xl hover:bg-red-50 min-h-[44px] min-w-[44px] flex items-center justify-center text-red-500">
          <Trash2 size={20} />
        </button>
      </div>

      {/* Info Card */}
      <Card className="mb-4">
        <div className="space-y-2">
          {customer.phone && (
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <Phone size={14} className="text-gray-400" />
              {customer.phone}
            </div>
          )}
          {customer.email && (
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <Mail size={14} className="text-gray-400" />
              {customer.email}
            </div>
          )}
          {(customer.address || customer.city) && (
            <div className="flex items-start gap-2 text-sm text-gray-700">
              <MapPin size={14} className="text-gray-400 mt-0.5" />
              <span>{[customer.address, customer.city, customer.state, customer.zip].filter(Boolean).join(', ')}</span>
            </div>
          )}
        </div>
      </Card>

      <Tabs tabs={tabList} active={activeTab} onChange={setActiveTab} />

      <div className="mt-4 space-y-2">
        {activeTab === 'jobs' && (
          jobsLoading ? <LoadingSpinner /> :
          jobs.length === 0 ? <EmptyState icon={Briefcase} title="No jobs" description="No jobs found for this customer." /> :
          jobs.map((job) => (
            <Card key={job.id || job._id} onClick={() => navigate(`/jobs/${job.id || job._id}`)}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{job.title || job.job_title}</p>
                  <p className="text-xs text-gray-400">#{job.job_number || job.id}</p>
                </div>
                <Badge status={job.status} label={job.status?.replace(/_/g, ' ')} />
              </div>
            </Card>
          ))
        )}
        {activeTab === 'estimates' && (
          estimatesLoading ? <LoadingSpinner /> :
          estimates.length === 0 ? <EmptyState icon={FileText} title="No estimates" /> :
          estimates.map((est) => (
            <Card key={est.id || est._id} onClick={() => navigate(`/estimates/${est.id || est._id}`)}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">#{est.estimate_number || est.id}</p>
                  <p className="text-sm text-gray-500">{est.title || 'Estimate'}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{formatCurrency(est.total)}</p>
                  <Badge status={est.status} label={est.status} />
                </div>
              </div>
            </Card>
          ))
        )}
        {activeTab === 'invoices' && (
          invoicesLoading ? <LoadingSpinner /> :
          invoices.length === 0 ? <EmptyState icon={Receipt} title="No invoices" /> :
          invoices.map((inv) => (
            <Card key={inv.id || inv._id} onClick={() => navigate(`/invoices/${inv.id || inv._id}`)}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">#{inv.invoice_number || inv.id}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{formatCurrency(inv.total)}</p>
                  <Badge status={inv.status} label={inv.status} />
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Delete Modal */}
      <Modal
        isOpen={deleteModal}
        onClose={() => setDeleteModal(false)}
        title="Delete Customer"
        footer={
          <>
            <Button variant="outlined" onClick={() => setDeleteModal(false)}>Cancel</Button>
            <Button variant="danger" loading={deleting} onClick={handleDelete}>Delete</Button>
          </>
        }
      >
        <p className="text-gray-600">Are you sure you want to delete <strong>{name}</strong>? This action cannot be undone.</p>
      </Modal>
    </div>
  );
}
