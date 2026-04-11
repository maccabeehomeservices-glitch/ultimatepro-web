import { NavLink } from 'react-router-dom';
import { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Briefcase,
  Users,
  Calendar,
  FileText,
  Receipt,
  DollarSign,
  Phone,
  BarChart2,
  CreditCard,
  BookOpen,
  Handshake,
  Truck,
  Settings,
  LogOut,
  ClipboardList,
  Bell,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import Avatar from './ui/Avatar';
import { notificationsApi } from '../lib/api';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/jobs', icon: Briefcase, label: 'Jobs' },
  { to: '/customers', icon: Users, label: 'Customers' },
  { to: '/leads', icon: ClipboardList, label: 'Leads' },
  { to: '/calendar', icon: Calendar, label: 'Calendar' },
  { to: '/estimates', icon: FileText, label: 'Estimates' },
  { to: '/invoices', icon: Receipt, label: 'Invoices' },
  { to: '/payments', icon: DollarSign, label: 'Payments' },
  { to: '/phone', icon: Phone, label: 'Phone / SMS' },
  { to: '/reports', icon: BarChart2, label: 'Reports' },
  { to: '/payroll', icon: CreditCard, label: 'Payroll' },
  { to: '/pricebook', icon: BookOpen, label: 'Pricebook' },
  { to: '/network', icon: Handshake, label: 'Network' },
  { to: '/inventory', icon: Truck, label: 'Inventory' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar() {
  const { user, company, logout } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let active = true;
    const fetch = () => notificationsApi.getUnreadCount()
      .then(r => { if (active) setUnreadCount(r.data.unread_count || 0); })
      .catch(() => {});
    fetch();
    const interval = setInterval(fetch, 30000);
    return () => { active = false; clearInterval(interval); };
  }, []);

  return (
    <div className="hidden md:flex flex-col fixed left-0 top-0 bottom-0 w-[240px] bg-[#0D1B2A] text-white z-20">
      {/* Logo / Brand */}
      <div className="px-5 py-5 border-b border-white/10">
        <h1 className="text-xl font-bold text-white">UltimatePro</h1>
        {company && (
          <p className="text-xs text-white/50 mt-0.5 truncate">{company.name}</p>
        )}
      </div>

      {/* Nav links */}
      <nav className="flex-1 overflow-y-auto py-3">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'text-white bg-white/10 border-l-4 border-[#1A73E8]'
                  : 'text-white/60 hover:text-white hover:bg-white/5 border-l-4 border-transparent'
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Notifications link */}
      <div className="px-3 pb-2">
        <NavLink
          to="/notifications"
          className={({ isActive }) =>
            `flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors rounded-lg ${
              isActive
                ? 'text-white bg-white/10 border-l-4 border-[#1A73E8]'
                : 'text-white/60 hover:text-white hover:bg-white/5 border-l-4 border-transparent'
            }`
          }
        >
          <Bell size={18} />
          Notifications
          {unreadCount > 0 && (
            <span className="ml-auto bg-red-500 text-white text-xs font-bold rounded-full px-1.5 py-0.5 leading-none">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </NavLink>
      </div>

      {/* User section */}
      <div className="p-4 border-t border-white/10">
        <div className="flex items-center gap-3 mb-3">
          <Avatar
            name={user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : ''}
            size="sm"
            color="#1A73E8"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {user?.first_name} {user?.last_name}
            </p>
            <p className="text-xs text-white/40 truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-2 w-full text-sm text-white/60 hover:text-white py-2 transition-colors"
        >
          <LogOut size={16} />
          Sign Out
        </button>
      </div>
    </div>
  );
}
