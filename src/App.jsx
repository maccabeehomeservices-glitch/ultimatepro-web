import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './hooks/useAuth';
import { SnackbarProvider } from './components/ui/Snackbar';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';

import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Jobs from './pages/Jobs';
import JobDetail from './pages/JobDetail';
import JobForm from './pages/JobForm';
import Customers from './pages/Customers';
import CustomerDetail from './pages/CustomerDetail';
import CustomerForm from './pages/CustomerForm';
import Calendar from './pages/Calendar';
import Estimates from './pages/Estimates';
import EstimateDetail from './pages/EstimateDetail';
import EstimateBuilder from './pages/EstimateBuilder';
import Invoices from './pages/Invoices';
import InvoiceDetail from './pages/InvoiceDetail';
import Payments from './pages/Payments';
import Phone from './pages/Phone';
import SmsThread from './pages/SmsThread';
import Reports from './pages/Reports';
import Payroll from './pages/Payroll';
import Pricebook from './pages/Pricebook';
import Network from './pages/Network';
import Inventory from './pages/Inventory';
import Settings from './pages/Settings';
import ImportWizard from './pages/ImportWizard';

import RosterTechs from './pages/settings/RosterTechs';
import MembershipPlans from './pages/settings/MembershipPlans';
import JobSources from './pages/settings/JobSources';
import ReviewPlatforms from './pages/settings/ReviewPlatforms';
import OnlineBooking from './pages/settings/OnlineBooking';
import Notifications from './pages/settings/Notifications';
import CompanyProfile from './pages/settings/CompanyProfile';
import UserManagement from './pages/settings/UserManagement';
import Leads from './pages/Leads';
import LiveMap from './pages/LiveMap';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30000,
    },
  },
});

function Wrap({ children }) {
  return <ErrorBoundary>{children}</ErrorBoundary>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SnackbarProvider>
          <BrowserRouter>
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/" element={<Navigate to="/dashboard" replace />} />

              {/* Protected routes */}
              <Route element={<ProtectedRoute />}>
                <Route path="/live-map" element={<Wrap><LiveMap /></Wrap>} />
                <Route element={<Layout />}>
                  <Route path="/dashboard" element={<Wrap><Dashboard /></Wrap>} />
                  <Route path="/jobs" element={<Wrap><Jobs /></Wrap>} />
                  <Route path="/jobs/new" element={<Wrap><JobForm /></Wrap>} />
                  <Route path="/jobs/:id" element={<Wrap><JobDetail /></Wrap>} />
                  <Route path="/jobs/:id/edit" element={<Wrap><JobForm /></Wrap>} />
                  <Route path="/customers" element={<Wrap><Customers /></Wrap>} />
                  <Route path="/customers/new" element={<Wrap><CustomerForm /></Wrap>} />
                  <Route path="/customers/:id" element={<Wrap><CustomerDetail /></Wrap>} />
                  <Route path="/customers/:id/edit" element={<Wrap><CustomerForm /></Wrap>} />
                  <Route path="/calendar" element={<Wrap><Calendar /></Wrap>} />
                  <Route path="/estimates" element={<Wrap><Estimates /></Wrap>} />
                  <Route path="/estimates/new" element={<Wrap><EstimateBuilder /></Wrap>} />
                  <Route path="/estimates/:id" element={<Wrap><EstimateDetail /></Wrap>} />
                  <Route path="/estimates/:id/edit" element={<Wrap><EstimateBuilder /></Wrap>} />
                  <Route path="/invoices" element={<Wrap><Invoices /></Wrap>} />
                  <Route path="/invoices/:id" element={<Wrap><InvoiceDetail /></Wrap>} />
                  <Route path="/payments" element={<Wrap><Payments /></Wrap>} />
                  <Route path="/phone" element={<Wrap><Phone /></Wrap>} />
                  <Route path="/phone/thread/:id" element={<Wrap><SmsThread /></Wrap>} />
                  <Route path="/phone/sms/:conversationId" element={<Wrap><SmsThread /></Wrap>} />
                  <Route path="/reports" element={<Wrap><Reports /></Wrap>} />
                  <Route path="/payroll" element={<Wrap><Payroll /></Wrap>} />
                  <Route path="/pricebook" element={<Wrap><Pricebook /></Wrap>} />
                  <Route path="/network" element={<Wrap><Network /></Wrap>} />
                  <Route path="/inventory" element={<Wrap><Inventory /></Wrap>} />
                  <Route path="/settings" element={<Wrap><Settings /></Wrap>} />
                  <Route path="/settings/technicians" element={<Wrap><RosterTechs /></Wrap>} />
                  <Route path="/settings/membership-plans" element={<Wrap><MembershipPlans /></Wrap>} />
                  <Route path="/settings/job-sources" element={<Wrap><JobSources /></Wrap>} />
                  <Route path="/settings/review-platforms" element={<Wrap><ReviewPlatforms /></Wrap>} />
                  <Route path="/settings/online-booking" element={<Wrap><OnlineBooking /></Wrap>} />
                  <Route path="/settings/notifications" element={<Wrap><Notifications /></Wrap>} />
                  <Route path="/settings/company" element={<Wrap><CompanyProfile /></Wrap>} />
                  <Route path="/settings/team" element={<Wrap><UserManagement /></Wrap>} />
                  <Route path="/leads" element={<Wrap><Leads /></Wrap>} />
                  <Route path="/import" element={<Wrap><ImportWizard /></Wrap>} />
                </Route>
              </Route>

              {/* 404 fallback */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </BrowserRouter>
        </SnackbarProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
