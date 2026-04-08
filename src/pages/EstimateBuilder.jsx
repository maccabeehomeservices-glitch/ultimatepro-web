import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Search } from 'lucide-react';
import api from '../lib/api';
import { useGet } from '../hooks/useApi';
import { Button, Input, Card, Toggle, StepperInput, Modal, LoadingSpinner } from '../components/ui';
import { useSnackbar } from '../components/ui/Snackbar';

const GBB_TIERS = ['good', 'better', 'best'];
const GBB_LABELS = { good: 'Good', better: 'Better', best: 'Best' };
const ITEM_TYPES = ['service', 'material', 'discount'];

function emptyItem(type = 'service') {
  return { name: '', qty: 1, unit_price: '', total: 0, item_type: type };
}

function emptySection() {
  return { services: [emptyItem('service')], materials: [], discounts: [] };
}

function sectionTotal(section) {
  const sum = (arr) => arr.reduce((s, i) => s + (Number(i.unit_price || 0) * Number(i.qty || 1)), 0);
  return sum(section.services) + sum(section.materials) - sum(section.discounts);
}

function calcTotal(section, taxRate, taxEnabled) {
  const sub = sectionTotal(section);
  return taxEnabled ? sub * (1 + Number(taxRate || 0) / 100) : sub;
}

export default function EstimateBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showSnack } = useSnackbar();
  const isEdit = Boolean(id);

  const [customerId, setCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState([]);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('');
  const [taxEnabled, setTaxEnabled] = useState(false);
  const [taxRate, setTaxRate] = useState('8.5');
  const [depositRequired, setDepositRequired] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [depositType, setDepositType] = useState('flat');
  const [saving, setSaving] = useState(false);
  const [pricebookModal, setPricebookModal] = useState(null); // { tier, type } or null (standard)
  const [pricebookSearch, setPricebookSearch] = useState('');
  const searchTimeout = useRef(null);

  // GBB mode
  const [gbbMode, setGbbMode] = useState(false);
  const [activeTier, setActiveTier] = useState('good');

  // Standard mode: single section
  const [stdSection, setStdSection] = useState(emptySection());

  // GBB mode: per-tier sections
  const [gbbSections, setGbbSections] = useState({
    good: emptySection(),
    better: emptySection(),
    best: emptySection(),
  });

  const { data: existingData, loading: loadingExisting } = useGet(isEdit ? `/estimates/${id}` : null, [id]);
  const { data: pricebookData } = useGet(
    pricebookModal !== null ? `/pricebook/items${pricebookSearch ? `?search=${encodeURIComponent(pricebookSearch)}` : ''}` : null,
    [pricebookModal, pricebookSearch]
  );

  useEffect(() => {
    if (isEdit && existingData) {
      const e = existingData.estimate || existingData;
      setCustomerId(e.customer_id || '');
      setCustomerName(e.customer_name || e.customer?.name || '');
      setCustomerSearch(e.customer_name || e.customer?.name || '');
      setTitle(e.title || '');
      setNotes(e.notes || '');
      setTerms(e.terms || '');
      setTaxEnabled(Boolean(e.tax_enabled));
      setTaxRate(e.tax_rate?.toString() || '8.5');
      setDepositRequired(Boolean(e.deposit_required));
      setDepositAmount(e.deposit_amount?.toString() || '');
      setDepositType(e.deposit_type || 'flat');
      if (e.gbb_mode) {
        setGbbMode(true);
        setGbbSections({
          good: e.tiers?.good || emptySection(),
          better: e.tiers?.better || emptySection(),
          best: e.tiers?.best || emptySection(),
        });
      } else {
        const items = e.line_items || e.items || [];
        const services = items.filter(i => i.item_type !== 'material' && i.item_type !== 'discount');
        const materials = items.filter(i => i.item_type === 'material');
        const discounts = items.filter(i => i.item_type === 'discount');
        setStdSection({ services: services.length ? services : [emptyItem('service')], materials, discounts });
      }
    }
  }, [isEdit, existingData]);

  function handleCustomerInput(e) {
    const val = e.target.value;
    setCustomerSearch(val);
    setCustomerId('');
    clearTimeout(searchTimeout.current);
    if (val.length > 1) {
      searchTimeout.current = setTimeout(async () => {
        try {
          const res = await api.get(`/customers?search=${encodeURIComponent(val)}&limit=6`);
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
    setCustomerId(c.id || c._id);
    setCustomerName(name);
    setCustomerSearch(name);
    setShowCustomerDropdown(false);
  }

  function updateSectionItem(getter, setter, type, idx, field, value) {
    setter(prev => {
      const next = { ...prev };
      next[type] = [...prev[type]];
      next[type][idx] = { ...next[type][idx], [field]: value };
      const qty = Number(next[type][idx].qty || 1);
      const price = Number(next[type][idx].unit_price || 0);
      next[type][idx].total = qty * price;
      return next;
    });
  }

  function addItemToSection(setter, type) {
    setter(prev => ({ ...prev, [type]: [...prev[type], emptyItem(type)] }));
  }

  function removeItemFromSection(setter, type, idx) {
    setter(prev => ({ ...prev, [type]: prev[type].filter((_, i) => i !== idx) }));
  }

  function addFromPricebook(pbItem) {
    if (gbbMode && pricebookModal) {
      const { tier, type } = pricebookModal;
      setGbbSections(prev => {
        const next = { ...prev };
        next[tier] = { ...next[tier], [type + 's']: [...next[tier][type + 's'], {
          name: pbItem.name,
          qty: 1,
          unit_price: pbItem.price || pbItem.unit_price || '',
          total: Number(pbItem.price || pbItem.unit_price || 0),
          item_type: type,
        }]};
        return next;
      });
    } else if (pricebookModal) {
      const type = pricebookModal.type || 'service';
      addItemToSection(setStdSection, type + 's');
      // Actually just add the item directly
      setStdSection(prev => ({
        ...prev,
        [type + 's']: [...prev[type + 's'], {
          name: pbItem.name,
          qty: 1,
          unit_price: pbItem.price || pbItem.unit_price || '',
          total: Number(pbItem.price || pbItem.unit_price || 0),
          item_type: type,
        }],
      }));
    }
    setPricebookModal(null);
    setPricebookSearch('');
  }

  // Get the active section for display (GBB mode uses activeTier)
  const activeSection = gbbMode ? gbbSections[activeTier] : stdSection;
  const activeSetter = gbbMode
    ? (updater) => setGbbSections(prev => ({ ...prev, [activeTier]: typeof updater === 'function' ? updater(prev[activeTier]) : updater }))
    : setStdSection;

  // Compute totals
  const stdTotal = calcTotal(stdSection, taxRate, taxEnabled);
  const gbbTotals = {
    good: calcTotal(gbbSections.good, taxRate, taxEnabled),
    better: calcTotal(gbbSections.better, taxRate, taxEnabled),
    best: calcTotal(gbbSections.best, taxRate, taxEnabled),
  };

  async function handleSave(action) {
    if (!customerId) { showSnack('Please select a customer', 'error'); return; }
    setSaving(true);
    try {
      const payload = {
        customer_id: customerId,
        title,
        notes,
        terms,
        tax_enabled: taxEnabled,
        tax_rate: taxEnabled ? Number(taxRate) : 0,
        deposit_required: depositRequired,
        deposit_amount: depositRequired ? Number(depositAmount) : 0,
        deposit_type: depositType,
        gbb_mode: gbbMode,
      };

      if (gbbMode) {
        payload.tiers = gbbSections;
        payload.total = Math.max(gbbTotals.good, gbbTotals.better, gbbTotals.best);
      } else {
        const allItems = [
          ...stdSection.services,
          ...stdSection.materials,
          ...stdSection.discounts,
        ];
        payload.line_items = allItems;
        payload.total = stdTotal;
      }

      if (action === 'send') payload.action = 'send_for_signature';
      if (action === 'get_signature') payload.action = 'get_signature';

      let estimateId = id;
      if (isEdit) {
        await api.put(`/estimates/${id}`, payload);
        showSnack('Estimate updated', 'success');
      } else {
        const res = await api.post('/estimates', payload);
        estimateId = res.data?.estimate?.id || res.data?.id;
        showSnack('Estimate created', 'success');
      }
      navigate(`/estimates/${estimateId}`);
    } catch (err) {
      showSnack(err?.response?.data?.message || 'Failed to save estimate', 'error');
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
              onClick={() => { setPricebookModal({ tier: activeTier, type: itemType }); setPricebookSearch(''); }}
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
                    value={Number(item.qty || 1)}
                    min={1}
                    onChange={v => {
                      setter(prev => {
                        const next = { ...prev, [sectionKey]: [...prev[sectionKey]] };
                        next[sectionKey][idx] = { ...next[sectionKey][idx], qty: v, total: v * Number(next[sectionKey][idx].unit_price || 0) };
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
                        next[sectionKey][idx] = { ...next[sectionKey][idx], unit_price: e.target.value, total: Number(e.target.value || 0) * Number(next[sectionKey][idx].qty || 1) };
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
                    {itemType === 'discount' ? '-' : ''}${(Number(item.unit_price || 0) * Number(item.qty || 1)).toFixed(2)}
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
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
              <input
                value={customerId ? customerName : customerSearch}
                onChange={handleCustomerInput}
                placeholder="Search customer..."
                className="w-full rounded-xl border border-gray-300 px-3 py-2.5 min-h-[44px] focus:outline-none focus:ring-2 focus:ring-[#1A73E8]"
              />
              {showCustomerDropdown && customerResults.length > 0 && (
                <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                  {customerResults.map((c) => (
                    <button key={c.id || c._id} type="button" onClick={() => selectCustomer(c)} className="w-full text-left px-4 py-3 hover:bg-gray-50 text-sm border-b last:border-0">
                      <span className="font-medium">{`${c.first_name || ''} ${c.last_name || ''}`.trim() || c.name}</span>
                      {c.phone && <span className="text-gray-400 ml-2">{c.phone}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Input label="Title / Description" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. AC Tune-Up Service" />
          </div>
        </Card>

        {/* Estimate Mode toggle */}
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">Good-Better-Best Mode</p>
              <p className="text-xs text-gray-400">Present 3 tier options to the customer</p>
            </div>
            <Toggle checked={gbbMode} onChange={(e) => setGbbMode(e.target.checked)} />
          </div>
        </Card>

        {/* GBB tier tabs */}
        {gbbMode && (
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            {GBB_TIERS.map(tier => (
              <button
                key={tier}
                type="button"
                onClick={() => setActiveTier(tier)}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  activeTier === tier ? 'bg-white text-[#1A73E8] shadow-sm' : 'text-gray-500'
                }`}
              >
                {GBB_LABELS[tier]}
                <span className="block text-xs font-normal text-gray-400">
                  ${gbbTotals[tier].toFixed(0)}
                </span>
              </button>
            ))}
          </div>
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
              {gbbMode ? `${GBB_LABELS[activeTier]} Subtotal` : 'Subtotal'}
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
        <Button onClick={() => handleSave('get_signature')} loading={saving} disabled={saving} variant="outlined" className="flex-1">
          Get Sig
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
    </div>
  );
}
