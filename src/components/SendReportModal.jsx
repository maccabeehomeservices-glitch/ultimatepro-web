import { useEffect, useState } from 'react';
import { Send, Mail, MessageSquare } from 'lucide-react';
import { reportsApi } from '../lib/api';
import { useSnackbar } from './ui/Snackbar';
import { Modal, Button } from './ui';

/**
 * Bundle 4.4 distribution UI. Reused across all 5 actor screens
 * (team/roster/source/self/partner). Backend dispatch is per-actorType:
 *   POST /reports/:actorType/:actorId/send   (self has no actorId)
 *
 * Props:
 *  - isOpen, onClose
 *  - actorType: 'tech' | 'roster' | 'source' | 'self' | 'partner'
 *  - actorId  : UUID required for everything except 'self'
 *  - actorName: human label rendered as recipient
 *  - defaultEmail / defaultPhone: prefilled when the actor has them on file
 *  - period   : { from, to } — required, propagated to backend body
 */
export default function SendReportModal({
  isOpen,
  onClose,
  actorType,
  actorId,
  actorName,
  defaultEmail,
  defaultPhone,
  period,
}) {
  const { showSnack } = useSnackbar();

  const [format, setFormat] = useState('pdf');
  const [via, setVia] = useState('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [sending, setSending] = useState(false);

  // Reset prefill when the modal opens or the actor changes. Reading
  // defaults inside useEffect keeps the inputs editable after open.
  useEffect(() => {
    if (isOpen) {
      setFormat('pdf');
      setVia('email');
      setEmail(defaultEmail || '');
      setPhone(defaultPhone || '');
    }
  }, [isOpen, defaultEmail, defaultPhone]);

  async function handleSend() {
    if (['email', 'both'].includes(via) && !email.trim()) {
      showSnack('Recipient email required', 'error');
      return;
    }
    if (['sms', 'both'].includes(via) && !phone.trim()) {
      showSnack('Recipient phone required', 'error');
      return;
    }

    setSending(true);
    try {
      const res = await reportsApi.sendReport(actorType, actorId, {
        format,
        via,
        recipient_email: email.trim() || null,
        recipient_phone: phone.trim() || null,
        from: period.from,
        to: period.to,
      });
      const sentTo = (res?.sent_to || []).join(', ');
      showSnack(sentTo ? `Sent to: ${sentTo}` : 'Report sent', 'success');
      onClose();
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Send failed';
      showSnack(`Send failed: ${msg}`, 'error');
    } finally {
      setSending(false);
    }
  }

  const formatOptions = ['pdf', 'html', 'csv'];
  const viaOptions = [
    { id: 'email', label: 'Email', icon: Mail },
    { id: 'sms',   label: 'SMS',   icon: MessageSquare },
    { id: 'both',  label: 'Both',  icon: null },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !sending && onClose()}
      title="Send Report"
      footer={
        <>
          <Button variant="outlined" disabled={sending} onClick={onClose}>
            Cancel
          </Button>
          <Button loading={sending} onClick={handleSend}>
            <Send size={16} className="inline mr-1" />
            Send Report
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <p className="text-xs text-muted uppercase font-medium mb-1">Recipient</p>
          <p className="font-medium text-ink">{actorName || '—'}</p>
          <p className="text-sm text-muted">
            {period?.from} to {period?.to}
          </p>
        </div>

        {/* Format selector */}
        <div>
          <p className="text-sm font-medium text-ink mb-2">Format</p>
          <div className="flex gap-2">
            {formatOptions.map((f) => {
              const active = format === f;
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFormat(f)}
                  className={`flex-1 px-3 rounded-xl border text-sm font-medium min-h-[44px] ${
                    active
                      ? 'border-blue bg-blue-50 text-blue'
                      : 'border-hairline text-ink hover:bg-background'
                  }`}
                >
                  {f.toUpperCase()}
                </button>
              );
            })}
          </div>
        </div>

        {/* Send via selector */}
        <div>
          <p className="text-sm font-medium text-ink mb-2">Send Via</p>
          <div className="flex gap-2">
            {viaOptions.map(({ id, label, icon: Icon }) => {
              const active = via === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setVia(id)}
                  className={`flex-1 px-3 rounded-xl border text-sm font-medium min-h-[44px] flex items-center justify-center gap-1 ${
                    active
                      ? 'border-blue bg-blue-50 text-blue'
                      : 'border-hairline text-ink hover:bg-background'
                  }`}
                >
                  {Icon && <Icon size={16} />}
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Email input — shown when relevant */}
        {(via === 'email' || via === 'both') && (
          <div>
            <label className="block text-xs font-medium text-muted mb-1">
              Recipient Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="recipient@example.com"
              className="w-full rounded-xl border border-hairline px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue min-h-[44px]"
            />
          </div>
        )}

        {/* Phone input — shown when relevant */}
        {(via === 'sms' || via === 'both') && (
          <div>
            <label className="block text-xs font-medium text-muted mb-1">
              Recipient Phone
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+15555551234"
              className="w-full rounded-xl border border-hairline px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue min-h-[44px]"
            />
            <p className="text-xs text-muted mt-1">
              SMS sends a short link to a hosted HTML view (PDFs can't ship reliably over SMS).
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
