import { useState, useEffect } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import { notificationsApi } from '../lib/api';

export default function Layout() {
  const { company } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const fetchCount = () => notificationsApi.getUnreadCount()
      .then(r => setUnreadCount(r.data?.unread_count || 0))
      .catch(() => {});
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => { clearInterval(interval); };
  }, []);

  return (
    <div className="min-h-dvh bg-gray-50">
      {/* Desktop sidebar */}
      <Sidebar />

      {/* Mobile top header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-12 bg-white border-b border-gray-200 flex items-center px-4 z-20">
        <div className="flex-1 flex items-center justify-center">
          <span className="font-semibold text-[#0D1B2A] text-base">
            {company?.name || 'UltimatePro'}
          </span>
        </div>
        <Link to="/notifications" className="relative p-2 text-gray-500 hover:text-[#1A73E8] transition-colors">
          <Bell size={20} />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 bg-red-500 text-white text-[9px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center leading-none">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Link>
      </div>

      {/* Main content */}
      <div className="md:ml-[240px]">
        <main className="pt-12 md:pt-0 pb-[56px] md:pb-0 min-h-dvh">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom nav */}
      <BottomNav />
    </div>
  );
}
