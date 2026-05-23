// Shared period helpers for the per-actor report screens (TeamReport,
// RosterReport, SourceReport, …). Returns 'yyyy-MM-dd' strings so the
// backend's ::date casting treats the bounds as inclusive calendar days.
//
// Monday-anchored weeks, calendar-month boundaries (full month for
// this_month, prior calendar month for last_month).

import { format } from 'date-fns';

const fmtDate = (d) => format(d, 'yyyy-MM-dd');

export function buildPeriods(now = new Date()) {
  const today = now;
  const dayIdx = (today.getDay() + 6) % 7;
  const weekStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - dayIdx);

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd   = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastMonthEnd   = new Date(today.getFullYear(), today.getMonth(), 0);

  const q = Math.floor(today.getMonth() / 3);
  const quarterStart = new Date(today.getFullYear(), q * 3, 1);

  const yearStart = new Date(today.getFullYear(), 0, 1);

  return {
    this_week:    { from: fmtDate(weekStart),      to: fmtDate(today) },
    this_month:   { from: fmtDate(monthStart),     to: fmtDate(monthEnd) },
    last_month:   { from: fmtDate(lastMonthStart), to: fmtDate(lastMonthEnd) },
    this_quarter: { from: fmtDate(quarterStart),   to: fmtDate(today) },
    this_year:    { from: fmtDate(yearStart),      to: fmtDate(today) },
  };
}

export const PERIOD_CHIPS = [
  { id: 'this_week',    label: 'This Week' },
  { id: 'this_month',   label: 'This Month' },
  { id: 'last_month',   label: 'Last Month' },
  { id: 'this_quarter', label: 'This Quarter' },
  { id: 'this_year',    label: 'This Year' },
];

// Convenience: get a single named period without building all five.
export function periodFor(chipId, now = new Date()) {
  return buildPeriods(now)[chipId] || buildPeriods(now).this_month;
}
