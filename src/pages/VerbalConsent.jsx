import { Link } from 'react-router-dom';

export default function VerbalConsent() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-900">UltimatePro Solutions LLC</h1>
          <nav className="flex gap-4 text-sm">
            <Link to="/privacy" className="text-blue-600 hover:underline">Privacy</Link>
            <Link to="/terms" className="text-blue-600 hover:underline">Terms</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Verbal SMS Opt-In Process</h1>
        <p className="text-sm text-gray-500 mb-8">Last updated: May 1, 2026</p>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">When verbal consent is collected</h2>
          <p className="text-gray-700 leading-relaxed">
            UltimatePro Solutions LLC and service businesses using the
            UltimatePro platform may collect verbal SMS consent during
            the following customer interactions: inbound phone calls
            when a customer is requesting service or scheduling an
            appointment, in-person conversations between a service
            technician and the customer at the job site, and follow-up
            calls regarding completed service.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Verbal consent script</h2>
          <p className="text-gray-700 mb-3">
            The technician or office staff reads the following
            disclosure to the customer before adding the customer's
            phone number to the SMS opt-in list:
          </p>
          <blockquote className="border-l-4 border-blue-600 bg-blue-50 px-4 py-4 my-4 rounded-r-lg">
            <p className="text-gray-900 leading-relaxed italic">
              "Before we end the call, can I confirm: it's okay if we
              text you appointment confirmations, your estimate,
              invoice, and updates from your technician at this
              number? You can reply STOP at any time to opt out.
              Message frequency depends on your service, typically
              1 to 5 messages per service engagement. Message and
              data rates may apply."
            </p>
          </blockquote>
          <p className="text-gray-700 leading-relaxed">
            The customer must respond affirmatively (e.g., "yes,"
            "okay," "that's fine") for the consent to be recorded. If
            the customer declines, refuses, or does not give a clear
            affirmative answer, no SMS opt-in is recorded and the
            customer will only be contacted by phone or email.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">How verbal consent is recorded</h2>
          <p className="text-gray-700 leading-relaxed">
            Once a customer gives verbal consent, the staff member
            records it in the customer's account record on the
            UltimatePro platform with the following information:
          </p>
          <ul className="list-disc pl-6 mt-3 space-y-2 text-gray-700">
            <li>Date and timestamp of the verbal consent</li>
            <li>Name of the staff member who collected the consent</li>
            <li>Method of collection (inbound call, in-person, follow-up call)</li>
            <li>Customer phone number that was opted in</li>
          </ul>
          <p className="text-gray-700 leading-relaxed mt-3">
            The customer's record is then flagged as opted-in for
            transactional SMS messages. The customer can opt out at
            any time by replying STOP to any message, which
            automatically updates the customer's record to opted-out
            and stops all future SMS messages.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Disclosures included in the verbal script</h2>
          <ul className="list-disc pl-6 space-y-2 text-gray-700">
            <li>Message purpose: appointment confirmations, estimates, invoices, technician updates</li>
            <li>Message frequency: typically 1-5 messages per service engagement</li>
            <li>Cost disclosure: "Message and data rates may apply"</li>
            <li>Opt-out method: "Reply STOP at any time"</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Other opt-in paths</h2>
          <p className="text-gray-700 leading-relaxed">
            Customers can also opt in by signing a service agreement
            that includes an SMS authorization block. A sample of the
            service agreement is available at{' '}
            <a
              href="/sample-service-agreement.pdf"
              className="text-blue-600 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              https://ultimatepro.pro/sample-service-agreement.pdf
            </a>.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Privacy and Terms</h2>
          <p className="text-gray-700 leading-relaxed">
            For the full SMS Communications and Mobile Messaging
            Consent disclosure, see our{' '}
            <Link to="/privacy" className="text-blue-600 hover:underline">Privacy Policy</Link>{' '}
            and{' '}
            <Link to="/terms" className="text-blue-600 hover:underline">Terms of Service</Link>.
            Mobile phone numbers and SMS opt-in consent are not
            shared with third parties or affiliates for marketing or
            promotional purposes.
          </p>
        </section>
      </main>

      <footer className="border-t border-gray-200 mt-12 py-6">
        <div className="max-w-3xl mx-auto px-4 text-center text-sm text-gray-500">
          © 2026 UltimatePro Solutions LLC, Virginia Beach VA · {' '}
          <Link to="/privacy" className="text-blue-600 hover:underline">Privacy</Link> ·{' '}
          <Link to="/terms" className="text-blue-600 hover:underline">Terms</Link>
        </div>
      </footer>
    </div>
  );
}
