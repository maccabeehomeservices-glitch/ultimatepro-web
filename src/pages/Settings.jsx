import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Building2,
  Users,
  Star,
  Globe,
  Tag,
  Wrench,
  CreditCard,
  UserCheck,
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
  { to: '/settings/job-types', icon: Wrench, label: 'Job Types' },
  { to: '/settings/membership-plans', icon: CreditCard, label: 'Membership Plans' },
  { to: '/settings/notifications', icon: Bell, label: 'Notifications' },
];

const emojiSettingsItems = [
  { to: '/settings/custom-fields', emoji: '🏷️', label: 'Custom Fields', desc: 'Add custom data fields to jobs, customers, estimates' },
  { to: '/settings/automation', emoji: '⚡', label: 'Ailot', desc: 'Smart Automation Rules' },
  { to: '/settings/integrations', emoji: '🔗', label: 'Integrations', desc: 'Connect QuickBooks Online and other tools' },
];

export default function Settings() {
  const [darkMode, setDarkMode] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('up_dark_mode')) || false;
    } catch { return false; }
  });

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-ink mb-4">Settings</h1>
      <div className="bg-card rounded-2xl shadow overflow-hidden">
        {settingsItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-4 px-4 py-4 min-h-[60px] transition-colors border-b border-hairline ${
                isActive ? 'bg-blue-50' : 'hover:bg-background'
              }`
            }
          >
            <div className="w-9 h-9 rounded-xl bg-background flex items-center justify-center flex-shrink-0">
              <Icon size={18} className="text-ink" />
            </div>
            <span className="flex-1 font-medium text-ink">{label}</span>
            <ChevronRight size={18} className="text-muted flex-shrink-0" />
          </NavLink>
        ))}

        {emojiSettingsItems.map(({ to, emoji, label, desc }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-4 px-4 py-4 min-h-[60px] transition-colors border-b border-hairline ${
                isActive ? 'bg-blue-50' : 'hover:bg-background'
              }`
            }
          >
            <div className="w-9 h-9 rounded-xl bg-background flex items-center justify-center flex-shrink-0 text-base">
              {emoji}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-ink">{label}</p>
              <p className="text-xs text-muted">{desc}</p>
            </div>
            <ChevronRight size={18} className="text-muted flex-shrink-0" />
          </NavLink>
        ))}

        {/* Appearance — inline toggle, no navigation */}
        <div className="flex items-center justify-between px-4 py-4 min-h-[60px]">
          <div className="flex items-center gap-4">
            <div className="w-9 h-9 rounded-xl bg-background flex items-center justify-center flex-shrink-0 text-base">
              🎨
            </div>
            <div>
              <div className="font-medium text-ink">Appearance</div>
              <div className="text-xs text-muted">Dark mode</div>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={darkMode}
              onChange={() => {
                const newMode = !darkMode;
                setDarkMode(newMode);
                localStorage.setItem('up_dark_mode', JSON.stringify(newMode));
                document.documentElement.classList.toggle('dark', newMode);
              }}
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-card after:border-hairline after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue" />
          </label>
        </div>
      </div>
      <div className="text-xs text-muted text-center pt-4 pb-8">
        UltimatePro v{__APP_VERSION__} · Built {__BUILD_TIME__}
      </div>
    </div>
  );
}
