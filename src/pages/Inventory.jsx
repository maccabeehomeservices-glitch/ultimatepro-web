import { useState } from 'react';
import { Truck, Package, ArrowRight } from 'lucide-react';
import { useGet, useMutation } from '../hooks/useApi';
import { Card, LoadingSpinner, EmptyState, Tabs, StepperInput, Button, Select, Modal } from '../components/ui';
import { useSnackbar } from '../components/ui/Snackbar';
import api from '../lib/api';

const tabList = [
  { id: 'warehouse', label: 'Warehouse' },
  { id: 'trucks', label: 'Trucks' },
];

export default function Inventory() {
  const { showSnack } = useSnackbar();
  const [activeTab, setActiveTab] = useState('warehouse');
  const [selectedTruckId, setSelectedTruckId] = useState('');
  const [itemQtys, setItemQtys] = useState({});
  const [saving, setSaving] = useState({});

  // Truck stock editable qty
  const [truckItemQtys, setTruckItemQtys] = useState({});
  const [savingTruck, setSavingTruck] = useState({});

  // Transfer modal
  const [transferItem, setTransferItem] = useState(null); // warehouse item
  const [transferTruckId, setTransferTruckId] = useState('');
  const [transferQty, setTransferQty] = useState(1);
  const [transferring, setTransferring] = useState(false);

  // Restock modal
  const [restockModal, setRestockModal] = useState(false);
  const [restockItems, setRestockItems] = useState([]);
  const [restockSending, setRestockSending] = useState(false);

  const { data: warehouseData, loading: warehouseLoading, refetch: refetchWarehouse } = useGet(
    activeTab === 'warehouse' ? '/inventory/warehouse' : null, [activeTab]
  );
  const { data: trucksData, loading: trucksLoading } = useGet('/inventory/trucks');
  const { data: truckStockData, loading: truckStockLoading, refetch: refetchTruckStock } = useGet(
    activeTab === 'trucks' && selectedTruckId ? `/inventory/trucks/${selectedTruckId}/stock` : null,
    [selectedTruckId]
  );
  const { mutate } = useMutation();

  const warehouseItems = warehouseData?.items || warehouseData || [];
  const trucks = trucksData?.trucks || trucksData || [];
  const truckStock = truckStockData?.items || truckStockData || [];

  const truckOptions = trucks.map((t) => ({ value: t.id || t._id, label: t.name || t.truck_name || `Truck ${t.id}` }));

  function getQty(item) {
    const id = item.id || item._id;
    return itemQtys[id] !== undefined ? itemQtys[id] : Number(item.quantity || item.qty || 0);
  }

  function setQty(item, qty) {
    const id = item.id || item._id;
    setItemQtys((prev) => ({ ...prev, [id]: qty }));
  }

  function getTruckQty(item) {
    const id = item.id || item._id;
    return truckItemQtys[id] !== undefined ? truckItemQtys[id] : Number(item.quantity || item.qty || 0);
  }

  function setTruckQty(item, qty) {
    const id = item.id || item._id;
    setTruckItemQtys((prev) => ({ ...prev, [id]: qty }));
  }

  async function saveWarehouseItem(item) {
    const id = item.id || item._id;
    const qty = getQty(item);
    setSaving((prev) => ({ ...prev, [id]: true }));
    try {
      await mutate('put', `/inventory/warehouse/${id}`, { quantity: qty });
      showSnack('Quantity updated', 'success');
      refetchWarehouse();
    } catch {
      showSnack('Failed to update', 'error');
    } finally {
      setSaving((prev) => ({ ...prev, [id]: false }));
    }
  }

  async function saveTruckItem(item) {
    const id = item.id || item._id;
    const qty = getTruckQty(item);
    setSavingTruck((prev) => ({ ...prev, [id]: true }));
    try {
      await mutate('put', `/inventory/truck-items/${id}`, { quantity: qty });
      showSnack('Quantity updated', 'success');
      refetchTruckStock();
    } catch {
      showSnack('Failed to update', 'error');
    } finally {
      setSavingTruck((prev) => ({ ...prev, [id]: false }));
    }
  }

  function openRestockModal() {
    setRestockItems(truckStock.map(item => ({
      id: item.id || item._id,
      name: item.name,
      sku: item.sku || '',
      checked: false,
      qty_requested: 1,
    })));
    setRestockModal(true);
  }

  async function handleRestockRequest() {
    const selected = restockItems.filter(i => i.checked);
    if (selected.length === 0) { showSnack('Select at least one item', 'error'); return; }
    setRestockSending(true);
    try {
      await api.post('/inventory/restock-request', {
        truck_id: selectedTruckId,
        items: selected.map(i => ({
          pricebook_item_id: i.id,
          item_name: i.name,
          qty_requested: i.qty_requested,
        })),
      });
      showSnack('Restock request sent to office!', 'success');
      setRestockModal(false);
    } catch {
      showSnack('Failed to send restock request', 'error');
    } finally {
      setRestockSending(false);
    }
  }

  function openTransfer(item) {
    setTransferItem(item);
    setTransferTruckId(trucks.length === 1 ? (trucks[0].id || trucks[0]._id) : '');
    setTransferQty(1);
  }

  async function handleTransfer() {
    if (!transferTruckId) { showSnack('Select a truck', 'error'); return; }
    setTransferring(true);
    try {
      await api.post('/inventory/transfer', {
        item_id: transferItem.id || transferItem._id,
        truck_id: transferTruckId,
        quantity: transferQty,
      });
      showSnack('Transferred', 'success');
      setTransferItem(null);
      refetchWarehouse();
      if (selectedTruckId === transferTruckId) refetchTruckStock();
    } catch {
      showSnack('Failed to transfer', 'error');
    } finally {
      setTransferring(false);
    }
  }

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-4">Inventory</h1>

      <Tabs tabs={tabList} active={activeTab} onChange={setActiveTab} />

      <div className="mt-4">
        {activeTab === 'warehouse' && (
          warehouseLoading ? <LoadingSpinner /> :
          warehouseItems.length === 0 ? (
            <EmptyState icon={Package} title="No warehouse items" description="Add items to track warehouse inventory." />
          ) : (
            <div className="space-y-2">
              {warehouseItems.map((item) => {
                const id = item.id || item._id;
                return (
                  <Card key={id}>
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900">{item.name}</p>
                        {item.sku && <p className="text-xs text-gray-400">SKU: {item.sku}</p>}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <StepperInput value={getQty(item)} onChange={(v) => setQty(item, v)} min={0} />
                        <Button
                          size="sm"
                          variant="outlined"
                          loading={saving[id]}
                          onClick={() => saveWarehouseItem(item)}
                          disabled={getQty(item) === Number(item.quantity || item.qty || 0)}
                        >
                          Save
                        </Button>
                        <button
                          onClick={() => openTransfer(item)}
                          className="flex items-center gap-1 text-sm text-[#1A73E8] font-medium px-3 py-2 rounded-xl border border-[#1A73E8] min-h-[44px] hover:bg-blue-50 transition-colors"
                        >
                          <ArrowRight size={14} /> Truck
                        </button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )
        )}

        {activeTab === 'trucks' && (
          trucksLoading ? <LoadingSpinner /> : (
            <div className="space-y-4">
              <Select
                label="Select Truck"
                value={selectedTruckId}
                onChange={(e) => { setSelectedTruckId(e.target.value); setTruckItemQtys({}); }}
                options={truckOptions}
                placeholder="Choose a truck..."
              />
              {selectedTruckId && (
                truckStockLoading ? <LoadingSpinner /> :
                truckStock.length === 0 ? (
                  <EmptyState icon={Truck} title="No stock" description="No inventory assigned to this truck." />
                ) : (
                  <div className="space-y-2">
                    {truckStock.map((item) => {
                      const id = item.id || item._id;
                      return (
                        <Card key={id}>
                          <div className="flex items-center justify-between gap-3 flex-wrap">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900">{item.name}</p>
                              {item.sku && <p className="text-xs text-gray-400">SKU: {item.sku}</p>}
                            </div>
                            <div className="flex items-center gap-2">
                              <StepperInput value={getTruckQty(item)} onChange={(v) => setTruckQty(item, v)} min={0} />
                              <Button
                                size="sm"
                                variant="outlined"
                                loading={savingTruck[id]}
                                onClick={() => saveTruckItem(item)}
                                disabled={getTruckQty(item) === Number(item.quantity || item.qty || 0)}
                              >
                                Save
                              </Button>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                    <Button variant="outlined" onClick={openRestockModal} className="w-full mt-2">
                      Request Restock
                    </Button>
                  </div>
                )
              )}
              {!selectedTruckId && trucks.length === 0 && (
                <EmptyState icon={Truck} title="No trucks" description="No trucks configured." />
              )}
            </div>
          )
        )}
      </div>

      {/* Restock Modal */}
      <Modal
        isOpen={restockModal}
        onClose={() => setRestockModal(false)}
        title="Request Restock"
        footer={
          <>
            <Button variant="outlined" onClick={() => setRestockModal(false)}>Cancel</Button>
            <Button loading={restockSending} onClick={handleRestockRequest}>Send Request</Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-500">Select items you need restocked and enter the quantity needed.</p>
          {restockItems.map((item, i) => (
            <div key={item.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
              <input
                type="checkbox"
                checked={item.checked}
                onChange={e => setRestockItems(prev => prev.map((it, j) => j === i ? { ...it, checked: e.target.checked } : it))}
                className="w-5 h-5 rounded accent-[#1A73E8] flex-shrink-0"
              />
              <span className="flex-1 text-sm font-medium text-gray-900 min-w-0 truncate">{item.name}</span>
              {item.checked && (
                <StepperInput
                  value={item.qty_requested}
                  min={1}
                  onChange={v => setRestockItems(prev => prev.map((it, j) => j === i ? { ...it, qty_requested: v } : it))}
                />
              )}
            </div>
          ))}
        </div>
      </Modal>

      {/* Transfer Modal */}
      <Modal
        isOpen={Boolean(transferItem)}
        onClose={() => setTransferItem(null)}
        title={transferItem ? `Transfer ${transferItem.name}` : 'Transfer'}
        footer={
          <>
            <Button variant="outlined" onClick={() => setTransferItem(null)}>Cancel</Button>
            <Button loading={transferring} onClick={handleTransfer}>Transfer</Button>
          </>
        }
      >
        {transferItem && (
          <div className="space-y-4">
            <Select
              label="Destination Truck"
              value={transferTruckId}
              onChange={(e) => setTransferTruckId(e.target.value)}
              options={[{ value: '', label: 'Select a truck...' }, ...truckOptions]}
            />
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">Quantity</p>
              <StepperInput
                value={transferQty}
                onChange={setTransferQty}
                min={1}
                max={Number(transferItem.quantity || transferItem.qty || 0)}
              />
              <p className="text-xs text-gray-400 mt-1">
                Available: {Number(transferItem.quantity || transferItem.qty || 0)}
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
