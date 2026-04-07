import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { setToken, setStoredUser, setStoredCompany } from '../lib/auth';
import { useAuth } from '../hooks/useAuth';
import { Button, Input, Card } from '../components/ui';

export default function Register() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({
    company_name: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/register', form);
      const { token, refresh_token, user, company } = res.data;
      setToken(token);
      if (refresh_token) localStorage.setItem('up_refresh_token', refresh_token);
      setStoredUser(user);
      setStoredCompany(company);
      navigate('/dashboard');
    } catch (err) {
      setError(err?.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh bg-gray-50 flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#0D1B2A]">UltimatePro</h1>
          <p className="text-gray-500 mt-2">Create your account</p>
        </div>

        <Card>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                {error}
              </div>
            )}
            <Input
              label="Company Name"
              name="company_name"
              value={form.company_name}
              onChange={handleChange}
              placeholder="Acme Services LLC"
              required
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="First Name"
                name="first_name"
                value={form.first_name}
                onChange={handleChange}
                placeholder="John"
                required
              />
              <Input
                label="Last Name"
                name="last_name"
                value={form.last_name}
                onChange={handleChange}
                placeholder="Doe"
                required
              />
            </div>
            <Input
              label="Email"
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
            <Input
              label="Phone"
              type="tel"
              name="phone"
              value={form.phone}
              onChange={handleChange}
              placeholder="+1 (555) 000-0000"
            />
            <Input
              label="Password"
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder="••••••••"
              autoComplete="new-password"
              required
            />
            <Button
              type="submit"
              loading={loading}
              disabled={loading}
              className="w-full"
            >
              Create Account
            </Button>
          </form>
        </Card>

        <p className="text-center text-sm text-gray-500 mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-[#1A73E8] font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
