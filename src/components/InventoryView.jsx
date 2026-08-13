import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Package, ShoppingBag, Plus, Trash2, CheckCircle2, AlertTriangle, RefreshCw, DollarSign } from 'lucide-react';

export const InventoryView = () => {
  const {
    inventory,
    updateInventoryItem,
    addInventoryItem,
    deleteInventoryItem,
    toggleInCart,
    markPurchasedAndRestock
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState('inventory'); // 'inventory' | 'cart'
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [showAddForm, setShowAddForm] = useState(false);

  const [newItem, setNewItem] = useState({
    name: '',
    category: 'FOOD',
    currentQty: 1,
    unit: 'pcs',
    minStockLevel: 1,
    purchaseQty: 1,
    estimatedPrice: 100
  });

  const categories = ['ALL', 'FOOD', 'SUPPLEMENTS', 'SKINCARE', 'HAIR'];

  const filteredInventory = inventory.filter(item => {
    if (selectedCategory === 'ALL') return true;
    return item.category === selectedCategory;
  });

  const cartItems = inventory.filter(item => item.inCart || item.currentQty <= item.minStockLevel);

  const totalCartCost = cartItems.reduce((acc, item) => acc + item.estimatedPrice, 0);

  const handleAddSubmit = (e) => {
    e.preventDefault();
    if (!newItem.name.trim()) return;
    addInventoryItem({
      ...newItem,
      currentQty: Number(newItem.currentQty) || 0,
      minStockLevel: Number(newItem.minStockLevel) || 0,
      purchaseQty: Number(newItem.purchaseQty) || 1,
      estimatedPrice: Number(newItem.estimatedPrice) || 0
    });
    setNewItem({
      name: '',
      category: 'FOOD',
      currentQty: 1,
      unit: 'pcs',
      minStockLevel: 1,
      purchaseQty: 1,
      estimatedPrice: 100
    });
    setShowAddForm(false);
  };

  const getStockBadge = (item) => {
    if (item.currentQty <= 0) return <span className="badge badge-danger">OUT OF STOCK</span>;
    if (item.currentQty <= item.minStockLevel) return <span className="badge badge-warning">LOW STOCK</span>;
    return <span className="badge badge-success">IN STOCK</span>;
  };

  return (
    <div className="inventory-view">
      {/* Sub-tab Navigation */}
      <div className="day-tabs">
        <button
          className={`day-tab ${activeSubTab === 'inventory' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('inventory')}
        >
          Inventory Stock ({inventory.length})
        </button>
        <button
          className={`day-tab ${activeSubTab === 'cart' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('cart')}
        >
          Shopping Cart ({cartItems.length})
        </button>
      </div>

      {activeSubTab === 'inventory' ? (
        <>
          {/* Category Filter & Add Item */}
          <div className="card" style={{ padding: '14px 18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', scrollbarWidth: 'none' }}>
                {categories.map(cat => (
                  <button
                    key={cat}
                    className={`btn btn-sm ${selectedCategory === cat ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setSelectedCategory(cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <button className="btn btn-primary btn-sm" onClick={() => setShowAddForm(!showAddForm)}>
                <Plus size={14} /> Add Item
              </button>
            </div>

            {/* Add Item Form Modal */}
            {showAddForm && (
              <form onSubmit={handleAddSubmit} style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--border-color)' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '10px' }}>Add Product to Inventory</h3>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Item Name</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Greek Yogurt"
                      value={newItem.name}
                      onChange={e => setNewItem({ ...newItem, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Category</label>
                    <select
                      className="form-select"
                      value={newItem.category}
                      onChange={e => setNewItem({ ...newItem, category: e.target.value })}
                    >
                      <option value="FOOD">FOOD</option>
                      <option value="SUPPLEMENTS">SUPPLEMENTS</option>
                      <option value="SKINCARE">SKINCARE</option>
                      <option value="HAIR">HAIR</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Current Qty</label>
                    <input
                      type="number"
                      className="form-input"
                      value={newItem.currentQty}
                      onChange={e => setNewItem({ ...newItem, currentQty: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Unit</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. kg, scoops, bottle"
                      value={newItem.unit}
                      onChange={e => setNewItem({ ...newItem, unit: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Min Stock Alert Level</label>
                    <input
                      type="number"
                      className="form-input"
                      value={newItem.minStockLevel}
                      onChange={e => setNewItem({ ...newItem, minStockLevel: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Est. Price (₹)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={newItem.estimatedPrice}
                      onChange={e => setNewItem({ ...newItem, estimatedPrice: e.target.value })}
                    />
                  </div>
                </div>
                <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }}>
                  Save Item
                </button>
              </form>
            )}
          </div>

          {/* Inventory Items List */}
          <div className="grid-2">
            {filteredInventory.map(item => (
              <div key={item.id} className="card" style={{ marginBottom: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>{item.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      Category: {item.category}
                    </div>
                  </div>
                  {getStockBadge(item)}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px' }}>
                  <div style={{ fontSize: '13px' }}>
                    Stock: <strong style={{ fontSize: '16px', color: 'var(--text-primary)' }}>{item.currentQty}</strong> {item.unit}
                    <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginLeft: '6px' }}>
                      (Min: {item.minStockLevel})
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => updateInventoryItem(item.id, { currentQty: Math.max(0, item.currentQty - 1) })}
                    >
                      -
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => updateInventoryItem(item.id, { currentQty: item.currentQty + 1 })}
                    >
                      +
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Est. Price: ₹{item.estimatedPrice}
                  </span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      className={`btn btn-sm ${item.inCart ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => toggleInCart(item.id)}
                    >
                      {item.inCart ? 'In Cart ✓' : '+ Add to Cart'}
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => deleteInventoryItem(item.id)}
                      style={{ color: 'var(--accent-red)' }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        /* SHOPPING CART VIEW */
        <div className="card">
          <div className="card-title">
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShoppingBag size={18} color="var(--accent-blue)" /> Auto Shopping Cart List
            </span>
            <span className="badge badge-purple">Est Total: ₹{totalCartCost}</span>
          </div>
          <div className="card-subtitle">
            Items added manually or automatically flagged because Current Qty &le; Min Stock level.
          </div>

          {cartItems.length === 0 ? (
            <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '14px' }}>
              🎉 All stock levels are sufficient! No items in shopping cart.
            </div>
          ) : (
            <div>
              {cartItems.map(item => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    justify: 'space-between',
                    alignItems: 'center',
                    padding: '14px',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    marginBottom: '10px',
                    background: 'var(--bg-app)'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>{item.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      Category: {item.category} • Purchase Qty: {item.purchaseQty} {item.unit} • Est: ₹{item.estimatedPrice}
                    </div>
                  </div>

                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => markPurchasedAndRestock(item.id)}
                  >
                    <CheckCircle2 size={14} /> Mark Purchased & Restock
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
