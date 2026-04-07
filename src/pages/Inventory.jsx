import { useState } from 'react';
import { Truck, Package } from 'lucide-react';
import { useGet, useMutation } from '../hooks/useApi';
import { Card, LoadingSpinner, EmptyState, Tabs, StepperInput, Button, Select } from '../components/ui';
import { useSnackbar } from '../components/ui/Snackbar';

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

  const { data: warehouseData, loading: warehouseLoading, refetch: refetchWarehouse } = useGet(
    activeTab === 'warehouse' ? '/inventory/warehouse' : null, [activeTab]
  );
  const { data: trucksData, loading: trucksLoading } = useGet(
    activeTab === 'trucks' ? '/inventory/trucks' : null, [activeTab]
  );
  const { data: truckStockData, loading: truckStockLoading } = useGet(
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

  async function saveItem(item) {
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
                      <div className="flex items-center gap-2">
                        <StepperInput value={getQty(item)} onChange={(v) => setQty(item, v)} min={0} />
                        <Button
                          size="sm"
                          variant="outlined"
                          loading={saving[id]}
                          onClick={() => saveItem(item)}
                          disabled={getQty(item) === Number(item.quantity || item.qty || 0)}
                        >
                          Save
                        </Button>
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
                onChange={(e) => setSelectedTruckId(e.target.value)}
                options={truckOptions}
                placeholder="Choose a truck..."
              />
              {selectedTruckId && (
                truckStockLoading ? <LoadingSpinner /> :
                truckStock.length === 0 ? (
                  <EmptyState icon={Truck} title="No stock" description="No inventory assigned to this truck." />
                ) : (
                  <div className="space-y-2">
                    {truckStock.map((item) => (
                      <Card key={item.id || item._id}>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-900">{item.name}</p>
                            {item.sku && <p className="text-xs text-gray-400">SKU: {item.sku}</p>}
                          </div>
                          <p className="font-semibold text-gray-900">Qty: {item.quantity || item.qty || 0}</p>
                        </div>
                      </Card>
                    ))}
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
    </div>
  );
}
