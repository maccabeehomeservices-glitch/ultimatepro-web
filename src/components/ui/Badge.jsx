const statusStyles = {
  unscheduled: 'bg-gray-100 text-gray-600',
  scheduled: 'bg-blue-100 text-blue-700',
  en_route: 'bg-indigo-100 text-indigo-700',
  in_progress: 'bg-orange-100 text-orange-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  holding: 'bg-amber-100 text-amber-700',
  invoiced: 'bg-purple-100 text-purple-700',
  deleted: 'bg-gray-100 text-gray-500',
  draft: 'bg-gray-100 text-gray-600',
  sent: 'bg-blue-100 text-blue-700',
  approved: 'bg-green-100 text-green-700',
  paid: 'bg-green-100 text-green-700',
  unpaid: 'bg-red-100 text-red-700',
  overdue: 'bg-red-100 text-red-700',
  active: 'bg-green-100 text-green-700',
  inactive: 'bg-gray-100 text-gray-500',
};

export default function Badge({ status, label, variant, className = '' }) {
  const key = (status || variant || '').toLowerCase().replace(/ /g, '_');
  const styles = statusStyles[key] || 'bg-gray-100 text-gray-600';
  const displayLabel = label || status || variant || '';

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles} ${className}`}>
      {displayLabel}
    </span>
  );
}
