import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Briefcase,
  Users,
  Phone,
  MoreHorizontal,
  Calendar,
  FileText,
  Receipt,
  DollarSign,
  BarChart2,
  CreditCard,
  BookOpen,
  Handshake,
  Truck,
  Settings,
  X,
  ClipboardList,
  Bell,
} from 'lucide-react';
import { notificationsApi } from '../lib/api';

const mainItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Home' },
  { to: '/jobs', icon: Briefcase, label: 'Jobs' },
  { to: '/customers', icon: Users, label: 'Customers' },
];

const moreItems = [
  { to: '/phone', icon: Phone, label: 'Phone' },
  { to: '/leads', icon: ClipboardList, label: 'Leads' },
  { to: '/calendar', icon: Calendar, label: 'Calendar' },
  { to: '/estimates', icon: FileText, label: 'Estimates' },
  { to: '/invoices', icon: Receipt, label: 'Invoices' },
  { to: '/payments', icon: DollarSign, label: 'Payments' },
  { to: '/reports', icon: BarChart2, label: 'Reports' },
  { to: '/payroll', icon: CreditCard, label: 'Payroll' },
  { to: '/pricebook', icon: BookOpen, label: 'Pricebook' },
  { to: '/network', icon: Handshake, label: 'Network' },
  { to: '/inventory', icon: Truck, label: 'Inventory' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function BottomNav() {
  const [showMore, setShowMore] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const fetchCount = () => notificationsApi.getUnreadCount()
      .then(r => setUnreadCount(r.data?.unread_count || 0))
      .catch(() => {});
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      {/* More sheet */}
      {showMore && (
        <div className="fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowMore(false)} />
          <div className="absolute bottom-[56px] left-0 right-0 bg-white rounded-t-2xl shadow-xl p-4 pb-6 z-50">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800">More</h3>
              <button
                onClick={() => setShowMore(false)}
                className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <X size={20} />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-y-4 gap-x-2">
              {moreItems.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={() => setShowMore(false)}
                  className={({ isActive }) =>
                    `flex flex-col items-center gap-1 p-2 rounded-xl min-h-[64px] justify-center text-center transition-colors ${
                      isActive ? 'text-[#1A73E8] bg-blue-50' : 'text-gray-500 hover:bg-gray-50'
                    }`
                  }
                >
                  <Icon size={22} />
                  <span className="text-xs font-medium leading-tight">{label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bottom nav bar */}
      <div className="fixed bottom-0 left-0 right-0 h-[56px] bg-white border-t border-gray-200 flex items-center z-30 md:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {mainItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center gap-0.5 h-full text-center transition-colors ${
                isActive ? 'text-[#1A73E8]' : 'text-gray-400'
              }`
            }
          >
            <Icon size={22} />
            <span className="text-[10px] font-medium">{label}</span>
          </NavLink>
        ))}
        <NavLink
          to="/notifications"
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center justify-center gap-0.5 h-full text-center transition-colors ${
              isActive ? 'text-[#1A73E8]' : 'text-gray-400'
            }`
          }
        >
          <div className="relative">
            <Bell size={22} />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-2 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {unreadCount > 99 ? '!' : unreadCount}
              </span>
            )}
          </div>
          <span className="text-[10px] font-medium">Alerts</span>
        </NavLink>
        <button
          onClick={() => setShowMore(!showMore)}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 h-full text-center transition-colors ${showMore ? 'text-[#1A73E8]' : 'text-gray-400'}`}
        >
          <MoreHorizontal size={22} />
          <span className="text-[10px] font-medium">More</span>
        </button>
      </div>
    </>
  );
}
