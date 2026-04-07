import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, isSameMonth, isSameDay, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalIcon } from 'lucide-react';
import { useGet } from '../hooks/useApi';
import { Modal, LoadingSpinner, Badge } from '../components/ui';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function buildCalendarDays(currentMonth) {
  const start = startOfWeek(startOfMonth(currentMonth));
  const end = endOfWeek(endOfMonth(currentMonth));
  const days = [];
  let day = start;
  while (day <= end) {
    days.push(day);
    day = addDays(day, 1);
  }
  return days;
}

export default function Calendar() {
  const navigate = useNavigate();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);
  const touchStart = useRef(null);

  const from = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
  const to = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
  const { data, loading } = useGet(`/schedules?from=${from}&to=${to}`, [from, to]);

  const schedules = data?.schedules || data || [];

  function getJobsForDay(day) {
    return schedules.filter((s) => {
      const d = s.scheduled_date || s.date || s.start_date;
      if (!d) return false;
      try { return isSameDay(parseISO(d), day); } catch { return false; }
    });
  }

  function handleTouchStart(e) {
    touchStart.current = e.touches[0].clientX;
  }

  function handleTouchEnd(e) {
    if (touchStart.current == null) return;
    const diff = touchStart.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) setCurrentMonth((m) => addMonths(m, 1));
      else setCurrentMonth((m) => subMonths(m, 1));
    }
    touchStart.current = null;
  }

  const days = buildCalendarDays(currentMonth);
  const selectedJobs = selectedDay ? getJobsForDay(selectedDay) : [];

  return (
    <div className="p-4 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setCurrentMonth((m) => subMonths(m, 1))} className="p-2 rounded-xl hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-600">
          <ChevronLeft size={20} />
        </button>
        <h2 className="text-lg font-bold text-gray-900">{format(currentMonth, 'MMMM yyyy')}</h2>
        <button onClick={() => setCurrentMonth((m) => addMonths(m, 1))} className="p-2 rounded-xl hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-600">
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Day names */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_NAMES.map((d) => (
          <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div
        className="grid grid-cols-7 border border-gray-100 rounded-2xl overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {days.map((day, i) => {
          const dayJobs = getJobsForDay(day);
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isSelected = selectedDay && isSameDay(day, selectedDay);
          const isToday = isSameDay(day, new Date());
          return (
            <button
              key={i}
              onClick={() => setSelectedDay(isSameDay(day, selectedDay) ? null : day)}
              className={`min-h-[52px] p-1.5 flex flex-col items-center border-r border-b border-gray-100 last:border-r-0 transition-colors ${
                isSelected ? 'bg-blue-50' : isToday ? 'bg-amber-50' : 'bg-white hover:bg-gray-50'
              } ${!isCurrentMonth ? 'opacity-40' : ''}`}
            >
              <span className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-[#1A73E8] text-white' : 'text-gray-700'}`}>
                {format(day, 'd')}
              </span>
              {dayJobs.length > 0 && (
                <div className="flex gap-0.5 flex-wrap justify-center mt-0.5">
                  {dayJobs.slice(0, 3).map((_, idx) => (
                    <span key={idx} className="w-1.5 h-1.5 rounded-full bg-[#1A73E8]" />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {loading && <LoadingSpinner />}

      {/* Selected day modal */}
      <Modal
        isOpen={Boolean(selectedDay)}
        onClose={() => setSelectedDay(null)}
        title={selectedDay ? format(selectedDay, 'EEEE, MMMM d') : ''}
      >
        {selectedJobs.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <CalIcon size={32} className="mx-auto mb-2 opacity-50" />
            <p>No jobs scheduled for this day.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {selectedJobs.map((job) => (
              <button
                key={job.id || job._id}
                onClick={() => { setSelectedDay(null); navigate(`/jobs/${job.id || job._id}`); }}
                className="w-full text-left p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{job.title || job.job_title}</p>
                    <p className="text-xs text-gray-500">{job.customer_name || job.customer?.name}</p>
                  </div>
                  <Badge status={job.status} label={job.status?.replace(/_/g, ' ')} />
                </div>
              </button>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
