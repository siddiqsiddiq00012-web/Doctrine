import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import {
  ShoppingBag,
  Plus,
  Trash2,
  Edit2,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Target,
  Package,
  Calendar,
  Tag,
  DollarSign
} from 'lucide-react';
import { formatPaise } from './BudgetView';

export const CartView = () => {
  const [items, setItems] = useState([]);
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal States
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  // Form Fields
  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [estimatedPriceRupees, setEstimatedPriceRupees] = useState('');
  const [priority, setPriority] = useState('1');
  const [targetPurchaseDate, setTargetPurchaseDate] = useState('');
  const [financialGoalId, setFinancialGoalId] = useState('');
  const [resourceId, setResourceId] = useState('');
  const [status, setStatus] = useState('PENDING');
  const [notes, setNotes] = useState('');

  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // Fetch Cart Items & Available Goals for Dropdown
  const fetchCartData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cartRes, finRes] = await Promise.all([
        fetch('/api/financial/cart', { credentials: 'include' }),
        fetch('/api/financial/state', { credentials: 'include' })
      ]);

      if (cartRes.ok) {
        const cartData = await cartRes.json();
        setItems(cartData.items || []);
      } else {
        throw new Error('Failed to load cart items');
      }

      if (finRes.ok) {
        const finData = await finRes.json();
        if (finData.financialState?.goals) {
          setGoals(finData.financialState.goals);
        }
      }
    } catch (err) {
      console.error('[CartView Fetch Error]:', err);
      setError(err.message || 'Unable to load cart data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCartData();
  }, [fetchCartData]);

  const resetForm = () => {
    setItemName('');
    setQuantity('1');
    setEstimatedPriceRupees('');
    setPriority('1');
    setTargetPurchaseDate('');
    setFinancialGoalId('');
    setResourceId('');
    setStatus('PENDING');
    setNotes('');
    setFormError('');
    setEditingItem(null);
  };

  const openAddModal = () => {
    resetForm();
    setShowAddModal(true);
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setItemName(item.itemName || '');
    setQuantity(String(item.quantity || 1));
    setEstimatedPriceRupees(String((item.estimatedPricePaise || 0) / 100));
    setPriority(String(item.priority || 1));
    setTargetPurchaseDate(item.targetPurchaseDate || '');
    setFinancialGoalId(item.financialGoalId || '');
    setResourceId(item.resourceId || '');
    setStatus(item.status || 'PENDING');
    setNotes(item.notes || '');
    setFormError('');
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!itemName.trim()) {
      setFormError('Item name is required');
      return;
    }

    const numQty = parseFloat(quantity);
    if (isNaN(numQty) || numQty <= 0) {
      setFormError('Quantity must be greater than 0');
      return;
    }

    const numRupees = parseFloat(estimatedPriceRupees);
    if (isNaN(numRupees) || numRupees < 0) {
      setFormError('Estimated price must be 0 or greater');
      return;
    }

    const numPriority = parseInt(priority, 10);
    if (isNaN(numPriority) || numPriority < 1) {
      setFormError('Priority must be 1 or greater');
      return;
    }

    const pricePaise = Math.round(numRupees * 100);

    const payload = {
      itemName: itemName.trim(),
      quantity: numQty,
      estimatedPricePaise: pricePaise,
      priority: numPriority,
      targetPurchaseDate: targetPurchaseDate ? targetPurchaseDate.trim() : null,
      financialGoalId: financialGoalId ? financialGoalId.trim() : null,
      resourceId: resourceId ? resourceId.trim() : null,
      notes: notes.trim()
    };

    if (editingItem) {
      payload.status = status;
    }

    setSaving(true);
    try {
      const url = editingItem ? `/api/financial/cart/${editingItem.id}` : '/api/financial/cart';
      const method = editingItem ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to save cart item');
      }

      setShowAddModal(false);
      setEditingItem(null);
      resetForm();
      fetchCartData();
    } catch (err) {
      setFormError(err.message || 'Save failed. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (itemId) => {
    if (!window.confirm('Remove this planned item from your cart?')) return;
    try {
      const res = await fetch(`/api/financial/cart/${itemId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (res.ok) {
        fetchCartData();
      } else {
        alert('Failed to remove cart item');
      }
    } catch (err) {
      console.error('[Cart Delete Error]:', err);
    }
  };

  const handleDefer = async (itemId) => {
    try {
      const res = await fetch(`/api/financial/cart/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'DEFERRED' })
      });
      if (res.ok) {
        fetchCartData();
      }
    } catch (err) {
      console.error('[Cart Defer Error]:', err);
    }
  };

  if (loading) {
    return (
      <div className="workspace-fluid" style={{ padding: '40px 0', textAlign: 'center' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '12px',
          padding: '16px 28px',
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-card)',
          border: '1px solid var(--border-color)',
          color: 'var(--text-secondary)'
        }}>
          <RefreshCw className="spin-animation" size={18} color="var(--accent-blue)" />
          <span>Loading planned cart items...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="workspace-fluid" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* HEADER BAR */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        paddingBottom: '12px',
        borderBottom: '1px solid var(--border-color)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '12px',
            background: 'var(--accent-blue-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-blue)'
          }}>
            <ShoppingBag size={22} />
          </div>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 700, letterSpacing: '-0.3px', color: 'var(--text-primary)' }}>
              Purchase Intent Cart
            </h1>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Independent Planned Purchases ({items.length} {items.length === 1 ? 'item' : 'items'})
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={fetchCartData}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-button)',
              color: 'var(--text-primary)',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={14} />
            <span>Refresh</span>
          </button>

          <button
            onClick={openAddModal}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              background: 'var(--accent-blue)',
              color: '#FFF',
              border: 'none',
              borderRadius: 'var(--radius-button)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <Plus size={16} />
            <span>Add to Cart</span>
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          padding: '14px 18px',
          background: 'var(--accent-red-subtle)',
          border: '1px solid var(--accent-red)',
          borderRadius: 'var(--radius-card)',
          color: 'var(--accent-red)',
          fontSize: '14px'
        }}>
          {error}
        </div>
      )}

      {/* ITEMS LIST */}
      {items.length === 0 ? (
        <div style={{
          padding: '48px 24px',
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-card)',
          border: '1px solid var(--border-color)',
          textAlign: 'center'
        }}>
          <ShoppingBag size={48} color="var(--text-tertiary)" style={{ marginBottom: '12px' }} />
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
            Your Cart is empty
          </h3>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '20px', maxWidth: '400px', margin: '0 auto 20px auto' }}>
            Add planned items (personal items, PC parts, general expenses, or resource needs) to track purchase intent.
          </p>
          <button
            onClick={openAddModal}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 20px',
              background: 'var(--accent-blue)',
              color: '#FFF',
              border: 'none',
              borderRadius: 'var(--radius-button)',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            <Plus size={16} />
            <span>Add First Planned Purchase</span>
          </button>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '16px'
        }}>
          {items.map((item) => {
            const linkedGoal = goals.find(g => g.id === item.financialGoalId);
            const statusColor = item.status === 'APPROVED' ? 'var(--accent-green)' :
                                item.status === 'DEFERRED' ? 'var(--accent-amber)' :
                                item.status === 'REJECTED' ? 'var(--accent-red)' : 'var(--accent-blue)';

            const statusBg = item.status === 'APPROVED' ? 'var(--accent-green-subtle)' :
                              item.status === 'DEFERRED' ? 'var(--accent-amber-subtle)' :
                              item.status === 'REJECTED' ? 'var(--accent-red-subtle)' : 'var(--accent-blue-subtle)';

            return (
              <div
                key={item.id}
                style={{
                  padding: '18px',
                  background: 'var(--bg-card)',
                  borderRadius: 'var(--radius-card)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  boxShadow: 'var(--shadow-sm)'
                }}
              >
                {/* CARD HEADER */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: 'var(--accent-blue-subtle)',
                      color: 'var(--accent-blue)'
                    }}>
                      #{item.priority}
                    </span>
                    <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {item.itemName}
                    </h3>
                  </div>

                  <span style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '3px 8px',
                    borderRadius: 'var(--radius-pill)',
                    background: statusBg,
                    color: statusColor
                  }}>
                    {item.status}
                  </span>
                </div>

                {/* PRICE & QTY GRID */}
                <div style={{
                  padding: '10px 12px',
                  background: 'var(--bg-card-subtle)',
                  borderRadius: '10px',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  gap: '8px',
                  fontSize: '13px'
                }}>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Qty</div>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>x{item.quantity}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Estimated</div>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{formatPaise(item.estimatedPricePaise)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Total</div>
                    <div style={{ fontWeight: 700, color: 'var(--accent-blue)' }}>{formatPaise(item.totalEstimatedPaise)}</div>
                  </div>
                </div>

                {/* METADATA CHIPS */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {linkedGoal && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Target size={14} color="var(--accent-purple)" />
                      <span>Goal: <strong style={{ color: 'var(--text-primary)' }}>{linkedGoal.name}</strong></span>
                    </div>
                  )}

                  {item.resourceId && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Package size={14} color="var(--accent-amber)" />
                      <span>Linked Resource: <strong style={{ color: 'var(--text-primary)' }}>{item.resourceId}</strong></span>
                    </div>
                  )}

                  {item.targetPurchaseDate && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Calendar size={14} color="var(--text-tertiary)" />
                      <span>Target Date: {item.targetPurchaseDate}</span>
                    </div>
                  )}

                  {item.notes && (
                    <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontStyle: 'italic', marginTop: '2px' }}>
                      "{item.notes}"
                    </div>
                  )}
                </div>

                {/* CARD ACTIONS */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: '8px',
                  marginTop: 'auto',
                  paddingTop: '8px',
                  borderTop: '1px solid var(--border-color)'
                }}>
                  {item.status !== 'DEFERRED' && (
                    <button
                      onClick={() => handleDefer(item.id)}
                      style={{
                        padding: '6px 12px',
                        background: 'none',
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        fontSize: '12px',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer'
                      }}
                    >
                      Defer
                    </button>
                  )}

                  <button
                    onClick={() => openEditModal(item)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '6px 12px',
                      background: 'none',
                      border: '1px solid var(--border-color)',
                      borderRadius: '6px',
                      fontSize: '12px',
                      color: 'var(--text-primary)',
                      cursor: 'pointer'
                    }}
                  >
                    <Edit2 size={12} />
                    <span>Edit</span>
                  </button>

                  <button
                    onClick={() => handleDelete(item.id)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '6px 12px',
                      background: 'none',
                      border: '1px solid var(--accent-red-subtle)',
                      borderRadius: '6px',
                      fontSize: '12px',
                      color: 'var(--accent-red)',
                      cursor: 'pointer'
                    }}
                  >
                    <Trash2 size={12} />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ADD / EDIT MODAL */}
      {(showAddModal || editingItem) && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1200,
          padding: '16px'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '480px',
            background: 'var(--bg-card)',
            borderRadius: 'var(--radius-card)',
            border: '1px solid var(--border-color)',
            padding: '24px',
            boxShadow: 'var(--shadow-md)'
          }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px' }}>
              {editingItem ? 'Edit Cart Item' : 'Add Planned Purchase to Cart'}
            </h2>

            {formError && (
              <div style={{
                padding: '10px 14px',
                background: 'var(--accent-red-subtle)',
                color: 'var(--accent-red)',
                borderRadius: '8px',
                fontSize: '13px',
                marginBottom: '14px'
              }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Item Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Bluetooth Speaker, Eggs, College Fee"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: 'var(--bg-card-subtle)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    fontSize: '14px'
                  }}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Quantity *
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: 'var(--bg-card-subtle)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      color: 'var(--text-primary)',
                      fontSize: '14px'
                    }}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Est. Unit Price (₹) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="e.g. 500"
                    value={estimatedPriceRupees}
                    onChange={(e) => setEstimatedPriceRupees(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: 'var(--bg-card-subtle)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      color: 'var(--text-primary)',
                      fontSize: '14px'
                    }}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Priority Rank (1 = Highest)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: 'var(--bg-card-subtle)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      color: 'var(--text-primary)',
                      fontSize: '14px'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Target Date
                  </label>
                  <input
                    type="date"
                    value={targetPurchaseDate}
                    onChange={(e) => setTargetPurchaseDate(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: 'var(--bg-card-subtle)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      color: 'var(--text-primary)',
                      fontSize: '14px'
                    }}
                  />
                </div>
              </div>

              {goals.length > 0 && (
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Optional Linked Goal
                  </label>
                  <select
                    value={financialGoalId}
                    onChange={(e) => setFinancialGoalId(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: 'var(--bg-card-subtle)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      color: 'var(--text-primary)',
                      fontSize: '14px'
                    }}
                  >
                    <option value="">-- None (Standalone Intent) --</option>
                    {goals.map(g => (
                      <option key={g.id} value={g.id}>#{g.priority} - {g.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {editingItem && (
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Intent Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: 'var(--bg-card-subtle)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      color: 'var(--text-primary)',
                      fontSize: '14px'
                    }}
                  >
                    <option value="PENDING">PENDING</option>
                    <option value="APPROVED">APPROVED</option>
                    <option value="DEFERRED">DEFERRED</option>
                    <option value="REJECTED">REJECTED</option>
                  </select>
                  <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                    * Actual PURCHASED status requires future purchase confirmation workflow.
                  </div>
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Notes
                </label>
                <textarea
                  placeholder="Optional notes or details"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: 'var(--bg-card-subtle)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                    resize: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => { setShowAddModal(false); setEditingItem(null); }}
                  style={{
                    padding: '8px 16px',
                    background: 'none',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-button)',
                    color: 'var(--text-secondary)',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    padding: '8px 20px',
                    background: 'var(--accent-blue)',
                    color: '#FFF',
                    border: 'none',
                    borderRadius: 'var(--radius-button)',
                    fontWeight: 600,
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                >
                  {saving ? 'Saving...' : editingItem ? 'Update Cart' : 'Add Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
