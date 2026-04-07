import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowLeft, Edit } from 'lucide-react';
import { useGet, useMutation } from '../hooks/useApi';
import { Card, Badge, Button, Modal, LoadingSpinner, Tabs } from '../components/ui';
import { useSnackbar } from '../components/ui/Snackbar';

const JOB_STATUSES = [
  { value: 'unscheduled', label: 'Unscheduled' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'en_route', label: 'En Route' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'holding', label: 'Holding' },
  { value: 'cancelled', label: 'Cancelled' },
];

const tabList = [
  { id: 'details', label: 'Details' },
  { id: 'history', label: 'History' },
];

export default function JobDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showSnack } = useSnackbar();
  const { data: job, loading, refetch } = useGet(`/jobs/${id}`);
  const { mutate, loading: mutating } = useMutation();
  const [statusModal, setStatusModal] = useState(false);
  const [activeTab, setActiveTab] = useState('details');

  const jobData = job?.job || job;

  async function handleStatusChange(status) {
    try {
      await mutate('put', `/jobs/${id}`, { status });
      setStatusModal(false);
      refetch();
      showSnack('Status updated', 'success');
    } catch {
      showSnack('Failed to update status', 'error');
    }
  }

  async function handleCreateEstimate() {
    try {
      const result = await mutate('post', '/estimates', { job_id: id, customer_id: jobData?.customer_id });
      navigate(`/estimates/${result?.estimate?.id || result?.id}`);
    } catch {
      showSnack('Failed to create estimate', 'error');
    }
  }

  if (loading) return <LoadingSpinner fullPage />;
  if (!jobData) return <div className="p-4 text-gray-500">Job not found.</div>;

  return (
    <div className="p-4 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-600"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-gray-900 text-lg truncate">{jobData.title || jobData.job_title}</h1>
          <p className="text-sm text-gray-400">#{jobData.job_number || jobData.id}</p>
        </div>
        <button
          onClick={() => navigate(`/jobs/${id}/edit`)}
          className="p-2 rounded-xl hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-600"
        >
          <Edit size={20} />
        </button>
      </div>

      <Tabs tabs={tabList} active={activeTab} onChange={setActiveTab} />

      <div className="mt-4 space-y-4">
        {activeTab === 'details' && (
          <>
            {/* Job Info */}
            <Card>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge status={jobData.status} label={jobData.status?.replace(/_/g, ' ')} />
                </div>
                {jobData.description && (
                  <p className="text-sm text-gray-600">{jobData.description}</p>
                )}
                {(jobData.scheduled_date || jobData.scheduled_at) && (
                  <div>
                    <p className="text-xs text-gray-400 font-medium uppercase">Scheduled</p>
                    <p className="text-sm text-gray-800">
                      {format(new Date(jobData.scheduled_date || jobData.scheduled_at), 'PPp')}
                    </p>
                  </div>
                )}
                {(jobData.address || jobData.service_address) && (
                  <div>
                    <p className="text-xs text-gray-400 font-medium uppercase">Address</p>
                    <p className="text-sm text-gray-800">{jobData.address || jobData.service_address}</p>
                  </div>
                )}
              </div>
            </Card>

            {/* Customer Card */}
            {(jobData.customer || jobData.customer_id) && (
              <Card
                onClick={() => navigate(`/customers/${jobData.customer_id || jobData.customer?.id}`)}
              >
                <p className="text-xs text-gray-400 font-medium uppercase mb-1">Customer</p>
                <p className="font-semibold text-gray-900">
                  {jobData.customer_name || jobData.customer?.name || 'View Customer'}
                </p>
                {jobData.customer?.phone && (
                  <p className="text-sm text-gray-500">{jobData.customer.phone}</p>
                )}
              </Card>
            )}

            {/* Actions */}
            <div className="flex flex-col gap-2">
              <Button onClick={() => setStatusModal(true)} className="w-full">
                Update Status
              </Button>
              {!jobData.has_estimate && (
                <Button
                  variant="outlined"
                  onClick={handleCreateEstimate}
                  loading={mutating}
                  className="w-full"
                >
                  Create Estimate
                </Button>
              )}
            </div>
          </>
        )}

        {activeTab === 'history' && (
          <Card>
            <p className="text-sm text-gray-500">Job history will appear here.</p>
          </Card>
        )}
      </div>

      {/* Status Modal */}
      <Modal isOpen={statusModal} onClose={() => setStatusModal(false)} title="Update Status">
        <div className="space-y-2">
          {JOB_STATUSES.map((s) => (
            <button
              key={s.value}
              onClick={() => handleStatusChange(s.value)}
              className={`w-full text-left px-4 py-3 rounded-xl transition-colors min-h-[44px] flex items-center gap-3 ${
                jobData.status === s.value
                  ? 'bg-blue-50 text-[#1A73E8] font-semibold'
                  : 'hover:bg-gray-50 text-gray-700'
              }`}
            >
              <Badge status={s.value} label={s.label} />
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}
