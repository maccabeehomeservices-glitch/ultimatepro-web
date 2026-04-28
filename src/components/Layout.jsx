import { useState, useEffect, useCallback } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import { notificationsApi } from '../lib/api';

const STORAGE_KEY = 'up_sidebar_collapsed';

function readInitialCollapsed() {
  if (typeof window === 'undefined') return false;
  // Mirror index.html anti-flash script exactly so React state agrees with
  // the pre-mount data-sidebar attribute.
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'true') return true;
    if (saved === 'false') return false;
    return window.innerWidth < 1024; // Apple HIG default
  } catch {
    return false;
  }
}

export default function Layout() {
  const { company } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [collapsed, setCollapsed] = useState(readInitialCollapsed);
  const [vw, setVw] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1024));

  useEffect(() => {
    const fetchCount = () => notificationsApi.getUnreadCount()
      .then(r => setUnreadCount(r.data?.unread_count || 0))
      .catch(() => {});
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => { clearInterval(interval); };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onResize = () => setVw(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Keep <html data-sidebar> in sync with React state (also covers any divergence
  // between the inline script and React on first render).
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (collapsed) document.documentElement.setAttribute('data-sidebar', 'collapsed');
    else document.documentElement.removeAttribute('data-sidebar');
  }, [collapsed]);

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem(STORAGE_KEY, String(next)); } catch {}
      return next;
    });
  }, []);

  const sidebarWidth = collapsed ? 64 : 240;
  const isDesktop = vw >= 768;

  return (
    <div className="min-h-dvh bg-gray-50">
      {/* Desktop sidebar (auto-hidden below md via internal class) */}
      <Sidebar collapsed={collapsed} onToggle={toggle} />

      {/* Mobile top bar — unchanged */}
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

      {/* Main content — margin-left animates with sidebar width on desktop */}
      <div
        className="transition-[margin-left] duration-200 ease-in-out"
        style={{ marginLeft: isDesktop ? sidebarWidth : 0 }}
      >
        <main className="pt-12 md:pt-0 pb-[56px] md:pb-0 min-h-dvh">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom nav — unchanged */}
      <BottomNav />
    </div>
  );
}
