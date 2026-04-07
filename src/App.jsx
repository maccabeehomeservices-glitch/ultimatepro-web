import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './hooks/useAuth';
import { SnackbarProvider } from './components/ui/Snackbar';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';

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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30000,
    },
  },
});

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
                <Route element={<Layout />}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/jobs" element={<Jobs />} />
                  <Route path="/jobs/new" element={<JobForm />} />
                  <Route path="/jobs/:id" element={<JobDetail />} />
                  <Route path="/jobs/:id/edit" element={<JobForm />} />
                  <Route path="/customers" element={<Customers />} />
                  <Route path="/customers/new" element={<CustomerForm />} />
                  <Route path="/customers/:id" element={<CustomerDetail />} />
                  <Route path="/customers/:id/edit" element={<CustomerForm />} />
                  <Route path="/calendar" element={<Calendar />} />
                  <Route path="/estimates" element={<Estimates />} />
                  <Route path="/estimates/new" element={<EstimateBuilder />} />
                  <Route path="/estimates/:id" element={<EstimateDetail />} />
                  <Route path="/estimates/:id/edit" element={<EstimateBuilder />} />
                  <Route path="/invoices" element={<Invoices />} />
                  <Route path="/invoices/:id" element={<InvoiceDetail />} />
                  <Route path="/payments" element={<Payments />} />
                  <Route path="/phone" element={<Phone />} />
                  <Route path="/phone/thread/:id" element={<SmsThread />} />
                  <Route path="/reports" element={<Reports />} />
                  <Route path="/payroll" element={<Payroll />} />
                  <Route path="/pricebook" element={<Pricebook />} />
                  <Route path="/network" element={<Network />} />
                  <Route path="/inventory" element={<Inventory />} />
                  <Route path="/settings/*" element={<Settings />} />
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
