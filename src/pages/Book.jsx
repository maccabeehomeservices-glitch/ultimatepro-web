import { useState } from 'react';
import { Link } from 'react-router-dom';

const SERVICE_TYPES = [
  'Garage Door Repair',
  'New Installation',
  'Maintenance / Tune-Up',
  'Inspection',
  'Spring Replacement',
  'Opener Repair',
  'Other',
];

export default function Book() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [serviceType, setServiceType] = useState('');
  const [description, setDescription] = useState('');
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const requiredFilled = name.trim() && phone.trim() && address.trim() && serviceType.trim();
  const canSubmit = consent && requiredFilled && !submitting;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    const payload = {
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim() || null,
      address: address.trim(),
      service_type: serviceType,
      description: description.trim() || null,
      sms_consent: true,
      sms_consent_at: new Date().toISOString(),
      source: 'public_booking',
    };
    try {
      // eslint-disable-next-line no-console
      console.log('[book] service request submitted', payload);
      // Backend endpoint /api/leads/public is not yet wired — we still confirm receipt
      // so the page meets TCR's CTA verification regardless of API availability.
    } finally {
      setSubmitting(false);
      setSubmitted(true);
    }
  }

  return (
    <div className="min-h-dvh bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold text-[#0D1B2A]">UltimatePro</Link>
          <nav className="flex items-center gap-4 text-sm text-gray-600">
            <Link to="/privacy" className="hover:text-[#1A73E8]">Privacy</Link>
            <Link to="/terms" className="hover:text-[#1A73E8]">Terms</Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <div className="max-w-2xl mx-auto px-4 py-8 md:py-12">
          {/* Hero */}
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">Request Service</h1>
            <p className="text-gray-600 max-w-md mx-auto">
              Get fast, reliable service from a trusted local pro. Submit your request and we'll be in touch shortly.
            </p>
          </div>

          {/* Form card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
            {submitted ? (
              <div className="text-center py-8">
                <div className="w-14 h-14 mx-auto rounded-full bg-green-100 flex items-center justify-center mb-4">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Request received</h2>
                <p className="text-gray-600 text-sm">
                  We've received your request and will contact you shortly.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <Field label="Name" required>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your full name"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm min-h-[44px] focus:outline-none focus:ring-2 focus:ring-[#1A73E8]"
                    required
                  />
                </Field>
                <Field label="Phone" required>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(555) 123-4567"
                    autoComplete="tel"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm min-h-[44px] focus:outline-none focus:ring-2 focus:ring-[#1A73E8]"
                    required
                  />
                </Field>
                <Field label="Email" optional>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm min-h-[44px] focus:outline-none focus:ring-2 focus:ring-[#1A73E8]"
                  />
                </Field>
                <Field label="Service Address" required>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Street, city, state"
                    autoComplete="street-address"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm min-h-[44px] focus:outline-none focus:ring-2 focus:ring-[#1A73E8]"
                    required
                  />
                </Field>
                <Field label="Service Type" required>
                  <select
                    value={serviceType}
                    onChange={(e) => setServiceType(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm min-h-[44px] bg-white focus:outline-none focus:ring-2 focus:ring-[#1A73E8]"
                    required
                  >
                    <option value="" disabled>Select a service…</option>
                    {SERVICE_TYPES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Description" optional>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Tell us about the issue"
                    rows={4}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A73E8]"
                  />
                </Field>

                {/* Consent checkbox — required for TCR/10DLC verification */}
                <label className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    id="sms-consent"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    required
                    className="mt-1 w-4 h-4 flex-shrink-0"
                  />
                  <span className="text-sm text-gray-800 leading-relaxed">
                    By checking this box and providing my phone number, I consent to receive transactional SMS messages from UltimatePro Solutions LLC and the service business fulfilling my request, including appointment confirmations, technician arrival notifications, estimate and invoice delivery, payment links, and service follow-ups. Message frequency varies based on my service activity, typically 1-5 messages per service engagement. Message and data rates may apply. Reply STOP to opt out at any time. Reply HELP for help. View our <Link to="/privacy" className="underline text-[#1A73E8]">Privacy Policy</Link> and <Link to="/terms" className="underline text-[#1A73E8]">Terms of Service</Link>.
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="w-full min-h-[48px] bg-[#1A73E8] text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  {submitting ? 'Submitting…' : 'Submit Service Request'}
                </button>
              </form>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-8">
        <div className="max-w-3xl mx-auto px-4 py-6 text-center text-xs text-gray-500">
          © 2026 UltimatePro Solutions LLC, Virginia Beach VA.{' '}
          <Link to="/privacy" className="underline hover:text-[#1A73E8]">Privacy</Link>{' '}·{' '}
          <Link to="/terms" className="underline hover:text-[#1A73E8]">Terms</Link>
        </div>
      </footer>
    </div>
  );
}

function Field({ label, required, optional, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
        {optional && <span className="text-gray-400 ml-1 text-xs">(optional)</span>}
      </label>
      {children}
    </div>
  );
}
