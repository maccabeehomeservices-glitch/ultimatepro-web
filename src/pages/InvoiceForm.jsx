import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Search } from 'lucide-react';
import { invoicesApi, customersApi } from '../lib/api';
import api from '../lib/api';
import { Button, Input, Card, Modal, LoadingSpinner } from '../components/ui';
import { useSnackbar } from '../components/ui/Snackbar';

function formatCurrency(v) {
  return '$' + Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function emptyItem() {
  return { name: '', quantity: 1, unit_price: '', total: 0 };
}

export default function InvoiceForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const { showSnack } = useSnackbar();

  const [customerId, setCustomerId] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState([]);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const customerDropdownRef = useRef(null);
  const searchTO = useRef(null);

  const [lineItems, setLineItems] = useState([emptyItem()]);
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('Net 30');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);

  // Pricebook search modal
  const [pbModal, setPbModal] = useState(false);
  const [pbSearch, setPbSearch] = useState('');
  const [pbResults, setPbResults] = useState([]);
  const [pbLoading, setPbLoading] = useState(false);
  const pbTO = useRef(null);

  // Pre-fill customer from location state (e.g. from CustomerDetail)
  useEffect(() => {
    const preCustomer = location.state?.customer;
    if (preCustomer) {
      setCustomerId(preCustomer.id || '');
      setCustomerSearch(preCustomer.name || '');
      setSelectedCustomer(preCustomer);
    }
    const preJobId = location.state?.job_id;
    if (preJobId) setNotes(`Job #${preJobId}`);
  }, []);

  // Outside-click closes dropdown
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
    clearTimeout(searchTO.current);
    if (val.length > 1) {
      searchTO.current = setTimeout(async () => {
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
    setCustomerSearch(name);
    setShowCustomerDropdown(false);
  }

  function handleItemChange(idx, field, value) {
    setLineItems(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      const qty = Number(field === 'quantity' ? value : next[idx].quantity) || 1;
      const price = Number(field === 'unit_price' ? value : next[idx].unit_price) || 0;
      next[idx].total = qty * price;
      return next;
    });
  }

  function addItem() {
    setLineItems(prev => [...prev, emptyItem()]);
  }

  function removeItem(idx) {
    setLineItems(prev => prev.filter((_, i) => i !== idx));
  }

  function handlePbSearch(val) {
    setPbSearch(val);
    clearTimeout(pbTO.current);
    if (!val.trim()) { setPbResults([]); return; }
    setPbLoading(true);
    pbTO.current = setTimeout(async () => {
      try {
        const res = await api.get(`/pricebook/items?search=${encodeURIComponent(val)}&limit=10`);
        setPbResults(res.data?.items || res.data || []);
      } catch { setPbResults([]); }
      finally { setPbLoading(false); }
    }, 300);
  }

  function addFromPricebook(item) {
    setLineItems(prev => [...prev, {
      name: item.name,
      quantity: 1,
      unit_price: item.unit_price || item.price || 0,
      total: Number(item.unit_price || item.price || 0),
    }]);
    setPbModal(false);
    setPbSearch('');
    setPbResults([]);
  }

  const subtotal = lineItems.reduce((s, i) => s + (Number(i.total) || 0), 0);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!customerId) { showSnack('Please select a customer', 'error'); return; }
    if (!lineItems.some(i => i.name.trim())) { showSnack('Add at least one line item', 'error'); return; }

    setSaving(true);
    try {
      const payload = {
        customer_id: customerId,
        notes: notes || undefined,
        terms: terms || 'Net 30',
        due_date: dueDate || undefined,
        line_items: lineItems.filter(i => i.name.trim()).map(i => ({
          name: i.name,
          quantity: Number(i.quantity) || 1,
          unit_price: Number(i.unit_price) || 0,
          total: Number(i.total) || 0,
        })),
      };
      const res = await invoicesApi.create(payload);
      const inv = res.data?.invoice || res.data;
      showSnack('Invoice created', 'success');
      navigate(`/invoices/${inv.id}`);
    } catch (err) {
      showSnack(err?.response?.data?.error || 'Failed to create invoice', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 max-w-3xl mx-auto pb-32">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-600">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-gray-900">New Invoice</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Customer */}
        <Card>
          <label className="block text-sm font-medium text-gray-700 mb-1">Customer *</label>
          {selectedCustomer ? (
            <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900">{customerSearch}</p>
                {selectedCustomer.phone && <p className="text-xs text-gray-500">{selectedCustomer.phone}</p>}
              </div>
              <button type="button" onClick={() => { setSelectedCustomer(null); setCustomerId(''); setCustomerSearch(''); }}
                className="text-gray-400 hover:text-red-500 p-1 rounded-lg text-xs">✕</button>
            </div>
          ) : (
            <div className="relative" ref={customerDropdownRef}>
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={customerSearch}
                onChange={handleCustomerInput}
                placeholder="Search customer by name or phone..."
                className="w-full rounded-xl border border-gray-300 pl-9 pr-3 py-2.5 min-h-[44px] text-sm focus:outline-none focus:ring-2 focus:ring-[#1A73E8]"
              />
              {showCustomerDropdown && customerResults.length > 0 && (
                <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                  {customerResults.map(c => (
                    <button key={c.id} type="button" onClick={() => selectCustomer(c)}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 text-sm border-b last:border-0 flex items-center justify-between">
                      <span className="font-medium">{`${c.first_name || ''} ${c.last_name || ''}`.trim() || c.name}</span>
                      {c.phone && <span className="text-gray-400 text-xs">{c.phone}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Line Items */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-gray-800">Line Items</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => { setPbModal(true); setPbSearch(''); setPbResults([]); }}
                className="text-xs text-[#1A73E8] font-medium min-h-[36px]">Pricebook</button>
              <button type="button" onClick={addItem}
                className="flex items-center gap-1 text-xs text-[#1A73E8] font-medium min-h-[36px]">
                <Plus size={12} /> Add
              </button>
            </div>
          </div>
          <div className="space-y-3">
            {lineItems.map((item, idx) => (
              <div key={idx} className="border border-gray-100 rounded-xl p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    value={item.name}
                    onChange={e => handleItemChange(idx, 'name', e.target.value)}
                    placeholder="Item name"
                    className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A73E8] min-h-[44px]"
                  />
                  <button type="button" onClick={() => removeItem(idx)}
                    className="p-2 text-red-400 hover:bg-red-50 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center">
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs text-gray-400">Qty</label>
                    <input type="number" min="1" value={item.quantity}
                      onChange={e => handleItemChange(idx, 'quantity', e.target.value)}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A73E8] min-h-[44px]" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">Unit Price</label>
                    <input type="number" min="0" step="0.01" value={item.unit_price}
                      onChange={e => handleItemChange(idx, 'unit_price', e.target.value)}
                      placeholder="0.00"
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A73E8] min-h-[44px]" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">Total</label>
                    <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-sm font-medium min-h-[44px] flex items-center">
                      {formatCurrency(item.total)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between">
            <p className="font-semibold text-gray-700">Subtotal</p>
            <p className="font-bold text-[#1A73E8]">{formatCurrency(subtotal)}</p>
          </div>
        </Card>

        {/* Details */}
        <Card>
          <div className="space-y-3">
            <Input label="Terms" value={terms} onChange={e => setTerms(e.target.value)} placeholder="Net 30" />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm min-h-[44px] focus:outline-none focus:ring-2 focus:ring-[#1A73E8]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                placeholder="Optional notes..."
                className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A73E8] resize-none" />
            </div>
          </div>
        </Card>

        <div className="flex gap-3">
          <Button type="button" variant="outlined" onClick={() => navigate(-1)} className="flex-1">Cancel</Button>
          <Button type="submit" loading={saving} disabled={saving} className="flex-1">Create Invoice</Button>
        </div>
      </form>

      {/* Pricebook Modal */}
      <Modal isOpen={pbModal} onClose={() => { setPbModal(false); setPbSearch(''); setPbResults([]); }} title="Add from Pricebook">
        <div className="space-y-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={pbSearch} onChange={e => handlePbSearch(e.target.value)}
              placeholder="Search pricebook..."
              className="w-full rounded-xl border border-gray-300 pl-9 pr-3 py-2.5 min-h-[44px] text-sm focus:outline-none focus:ring-2 focus:ring-[#1A73E8]"
              autoFocus />
          </div>
          {pbLoading && <LoadingSpinner />}
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {pbResults.map(item => (
              <button key={item.id} type="button" onClick={() => addFromPricebook(item)}
                className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-gray-50 border border-gray-100 flex items-center justify-between min-h-[44px]">
                <span className="text-sm font-medium text-gray-900">{item.name}</span>
                <span className="text-sm font-bold text-[#1A73E8]">{formatCurrency(item.unit_price || item.price)}</span>
              </button>
            ))}
            {pbSearch && !pbLoading && pbResults.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">No items found</p>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
