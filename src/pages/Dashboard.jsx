import { useNavigate } from 'react-router-dom';
import { useGet } from '../hooks/useApi';
import { useAuth } from '../hooks/useAuth';
import { Card, Badge, LoadingSpinner, EmptyState } from '../components/ui';
import { Briefcase, DollarSign, Receipt, Calendar } from 'lucide-react';

function formatCurrency(amount) {
  if (amount == null) return '$0.00';
  return '$' + Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: dashData, loading: dashLoading } = useGet('/reports/dashboard');
  const { data: jobsData, loading: jobsLoading } = useGet('/jobs?status=scheduled,en_route,in_progress&limit=10');

  const stats = dashData?.stats || dashData || {};
  const activeJobs = jobsData?.jobs || jobsData || [];

  return (
    <div className="p-4 space-y-6 max-w-5xl mx-auto">
      {/* Greeting */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">
          Hello, {user?.first_name || 'there'} 👋
        </h2>
        <p className="text-gray-500 text-sm">Here's what's happening today.</p>
      </div>

      {/* Stats cards */}
      {dashLoading ? (
        <LoadingSpinner />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <div className="flex flex-col gap-1">
              <div className="p-2 bg-blue-50 rounded-lg w-fit">
                <Briefcase size={18} className="text-[#1A73E8]" />
              </div>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {stats.today_jobs ?? stats.todayJobs ?? 0}
              </p>
              <p className="text-xs text-gray-500">Today's Jobs</p>
            </div>
          </Card>
          <Card>
            <div className="flex flex-col gap-1">
              <div className="p-2 bg-green-50 rounded-lg w-fit">
                <DollarSign size={18} className="text-green-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {formatCurrency(stats.month_revenue ?? stats.monthRevenue ?? 0)}
              </p>
              <p className="text-xs text-gray-500">This Month</p>
            </div>
          </Card>
          <Card>
            <div className="flex flex-col gap-1">
              <div className="p-2 bg-purple-50 rounded-lg w-fit">
                <Receipt size={18} className="text-purple-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {stats.open_invoices ?? stats.openInvoices ?? 0}
              </p>
              <p className="text-xs text-gray-500">Open Invoices</p>
            </div>
          </Card>
          <Card>
            <div className="flex flex-col gap-1">
              <div className="p-2 bg-amber-50 rounded-lg w-fit">
                <Calendar size={18} className="text-amber-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {stats.scheduled_today ?? stats.scheduledToday ?? 0}
              </p>
              <p className="text-xs text-gray-500">Scheduled Today</p>
            </div>
          </Card>
        </div>
      )}

      {/* Active Jobs */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900">Active Jobs</h3>
          <button
            onClick={() => navigate('/jobs')}
            className="text-sm text-[#1A73E8] font-medium"
          >
            View all
          </button>
        </div>
        {jobsLoading ? (
          <LoadingSpinner />
        ) : activeJobs.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title="No active jobs"
            description="Jobs that are scheduled or in progress will appear here."
          />
        ) : (
          <div className="space-y-2">
            {activeJobs.map((job) => (
              <Card key={job.id || job._id} onClick={() => navigate(`/jobs/${job.id || job._id}`)}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">
                      {job.title || job.job_title || 'Untitled Job'}
                    </p>
                    <p className="text-sm text-gray-500 truncate">
                      {job.customer_name || job.customer?.name || ''}
                    </p>
                    {(job.address || job.service_address) && (
                      <p className="text-xs text-gray-400 truncate mt-0.5">
                        {job.address || job.service_address}
                      </p>
                    )}
                  </div>
                  <Badge status={job.status} label={job.status?.replace(/_/g, ' ')} />
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
