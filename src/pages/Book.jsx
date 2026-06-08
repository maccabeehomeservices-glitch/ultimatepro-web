import { useEffect } from 'react';

// The working public booking form is served by the BACKEND (routes/book.js,
// GET /book?company=<UCM_ID>). This SPA route used to be a dead stub that only
// console.log'd and never submitted — so a customer hitting the web domain's
// /book got a fake confirmation. We now forward to the backend form (preserving
// ?company=...), so the bare-domain URL reaches a real, working booking page.
const BOOKING_BASE = 'https://ultimatecrm-backend-production.up.railway.app/book';

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
      color: '#0D1B2A',
      padding: '24px',
      textAlign: 'center',
    }}>
      Taking you to the booking page…
    </div>
  );
}
