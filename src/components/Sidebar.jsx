import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  UpDashboard, UpJobs, UpCustomers, UpCalendar, UpEstimate, UpCard, UpPhone, UpBell,
} from './ui/icons';
import {
  Receipt,
  BarChart2,
  CreditCard,
  BookOpen,
  Handshake,
  Truck,
  Settings,
  LogOut,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import Avatar from './ui/Avatar';
import { notificationsApi } from '../lib/api';

const navItems = [
  { to: '/dashboard', icon: UpDashboard, label: 'Dashboard' },
  { to: '/jobs', icon: UpJobs, label: 'Jobs' },
  { to: '/customers', icon: UpCustomers, label: 'Customers' },
  { to: '/leads', icon: ClipboardList, label: 'Leads' },
  { to: '/calendar', icon: UpCalendar, label: 'Calendar' },
  { to: '/estimates', icon: UpEstimate, label: 'Estimates' },
  { to: '/invoices', icon: Receipt, label: 'Invoices' },
  { to: '/payments', icon: UpCard, label: 'Payments', section: 'payments_refunds' },
  { to: '/phone', icon: UpPhone, label: 'Phone / SMS' },
  { to: '/reports', icon: BarChart2, label: 'Reports', section: 'reports' },
  { to: '/payroll', icon: CreditCard, label: 'Payroll', section: 'accounting_earnings' },
  { to: '/pricebook', icon: BookOpen, label: 'Pricebook' },
  { to: '/network', icon: Handshake, label: 'Network' },
  { to: '/inventory', icon: Truck, label: 'Inventory' },
  { to: '/settings', icon: Settings, label: 'Settings', section: 'team_settings' },
];

export default function Sidebar({ collapsed = false, onToggle }) {
  const { user, company, logout, can } = useAuth();
  const navigate = useNavigate();
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

  const userName = user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : '';

  const bellButton = (
    <button
      onClick={() => navigate('/notifications')}
      className="relative p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
      aria-label="Notifications"
      title={collapsed ? 'Notifications' : undefined}
    >
      <UpBell size={18} />
      {unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
          {unreadCount > 99 ? '!' : unreadCount}
        </span>
      )}
    </button>
  );

  const toggleButton = (
    <button
      onClick={onToggle}
      className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
      aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
    >
      {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
    </button>
  );

  return (
    <div
      className={`hidden md:flex flex-col fixed left-0 top-0 bottom-0 ${
        collapsed ? 'w-[64px]' : 'w-[240px]'
      } bg-[#0D1B2A] text-white z-20 overflow-hidden transition-[width] duration-200 ease-in-out`}
    >
      {/* Logo / Brand + Bell + Toggle */}
      {collapsed ? (
        <div className="px-2 py-3 border-b border-white/10 flex flex-col items-center gap-2">
          <div className="w-9 h-9 rounded-md bg-white/10 flex items-center justify-center font-bold text-white text-base">U</div>
          {bellButton}
          {toggleButton}
        </div>
      ) : (
        <div className="px-5 py-5 border-b border-white/10 flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-white">UltimatePro</h1>
            {company && (
              <p className="text-xs text-white/50 mt-0.5 truncate">{company.name}</p>
            )}
          </div>
          <div className="flex items-center gap-1 ml-2">
            {bellButton}
            {toggleButton}
          </div>
        </div>
      )}

      {/* Nav links */}
      <nav className="flex-1 overflow-y-auto py-3">
        {navItems.filter(item => !item.section || can(item.section, 'view')).map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
              `flex items-center text-sm font-medium transition-colors ${
                collapsed
                  ? `justify-center px-2 py-3 ${
                      isActive
                        ? 'text-white bg-white/10 border-l-4 border-[#2D6FC2]'
                        : 'text-white/60 hover:text-white hover:bg-white/5 border-l-4 border-transparent'
                    }`
                  : `gap-3 px-4 py-2.5 ${
                      isActive
                        ? 'text-white bg-white/10 border-l-4 border-[#2D6FC2]'
                        : 'text-white/60 hover:text-white hover:bg-white/5 border-l-4 border-transparent'
                    }`
              }`
            }
          >
            <Icon size={18} className="flex-shrink-0" />
            {!collapsed && <span className="truncate">{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* User section */}
      {collapsed ? (
        <div className="p-3 border-t border-white/10 flex flex-col items-center gap-2">
          <div title={userName}>
            <Avatar name={userName} size="sm" color="#2D6FC2" />
          </div>
          <button
            onClick={logout}
            className="p-2 rounded-md text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Sign Out"
            title="Sign Out"
          >
            <LogOut size={18} />
          </button>
        </div>
      ) : (
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3 mb-3">
            <Avatar name={userName} size="sm" color="#2D6FC2" />
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
      )}
    </div>
  );
}
