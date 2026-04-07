import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Search } from 'lucide-react';
import api from '../lib/api';
import { useGet } from '../hooks/useApi';
import { Button, Input, Card, Toggle, StepperInput, Modal, LoadingSpinner } from '../components/ui';
import { useSnackbar } from '../components/ui/Snackbar';

function emptyItem() {
  return { name: '', qty: 1, unit_price: '', total: 0 };
}

function calcTotal(items, taxRate, taxEnabled) {
  const subtotal = items.reduce((s, i) => s + (Number(i.unit_price || 0) * Number(i.qty || 1)), 0);
  return taxEnabled ? subtotal * (1 + Number(taxRate || 0) / 100) : subtotal;
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
  const [items, setItems] = useState([emptyItem()]);
  const [notes, setNotes] = useState('');
  const [taxEnabled, setTaxEnabled] = useState(false);
  const [taxRate, setTaxRate] = useState('8.5');
  const [depositRequired, setDepositRequired] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [depositType, setDepositType] = useState('flat');
  const [saving, setSaving] = useState(false);
  const [pricebookModal, setPricebookModal] = useState(false);
  const [pricebookSearch, setPricebookSearch] = useState('');
  const searchTimeout = useRef(null);

  const { data: existingData, loading: loadingExisting } = useGet(isEdit ? `/estimates/${id}` : null, [id]);
  const { data: pricebookData } = useGet(pricebookModal ? `/pricebook/items${pricebookSearch ? `?search=${encodeURIComponent(pricebookSearch)}` : ''}` : null, [pricebookModal, pricebookSearch]);

  useEffect(() => {
    if (isEdit && existingData) {
      const e = existingData.estimate || existingData;
      setCustomerId(e.customer_id || '');
      setCustomerName(e.customer_name || e.customer?.name || '');
      setTitle(e.title || '');
      setItems(e.line_items || e.items || [emptyItem()]);
      setNotes(e.notes || '');
      setTaxEnabled(Boolean(e.tax_enabled));
      setTaxRate(e.tax_rate?.toString() || '8.5');
      setDepositRequired(Boolean(e.deposit_required));
      setDepositAmount(e.deposit_amount?.toString() || '');
      setDepositType(e.deposit_type || 'flat');
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

  function updateItem(idx, field, value) {
    setItems((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      const qty = Number(next[idx].qty || 1);
      const price = Number(next[idx].unit_price || 0);
      next[idx].total = qty * price;
      return next;
    });
  }

  function addItem() { setItems((prev) => [...prev, emptyItem()]); }
  function removeItem(idx) { setItems((prev) => prev.filter((_, i) => i !== idx)); }

  function addFromPricebook(item) {
    setItems((prev) => [...prev, { name: item.name, qty: 1, unit_price: item.price || item.unit_price || '', total: Number(item.price || item.unit_price || 0) }]);
    setPricebookModal(false);
  }

  const total = calcTotal(items, taxRate, taxEnabled);

  async function handleSave() {
    if (!customerId) { showSnack('Please select a customer', 'error'); return; }
    setSaving(true);
    try {
      const payload = {
        customer_id: customerId,
        title,
        line_items: items,
        notes,
        tax_enabled: taxEnabled,
        tax_rate: taxEnabled ? Number(taxRate) : 0,
        deposit_required: depositRequired,
        deposit_amount: depositRequired ? Number(depositAmount) : 0,
        deposit_type: depositType,
        total,
      };
      if (isEdit) {
        await api.put(`/estimates/${id}`, payload);
        showSnack('Estimate updated', 'success');
        navigate(`/estimates/${id}`);
      } else {
        const res = await api.post('/estimates', payload);
        showSnack('Estimate created', 'success');
        navigate(`/estimates/${res.data?.estimate?.id || res.data?.id}`);
      }
    } catch (err) {
      showSnack(err?.response?.data?.message || 'Failed to save estimate', 'error');
    } finally {
      setSaving(false);
    }
  }

  if (isEdit && loadingExisting) return <LoadingSpinner fullPage />;

  const pricebookItems = pricebookData?.items || pricebookData || [];

  return (
    <div className="p-4 max-w-3xl mx-auto">
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

        {/* Line Items */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <p className="font-semibold text-gray-900">Line Items</p>
            <button onClick={() => setPricebookModal(true)} className="text-sm text-[#1A73E8] font-medium min-h-[36px] px-2">Add from Pricebook</button>
          </div>
          <div className="space-y-3">
            {items.map((item, idx) => (
              <div key={idx} className="border border-gray-100 rounded-xl p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    value={item.name}
                    onChange={(e) => updateItem(idx, 'name', e.target.value)}
                    placeholder="Item name"
                    className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A73E8] min-h-[44px]"
                  />
                  <button onClick={() => removeItem(idx)} className="p-2 text-red-400 hover:bg-red-50 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center">
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-xs text-gray-400">Qty</label>
                    <StepperInput value={Number(item.qty || 1)} min={1} onChange={(v) => updateItem(idx, 'qty', v)} />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-gray-400">Unit Price</label>
                    <input
                      type="number"
                      value={item.unit_price}
                      onChange={(e) => updateItem(idx, 'unit_price', e.target.value)}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A73E8] min-h-[44px]"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-gray-400">Total</label>
                    <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-sm font-medium min-h-[44px] flex items-center">
                      ${(Number(item.unit_price || 0) * Number(item.qty || 1)).toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button onClick={addItem} className="mt-3 flex items-center gap-2 text-sm text-[#1A73E8] font-medium min-h-[44px]">
            <Plus size={16} /> Add Line Item
          </button>
        </Card>

        {/* Notes */}
        <Card>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Internal notes or customer-facing notes..." className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A73E8] resize-none" />
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
        <Card>
          <div className="flex items-center justify-between">
            <span className="font-bold text-gray-900 text-lg">Total</span>
            <span className="font-bold text-2xl text-[#1A73E8]">${total.toFixed(2)}</span>
          </div>
        </Card>

        <div className="flex gap-3 pb-4">
          <Button type="button" variant="outlined" onClick={() => navigate(-1)} className="flex-1">Cancel</Button>
          <Button onClick={handleSave} loading={saving} disabled={saving} className="flex-1">
            {isEdit ? 'Save Changes' : 'Create Estimate'}
          </Button>
        </div>
      </div>

      {/* Pricebook Modal */}
      <Modal isOpen={pricebookModal} onClose={() => setPricebookModal(false)} title="Add from Pricebook">
        <div className="space-y-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={pricebookSearch} onChange={(e) => setPricebookSearch(e.target.value)} placeholder="Search items..." className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#1A73E8] min-h-[44px] text-sm" />
          </div>
          {pricebookItems.map((item) => (
            <button key={item.id || item._id} onClick={() => addFromPricebook(item)} className="w-full text-left p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between">
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
