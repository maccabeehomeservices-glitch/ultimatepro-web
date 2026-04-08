import { useState, useMemo } from 'react';
import { Plus, BookOpen, Upload, Search, Edit2, Trash2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useGet, useMutation } from '../hooks/useApi';
import { Card, LoadingSpinner, EmptyState, Modal, Input, Button, Select, Toggle } from '../components/ui';
import { useSnackbar } from '../components/ui/Snackbar';

const ITEM_TYPE_OPTIONS = [
  { value: 'service', label: 'Service' },
  { value: 'material', label: 'Material' },
  { value: 'part', label: 'Part' },
  { value: 'discount', label: 'Discount' },
];

function formatCurrency(v) {
  return '$' + Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const emptyItemForm = () => ({
  name: '', sku: '', description: '', unit_price: '', cost_price: '',
  item_type: 'service', is_active: true, category_id: '',
});

export default function Pricebook() {
  const navigate = useNavigate();
  const { showSnack } = useSnackbar();
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [categorySearch, setCategorySearch] = useState('');
  const [itemSearch, setItemSearch] = useState('');

  // Modals
  const [addCatModal, setAddCatModal] = useState(false);
  const [catName, setCatName] = useState('');
  const [itemModal, setItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null); // null = add, item = edit
  const [itemForm, setItemForm] = useState(emptyItemForm());
  const [deleteModal, setDeleteModal] = useState(null); // item to delete

  const { mutate, loading: saving } = useMutation();

  const { data: catData, loading: catLoading, refetch: refetchCats } = useGet('/pricebook/categories');
  const { data: itemsData, loading: itemsLoading, refetch: refetchItems } = useGet(
    selectedCategory ? `/pricebook/items?category_id=${selectedCategory.id || selectedCategory._id}` : null,
    [selectedCategory?.id]
  );

  const categories = catData?.categories || catData || [];
  const items = itemsData?.items || itemsData || [];

  const filteredCategories = useMemo(() => {
    if (!categorySearch.trim()) return categories;
    return categories.filter(c => c.name?.toLowerCase().includes(categorySearch.toLowerCase()));
  }, [categories, categorySearch]);

  const filteredItems = useMemo(() => {
    if (!itemSearch.trim()) return items;
    const q = itemSearch.toLowerCase();
    return items.filter(i => i.name?.toLowerCase().includes(q) || i.sku?.toLowerCase().includes(q));
  }, [items, itemSearch]);

  async function handleAddCategory() {
    if (!catName.trim()) { showSnack('Name required', 'error'); return; }
    try {
      await mutate('post', '/pricebook/categories', { name: catName.trim() });
      showSnack('Category added', 'success');
      setCatName('');
      setAddCatModal(false);
      refetchCats();
    } catch {
      showSnack('Failed to add category', 'error');
    }
  }

  function openAddItem() {
    setEditingItem(null);
    setItemForm({ ...emptyItemForm(), category_id: selectedCategory?.id || selectedCategory?._id || '' });
    setItemModal(true);
  }

  function openEditItem(item) {
    setEditingItem(item);
    setItemForm({
      name: item.name || '',
      sku: item.sku || '',
      description: item.description || '',
      unit_price: item.unit_price?.toString() || item.price?.toString() || '',
      cost_price: item.cost_price?.toString() || '',
      item_type: item.item_type || 'service',
      is_active: item.is_active !== false,
      category_id: item.category_id || selectedCategory?.id || selectedCategory?._id || '',
    });
    setItemModal(true);
  }

  async function handleSaveItem() {
    if (!itemForm.name.trim()) { showSnack('Item name required', 'error'); return; }
    try {
      const payload = {
        ...itemForm,
        unit_price: Number(itemForm.unit_price) || 0,
        cost_price: Number(itemForm.cost_price) || 0,
        category_id: itemForm.category_id || selectedCategory?.id || selectedCategory?._id,
      };
      if (editingItem) {
        await mutate('put', `/pricebook/items/${editingItem.id || editingItem._id}`, payload);
        showSnack('Item updated', 'success');
      } else {
        await mutate('post', '/pricebook/items', payload);
        showSnack('Item added', 'success');
      }
      setItemModal(false);
      setEditingItem(null);
      setItemForm(emptyItemForm());
      refetchItems();
      refetchCats();
    } catch {
      showSnack('Failed to save item', 'error');
    }
  }

  async function handleDeleteItem(item) {
    try {
      await mutate('delete', `/pricebook/items/${item.id || item._id}`);
      showSnack('Item deleted', 'success');
      setDeleteModal(null);
      refetchItems();
      refetchCats();
    } catch {
      showSnack('Failed to delete item', 'error');
    }
  }

  function handleItemFormChange(e) {
    const { name, value, type, checked } = e.target;
    setItemForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  }

  return (
    <div className="p-4 max-w-3xl mx-auto pb-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-900">Pricebook</h1>
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/import?type=pricebook')}
            className="flex items-center gap-1.5 text-sm text-[#1A73E8] font-medium px-3 py-2 rounded-xl border border-[#1A73E8] min-h-[44px] hover:bg-blue-50 transition-colors"
          >
            <Upload size={14} /> Import
          </button>
          {!selectedCategory && (
            <button
              onClick={() => { setCatName(''); setAddCatModal(true); }}
              className="flex items-center gap-1.5 text-sm bg-[#1A73E8] text-white font-medium px-3 py-2 rounded-xl min-h-[44px] hover:bg-blue-700 transition-colors"
            >
              <Plus size={14} /> Category
            </button>
          )}
        </div>
      </div>

      {!selectedCategory ? (
        <>
          {/* Category search */}
          <div className="relative mb-4">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search categories..."
              value={categorySearch}
              onChange={e => setCategorySearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#1A73E8] min-h-[44px] text-sm"
            />
          </div>

          {catLoading ? (
            <LoadingSpinner />
          ) : filteredCategories.length === 0 ? (
            <EmptyState icon={BookOpen} title="No categories" description="Add categories to your pricebook." />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {filteredCategories.map((cat) => (
                <Card key={cat.id || cat._id} onClick={() => { setSelectedCategory(cat); setItemSearch(''); }}>
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
          )}
        </>
      ) : (
        <>
          {/* Category items view */}
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => { setSelectedCategory(null); setCategorySearch(''); }}
              className="text-sm text-[#1A73E8] font-medium min-h-[44px] flex items-center"
            >
              ← All Categories
            </button>
            <h2 className="font-semibold text-gray-900 flex-1">{selectedCategory.name}</h2>
            <button
              onClick={openAddItem}
              className="flex items-center gap-1.5 text-sm text-[#1A73E8] font-medium min-h-[44px]"
            >
              <Plus size={16} /> Add Item
            </button>
          </div>

          {/* Item search within category */}
          <div className="relative mb-4">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search items by name or SKU..."
              value={itemSearch}
              onChange={e => setItemSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#1A73E8] min-h-[44px] text-sm"
            />
            {itemSearch && (
              <button onClick={() => setItemSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                <X size={16} />
              </button>
            )}
          </div>

          {itemsLoading ? (
            <LoadingSpinner />
          ) : filteredItems.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="No items"
              description="Add items to this category."
              action={<Button onClick={openAddItem} size="sm">Add Item</Button>}
            />
          ) : (
            <div className="space-y-2">
              {filteredItems.map((item) => (
                <Card key={item.id || item._id}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-gray-900">{item.name}</p>
                        {item.is_active === false && (
                          <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">Inactive</span>
                        )}
                      </div>
                      {item.sku && <p className="text-xs text-gray-400">SKU: {item.sku}</p>}
                      {item.description && <p className="text-xs text-gray-400 truncate">{item.description}</p>}
                      {item.item_type && (
                        <span className="text-xs text-gray-400 capitalize">{item.item_type}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <p className="font-bold text-[#1A73E8]">{formatCurrency(item.unit_price || item.price)}</p>
                      <button
                        onClick={(e) => { e.stopPropagation(); openEditItem(item); }}
                        className="p-2 text-gray-400 hover:text-[#1A73E8] min-h-[44px] min-w-[44px] flex items-center justify-center"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteModal(item); }}
                        className="p-2 text-gray-400 hover:text-red-500 min-h-[44px] min-w-[44px] flex items-center justify-center"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* Add Category Modal */}
      <Modal
        isOpen={addCatModal}
        onClose={() => setAddCatModal(false)}
        title="Add Category"
        footer={
          <>
            <Button variant="outlined" onClick={() => setAddCatModal(false)}>Cancel</Button>
            <Button loading={saving} onClick={handleAddCategory}>Save Category</Button>
          </>
        }
      >
        <Input
          label="Category Name"
          value={catName}
          onChange={e => setCatName(e.target.value)}
          placeholder="e.g. HVAC Services"
          autoFocus
        />
      </Modal>

      {/* Add/Edit Item Modal */}
      <Modal
        isOpen={itemModal}
        onClose={() => { setItemModal(false); setEditingItem(null); }}
        title={editingItem ? 'Edit Item' : 'Add Item'}
        footer={
          <>
            <Button variant="outlined" onClick={() => { setItemModal(false); setEditingItem(null); }}>Cancel</Button>
            <Button loading={saving} onClick={handleSaveItem}>{editingItem ? 'Save' : 'Add Item'}</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input
            label="Item Name *"
            name="name"
            value={itemForm.name}
            onChange={handleItemFormChange}
            placeholder="e.g. AC Filter Replacement"
          />
          <Input
            label="SKU"
            name="sku"
            value={itemForm.sku}
            onChange={handleItemFormChange}
            placeholder="e.g. AC-FILTER-001"
          />
          <Input
            label="Description"
            name="description"
            value={itemForm.description}
            onChange={handleItemFormChange}
            placeholder="Short description..."
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Unit Price ($) *"
              type="number"
              name="unit_price"
              value={itemForm.unit_price}
              onChange={handleItemFormChange}
              placeholder="0.00"
            />
            <Input
              label="Cost Price ($)"
              type="number"
              name="cost_price"
              value={itemForm.cost_price}
              onChange={handleItemFormChange}
              placeholder="0.00"
            />
          </div>
          <Select
            label="Item Type"
            name="item_type"
            value={itemForm.item_type}
            onChange={handleItemFormChange}
            options={ITEM_TYPE_OPTIONS}
          />
          <div className="flex items-center justify-between py-1">
            <span className="text-sm font-medium text-gray-700">Active</span>
            <Toggle
              checked={itemForm.is_active}
              onChange={e => setItemForm(prev => ({ ...prev, is_active: e.target.checked }))}
            />
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={Boolean(deleteModal)}
        onClose={() => setDeleteModal(null)}
        title="Delete Item"
        footer={
          <>
            <Button variant="outlined" onClick={() => setDeleteModal(null)}>Cancel</Button>
            <Button variant="danger" loading={saving} onClick={() => handleDeleteItem(deleteModal)}>Delete</Button>
          </>
        }
      >
        <p className="text-gray-600">
          Delete <strong>{deleteModal?.name}</strong>? This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
