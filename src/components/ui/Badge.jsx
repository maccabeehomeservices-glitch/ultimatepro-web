import { statusColor } from '../../lib/api';

// ── P3.1b — Chip/status ───────────────────────────────────────────────────────
// pearlFace (light) / card (dark) fill via the `chip` token · 1px border + text in
// the status's canonical color family · radius full · 11px w500.
// Job statuses come straight from lib/api.js statusColor() (the single source of
// truth, in lockstep with android AppColors + ui-design-system.md §1). Non-job
// statuses (invoice/estimate/membership/generic) map to the matching family.
// NOTE: this corrects the prior Badge drift — en_route was indigo, in_progress was
// orange — to the canonical Orange / Sky (law 4: fix drift to the Android values).
const extraColor = {
  draft: '#6B7280', sent: '#2563EB', approved: '#16A34A', paid: '#16A34A',
  unpaid: '#DC2626', overdue: '#DC2626', active: '#16A34A', inactive: '#9CA3AF',
  partial: '#F97316', void: '#6B7280',
};
const JOB_STATUSES = new Set([
  'unscheduled', 'scheduled', 'en_route', 'in_progress', 'holding',
  'completed', 'cancelled', 'deleted',
]);

export default function Badge({ status, label, variant, className = '' }) {
  const key = (status || variant || '').toLowerCase().replace(/ /g, '_');
  const color = JOB_STATUSES.has(key)
    ? statusColor(key)
    : (extraColor[key] || '#7A7466');
  const displayLabel = label || status || variant || '';

  return (
    <span
      className={`inline-flex items-center bg-chip px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${className}`}
      style={{ color, borderColor: color }}
    >
      {displayLabel}
    </span>
  );
}
