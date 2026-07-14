import { useEffect } from 'react';

// The working public booking form is served by the BACKEND (routes/book.js,
// GET /book?company=<UCM_ID>). This SPA route used to be a dead stub that only
// console.log'd and never submitted — so a customer hitting the web domain's
// /book got a fake confirmation. We now forward to the backend form (preserving
// ?company=...), so the bare-domain URL reaches a real, working booking page.
// P2.10: use VITE_API_URL (was a hardcoded prod URL that ignored the env — staging/
// self-host builds forwarded customers to the prod booking form).
const BOOKING_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3000') + '/book';

export default function Book() {
  useEffect(() => {
    window.location.replace(BOOKING_BASE + window.location.search);
  }, []);

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'system-ui, sans-serif',
      color: 'var(--color-ink)',
      padding: '24px',
      textAlign: 'center',
    }}>
      Taking you to the booking page…
    </div>
  );
}
