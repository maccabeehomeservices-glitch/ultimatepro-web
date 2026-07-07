import { Outlet, Link } from 'react-router-dom';
import { ShieldOff } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

// Route-level permission gate (P2.1h). Mirrors the backend requirePermission(section,level)
// so a page whose data the server would 403 shows a clean denial instead of a broken shell
// that fires failing fetches. Nav hides the same items via can() — this is the direct-URL
// defense-in-depth. Renders inside <Layout> so the sidebar/nav stay visible.
export default function RequirePermission({ section, level = 'view', children }) {
  const { can } = useAuth();

  if (can(section, level)) {
    return children || <Outlet />;
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="bg-white rounded-2xl shadow p-8 flex flex-col items-center text-center">
        <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center mb-4">
          <ShieldOff size={22} className="text-red-500" />
        </div>
        <h1 className="text-lg font-bold text-gray-900 mb-1">Access denied</h1>
        <p className="text-sm text-gray-500 mb-6">
          You don't have permission to view this page. Contact your account owner if you
          believe this is a mistake.
        </p>
        <Link
          to="/dashboard"
          className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-[#1A73E8] text-white text-sm font-medium hover:bg-[#1557b0] transition-colors"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
