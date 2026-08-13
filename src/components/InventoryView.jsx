import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Package,
  ShoppingBag,
  Plus,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Info,
  ShieldCheck,
  Minus
} from 'lucide-react';

export const InventoryView = () => {
  const {
    inventory,
    updateInventoryItem,
    toggleInCart,
    markPurchasedAndRestock
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState('inventory'); // 'inventory' | 'cart'
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  // Stock Adjustment Modal / Inline State
  const [adjustingItemId, setAdjustingItemId] = useState(null);
  const [adjustType, setAdjustType] = useState('ADD'); // 'ADD' | 'USE'
  const [adjustAmount, setAdjustAmount] = useState('');

  const categories = ['ALL', 'FOOD', 'SUPPLEMENTS', 'SKINCARE', 'HAIR'];

  const filteredInventory = inventory.filter(item => {
    if (selectedCategory === 'ALL') return true;
    return item.category === selectedCategory;
  });

  const cartItems = inventory.filter(item => item.inCart || item.currentQty <= item.minStockLevel);
  const totalCartCost = cartItems.reduce((acc, item) => acc + item.estimatedPrice, 0);

  const getStockBadge = (item) => {
    const minLevel = item.minStockLevel || 1;
    if (item.currentQty <= 0) {
      return <span className="badge badge-danger">OUT OF STOCK</span>;
    }
    if (item.currentQty <= minLevel) {
      return <span className="badge badge-warning">LOW STOCK</span>;
    }
    if (item.currentQty >= minLevel * 2) {
      return <span className="badge badge-success">FULLY STOCKED</span>;
    }
    return <span className="badge badge-purple">STOCKED</span>;
  };

  const handleApplyStockAdjustment = (itemId) => {
    const val = parseFloat(adjustAmount);
    if (isNaN(val) || val <= 0) {
      setAdjustingItemId(null);
      setAdjustAmount('');
      return;
    }

    const item = inventory.find(i => i.id === itemId);
    if (!item) return;

    let nextQty = item.currentQty;
    if (adjustType === 'ADD') {
      nextQty += val;
    } else if (adjustType === 'USE') {
      nextQty = Math.max(0, item.currentQty - val);
    }

    updateInventoryItem(itemId, { currentQty: Math.round(nextQty * 100) / 100 });
    setAdjustingItemId(null);
    setAdjustAmount('');
  };

  return (
    <div className="inventory-view" style={{ maxWidth: '800px', margin: '0 auto' }}>
      
      {/* Doctrine Source of Truth Immutability Banner */}
      <div style={{
        padding: '12px 16px',
        borderRadius: '12px',
        backgroundColor: 'var(--accent-blue-subtle)',
        border: '1px solid var(--accent-blue)',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        fontSize: '13px',
        color: 'var(--accent-blue)'
      }}>
        <ShieldCheck size={18} style={{ flexShrink: 0 }} />
        <span>
          <strong>Doctrine Derived Resources:</strong> Resource definitions and required quantities are derived directly from your active Doctrine plan and cannot be deleted or added manually. Track real-world inventory stock and usage below.
        </span>
      </div>

      {/* Sub-tab Navigation */}
      <div className="day-tabs">
        <button
          className={`day-tab ${activeSubTab === 'inventory' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('inventory')}
        >
          Resource Inventory ({inventory.length})
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
          {/* Category Filters */}
          <div className="card" style={{ padding: '12px 16px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', scrollbarWidth: 'none' }}>
              {categories.map(cat => (
                <button
                  key={cat}
                  className={`btn btn-sm ${selectedCategory === cat ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setSelectedCategory(cat)}
                  style={{ borderRadius: '20px', padding: '6px 14px', fontSize: '12px' }}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Inventory Items Grid */}
          <div className="grid-2">
            {filteredInventory.map(item => {
              const reqQty = item.purchaseQty || item.minStockLevel * 2 || 1;
              const progressPct = Math.min(100, Math.round((item.currentQty / reqQty) * 100));

              return (
                <div key={item.id} className="card" style={{ marginBottom: 0, padding: '18px' }}>
                  
                  {/* Title & Badge */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <div>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>{item.name}</div>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginTop: '2px', letterSpacing: '0.4px' }}>
                        Category: {item.category} • Doctrine Requirement: {reqQty} {item.unit}
                      </div>
                    </div>
                    {getStockBadge(item)}
                  </div>

                  {/* Stock Quantity Display */}
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                      <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Available Stock:</span>
                      <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>
                        {item.currentQty} <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-tertiary)' }}>{item.unit}</span>
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div style={{
                      height: '6px',
                      borderRadius: '3px',
                      backgroundColor: 'var(--border-color)',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        height: '100%',
                        width: `${progressPct}%`,
                        backgroundColor: progressPct >= 100 ? 'var(--accent-green)' : progressPct > 30 ? 'var(--accent-blue)' : 'var(--accent-red)',
                        transition: 'width 0.3s ease'
                      }} />
                    </div>
                  </div>

                  {/* Quick Quantity Adjustment (+ / -) */}
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ flex: 1, borderRadius: '8px', fontSize: '12px' }}
                      onClick={() => updateInventoryItem(item.id, { currentQty: Math.max(0, item.currentQty - 1) })}
                    >
                      <Minus size={12} /> Use 1 {item.unit}
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ flex: 1, borderRadius: '8px', fontSize: '12px' }}
                      onClick={() => updateInventoryItem(item.id, { currentQty: item.currentQty + 1 })}
                    >
                      <Plus size={12} /> Add 1 {item.unit}
                    </button>
                  </div>

                  {/* Stock Adjustment Popup Input */}
                  {adjustingItemId === item.id ? (
                    <div style={{
                      padding: '10px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--bg-card-subtle)',
                      border: '1px solid var(--border-color)',
                      marginBottom: '14px'
                    }}>
                      <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                        <button
                          type="button"
                          className={`btn btn-sm ${adjustType === 'ADD' ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ flex: 1, padding: '4px' }}
                          onClick={() => setAdjustType('ADD')}
                        >
                          + Add Stock
                        </button>
                        <button
                          type="button"
                          className={`btn btn-sm ${adjustType === 'USE' ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ flex: 1, padding: '4px' }}
                          onClick={() => setAdjustType('USE')}
                        >
                          - Record Usage
                        </button>
                      </div>

                      <div style={{ display: 'flex', gap: '6px' }}>
                        <input
                          type="number"
                          step="any"
                          className="form-input"
                          placeholder={`Amount in ${item.unit}`}
                          value={adjustAmount}
                          onChange={e => setAdjustAmount(e.target.value)}
                          style={{ padding: '6px 10px', fontSize: '13px' }}
                          autoFocus
                        />
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleApplyStockAdjustment(item.id)}
                        >
                          Confirm
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ marginBottom: '12px' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ width: '100%', borderRadius: '8px', fontSize: '12px' }}
                        onClick={() => { setAdjustingItemId(item.id); setAdjustType('ADD'); setAdjustAmount(''); }}
                      >
                        Custom Amount (+ / -)
                      </button>
                    </div>
                  )}

                  {/* Cart Action Footer (NO DELETE BUTTON) */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                      Est Price: ₹{item.estimatedPrice}
                    </span>
                    <button
                      className={`btn btn-sm ${item.inCart ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ borderRadius: '8px', fontSize: '12px' }}
                      onClick={() => toggleInCart(item.id)}
                    >
                      {item.inCart ? 'In Cart ✓' : '+ Add to Shopping Cart'}
                    </button>
                  </div>

                </div>
              );
            })}
          </div>
        </>
      ) : (
        /* SHOPPING CART SUB-TAB */
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
            <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '14px' }}>
              🎉 All stock levels are sufficient! No items in shopping cart.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {cartItems.map(item => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '14px',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
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
                    style={{ borderRadius: '8px' }}
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
