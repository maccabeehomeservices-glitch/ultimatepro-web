// Smart date-range helpers for the Jobs dashboard.
// Mirror of android/.../JobScreens.kt dateBoundsFor() / sortFor() / humanizeScheduled().
// Returns local-naive ISO strings (yyyy-MM-ddTHH:mm:ss) — matches Android format
// so the backend's TIMESTAMPTZ comparison treats them as wall-clock local time.

const isoDate = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/** Returns [from, to] ISO 8601 bounds for the named range. Monday-Sunday week boundary. */
export function dateBoundsFor(range, customFrom = null, customTo = null) {
  const now = new Date();
  switch (range) {
    case 'today': {
      const d = isoDate(now);
      return [`${d}T00:00:00`, `${d}T23:59:59`];
    }
    case 'yesterday': {
      const y = new Date(now); y.setDate(now.getDate() - 1);
      const d = isoDate(y);
      return [`${d}T00:00:00`, `${d}T23:59:59`];
    }
    case 'this_week': {
      // Monday-Sunday — JS Sunday=0, Monday=1, ..., Saturday=6
      const dow = now.getDay();
      const daysToMon = (dow + 6) % 7; // 0 if Mon, 6 if Sun
      const mon = new Date(now); mon.setDate(now.getDate() - daysToMon);
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      return [`${isoDate(mon)}T00:00:00`, `${isoDate(sun)}T23:59:59`];
    }
    case 'last_week': {
      const dow = now.getDay();
      const daysToMon = (dow + 6) % 7;
      const mon = new Date(now); mon.setDate(now.getDate() - daysToMon - 7);
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      return [`${isoDate(mon)}T00:00:00`, `${isoDate(sun)}T23:59:59`];
    }
    case 'this_month': {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      const last  = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return [`${isoDate(first)}T00:00:00`, `${isoDate(last)}T23:59:59`];
    }
    case 'last_30d': {
      const start = new Date(now); start.setDate(now.getDate() - 30);
      return [`${isoDate(start)}T00:00:00`, `${isoDate(now)}T23:59:59`];
    }
    case 'custom':
      return [
        customFrom ? `${customFrom}T00:00:00` : null,
        customTo   ? `${customTo}T23:59:59`   : null,
      ];
    case 'all':
    default:
      return [null, null];
  }
}

/** Returns "upcoming" or "recent" based on whether the range is past-only. */
export function sortFor(range, customTo) {
  if (range === 'yesterday' || range === 'last_week') return 'recent';
  if (range === 'custom') {
    const today = isoDate(new Date());
    return customTo && customTo < today ? 'recent' : 'upcoming';
  }
  return 'upcoming';
}

/** Humanize a scheduled timestamp: null → "Unscheduled", today → "Today, 2:00 PM", etc. */
export function humanizeScheduled(iso) {
  if (!iso) return 'Unscheduled';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 'Unscheduled';

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const sched = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const daysDiff = Math.round((sched - today) / (1000 * 60 * 60 * 24));

  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (daysDiff === 0) return `Today, ${time}`;
  if (daysDiff === 1) return `Tomorrow, ${time}`;
  if (daysDiff >= -6 && daysDiff <= 6) {
    return `${d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · ${time}`;
  }
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · ${time}`;
}

export const DATE_CHIPS = [
  { id: 'today',      label: 'Today' },
  { id: 'yesterday',  label: 'Yesterday' },
  { id: 'this_week',  label: 'This Week' },
  { id: 'last_week',  label: 'Last Week' },
  { id: 'this_month', label: 'This Month' },
  { id: 'last_30d',   label: 'Last 30d' },
  { id: 'custom',     label: 'Custom' },
  { id: 'all',        label: 'All' },
];

export const STATUS_OPTIONS = [
  { id: 'scheduled',   label: 'Scheduled' },
  { id: 'en_route',    label: 'En Route' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'holding',     label: 'Holding' },
  { id: 'completed',   label: 'Completed' },
  { id: 'cancelled',   label: 'Cancelled' },
  { id: 'deleted',     label: 'Deleted' },
];
