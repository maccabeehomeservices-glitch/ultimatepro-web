import { formatInTimeZone } from 'date-fns-tz';

export const DEFAULT_TZ = 'America/New_York';

// The zone a job should display in: backend-resolved effective zone → its raw zone → default.
export const jobZone = (job) => job?.effective_timezone || job?.job_timezone || DEFAULT_TZ;

// Format a stored UTC instant in the job's zone. `fmt` is a date-fns format string;
// use a `zzz` token for the zone label (e.g. "2:00 PM EDT").
export function formatInJobZone(iso, job, fmt) {
  if (!iso) return '';
  try {
    return formatInTimeZone(new Date(iso), jobZone(job), fmt);
  } catch {
    return '';
  }
}
