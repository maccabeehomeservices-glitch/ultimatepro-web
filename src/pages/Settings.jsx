import { NavLink } from 'react-router-dom';
import {
  Building2,
  Users,
  Star,
  Globe,
  Tag,
  CreditCard,
  UserCheck,
  Palette,
  Bell,
  ChevronRight,
} from 'lucide-react';

const settingsItems = [
  { to: '/settings/company', icon: Building2, label: 'Company Profile' },
  { to: '/settings/team', icon: Users, label: 'Team Members' },
  { to: '/settings/technicians', icon: UserCheck, label: 'Roster Technicians' },
  { to: '/settings/review-platforms', icon: Star, label: 'Review Platforms' },
  { to: '/settings/online-booking', icon: Globe, label: 'Online Booking' },
  { to: '/settings/job-sources', icon: Tag, label: 'Job Sources' },
  { to: '/settings/membership-plans', icon: CreditCard, label: 'Membership Plans' },
  { to: '/settings/notifications', icon: Bell, label: 'Notifications' },
  { to: '/settings/appearance', icon: Palette, label: 'Appearance' },
];

export default function Settings() {
  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-4">Settings</h1>
      <div className="bg-white rounded-2xl shadow overflow-hidden">
        {settingsItems.map(({ to, icon: Icon, label }, i) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-4 px-4 py-4 min-h-[60px] transition-colors ${
                i !== settingsItems.length - 1 ? 'border-b border-gray-100' : ''
              } ${isActive ? 'bg-blue-50' : 'hover:bg-gray-50'}`
            }
          >
            <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
              <Icon size={18} className="text-gray-600" />
            </div>
            <span className="flex-1 font-medium text-gray-900">{label}</span>
            <ChevronRight size={18} className="text-gray-400 flex-shrink-0" />
          </NavLink>
        ))}
      </div>
    </div>
  );
}
