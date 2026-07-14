import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { UpBack } from '../components/ui/icons';
import { useGet, useMutation } from '../hooks/useApi';
import api, { estimatesApi, customersApi, uploadsApi } from '../lib/api';
import { Card, Badge, Button, LoadingSpinner, Modal, Input, Select } from '../components/ui';
import { useSnackbar } from '../components/ui/Snackbar';
import { useAuth } from '../hooks/useAuth';
import SignaturePad from '../components/SignaturePad';

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'check', label: 'Check' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'ach', label: 'ACH' },
];

function formatCurrency(v) {
  return '$' + Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function TierCard({ tier, selectable = false, selected, onClick }) {
  const isSel = selected !== undefined ? selected : tier.is_selected;
  const items = tier.line_items || tier.items || [];
  const services = (tier.services || items.filter(i => i.item_type !== 'material' && i.item_type !== 'discount'));
  const materials = tier.materials || items.filter(i => i.item_type === 'material');
  const discounts = tier.discounts || items.filter(i => i.item_type === 'discount');
  const allItems = [...services, ...materials, ...discounts];
  const total = tier.total || allItems.reduce((s, i) => s + (Number(i.total || 0) || Number(i.unit_price || 0) * Number(i.qty || 1)), 0);

  return (
    <div onClick={onClick} className={`rounded-2xl border-2 p-4 transition-colors ${selectable ? 'cursor-pointer hover:border-blue ' : ''}${
      isSel ? 'border-blue bg-blue-50' : 'border-hairline bg-card'
    }`}>
      <div className="flex items-center justify-between mb-2">
        <p className="font-bold text-ink">{tier.name || tier.tier_name}</p>
        {isSel && (
          <span className="text-xs bg-blue text-white px-2 py-0.5 rounded-full font-medium">✓ Selected</span>
        )}
      </div>
      {tier.description && <p className="text-sm text-muted mb-3">{tier.description}</p>}
      {allItems.length > 0 && (
        <div className="space-y-1 mb-3">
          {allItems.map((item, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              {item.image_url && (
                <img src={item.image_url} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0 border border-hairline" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-ink truncate">{item.name || item.description}</p>
                {item.description && item.description !== item.name && (
                  <p className="text-xs text-muted whitespace-pre-wrap">{item.description}</p>
                )}
                {item.sku && <p className="text-xs text-muted">SKU: {item.sku}</p>}
              </div>
              <span className={`flex-shrink-0 ${item.item_type === 'discount' ? 'text-red-500' : 'text-muted'}`}>
                {item.item_type === 'discount' ? '-' : ''}{formatCurrency(item.total || Number(item.unit_price || 0) * Number(item.qty || 1))}
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between pt-2 border-t border-hairline">
        <p className="font-semibold text-ink">Total</p>
        <p className="font-bold text-lg text-blue">{formatCurrency(total)}</p>
      </div>
    </div>
  );
}

export default function EstimateDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showSnack } = useSnackbar();
  const { can } = useAuth();
  const { data, loading, refetch } = useGet(`/estimates/${id}`);
  const { data: tiersData } = useGet(
    data?.estimate?.presentation_mode === 'gbb' || data?.presentation_mode === 'gbb' ||
    data?.estimate?.presentation_mode === 'good_better_best' || data?.presentation_mode === 'good_better_best' ||
    data?.estimate?.gbb_mode || data?.gbb_mode
      ? `/estimates/${id}/tiers`
      : null,
    [id, data]
  );
  const { mutate, loading: acting } = useMutation();

  const [depositModal, setDepositModal] = useState(false);
  const [depositForm, setDepositForm] = useState({ method: 'cash', amount: '' });
  const [collectingDeposit, setCollectingDeposit] = useState(false);
  // P2.38: deposit via ScanPay (QR + link + status poll)
  const [depQr, setDepQr] = useState(null);
  const [depLink, setDepLink] = useState(null);
  const [depScanpayBusy, setDepScanpayBusy] = useState(false);
  const [showSignature, setShowSignature] = useState(false);
  const [signerName, setSignerName] = useState('');
  const [savingSig, setSavingSig] = useState(false);
  const [showTierSelect, setShowTierSelect] = useState(false);
  const [selectedTierId, setSelectedTierId] = useState(null);
  const [selectingTier, setSelectingTier] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showAddToInvoiceModal, setShowAddToInvoiceModal] = useState(false);
  const [showKeepReplaceModal, setShowKeepReplaceModal] = useState(false);
  const [keepReplaceOldItems, setKeepReplaceOldItems] = useState([]);
  const [checkingInvoice, setCheckingInvoice] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [loadingSendData, setLoadingSendData] = useState(false);
  const [sendEmails, setSendEmails] = useState([]);
  const [sendPhones, setSendPhones] = useState([]);
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [saveContactsToProfile, setSaveContactsToProfile] = useState(true);
  const [sending, setSending] = useState(false);
  const photoInputRef = useRef(null);

  // Track which recipients were already on the customer profile when the
  // modal was opened. Newly-added recipients (not in these sets) are
  // persisted to the profile only after a successful send, when the
  // save-to-profile toggle is still on at that moment.
  const originalSendEmailsRef = useRef(new Set());
  const originalSendPhonesRef = useRef(new Set());

  // Polling when status = 'sent'
  const pollRef = useRef(null);
  const estimate = data?.estimate || data;

  useEffect(() => {
    if (!estimate) return;
    if (estimate.status === 'sent') {
      pollRef.current = setInterval(() => refetch(), 10000);
    } else {
      clearInterval(pollRef.current);
    }
    return () => clearInterval(pollRef.current);
  }, [estimate?.status]);

  async function handleCaptureSignature(base64) {
    setSavingSig(true);
    try {
      await estimatesApi.captureSignature(id, base64, signerName);
      setShowSignature(false);
      showSnack('Signature captured!', 'success');
      refetch();
      setShowAddToInvoiceModal(true);
    } catch (err) {
      showSnack(err.response?.data?.error || 'Failed to save signature', 'error');
    } finally {
      setSavingSig(false);
    }
  }

  // GBB: open the tier picker (present → select → sign). Pre-select whatever
  // tier was already chosen, if any.
  function openTierSelect() {
    setSelectedTierId(estimate?.selected_tier_id || null);
    setShowTierSelect(true);
  }

  // Confirm the chosen tier, then sign. select-tier copies the tier's totals
  // onto the estimate, so the signature is captured against the correct amount.
  async function handleConfirmTierAndSign() {
    if (!selectedTierId) { showSnack('Select an option first', 'error'); return; }
    setSelectingTier(true);
    try {
      await estimatesApi.selectTier(id, selectedTierId);
      await refetch();              // estimate total is now the selected tier's total
      setShowTierSelect(false);
      setShowSignature(true);       // proceed to signature with the right total
    } catch (err) {
      showSnack(err.response?.data?.error || 'Failed to select option', 'error');
    } finally {
      setSelectingTier(false);
    }
  }

  async function handlePhotoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      // 2-step (mirrors the web job-photo flow): upload the file to cloudinary
      // via /uploads → get the url → POST the url to the estimate (the backend
      // add-photo handler stores a url string, not a file).
      const up = await uploadsApi.upload(file, 'estimate', id, 'estimate_photo');
      const url = up.data?.url || up.data?.secure_url;
      if (!url) throw new Error('Upload returned no url');
      await estimatesApi.addPhoto(id, { url, photo_type: 'before' });
      showSnack('Photo attached!', 'success');
      refetch();
    } catch (err) {
      showSnack(err.response?.data?.error || 'Failed to upload photo', 'error');
    } finally {
      setUploadingPhoto(false);
      e.target.value = '';
    }
  }

  async function openSendModal() {
    if (!estimate?.customer_id) { showSnack('No customer on estimate', 'error'); return; }
    setLoadingSendData(true);
    try {
      const res = await customersApi.get(estimate.customer_id);
      const customer = res.data?.customer || res.data;
      const primaryEmail = customer?.email;
      const primaryPhone = customer?.phone;
      const extraEmails = (customer?.emails || []).filter(e => e && e !== primaryEmail);
      const extraPhones = (customer?.phones || []).filter(p => p && p !== primaryPhone);
      const emails = [
        ...(primaryEmail ? [{ value: primaryEmail, checked: true }] : []),
        ...extraEmails.map(e => ({ value: e, checked: true })),
      ];
      const phones = [
        ...(primaryPhone ? [{ value: primaryPhone, checked: true }] : []),
        ...extraPhones.map(p => ({ value: p, checked: true })),
      ];
      setSendEmails(emails);
      setSendPhones(phones);
      originalSendEmailsRef.current = new Set(emails.map(e => e.value));
      originalSendPhonesRef.current = new Set(phones.map(p => p.value));
      setNewEmail('');
      setNewPhone('');
      setShowSendModal(true);
    } catch {
      showSnack('Failed to load customer contacts', 'error');
    } finally {
      setLoadingSendData(false);
    }
  }

  async function handleSendConfirm() {
    const emails = sendEmails.filter(e => e.checked).map(e => e.value);
    const phones = sendPhones.filter(p => p.checked).map(p => p.value);
    if (emails.length === 0 && phones.length === 0) {
      showSnack('Pick at least one recipient', 'error');
      return;
    }
    setSending(true);
    try {
      await estimatesApi.send(id, {
        emails,
        phones,
        send_email: emails.length > 0,
        send_sms: phones.length > 0,
      });
      showSnack('Estimate sent', 'success');
      setShowSendModal(false);
      refetch();

      // Persist newly-added recipients to the customer profile, only when
      // the toggle is still on at Send-click. Failures aggregate into a
      // single non-blocking snackbar; the send already succeeded.
      if (saveContactsToProfile && estimate?.customer_id) {
        const newEmails = sendEmails
          .filter(e => e.checked && !originalSendEmailsRef.current.has(e.value))
          .map(e => e.value);
        const newPhones = sendPhones
          .filter(p => p.checked && !originalSendPhonesRef.current.has(p.value))
          .map(p => p.value);
        const failures = [];
        for (const email of newEmails) {
          try {
            await api.post(`/customers/${estimate.customer_id}/contacts`, { type: 'email', value: email });
          } catch {
            failures.push(`email ${email}`);
          }
        }
        for (const phone of newPhones) {
          try {
            await api.post(`/customers/${estimate.customer_id}/contacts`, { type: 'phone', value: phone });
          } catch {
            failures.push(`phone ${phone}`);
          }
        }
        if (failures.length > 0) {
          showSnack(
            `Sent, but failed to save ${failures.length} contact${failures.length > 1 ? 's' : ''} to profile`,
            'error'
          );
        }
      }
    } catch (err) {
      showSnack(err?.response?.data?.error || 'Failed to send estimate', 'error');
    } finally {
      setSending(false);
    }
  }

  function handleAddSendEmail() {
    const v = newEmail.trim();
    if (!v) return;
    setSendEmails(prev => [...prev, { value: v, checked: true }]);
    setNewEmail('');
  }

  function handleAddSendPhone() {
    const v = newPhone.trim();
    if (!v) return;
    setSendPhones(prev => [...prev, { value: v, checked: true }]);
    setNewPhone('');
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await estimatesApi.delete(id);
      showSnack('Estimate deleted', 'success');
      setShowDeleteConfirm(false);
      if (estimate?.job_id) navigate(`/jobs/${estimate.job_id}`);
      else navigate(-1);
    } catch (err) {
      showSnack(err?.response?.data?.error || 'Failed to delete estimate', 'error');
    } finally {
      setDeleting(false);
    }
  }

  async function handleConvert() {
    try {
      const res = await mutate('post', `/estimates/${id}/convert-to-invoice`);
      showSnack('Invoice created', 'success');
      navigate(`/invoices/${res?.invoice?.id || res?.id}`);
    } catch {
      showSnack('Failed to convert estimate', 'error');
    }
  }

  async function handleAddToInvoiceYes() {
    setShowAddToInvoiceModal(false);
    if (estimate.job_id) {
      setCheckingInvoice(true);
      try {
        const res = await api.get(`/invoices`, { params: { job_id: estimate.job_id } });
        const invoices = res?.data?.invoices || res?.invoices || [];
        const existing = Array.isArray(invoices) ? invoices[0] : null;
        const existingItems = existing?.line_items || [];
        if (existingItems.length > 0) {
          setKeepReplaceOldItems(existingItems);
          setShowKeepReplaceModal(true);
          return;
        }
      } catch { /* ignore, just convert */ }
      finally { setCheckingInvoice(false); }
    }
    handleConvert();
  }

  async function handleKeepAndAdd() {
    setShowKeepReplaceModal(false);
    try {
      const res = await mutate('post', `/estimates/${id}/convert-to-invoice`);
      const newInvId = res?.invoice?.id || res?.id;
      showSnack('Invoice created', 'success');
      if (newInvId && keepReplaceOldItems.length > 0) {
        const invRes = await api.get(`/invoices/${newInvId}`);
        const newItems = invRes?.data?.invoice?.line_items || invRes?.data?.line_items || [];
        const merged = [...newItems, ...keepReplaceOldItems];
        await api.put(`/invoices/${newInvId}`, { line_items: merged });
      }
      navigate(`/invoices/${newInvId}`);
    } catch {
      showSnack('Failed to convert estimate', 'error');
    }
  }

  async function handleCollectDeposit() {
    setCollectingDeposit(true);
    try {
      await estimatesApi.collectDeposit(id, Number(depositForm.amount), depositForm.method);
      showSnack('Deposit collected', 'success');
      setDepositModal(false);
      refetch();
    } catch {
      showSnack('Failed to collect deposit', 'error');
    } finally {
      setCollectingDeposit(false);
    }
  }

  // P2.38: generate a ScanPay deposit QR (customer present) or send a payment link.
  async function handleDepositScanpayQr() {
    setDepScanpayBusy(true);
    try { const r = await estimatesApi.depositScanpayQr(id); setDepLink(null); setDepQr(r.data); }
    catch { showSnack('Failed to create deposit QR', 'error'); }
    finally { setDepScanpayBusy(false); }
  }
  async function handleDepositScanpayLink() {
    setDepScanpayBusy(true);
    try { const r = await estimatesApi.depositScanpayLink(id, 'both'); setDepQr(null); setDepLink(r.data); }
    catch { showSnack('Failed to send deposit link', 'error'); }
    finally { setDepScanpayBusy(false); }
  }
  function closeDepositModal() { setDepositModal(false); setDepQr(null); setDepLink(null); }

  // Poll deposit-status while a ScanPay QR/link is showing; auto-close on payment.
  useEffect(() => {
    if (!depositModal || (!depQr && !depLink)) return;
    const iv = setInterval(async () => {
      try {
        const r = await estimatesApi.depositStatus(id);
        if (r.data?.deposit_collected) {
          clearInterval(iv);
          closeDepositModal();
          showSnack('Deposit paid ✓', 'success');
          refetch();
        }
      } catch { /* keep polling */ }
    }, 3000);
    return () => clearInterval(iv);
  }, [depositModal, depQr, depLink, id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <LoadingSpinner fullPage />;
  if (!estimate) return <div className="p-4 text-muted">Estimate not found.</div>;

  const isGbb = ['gbb', 'good_better_best'].includes(estimate.presentation_mode) || estimate.gbb_mode;
  const tiers = tiersData?.tiers || (Array.isArray(tiersData) ? tiersData : []);
  const isSigned = Boolean(estimate.signature || estimate.signed_at || estimate.status === 'approved');
  const lineItems = estimate.line_items || estimate.items || [];
  const total = estimate.total || lineItems.reduce((s, i) => s + (Number(i.total || 0) || Number(i.unit_price || 0) * Number(i.qty || i.quantity || 1)), 0);

  // Status-dependent buttons
  const showPresent = isGbb && !isSigned && estimate.status !== 'sent';
  const showSend = !isSigned;
  const showConvert = isSigned;
  const showCollectDeposit = isSigned && estimate.deposit_required && !estimate.deposit_collected;

  return (
    <div className="p-4 max-w-3xl mx-auto pb-8">
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => {
            if (estimate?.job_id) navigate(`/jobs/${estimate.job_id}`);
            else navigate('/estimates');
          }}
          className="p-2 rounded-xl hover:bg-background min-h-[44px] min-w-[44px] flex items-center justify-center text-ink"
        >
          <UpBack size={20} />
        </button>
        <div className="flex-1">
          <h1 className="font-bold text-ink text-lg">
            {`Estimate ${estimate.estimate_number || estimate.id?.slice(0,8)}`}
          </h1>
          {(estimate.cust_first || estimate.cust_last || estimate.customer_name) && (
            <p className="text-sm text-muted">
              {[estimate.cust_first, estimate.cust_last].filter(Boolean).join(' ') || estimate.customer_name}
            </p>
          )}
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <Badge status={estimate.status} label={estimate.status} />
            {estimate.status === 'sent' && (
              <span className="text-xs text-amber-600 font-medium animate-pulse">Waiting for signature...</span>
            )}
          </div>
        </div>
      </div>

      {/* Customer */}
      {(estimate.cust_first || estimate.cust_last || estimate.cust_phone || estimate.cust_email || estimate.cust_address) && (
        <Card className="mb-4">
          <p className="text-xs text-blue uppercase font-semibold tracking-wider mb-2">Customer</p>
          <div className="space-y-1">
            <p className="font-semibold text-ink text-base">
              {[estimate.cust_first, estimate.cust_last].filter(Boolean).join(' ') || estimate.customer_name || '—'}
            </p>
            {estimate.cust_phone && (
              <a
                href={`tel:${estimate.cust_phone}`}
                className="block text-sm text-blue hover:underline"
              >
                📞 {estimate.cust_phone}
              </a>
            )}
            {estimate.cust_email && (
              <a
                href={`mailto:${estimate.cust_email}`}
                className="block text-sm text-blue hover:underline truncate"
              >
                ✉️ {estimate.cust_email}
              </a>
            )}
            {(estimate.cust_address || estimate.cust_city) && (
              <p className="text-sm text-ink">
                📍 {[estimate.cust_address, estimate.cust_city, estimate.cust_state, estimate.cust_zip]
                      .filter(Boolean)
                      .join(', ')}
              </p>
            )}
          </div>
        </Card>
      )}

      {/* GBB Tiers */}
      {isGbb && (
        <div className="mb-4">
          <p className="text-xs text-muted uppercase font-medium mb-3">Options</p>
          {tiers.length === 0 ? (
            <Card>
              <p className="text-sm text-muted text-center py-4">Customer hasn't selected an option yet.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {tiers.map((tier, i) => (
                <TierCard key={tier.id || tier._id || i} tier={tier} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Line Items (non-GBB) */}
      {!isGbb && (
        <Card className="mb-4">
          <p className="text-xs text-muted uppercase font-medium mb-3">Line Items</p>
          <div className="space-y-2">
            {lineItems.length === 0 && <p className="text-sm text-muted">No line items.</p>}
            {lineItems.map((item, i) => {
              const qty = Number(item.qty || item.quantity || 1);
              const price = Number(item.unit_price || item.price || 0);
              const itemTotal = Number(item.total || qty * price);
              const isDiscount = item.item_type === 'discount';
              return (
                <div key={i} className="flex items-start justify-between gap-3 py-2 border-b border-hairline last:border-0">
                  {item.image_url && (
                    <img src={item.image_url} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0 border border-hairline" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink">{item.name}</p>
                    {item.description && (
                      <p className="text-xs text-muted mt-0.5">{item.description}</p>
                    )}
                    <p className="text-xs text-muted mt-0.5">
                      {item.sku && <span className="mr-2">SKU: {item.sku}</span>}
                      {qty} × {formatCurrency(price)}
                    </p>
                  </div>
                  <p className={`font-semibold text-sm ${isDiscount ? 'text-red-500' : 'text-ink'}`}>
                    {isDiscount ? '-' : ''}{formatCurrency(itemTotal)}
                  </p>
                </div>
              );
            })}
          </div>
          <div className="mt-3 pt-3 border-t border-hairline flex justify-between">
            <p className="font-bold text-ink">Total</p>
            <p className="font-bold text-xl text-blue">{formatCurrency(total)}</p>
          </div>
        </Card>
      )}

      {/* Signature display */}
      {(estimate.signature) && (
        <Card className="mb-4">
          <p className="text-xs text-muted uppercase font-medium mb-2">Signature</p>
          <img
            src={estimate.signature.startsWith('data:') ? estimate.signature : `data:image/png;base64,${estimate.signature}`}
            alt="Customer signature"
            className="max-h-24 border border-hairline rounded-xl bg-background p-2"
          />
          {estimate.signed_at && (
            <p className="text-xs text-muted mt-1">
              Signed {new Date(estimate.signed_at).toLocaleDateString()}
            </p>
          )}
        </Card>
      )}

      {/* Deposit */}
      {estimate.deposit_required && (
        <Card className="mb-4">
          <p className="text-xs text-muted uppercase font-medium mb-1">Deposit Required</p>
          <p className="font-semibold text-ink">{formatCurrency(estimate.deposit_amount)}</p>
          {estimate.deposit_collected ? (
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium mt-1 inline-block">
              Collected
            </span>
          ) : (
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium mt-1 inline-block">
              Not collected
            </span>
          )}
        </Card>
      )}

      {/* Notes */}
      {estimate.notes && (
        <Card className="mb-4">
          <p className="text-xs text-muted uppercase font-medium mb-1">Notes</p>
          <p className="text-sm text-ink">{estimate.notes}</p>
        </Card>
      )}

      {/* Terms */}
      {estimate.terms && (
        <Card className="mb-4">
          <p className="text-xs text-muted uppercase font-medium mb-1">Terms</p>
          <p className="text-sm text-ink">{estimate.terms}</p>
        </Card>
      )}

      {/* Photo upload */}
      <div className="mb-4">
        <p className="text-xs font-semibold text-blue uppercase tracking-wider mb-2">ATTACHMENTS</p>
        <input
          type="file"
          accept="image/*"
          className="hidden"
          ref={photoInputRef}
          onChange={handlePhotoUpload}
        />
        <Button
          variant="ghost"
          onClick={() => photoInputRef.current?.click()}
          disabled={uploadingPhoto}
        >
          {uploadingPhoto ? 'Uploading...' : '📎 Attach Photo'}
        </Button>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2 pb-4">
        {showPresent && (
          <Button onClick={openTierSelect} className="w-full">
            📊 Present GBB Options
          </Button>
        )}
        {showSend && (
          <Button onClick={openSendModal} loading={loadingSendData} className="w-full">
            Send for Signature
          </Button>
        )}
        <Button
          variant="ghost"
          onClick={() => {
            // GBB money guard: a tier must be selected before signing (select-tier
            // sets the estimate total). Route to the picker if none chosen yet.
            if (isGbb && !estimate.selected_tier_id) openTierSelect();
            else setShowSignature(true);
          }}
          className="w-full"
        >
          ✍️ Get Signature
        </Button>
        {showConvert && (
          <Button onClick={handleConvert} loading={acting} className="w-full">
            Convert to Invoice
          </Button>
        )}
        {showCollectDeposit && can('payments_refunds','edit_self') && (
          <Button variant="outlined" onClick={() => setDepositModal(true)} className="w-full">
            Collect Deposit
          </Button>
        )}
        <Button variant="outlined" onClick={() => navigate(`/estimates/${id}/edit`)} className="w-full">
          Edit Estimate
        </Button>
        {!isSigned && can('estimates_invoices','full') && (
          <Button
            variant="outlined"
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full text-red-600 border-red-300 hover:bg-red-50"
          >
            Delete Estimate
          </Button>
        )}
      </div>

      {/* Signature Modal */}
      <Modal
        isOpen={showSignature}
        onClose={() => setShowSignature(false)}
        title="Get Signature"
      >
        <div className="space-y-3">
          <input
            className="w-full border border-hairline rounded-xl px-4 py-3 text-base min-h-[44px] focus:outline-none focus:ring-2 focus:ring-blue"
            placeholder="Signer's full name"
            value={signerName}
            onChange={e => setSignerName(e.target.value)}
          />
          <SignaturePad
            onSave={handleCaptureSignature}
            onCancel={() => setShowSignature(false)}
          />
        </div>
      </Modal>

      {/* Present Options (GBB): select a tier, then sign */}
      <Modal
        isOpen={showTierSelect}
        onClose={() => setShowTierSelect(false)}
        title="Present Options"
      >
        <div className="space-y-3">
          <p className="text-sm text-muted">Have the customer choose an option, then capture their signature.</p>
          {tiers.length === 0 ? (
            <p className="text-sm text-muted text-center py-4">No options on this estimate.</p>
          ) : (
            tiers.map((tier, i) => (
              <TierCard
                key={tier.id || tier._id || i}
                tier={tier}
                selectable
                selected={selectedTierId === (tier.id || tier._id)}
                onClick={() => setSelectedTierId(tier.id || tier._id)}
              />
            ))
          )}
          <Button
            onClick={handleConfirmTierAndSign}
            loading={selectingTier}
            disabled={!selectedTierId}
            className="w-full"
          >
            Confirm Selection &amp; Sign
          </Button>
        </div>
      </Modal>

      {/* Add to Invoice Modal */}
      <Modal
        isOpen={showAddToInvoiceModal}
        onClose={() => setShowAddToInvoiceModal(false)}
        title="Add to Invoice?"
        footer={
          <>
            <Button variant="outlined" onClick={() => setShowAddToInvoiceModal(false)}>No</Button>
            <Button loading={acting || checkingInvoice} onClick={handleAddToInvoiceYes}>Yes</Button>
          </>
        }
      >
        <p className="text-sm text-ink">Signature captured! Would you like to convert this estimate to an invoice now?</p>
      </Modal>

      {/* Keep / Replace Modal */}
      <Modal
        isOpen={showKeepReplaceModal}
        onClose={() => { setShowKeepReplaceModal(false); handleConvert(); }}
        title="Invoice already has items"
        footer={
          <>
            <Button variant="outlined" loading={acting} onClick={handleKeepAndAdd}>Keep &amp; Add</Button>
            <Button loading={acting} onClick={() => { setShowKeepReplaceModal(false); handleConvert(); }}>Replace</Button>
          </>
        }
      >
        <p className="text-sm text-ink">Keep existing items and add estimate items, or replace all items with estimate items?</p>
      </Modal>

      {/* Collect Deposit Modal */}
      <Modal
        isOpen={depositModal}
        onClose={closeDepositModal}
        title="Collect Deposit"
        footer={
          <>
            <Button variant="outlined" onClick={closeDepositModal}>Cancel</Button>
            {!depQr && !depLink && (
              <Button loading={collectingDeposit} onClick={handleCollectDeposit}>Record Manually</Button>
            )}
          </>
        }
      >
        <div className="space-y-3">
          {estimate.deposit_amount && (
            <p className="text-sm text-ink">
              Deposit amount: <strong>{formatCurrency(estimate.deposit_amount)}</strong>
            </p>
          )}

          {/* P2.38: ScanPay — QR on-screen (customer present) or send a payment link */}
          {depQr ? (
            <div className="flex flex-col items-center gap-3 py-2">
              <img src={depQr.qr_data_url} alt="Deposit QR" className="w-56 h-56 rounded-xl border border-hairline" />
              <div className="flex items-center gap-2 text-sm text-muted">
                <span className="inline-block w-3 h-3 rounded-full border-2 border-blue border-t-transparent animate-spin" />
                Waiting for payment…
              </div>
              <Button variant="ghost" onClick={() => navigator.clipboard?.writeText(depQr.payment_url)}>Copy payment link</Button>
            </div>
          ) : depLink ? (
            <div className="flex flex-col items-center gap-3 py-2 text-center">
              <div className="text-green-600 text-sm font-medium">Deposit link sent{depLink.phone_used ? ` to ${depLink.phone_used}` : ''}.</div>
              <div className="flex items-center gap-2 text-sm text-muted">
                <span className="inline-block w-3 h-3 rounded-full border-2 border-blue border-t-transparent animate-spin" />
                Waiting for payment…
              </div>
              <Button variant="ghost" onClick={() => navigator.clipboard?.writeText(depLink.payment_url)}>Copy payment link</Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outlined" loading={depScanpayBusy} onClick={handleDepositScanpayQr}>📲 Show QR (ScanPay)</Button>
                <Button variant="outlined" loading={depScanpayBusy} onClick={handleDepositScanpayLink}>🔗 Send Link</Button>
              </div>
              <div className="flex items-center gap-2 py-1">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-muted">or record manually</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
              <Select
                label="Payment Method"
                value={depositForm.method}
                onChange={e => setDepositForm(p => ({ ...p, method: e.target.value }))}
                options={PAYMENT_METHODS}
              />
              <Input
                label="Amount"
                type="number"
                value={depositForm.amount}
                onChange={e => setDepositForm(p => ({ ...p, amount: e.target.value }))}
                placeholder={estimate.deposit_amount?.toString() || '0.00'}
              />
            </>
          )}
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => !deleting && setShowDeleteConfirm(false)}
        title="Delete Estimate"
        footer={
          <>
            <Button variant="outlined" disabled={deleting} onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
            <Button loading={deleting} onClick={handleDelete} className="bg-red-600 hover:bg-red-700 border-red-600">
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink">Are you sure? This cannot be undone.</p>
      </Modal>

      {/* Send for Signature Modal */}
      <Modal
        isOpen={showSendModal}
        onClose={() => !sending && setShowSendModal(false)}
        title="Send for Signature"
        footer={
          <>
            <Button variant="outlined" disabled={sending} onClick={() => setShowSendModal(false)}>Cancel</Button>
            <Button loading={sending} onClick={handleSendConfirm}>Send</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <p className="text-xs text-muted uppercase font-medium mb-2">Email Recipients</p>
            {sendEmails.length === 0 && <p className="text-sm text-muted">No emails on file.</p>}
            {sendEmails.map((entry, i) => (
              <label key={i} className="flex items-center gap-2 py-1">
                <input
                  type="checkbox"
                  checked={entry.checked}
                  onChange={e => setSendEmails(prev => prev.map((p, idx) => idx === i ? { ...p, checked: e.target.checked } : p))}
                />
                <span className="text-sm text-ink">{entry.value}</span>
              </label>
            ))}
            <div className="flex items-center gap-2 mt-2">
              <input
                type="email"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                placeholder="Add email..."
                className="flex-1 rounded-xl border border-hairline px-3 py-2 text-sm min-h-[40px] focus:outline-none focus:ring-2 focus:ring-blue"
              />
              <Button variant="outlined" onClick={handleAddSendEmail} className="text-sm">Add</Button>
            </div>
          </div>
          <div>
            <p className="text-xs text-muted uppercase font-medium mb-2">SMS / Phone Recipients</p>
            {sendPhones.length === 0 && <p className="text-sm text-muted">No phones on file.</p>}
            {sendPhones.map((entry, i) => (
              <label key={i} className="flex items-center gap-2 py-1">
                <input
                  type="checkbox"
                  checked={entry.checked}
                  onChange={e => setSendPhones(prev => prev.map((p, idx) => idx === i ? { ...p, checked: e.target.checked } : p))}
                />
                <span className="text-sm text-ink">{entry.value}</span>
              </label>
            ))}
            <div className="flex items-center gap-2 mt-2">
              <input
                type="tel"
                value={newPhone}
                onChange={e => setNewPhone(e.target.value)}
                placeholder="Add phone..."
                className="flex-1 rounded-xl border border-hairline px-3 py-2 text-sm min-h-[40px] focus:outline-none focus:ring-2 focus:ring-blue"
              />
              <Button variant="outlined" onClick={handleAddSendPhone} className="text-sm">Add</Button>
            </div>
          </div>
          <label className="flex items-center gap-2 pt-2 border-t border-hairline">
            <input
              type="checkbox"
              checked={saveContactsToProfile}
              onChange={e => setSaveContactsToProfile(e.target.checked)}
            />
            <span className="text-xs text-muted">Save new contacts to customer profile</span>
          </label>
        </div>
      </Modal>
    </div>
  );
}
