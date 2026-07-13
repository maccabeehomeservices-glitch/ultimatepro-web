import { useEffect, useRef, useState } from 'react';
import { UpExport, UpChevronDown } from './ui/icons';
import { useSnackbar } from './ui/Snackbar';

// P2.10: fall back to localhost (matches src/lib/api.js), not a hardcoded prod URL,
// so staging/self-host builds never leak to prod for report-export downloads.
const BACKEND_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:3000';

/**
 * PDF / CSV / HTML export menu for actor-report screens.
 *
 * Uses fetch + Authorization header + blob URL so the backend GET handler's
 * JWT-only auth keeps working. Avoids putting the token in a query string
 * (auth middleware only reads `Authorization: Bearer ...`).
 *
 * Props:
 *  - actorType: 'tech' | 'roster' | 'source' | 'self' | 'partner'
 *  - actorId  : UUID; ignored when actorType === 'self'
 *  - period   : { from, to }
 */
export default function ExportReportMenu({ actorType, actorId, period }) {
  const { showSnack } = useSnackbar();
  const [open, setOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function buildUrl(format) {
    const base =
      actorType === 'self'
        ? `${BACKEND_URL}/api/reports/self`
        : `${BACKEND_URL}/api/reports/${actorType}/${actorId}`;
    const params = new URLSearchParams({
      format,
      from: period.from,
      to: period.to,
    });
    return `${base}?${params.toString()}`;
  }

  function extFor(format) {
    if (format === 'pdf')  return 'pdf';
    if (format === 'csv')  return 'csv';
    return 'html';
  }

  async function download(format) {
    setOpen(false);
    if (downloading) return;
    setDownloading(true);
    try {
      const token = localStorage.getItem('up_token');
      const res = await fetch(buildUrl(format), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${txt.slice(0, 120) || res.statusText}`);
      }
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);

      if (format === 'html') {
        // Inline view in new tab
        window.open(blobUrl, '_blank', 'noopener');
        // Browser holds the URL alive until the new tab loads
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
      } else {
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `${actorType}-report-${period.from}-to-${period.to}.${extFor(format)}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(blobUrl);
      }
    } catch (err) {
      showSnack(`Export failed: ${err.message}`, 'error');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={downloading}
        className="px-3 py-2 border border-blue text-blue rounded-xl text-sm font-medium flex items-center gap-1 hover:bg-blue-50 disabled:opacity-50 min-h-[44px]"
      >
        <UpExport size={16} />
        {downloading ? 'Exporting…' : 'Export'}
        <UpChevronDown size={14} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 bg-card border border-hairline rounded-xl shadow-lg z-20 min-w-[160px] overflow-hidden">
          <button
            type="button"
            onClick={() => download('pdf')}
            className="w-full px-4 py-3 text-left hover:bg-background text-sm min-h-[44px]"
          >
            Download PDF
          </button>
          <button
            type="button"
            onClick={() => download('csv')}
            className="w-full px-4 py-3 text-left hover:bg-background text-sm min-h-[44px] border-t border-hairline"
          >
            Download CSV
          </button>
          <button
            type="button"
            onClick={() => download('html')}
            className="w-full px-4 py-3 text-left hover:bg-background text-sm min-h-[44px] border-t border-hairline"
          >
            View HTML
          </button>
        </div>
      )}
    </div>
  );
}
