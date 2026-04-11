import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Briefcase, Receipt, FileText, Calendar, Trash2, CheckCheck } from 'lucide-react';
import { notificationsApi } from '../lib/api';
import { Card, EmptyState, LoadingSpinner } from '../components/ui';
import { useSnackbar } from '../components/ui/Snackbar';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function entityLink(n) {
  if (!n.entity_id) return null;
  if (n.entity_type === 'job') return `/jobs/${n.entity_id}`;
  if (n.entity_type === 'invoice') return `/invoices/${n.entity_id}`;
  if (n.entity_type === 'estimate') return `/estimates/${n.entity_id}`;
  return null;
}

function TypeIcon({ type, entity_type }) {
  const t = entity_type || type || '';
  if (t.includes('job')) return <Briefcase size={16} className="text-blue-500" />;
  if (t.includes('invoice') || t.includes('payment')) return <Receipt size={16} className="text-green-500" />;
  if (t.includes('estimate')) return <FileText size={16} className="text-purple-500" />;
  if (t.includes('booking')) return <Calendar size={16} className="text-orange-500" />;
  return <Bell size={16} className="text-gray-400" />;
}

export default function Notifications() {
  const navigate = useNavigate();
  const { showSnack } = useSnackbar();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await notificationsApi.list();
      setNotifications(res.data.notifications || []);
      setUnreadCount(res.data.unread_count || 0);
    } catch {
      showSnack('Failed to load notifications', 'error');
    } finally {
      setLoading(false);
    }
  }, [showSnack]);

  useEffect(() => { load(); }, [load]);

  async function handleClick(n) {
    if (!n.read) {
      await notificationsApi.markRead(n.id).catch(() => {});
      setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x));
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
    const link = entityLink(n);
    if (link) navigate(link);
  }

  async function handleDelete(e, id) {
    e.stopPropagation();
    await notificationsApi.delete(id).catch(() => {});
    const wasUnread = notifications.find(n => n.id === id && !n.read);
    setNotifications(prev => prev.filter(n => n.id !== id));
    if (wasUnread) setUnreadCount(prev => Math.max(0, prev - 1));
  }

  async function handleMarkAllRead() {
    await notificationsApi.markAllRead().catch(() => {});
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
    showSnack('All marked as read', 'success');
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-gray-900">Notifications</h1>
          {unreadCount > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold rounded-full px-2 py-0.5">
              {unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="flex items-center gap-1.5 text-sm text-[#1A73E8] hover:underline font-medium"
          >
            <CheckCheck size={15} />
            Mark all read
          </button>
        )}
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : notifications.length === 0 ? (
        <EmptyState icon={Bell} title="No notifications" description="You're all caught up!" />
      ) : (
        <div className="space-y-2">
          {notifications.map(n => {
            const link = entityLink(n);
            return (
              <div
                key={n.id}
                onClick={() => handleClick(n)}
                className={`bg-white rounded-2xl shadow-sm border transition-colors flex items-start gap-3 p-3.5 ${
                  link ? 'cursor-pointer hover:bg-gray-50 active:bg-gray-100' : ''
                } ${n.read ? 'border-gray-100' : 'border-blue-100 bg-blue-50/30'}`}
              >
                <div className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${n.read ? 'bg-gray-100' : 'bg-blue-100'}`}>
                  <TypeIcon type={n.type} entity_type={n.entity_type} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium leading-snug ${n.read ? 'text-gray-700' : 'text-gray-900'}`}>
                    {n.title}
                    {!n.read && <span className="ml-2 inline-block w-2 h-2 rounded-full bg-blue-500 align-middle" />}
                  </p>
                  {n.body && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.body}</p>}
                  <p className="text-xs text-gray-400 mt-1">{timeAgo(n.created_at)}</p>
                </div>
                <button
                  onClick={(e) => handleDelete(e, n.id)}
                  className="flex-shrink-0 p-1 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
