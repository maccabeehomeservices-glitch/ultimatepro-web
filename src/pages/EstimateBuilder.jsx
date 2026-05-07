import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Search, UserCheck, X, Copy } from 'lucide-react';
import { estimatesApi, customersApi } from '../lib/api';
import { useGet } from '../hooks/useApi';
import { Button, Input, Card, Toggle, StepperInput, Modal, LoadingSpinner } from '../components/ui';
import { useSnackbar } from '../components/ui/Snackbar';
import QuickCreateCustomerModal from '../components/QuickCreateCustomerModal';

const MAX_TIERS = 5;
const MIN_TIERS = 1;
const DEFAULT_NEW_TIER_COUNT = 2;

function emptyItem(type = 'service') {
  return { name: '', quantity: 1, unit_price: '', total: 0, item_type: type };
}

function emptySection() {
  return { services: [], materials: [], discounts: [] };
}

function emptyTier(n) {
  return { label: `Tier ${n}`, description: '', ...emptySection() };
}

function defaultTiers() {
  const arr = [];
  for (let i = 1; i <= DEFAULT_NEW_TIER_COUNT; i++) arr.push(emptyTier(i));
  return arr;
}

function sectionTotal(section) {
  const sum = (arr) => arr.reduce((s, i) => s + (Number(i.unit_price || 0) * Number(i.quantity || 1)), 0);
  return sum(section.services) + sum(section.materials) - sum(section.discounts);
}

function calcTotal(section, taxRate, taxEnabled) {
  const sub = sectionTotal(section);
  return taxEnabled ? sub * (1 + Number(taxRate || 0) / 100) : sub;
}

// Split a flat line_items array (as stored in JSONB) into the
// services/materials/discounts buckets the UI uses.
function splitLineItemsByType(items) {
  const list = Array.isArray(items) ? items : [];
  return {
    services:  list.filter(it => !it.item_type || it.item_type === 'service' || it.item_type === 'labor'),
    materials: list.filter(it => it.item_type === 'material' || it.item_type === 'part'),
    discounts: list.filter(it => it.item_type === 'discount'),
  };
}

export default function EstimateBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { showSnack } = useSnackbar();
  const isEdit = Boolean(id);
  const prefilledJobId = searchParams.get('job_id') || null;
  const prefilledCustomerId = searchParams.get('customer_id') || null;

  const [customerId, setCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState([]);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [quickCreatePrefill, setQuickCreatePrefill] = useState({});
  const [fieldErrors, setFieldErrors] = useState({});
  const customerDropdownRef = useRef(null);

  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('');
  const [taxEnabled, setTaxEnabled] = useState(false);
  const [taxRate, setTaxRate] = useState('8.5');
  const [depositRequired, setDepositRequired] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [depositType, setDepositType] = useState('flat');
  const [saving, setSaving] = useState(false);
  // pricebookModal: { tierIdx?, type } — tierIdx omitted for standard mode
  const [pricebookModal, setPricebookModal] = useState(null);
  const [pricebookSearch, setPricebookSearch] = useState('');
  const searchTimeout = useRef(null);

  // GBB mode + tiers array (1-5 entries, default 2 for new estimates)
  const [gbbMode, setGbbMode] = useState(false);
  const [tiers, setTiers] = useState(defaultTiers());
  const [activeTierIdx, setActiveTierIdx] = useState(0);

  // Standard mode: single section
  const [stdSection, setStdSection] = useState(emptySection());

  const { data: existingData, loading: loadingExisting } = useGet(isEdit ? `/estimates/${id}` : null, [id]);
  const { data: pricebookData } = useGet(
    pricebookModal !== null ? `/pricebook/items${pricebookSearch ? `?search=${encodeURIComponent(pricebookSearch)}` : ''}` : null,
    [pricebookModal, pricebookSearch]
  );

  // Sync hydration from existing estimate row
  useEffect(() => {
    if (isEdit && existingData) {
      const e = existingData.estimate || existingData;
      setCustomerId(e.customer_id || '');
      setCustomerName(e.customer_name || e.customer?.name || '');
      setCustomerSearch(e.customer_name || e.customer?.name || '');
      setNotes(e.notes || '');
      setTerms(e.terms || '');
      setTaxEnabled(Boolean(e.tax_enabled));
      setTaxRate(e.tax_rate?.toString() || '8.5');
      setDepositRequired(Boolean(e.deposit_required));
      setDepositAmount(e.deposit_amount?.toString() || '');
      setDepositType(e.deposit_type || 'flat');
      if (e.presentation_mode === 'gbb') {
        setGbbMode(true);
        // Tier rows fetched separately below
      } else {
        const items = e.line_items || e.items || [];
        setStdSection(splitLineItemsByType(items));
      }
    }
  }, [isEdit, existingData]);

  // Async tier hydration — fetches /estimates/:id/tiers when editing a GBB
  // estimate. Backend returns rows ordered by sort_order with line_items as
  // a flat JSONB array; we split back into services/materials/discounts so
  // the per-section UI keeps working.
  useEffect(() => {
    if (!isEdit || !existingData) return;
    const e = existingData.estimate || existingData;
    if (e.presentation_mode !== 'gbb') return;
    let cancelled = false;
    (async () => {
      try {
        const res = await estimatesApi.getTiers(id);
        if (cancelled) return;
        const apiTiers = res?.data || res || [];
        if (!Array.isArray(apiTiers) || apiTiers.length === 0) {
          setTiers(defaultTiers());
          setActiveTierIdx(0);
          return;
        }
        const loaded = [...apiTiers]
          .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
          .map(t => ({
            id: t.id,
            label: t.tier_label || 'Tier',
            description: t.description || '',
            ...splitLineItemsByType(t.line_items),
          }));
        setTiers(loaded);
        setActiveTierIdx(0);
      } catch (err) {
        console.error('[EstimateBuilder] failed to load tiers:', err);
        setTiers(defaultTiers());
        setActiveTierIdx(0);
      }
    })();
    return () => { cancelled = true; };
  }, [isEdit, existingData, id]);

  // Prefill customer from query params (when navigating from JobDetail)
  useEffect(() => {
    if (isEdit || !prefilledCustomerId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await customersApi.get(prefilledCustomerId);
        if (cancelled) return;
        const c = res.data?.customer || res.data;
        if (c) selectCustomer(c);
      } catch { /* ignore — user can pick manually */ }
    })();
    return () => { cancelled = true; };
  }, [isEdit, prefilledCustomerId]);

  // Outside-click closes customer dropdown
  useEffect(() => {
    function handleMouseDown(e) {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(e.target)) {
        setShowCustomerDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, []);

  function handleCustomerInput(e) {
    const val = e.target.value;
    setCustomerSearch(val);
    setCustomerId('');
    setSelectedCustomer(null);
    if (fieldErrors.customer_id) setFieldErrors(prev => ({ ...prev, customer_id: '' }));
    clearTimeout(searchTimeout.current);
    if (val.length > 1) {
      searchTimeout.current = setTimeout(async () => {
        try {
          const res = await customersApi.list({ search: val, limit: 6 });
          setCustomerResults(res.data?.customers || res.data || []);
          setShowCustomerDropdown(true);
        } catch { setCustomerResults([]); }
      }, 300);
    } else {
      setCustomerResults([]);
      setShowCustomerDropdown(false);
    }
  }

  function selectCustomer(c) {
    const name = `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.name || '';
    setSelectedCustomer(c);
    setCustomerId(c.id || c._id);
    setCustomerName(name);
    setCustomerSearch(name);
    setShowCustomerDropdown(false);
    setFieldErrors(prev => ({ ...prev, customer_id: '' }));
  }

  function onCustomerCreated(customer) {
    setShowQuickCreate(false);
    selectCustomer(customer);
  }

  // ── Tier helpers ──────────────────────────────────────────────────────────
  function addTier() {
    setTiers(prev => {
      if (prev.length >= MAX_TIERS) return prev;
      const next = [...prev, emptyTier(prev.length + 1)];
      setActiveTierIdx(next.length - 1);
      return next;
    });
  }

  function removeTier(idx) {
    setTiers(prev => {
      if (prev.length <= MIN_TIERS) {
        showSnack('Need at least 1 option', 'error');
        return prev;
      }
      const next = prev.filter((_, i) => i !== idx);
      setActiveTierIdx(curIdx => Math.min(curIdx, next.length - 1));
      return next;
    });
  }

  function duplicateTier(idx) {
    setTiers(prev => {
      if (prev.length >= MAX_TIERS) {
        showSnack(`Max ${MAX_TIERS} options`, 'error');
        return prev;
      }
      const source = prev[idx];
      if (!source) return prev;
      // Deep-copy line items so edits to the new tier don't mutate the source.
      // Drop `id` (backend assigns fresh ids on next saveTiers — replace-all
      // semantics).
      const copy = {
        label: `${source.label || 'Option'} (Copy)`,
        description: source.description || '',
        services:  source.services.map(it => ({ ...it })),
        materials: source.materials.map(it => ({ ...it })),
        discounts: source.discounts.map(it => ({ ...it })),
      };
      const next = [...prev, copy];
      setActiveTierIdx(next.length - 1);
      return next;
    });
  }

  function updateTier(idx, updater) {
    setTiers(prev => prev.map((t, i) => (i === idx ? updater(t) : t)));
  }

  function updateTierLabel(idx, label) {
    updateTier(idx, t => ({ ...t, label }));
  }

  // Bridges the existing ItemSection setter API (which expects setter(prev =>
  // ({ ...prev, [sectionKey]: ... }))) to our tier-indexed state.
  function tierSectionSetter(idx) {
    return (updater) => {
      setTiers(prev => prev.map((t, i) => {
        if (i !== idx) return t;
        const sub = { services: t.services, materials: t.materials, discounts: t.discounts };
        const nextSub = typeof updater === 'function' ? updater(sub) : updater;
        return { ...t, ...nextSub };
      }));
    };
  }

  function addFromPricebook(pbItem) {
    const buildItem = (type) => ({
      name: pbItem.name,
      description: pbItem.description || null,
      sku: pbItem.sku || null,
      image_url: pbItem.image_url || null,
      pricebook_id: pbItem.id || null,
      quantity: 1,
      unit_price: pbItem.price || pbItem.unit_price || '',
      total: Number(pbItem.price || pbItem.unit_price || 0),
      item_type: type,
      taxable: pbItem.taxable || false,
      tax_rate: Number(pbItem.tax_rate || 0),
    });
    if (gbbMode && pricebookModal && pricebookModal.tierIdx !== undefined) {
      const { tierIdx, type } = pricebookModal;
      updateTier(tierIdx, t => ({
        ...t,
        [type + 's']: [...t[type + 's'], buildItem(type)],
      }));
    } else if (pricebookModal) {
      const type = pricebookModal.type || 'service';
      setStdSection(prev => ({
        ...prev,
        [type + 's']: [...prev[type + 's'], buildItem(type)],
      }));
    }
    setPricebookModal(null);
    setPricebookSearch('');
  }

  // Active section + setter for the rendered editor
  const activeTier = tiers[activeTierIdx] || tiers[0];
  const activeSection = gbbMode
    ? { services: activeTier.services, materials: activeTier.materials, discounts: activeTier.discounts }
    : stdSection;
  const activeSetter = gbbMode ? tierSectionSetter(activeTierIdx) : setStdSection;

  // Compute totals
  const stdTotal = calcTotal(stdSection, taxRate, taxEnabled);
  const tierTotals = tiers.map(t => calcTotal(t, taxRate, taxEnabled));

  async function handleSave(action) {
    const fe = {};
    if (!customerId) fe.customer_id = 'Please select or create a customer';
    const cleanLineItems = (arr) => (arr || []).filter(it => (it.name || '').trim().length > 0);

    const cleanedItems = gbbMode ? [] : [
      ...cleanLineItems(stdSection.services).map(it => ({ ...it, item_type: 'service' })),
      ...cleanLineItems(stdSection.materials).map(it => ({ ...it, item_type: 'material' })),
      ...cleanLineItems(stdSection.discounts).map(it => ({ ...it, item_type: 'discount' })),
    ];
    if (!gbbMode && cleanedItems.length === 0) {
      showSnack('Add at least one line item before saving', 'error');
      return;
    }
    if (gbbMode) {
      // Each tier needs at least one named item to be saveable
      const emptyTiers = tiers.filter(t =>
        cleanLineItems(t.services).length === 0 &&
        cleanLineItems(t.materials).length === 0 &&
        cleanLineItems(t.discounts).length === 0
      );
      if (emptyTiers.length > 0) {
        showSnack(`Add at least one item to "${emptyTiers[0].label}"`, 'error');
        return;
      }
    }
    if (Object.keys(fe).length) { setFieldErrors(fe); return; }
    setSaving(true);
    try {
      // Backend POST /estimates and PUT /estimates/:id require line_items
      // with min:1. For GBB we use the first tier's items as the legacy
      // line_items mirror; the real per-tier data lives in the subsequent
      // saveTiers call.
      const seedItems = gbbMode
        ? [
            ...cleanLineItems(activeTier.services).map(it => ({ ...it, item_type: 'service' })),
            ...cleanLineItems(activeTier.materials).map(it => ({ ...it, item_type: 'material' })),
            ...cleanLineItems(activeTier.discounts).map(it => ({ ...it, item_type: 'discount' })),
          ]
        : cleanedItems;

      const basePayload = {
        customer_id: customerId,
        notes,
        terms,
        line_items: seedItems.map(item => ({
          name: item.name,
          description: item.description || null,
          sku: item.sku || null,
          image_url: item.image_url || null,
          pricebook_id: item.pricebook_id || null,
          quantity: Number(item.quantity || 1),
          unit_price: Number(item.unit_price || 0),
          total: Number(item.quantity || 1) * Number(item.unit_price || 0),
          item_type: item.item_type || 'service',
          taxable: item.taxable || false,
          tax_rate: Number(item.tax_rate || 0),
          discount_pct: Number(item.discount_pct || 0),
        })),
        discount_pct: 0,
      };
      if (!isEdit && prefilledJobId) basePayload.job_id = prefilledJobId;

      let estimateId = id;
      if (isEdit) {
        await estimatesApi.update(id, basePayload);
        showSnack('Estimate updated', 'success');
      } else {
        const res = await estimatesApi.create(basePayload);
        estimateId = res.data?.estimate?.id || res.data?.id;
        showSnack('Estimate created', 'success');
      }

      // Save GBB tiers separately. Backend POST /:id/tiers replaces all
      // tiers for the estimate and stamps presentation_mode='gbb'.
      if (gbbMode && estimateId) {
        const tiersPayload = tiers.map(tier => ({
          tier_label: (tier.label || '').trim() || 'Option',
          description: tier.description || '',
          line_items: [
            ...cleanLineItems(tier.services).map(it => ({ ...it, item_type: 'service' })),
            ...cleanLineItems(tier.materials).map(it => ({ ...it, item_type: 'material' })),
            ...cleanLineItems(tier.discounts).map(it => ({ ...it, item_type: 'discount' })),
          ].map(it => ({
            name: it.name,
            description: it.description || null,
            sku: it.sku || null,
            image_url: it.image_url || null,
            pricebook_id: it.pricebook_id || null,
            quantity: Number(it.quantity || 1),
            unit_price: Number(it.unit_price || 0),
            total: Number(it.quantity || 1) * Number(it.unit_price || 0),
            item_type: it.item_type || 'service',
            taxable: it.taxable || false,
            tax_rate: Number(it.tax_rate || 0),
            discount_pct: Number(it.discount_pct || 0),
          })),
        }));
        await estimatesApi.saveTiers(estimateId, tiersPayload);
      }

      navigate(`/estimates/${estimateId}`);
    } catch (err) {
      showSnack(err?.response?.data?.error || err?.response?.data?.message || 'Failed to save estimate', 'error');
    } finally {
      setSaving(false);
    }
  }

  if (isEdit && loadingExisting) return <LoadingSpinner fullPage />;

  const pricebookItems = pricebookData?.items || pricebookData || [];

  function ItemSection({ section, setter, sectionKey, label, type, itemType }) {
    const items = section[sectionKey] || [];
    return (
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-gray-500 uppercase">{label}</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                const modal = gbbMode
                  ? { tierIdx: activeTierIdx, type: itemType }
                  : { type: itemType };
                setPricebookModal(modal);
                setPricebookSearch('');
              }}
              className="text-xs text-[#1A73E8] font-medium"
            >
              Pricebook
            </button>
            <button
              type="button"
              onClick={() => setter(prev => ({ ...prev, [sectionKey]: [...prev[sectionKey], emptyItem(itemType)] }))}
              className="flex items-center gap-0.5 text-xs text-[#1A73E8] font-medium min-h-[44px]"
            >
              <Plus size={12} /> Add
            </button>
          </div>
        </div>
        {items.length === 0 && (
          <p className="text-xs text-gray-400 py-2 text-center">No {label.toLowerCase()} added.</p>
        )}
        <div className="space-y-2">
          {items.map((item, idx) => (
            <div key={idx} className="border border-gray-100 rounded-xl p-3 space-y-2">
              <div className="flex items-center gap-2">
                {item.image_url && (
                  <img src={item.image_url} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0 border border-gray-100" />
                )}
                <input
                  value={item.name}
                  onChange={e => {
                    setter(prev => {
                      const next = { ...prev, [sectionKey]: [...prev[sectionKey]] };
                      next[sectionKey][idx] = { ...next[sectionKey][idx], name: e.target.value };
                      return next;
                    });
                  }}
                  placeholder="Item name"
                  className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A73E8] min-h-[44px]"
                />
                <div className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => setter(prev => {
                      const arr = [...prev[sectionKey]];
                      [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
                      return { ...prev, [sectionKey]: arr };
                    })}
                    className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-20 rounded"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    disabled={idx === items.length - 1}
                    onClick={() => setter(prev => {
                      const arr = [...prev[sectionKey]];
                      [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
                      return { ...prev, [sectionKey]: arr };
                    })}
                    className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-20 rounded"
                  >
                    ▼
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setter(prev => ({ ...prev, [sectionKey]: prev[sectionKey].filter((_, i) => i !== idx) }))}
                  className="p-2 text-red-400 hover:bg-red-50 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-xs text-gray-400">Qty</label>
                  <StepperInput
                    value={Number(item.quantity || 1)}
                    min={1}
                    onChange={v => {
                      setter(prev => {
                        const next = { ...prev, [sectionKey]: [...prev[sectionKey]] };
                        next[sectionKey][idx] = { ...next[sectionKey][idx], quantity: v, total: v * Number(next[sectionKey][idx].unit_price || 0) };
                        return next;
                      });
                    }}
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-400">Unit Price</label>
                  <input
                    type="number"
                    value={item.unit_price}
                    onChange={e => {
                      setter(prev => {
                        const next = { ...prev, [sectionKey]: [...prev[sectionKey]] };
                        next[sectionKey][idx] = { ...next[sectionKey][idx], unit_price: e.target.value, total: Number(e.target.value || 0) * Number(next[sectionKey][idx].quantity || 1) };
                        return next;
                      });
                    }}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A73E8] min-h-[44px]"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-400">Total</label>
                  <div className={`rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-sm font-medium min-h-[44px] flex items-center ${itemType === 'discount' ? 'text-red-500' : ''}`}>
                    {itemType === 'discount' ? '-' : ''}${(Number(item.unit_price || 0) * Number(item.quantity || 1)).toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-3xl mx-auto pb-32">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-600">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-gray-900">{isEdit ? 'Edit Estimate' : 'New Estimate'}</h1>
      </div>

      <div className="space-y-4">
        {/* Customer */}
        <Card>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
              {selectedCustomer ? (
                <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                  <UserCheck size={18} className="text-[#1A73E8] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">
                      {`${selectedCustomer.first_name || ''} ${selectedCustomer.last_name || ''}`.trim() || selectedCustomer.name}
                    </p>
                    {selectedCustomer.phone && <p className="text-xs text-gray-500">{selectedCustomer.phone}</p>}
                  </div>
                  <button type="button" onClick={() => { setSelectedCustomer(null); setCustomerId(''); setCustomerName(''); setCustomerSearch(''); }}
                    className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg">
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <div className="relative" ref={customerDropdownRef}>
                  <input
                    value={customerSearch}
                    onChange={handleCustomerInput}
                    placeholder="Search customer by name, phone, or email..."
                    className={`w-full rounded-xl border px-3 py-2.5 min-h-[44px] text-[16px] focus:outline-none focus:ring-2 focus:ring-[#1A73E8] ${fieldErrors.customer_id ? 'border-red-400' : 'border-gray-300'}`}
                  />
                  {showCustomerDropdown && (
                    <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                      {customerResults.map((c) => (
                        <button key={c.id || c._id} type="button" onClick={() => selectCustomer(c)} className="w-full text-left px-4 py-3 hover:bg-gray-50 text-sm border-b last:border-0 flex items-center justify-between">
                          <span className="font-medium">{`${c.first_name || ''} ${c.last_name || ''}`.trim() || c.name}</span>
                          {c.phone && <span className="text-gray-400 text-xs">{c.phone}</span>}
                        </button>
                      ))}
                      <button type="button" onClick={() => { setShowCustomerDropdown(false); setShowQuickCreate(true); setQuickCreatePrefill({ first_name: customerSearch }); }}
                        className="w-full text-left px-4 py-3 hover:bg-blue-50 text-sm text-[#1A73E8] font-medium flex items-center gap-2">
                        <Plus size={14} /> Create new customer
                      </button>
                    </div>
                  )}
                  {!showCustomerDropdown && customerSearch.length > 1 && !selectedCustomer && (
                    <button type="button" onClick={() => { setShowQuickCreate(true); setQuickCreatePrefill({ first_name: customerSearch }); }}
                      className="mt-1.5 text-sm text-[#1A73E8] font-medium flex items-center gap-1 min-h-[36px]">
                      <Plus size={14} /> Create new customer
                    </button>
                  )}
                </div>
              )}
              {fieldErrors.customer_id && <p className="text-red-500 text-xs mt-1">{fieldErrors.customer_id}</p>}
            </div>
          </div>
        </Card>

        {/* Estimate Mode toggle */}
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">Good-Better-Best Mode</p>
              <p className="text-xs text-gray-400">Present 1–5 tier options to the customer</p>
            </div>
            <Toggle checked={gbbMode} onChange={(e) => setGbbMode(e.target.checked)} />
          </div>
        </Card>

        {/* GBB tier tabs (chip-style row, scrollable, with Add Option) */}
        {gbbMode && (
          <div className="flex gap-2 overflow-x-auto pb-2">
            {tiers.map((tier, idx) => {
              const isActive = idx === activeTierIdx;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveTierIdx(idx)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium whitespace-nowrap min-h-[44px] transition-colors ${
                    isActive
                      ? 'bg-[#1A73E8] text-white border border-[#1A73E8]'
                      : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span>{tier.label || `Tier ${idx + 1}`}</span>
                  <span className={`text-xs ${isActive ? 'text-blue-100' : 'text-gray-400'}`}>
                    ${tierTotals[idx].toFixed(0)}
                  </span>
                  {isActive && tiers.length < MAX_TIERS && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); duplicateTier(idx); }}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); duplicateTier(idx); } }}
                      className="ml-1 w-5 h-5 rounded-full flex items-center justify-center hover:bg-white/20 cursor-pointer"
                      title="Duplicate this option"
                    >
                      <Copy size={12} />
                    </span>
                  )}
                  {isActive && tiers.length > MIN_TIERS && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); removeTier(idx); }}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); removeTier(idx); } }}
                      className="ml-1 -mr-1 w-5 h-5 rounded-full flex items-center justify-center hover:bg-white/20 cursor-pointer"
                      title="Remove this option"
                    >
                      <X size={12} />
                    </span>
                  )}
                </button>
              );
            })}
            {tiers.length < MAX_TIERS && (
              <button
                type="button"
                onClick={addTier}
                className="px-3 py-2 rounded-full text-sm font-medium whitespace-nowrap border border-dashed border-gray-300 text-gray-500 hover:border-[#1A73E8] hover:text-[#1A73E8] flex items-center gap-1 min-h-[44px]"
              >
                <Plus size={14} /> Add Option
              </button>
            )}
          </div>
        )}

        {/* Active tier label + description editors */}
        {gbbMode && activeTier && (
          <Card>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Option Name</label>
            <input
              value={activeTier.label}
              onChange={(e) => updateTierLabel(activeTierIdx, e.target.value)}
              placeholder="e.g., Basic, Premium, Best Value"
              className="w-full rounded-xl border border-gray-300 px-3 py-2.5 min-h-[44px] text-[16px] focus:outline-none focus:ring-2 focus:ring-[#1A73E8] mb-3"
            />
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Description (optional)</label>
            <textarea
              value={activeTier.description}
              onChange={(e) => updateTier(activeTierIdx, t => ({ ...t, description: e.target.value }))}
              rows={2}
              placeholder="Short pitch shown to the customer for this option"
              className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A73E8] resize-none"
            />
          </Card>
        )}

        {/* Line item sections */}
        <Card>
          <ItemSection
            section={activeSection}
            setter={activeSetter}
            sectionKey="services"
            label="Services"
            itemType="service"
          />
          <ItemSection
            section={activeSection}
            setter={activeSetter}
            sectionKey="materials"
            label="Materials"
            itemType="material"
          />
          <ItemSection
            section={activeSection}
            setter={activeSetter}
            sectionKey="discounts"
            label="Discounts"
            itemType="discount"
          />

          {/* Section subtotal */}
          <div className="border-t border-gray-100 pt-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-600">
              {gbbMode ? `${activeTier?.label || 'Option'} Subtotal` : 'Subtotal'}
            </span>
            <span className="text-sm font-bold text-gray-900">
              ${sectionTotal(activeSection).toFixed(2)}
            </span>
          </div>
        </Card>

        {/* Notes */}
        <Card>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            placeholder="Internal notes or customer-facing notes..."
            className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A73E8] resize-none"
          />
        </Card>

        {/* Terms */}
        <Card>
          <label className="block text-sm font-medium text-gray-700 mb-1">Terms & Conditions</label>
          <textarea
            value={terms}
            onChange={e => setTerms(e.target.value)}
            rows={3}
            placeholder="Payment terms, warranty, cancellation policy..."
            className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A73E8] resize-none"
          />
        </Card>

        {/* Tax */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <span className="font-medium text-gray-900">Apply Tax</span>
            <Toggle checked={taxEnabled} onChange={(e) => setTaxEnabled(e.target.checked)} />
          </div>
          {taxEnabled && (
            <Input label="Tax Rate (%)" type="number" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} placeholder="8.5" />
          )}
        </Card>

        {/* Deposit */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <span className="font-medium text-gray-900">Require Deposit</span>
            <Toggle checked={depositRequired} onChange={(e) => setDepositRequired(e.target.checked)} />
          </div>
          {depositRequired && (
            <div className="space-y-3">
              <Input label="Deposit Amount" type="number" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} placeholder="0.00" />
              <div className="flex gap-2">
                {['flat', 'percent'].map((t) => (
                  <button key={t} type="button" onClick={() => setDepositType(t)} className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors min-h-[44px] ${depositType === t ? 'bg-[#1A73E8] text-white border-[#1A73E8]' : 'bg-white text-gray-600 border-gray-200'}`}>
                    {t === 'flat' ? 'Flat Amount' : 'Percentage'}
                  </button>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* Total */}
        {!gbbMode && (
          <Card>
            <div className="flex items-center justify-between">
              <span className="font-bold text-gray-900 text-lg">Total</span>
              <span className="font-bold text-2xl text-[#1A73E8]">${stdTotal.toFixed(2)}</span>
            </div>
          </Card>
        )}
      </div>

      {/* Sticky bottom action buttons */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 flex gap-2 max-w-3xl mx-auto z-10">
        <Button type="button" variant="outlined" onClick={() => navigate(-1)} className="flex-1">
          Cancel
        </Button>
        <Button onClick={() => handleSave('save')} loading={saving} disabled={saving} className="flex-1">
          {isEdit ? 'Save' : 'Save Draft'}
        </Button>
        <Button onClick={() => handleSave('send')} loading={saving} disabled={saving} className="flex-1 bg-green-600 hover:bg-green-700 border-green-600">
          Send
        </Button>
      </div>

      {/* Pricebook Modal */}
      <Modal isOpen={pricebookModal !== null} onClose={() => { setPricebookModal(null); setPricebookSearch(''); }} title="Add from Pricebook">
        <div className="space-y-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={pricebookSearch}
              onChange={(e) => setPricebookSearch(e.target.value)}
              placeholder="Search items..."
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#1A73E8] min-h-[44px] text-sm"
            />
          </div>
          {pricebookItems.map((item) => (
            <button
              key={item.id || item._id}
              onClick={() => addFromPricebook(item)}
              className="w-full text-left p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between"
            >
              <span className="font-medium text-sm text-gray-900">{item.name}</span>
              <span className="text-sm text-[#1A73E8] font-semibold">${Number(item.price || item.unit_price || 0).toFixed(2)}</span>
            </button>
          ))}
          {pricebookItems.length === 0 && <p className="text-center text-gray-400 text-sm py-4">No items found.</p>}
        </div>
      </Modal>

      {/* Quick Create Customer Modal */}
      <QuickCreateCustomerModal
        isOpen={showQuickCreate}
        onClose={() => setShowQuickCreate(false)}
        onCreated={onCustomerCreated}
        prefill={quickCreatePrefill}
      />
    </div>
  );
}
