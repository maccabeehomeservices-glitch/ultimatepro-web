import { useState } from 'react';
import { Plus, BookOpen } from 'lucide-react';
import { useGet, useMutation } from '../hooks/useApi';
import { Card, LoadingSpinner, EmptyState, Modal, Input, Button } from '../components/ui';
import { useSnackbar } from '../components/ui/Snackbar';

function formatCurrency(v) {
  return '$' + Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function Pricebook() {
  const { showSnack } = useSnackbar();
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [addModal, setAddModal] = useState(false);
  const [itemForm, setItemForm] = useState({ name: '', price: '', description: '' });
  const { mutate, loading: saving } = useMutation();

  const { data: catData, loading: catLoading } = useGet('/pricebook/categories');
  const { data: itemsData, loading: itemsLoading, refetch: refetchItems } = useGet(
    selectedCategory ? `/pricebook/items?category_id=${selectedCategory.id || selectedCategory._id}` : null,
    [selectedCategory?.id]
  );

  const categories = catData?.categories || catData || [];
  const items = itemsData?.items || itemsData || [];

  async function handleAddItem() {
    if (!itemForm.name.trim()) { showSnack('Item name required', 'error'); return; }
    try {
      await mutate('post', '/pricebook/items', {
        ...itemForm,
        price: Number(itemForm.price),
        category_id: selectedCategory?.id || selectedCategory?._id,
      });
      showSnack('Item added', 'success');
      setAddModal(false);
      setItemForm({ name: '', price: '', description: '' });
      refetchItems();
    } catch {
      showSnack('Failed to add item', 'error');
    }
  }

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-4">Pricebook</h1>

      {catLoading ? (
        <LoadingSpinner />
      ) : !selectedCategory ? (
        categories.length === 0 ? (
          <EmptyState icon={BookOpen} title="No categories" description="Add categories to your pricebook." />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {categories.map((cat) => (
              <Card key={cat.id || cat._id} onClick={() => setSelectedCategory(cat)}>
                <div className="text-center py-2">
                  <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-2">
                    <BookOpen size={22} className="text-[#1A73E8]" />
                  </div>
                  <p className="font-semibold text-gray-900">{cat.name}</p>
                  {cat.item_count != null && (
                    <p className="text-xs text-gray-400 mt-0.5">{cat.item_count} items</p>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )
      ) : (
        <>
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => setSelectedCategory(null)} className="text-sm text-[#1A73E8] font-medium min-h-[44px] flex items-center">
              ← All Categories
            </button>
            <h2 className="font-semibold text-gray-900 flex-1">{selectedCategory.name}</h2>
            <button
              onClick={() => setAddModal(true)}
              className="flex items-center gap-1.5 text-sm text-[#1A73E8] font-medium min-h-[44px]"
            >
              <Plus size={16} /> Add Item
            </button>
          </div>

          {itemsLoading ? (
            <LoadingSpinner />
          ) : items.length === 0 ? (
            <EmptyState icon={BookOpen} title="No items" description="Add items to this category." action={
              <Button onClick={() => setAddModal(true)} size="sm">Add Item</Button>
            } />
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <Card key={item.id || item._id}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{item.name}</p>
                      {item.description && <p className="text-xs text-gray-400">{item.description}</p>}
                    </div>
                    <p className="font-bold text-[#1A73E8]">{formatCurrency(item.price || item.unit_price)}</p>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* Add Item Modal */}
      <Modal
        isOpen={addModal}
        onClose={() => setAddModal(false)}
        title="Add Item"
        footer={
          <>
            <Button variant="outlined" onClick={() => setAddModal(false)}>Cancel</Button>
            <Button loading={saving} onClick={handleAddItem}>Add Item</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input label="Item Name" value={itemForm.name} onChange={(e) => setItemForm((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. AC Filter Replacement" />
          <Input label="Price" type="number" value={itemForm.price} onChange={(e) => setItemForm((p) => ({ ...p, price: e.target.value }))} placeholder="0.00" />
          <Input label="Description (optional)" value={itemForm.description} onChange={(e) => setItemForm((p) => ({ ...p, description: e.target.value }))} placeholder="Short description..." />
        </div>
      </Modal>
    </div>
  );
}
