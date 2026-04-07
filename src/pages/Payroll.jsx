import { useState } from 'react';
import { format } from 'date-fns';
import { CreditCard } from 'lucide-react';
import { useGet } from '../hooks/useApi';
import { Card, LoadingSpinner, EmptyState, Avatar } from '../components/ui';

function formatCurrency(v) {
  return '$' + Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function Payroll() {
  const today = new Date();
  const [from, setFrom] = useState(format(new Date(today.getFullYear(), today.getMonth(), 1), 'yyyy-MM-dd'));
  const [to, setTo] = useState(format(today, 'yyyy-MM-dd'));

  const url = `/payroll/summary?from=${from}&to=${to}`;
  const { data, loading } = useGet(url, [from, to]);

  const techs = data?.technicians || data?.payroll || data || [];

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-4">Payroll</h1>

      {/* Date Range */}
      <Card className="mb-4">
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A73E8] min-h-[44px]" />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A73E8] min-h-[44px]" />
          </div>
        </div>
      </Card>

      {loading ? (
        <LoadingSpinner />
      ) : techs.length === 0 ? (
        <EmptyState icon={CreditCard} title="No payroll data" description="Payroll summary will appear here." />
      ) : (
        <>
          <div className="space-y-2 mb-4">
            {techs.map((tech, i) => {
              const name = `${tech.first_name || ''} ${tech.last_name || ''}`.trim() || tech.name || 'Tech';
              return (
                <Card key={tech.id || tech._id || i}>
                  <div className="flex items-center gap-3">
                    <Avatar name={name} size="md" color="#1A73E8" />
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">{name}</p>
                      <p className="text-sm text-gray-500">{tech.total_jobs || tech.jobs_completed || 0} jobs completed</p>
                    </div>
                    <p className="font-bold text-[#1A73E8] text-lg">{formatCurrency(tech.earnings || tech.total_pay || tech.pay || 0)}</p>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Summary Table */}
          <div className="bg-white rounded-2xl shadow overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Technician</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Jobs</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Earnings</th>
                </tr>
              </thead>
              <tbody>
                {techs.map((tech, i) => {
                  const name = `${tech.first_name || ''} ${tech.last_name || ''}`.trim() || tech.name || 'Tech';
                  return (
                    <tr key={i} className="border-b border-gray-50 last:border-0">
                      <td className="px-4 py-2.5 text-sm font-medium text-gray-900">{name}</td>
                      <td className="px-4 py-2.5 text-sm text-gray-600">{tech.total_jobs || tech.jobs_completed || 0}</td>
                      <td className="px-4 py-2.5 text-sm font-semibold text-[#1A73E8]">{formatCurrency(tech.earnings || tech.total_pay || 0)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
