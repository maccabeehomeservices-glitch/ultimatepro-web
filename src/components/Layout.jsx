import { Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';

export default function Layout() {
  const { company } = useAuth();

  return (
    <div className="min-h-dvh bg-gray-50">
      {/* Desktop sidebar */}
      <Sidebar />

      {/* Mobile top header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-12 bg-white border-b border-gray-200 flex items-center justify-center z-20">
        <span className="font-semibold text-[#0D1B2A] text-base">
          {company?.name || 'UltimatePro'}
        </span>
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
