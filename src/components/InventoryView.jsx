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
  Minus,
  History,
  TrendingUp,
  ShoppingCart,
  Calendar,
  Clock,
  HelpCircle,
  Sparkles
} from 'lucide-react';

export const InventoryView = () => {
  const {
    inventory,
    resourceState,
    recordResourceEvent,
    toggleResourceInCart
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState('inventory'); // 'inventory' | 'forecast' | 'to_buy' | 'history'
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [forecastFilter, setForecastFilter] = useState('ALL'); // 'ALL' | 'DEPLETION' | 'PURCHASE_RECOMMENDED' | 'SUFFICIENT'

  // Stock Adjustment State
  const [adjustingItemId, setAdjustingItemId] = useState(null);
  const [adjustType, setAdjustType] = useState('ADD'); // 'ADD' | 'USE'
  const [adjustAmount, setAdjustAmount] = useState('');
  const [errorMessage, setErrorMessage] = useState(null);

  const categories = ['ALL', 'FOOD', 'SUPPLEMENTS', 'SKINCARE', 'HAIR'];

  const resourcesList = resourceState.resources.length > 0 ? resourceState.resources : inventory;

  const filteredInventory = resourcesList.filter(item => {
    if (selectedCategory === 'ALL') return true;
    return item.category === selectedCategory;
  });

  // Derived Purchase Plan items
  const purchasePlanItems = resourcesList.filter(item => item.needed > 0 || item.currentQty <= item.minStockLevel || item.inCart);
  
  // Forecast alerts (Items running out within 7 days or requiring purchase)
  const forecastAlerts = resourcesList.filter(i =>
    i.forecast?.forecastState === 'PROJECTED DEPLETION' ||
    i.forecast?.forecastState === 'PURCHASE RECOMMENDED' ||
    i.forecast?.forecastState === 'LOW STOCK'
  );

  const summaryMetrics = resourceState.summary || {
    totalResources: resourcesList.length,
    fullyStockedCount: resourcesList.filter(i => i.currentQty >= (i.required || 1)).length,
    needsPurchaseCount: purchasePlanItems.length,
    totalEstimatedCost: purchasePlanItems.reduce((acc, i) => acc + (i.estimatedPrice || 0), 0)
  };

  const getStockBadge = (item) => {
    if (item.status === 'NOT STARTED' || item.currentQty <= 0) {
      return <span className="badge badge-danger">OUT OF STOCK</span>;
    }
    if (item.status === 'SURPLUS') {
      return <span className="badge badge-success">SURPLUS (+{item.surplus} {item.unit})</span>;
    }
    if (item.status === 'FULLY STOCKED' || item.currentQty >= item.required) {
      return <span className="badge badge-success">FULLY STOCKED</span>;
    }
    if (item.status === 'NEEDS PURCHASE' || item.needed > 0) {
      return <span className="badge badge-warning">NEEDS PURCHASE</span>;
    }
    return <span className="badge badge-purple">PARTIALLY STOCKED</span>;
  };

  const getForecastStateBadge = (forecastState, daysToDepletion) => {
    if (forecastState === 'PROJECTED DEPLETION') {
      return <span className="badge badge-danger">PROJECTED DEPLETION ({daysToDepletion != null ? `${daysToDepletion}d left` : 'Out of stock'})</span>;
    }
    if (forecastState === 'PURCHASE RECOMMENDED') {
      return <span className="badge badge-warning">PURCHASE RECOMMENDED</span>;
    }
    if (forecastState === 'LOW STOCK') {
      return <span className="badge badge-warning">LOW STOCK</span>;
    }
    if (forecastState === 'SURPLUS') {
      return <span className="badge badge-success">WELL STOCKED / SURPLUS</span>;
    }
    if (forecastState === 'INSUFFICIENT DATA') {
      return <span className="badge badge-purple">INSUFFICIENT DATA</span>;
    }
    return <span className="badge badge-success">SUFFICIENT</span>;
  };

  const handleApplyStockAdjustment = async (itemId) => {
    setErrorMessage(null);
    const val = parseFloat(adjustAmount);
    if (isNaN(val) || val <= 0) {
      setAdjustingItemId(null);
      setAdjustAmount('');
      return;
    }

    const item = resourcesList.find(i => i.id === itemId);
    if (!item) return;

    const eventType = adjustType === 'ADD' ? 'PURCHASE' : 'CONSUMPTION';
    const res = await recordResourceEvent({
      resourceId: itemId,
      eventType,
      amount: val,
      unit: item.unit
    });

    if (res.success) {
      setAdjustingItemId(null);
      setAdjustAmount('');
    } else {
      setErrorMessage(res.error || 'Failed to apply adjustment');
    }
  };

  const handleQuickAdd = async (item, amount = 1) => {
    setErrorMessage(null);
    await recordResourceEvent({
      resourceId: item.id,
      eventType: 'PURCHASE',
      amount,
      unit: item.unit
    });
  };

  const handleQuickUse = async (item, amount = 1) => {
    setErrorMessage(null);
    const res = await recordResourceEvent({
      resourceId: item.id,
      eventType: 'CONSUMPTION',
      amount,
      unit: item.unit
    });
    if (!res.success) {
      setErrorMessage(res.error || 'Failed to record usage');
    }
  };

  const handleMarkPurchased = async (item) => {
    setErrorMessage(null);
    const amount = item.needed > 0 ? item.needed : (item.forecast?.recommendedPurchaseQty || item.purchaseQty || 1);
    await recordResourceEvent({
      resourceId: item.id,
      eventType: 'PURCHASE',
      amount,
      unit: item.unit
    });
  };

  return (
    <div className="inventory-view" style={{ maxWidth: '840px', margin: '0 auto', paddingBottom: '40px' }}>
      
      {/* DOCTRINE IMMUTABILITY BANNER */}
      <div style={{
        padding: '12px 16px',
        borderRadius: '12px',
        backgroundColor: 'var(--accent-blue-subtle)',
        border: '1px solid var(--accent-blue)',
        marginBottom: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        fontSize: '13px',
        color: 'var(--accent-blue)'
      }}>
        <ShieldCheck size={18} style={{ flexShrink: 0 }} />
        <span>
          <strong>Doctrine Resource Intelligence & Forecasting:</strong> Requirements are derived directly from your Doctrine plan and consumption logs. Track stock, forecast depletion dates, and plan purchases.
        </span>
      </div>

      {/* ERROR MESSAGE NOTIFICATION */}
      {errorMessage && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '10px',
          backgroundColor: '#FEE2E2',
          border: '1px solid #EF4444',
          color: '#991B1B',
          fontSize: '13px',
          marginBottom: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>⚠️ {errorMessage}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setErrorMessage(null)} style={{ color: '#991B1B' }}>✕</button>
        </div>
      )}

      {/* RESOURCE SUMMARY DASHBOARD */}
      <div className="grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '16px' }}>
        <div className="card" style={{ padding: '14px', marginBottom: 0 }}>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Total Items</div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>{summaryMetrics.totalResources}</div>
        </div>
        <div className="card" style={{ padding: '14px', marginBottom: 0 }}>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Stocked / Surplus</div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--accent-green, #10B981)', marginTop: '2px' }}>{summaryMetrics.fullyStockedCount}</div>
        </div>
        <div className="card" style={{ padding: '14px', marginBottom: 0 }}>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Needs Purchase</div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--accent-amber, #F59E0B)', marginTop: '2px' }}>{summaryMetrics.needsPurchaseCount}</div>
        </div>
        <div className="card" style={{ padding: '14px', marginBottom: 0 }}>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>7-Day Depletion Alerts</div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--accent-red, #EF4444)', marginTop: '2px' }}>{forecastAlerts.length}</div>
        </div>
      </div>

      {/* SUB-TAB NAVIGATION */}
      <div className="day-tabs" style={{ marginBottom: '16px', flexWrap: 'wrap' }}>
        <button
          className={`day-tab ${activeSubTab === 'inventory' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('inventory')}
        >
          Resource Inventory ({resourcesList.length})
        </button>
        <button
          className={`day-tab ${activeSubTab === 'forecast' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('forecast')}
        >
          ⚡ Resource Forecast ({forecastAlerts.length})
        </button>
        <button
          className={`day-tab ${activeSubTab === 'to_buy' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('to_buy')}
        >
          Needs To Buy ({purchasePlanItems.length})
        </button>
        <button
          className={`day-tab ${activeSubTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('history')}
        >
          Event History ({resourceState.events ? resourceState.events.length : 0})
        </button>
      </div>

      {/* TAB 1: RESOURCE INVENTORY GRID */}
      {activeSubTab === 'inventory' && (
        <>
          {/* Category Filter Pills */}
          <div className="card" style={{ padding: '12px 16px', marginBottom: '16px' }}>
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

          {/* Resources Grid */}
          <div className="grid-2">
            {filteredInventory.map(item => {
              const reqQty = item.required || item.purchaseQty || (item.minStockLevel ? item.minStockLevel * 2 : 1);
              const progressPct = reqQty > 0 ? Math.min(100, Math.round((item.currentQty / reqQty) * 100)) : 100;
              const neededQty = Math.max(0, reqQty - item.currentQty);
              const surplusQty = Math.max(0, item.currentQty - reqQty);
              const forecast = item.forecast || {};

              return (
                <div key={item.id} className="card" style={{ marginBottom: 0, padding: '18px' }}>
                  
                  {/* Title & Badge */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <div>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>{item.name}</div>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginTop: '2px', letterSpacing: '0.4px' }}>
                        Category: {item.category} • Requirement: {reqQty} {item.unit}
                      </div>
                    </div>
                    {getStockBadge(item)}
                  </div>

                  {/* Available Stock & Metrics */}
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                      <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Available Stock:</span>
                      <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>
                        {item.currentQty} <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-tertiary)' }}>{item.unit}</span>
                      </span>
                    </div>

                    {/* Needed / Surplus display */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 600, marginBottom: '6px' }}>
                      {neededQty > 0 ? (
                        <span style={{ color: 'var(--accent-amber, #F59E0B)' }}>Still Needed: {neededQty} {item.unit}</span>
                      ) : surplusQty > 0 ? (
                        <span style={{ color: 'var(--accent-green, #10B981)' }}>Surplus: {surplusQty} {item.unit}</span>
                      ) : (
                        <span style={{ color: 'var(--accent-green, #10B981)' }}>Requirement Fulfilled</span>
                      )}
                      <span style={{ color: 'var(--text-secondary)' }}>{progressPct}%</span>
                    </div>

                    {/* Progress Bar */}
                    <div style={{ height: '6px', borderRadius: '3px', backgroundColor: 'var(--border-color)', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${progressPct}%`,
                        backgroundColor: progressPct >= 100 ? 'var(--accent-green, #10B981)' : progressPct > 30 ? 'var(--accent-blue)' : 'var(--accent-red)',
                        transition: 'width 0.3s ease'
                      }} />
                    </div>
                  </div>

                  {/* FEATURE 11: COMPACT FORECAST BADGE ON RESOURCE CARD */}
                  {forecast && (
                    <div style={{
                      padding: '8px 10px',
                      borderRadius: '8px',
                      background: 'var(--bg-app)',
                      border: '1px solid var(--border-color)',
                      marginBottom: '12px',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <TrendingUp size={14} color="var(--accent-purple)" />
                        <span>
                          {forecast.daysToDepletion != null ? (
                            <span>Runs out in <strong>{forecast.daysToDepletion} days</strong> ({forecast.depletionDate})</span>
                          ) : forecast.dailyUsageRate > 0 ? (
                            <span>Estimated usage: {forecast.expectedWeeklyUsage} {item.unit}/wk</span>
                          ) : (
                            <span>Durable / Stable Stock</span>
                          )}
                        </span>
                      </div>

                      <span className="badge badge-purple" style={{ fontSize: '10px', padding: '2px 6px' }}>
                        {forecast.confidence}
                      </span>
                    </div>
                  )}

                  {/* Quick Usage & Stock Actions */}
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ flex: 1, borderRadius: '8px', fontSize: '12px' }}
                      onClick={() => handleQuickUse(item, 1)}
                    >
                      <Minus size={12} /> Use 1 {item.unit}
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ flex: 1, borderRadius: '8px', fontSize: '12px' }}
                      onClick={() => handleQuickAdd(item, 1)}
                    >
                      <Plus size={12} /> Add 1 {item.unit}
                    </button>
                  </div>

                  {/* Custom Stock Adjustment Form */}
                  {adjustingItemId === item.id ? (
                    <div style={{
                      padding: '10px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--bg-card-subtle, #F9FAFB)',
                      border: '1px solid var(--border-color)',
                      marginBottom: '12px'
                    }}>
                      <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                        <button
                          type="button"
                          className={`btn btn-sm ${adjustType === 'ADD' ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ flex: 1, padding: '4px', fontSize: '12px' }}
                          onClick={() => setAdjustType('ADD')}
                        >
                          + Record Purchase
                        </button>
                        <button
                          type="button"
                          className={`btn btn-sm ${adjustType === 'USE' ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ flex: 1, padding: '4px', fontSize: '12px' }}
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
                          placeholder={`Amount (${item.unit})`}
                          value={adjustAmount}
                          onChange={e => setAdjustAmount(e.target.value)}
                          style={{ padding: '6px 10px', fontSize: '13px' }}
                          autoFocus
                        />
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleApplyStockAdjustment(item.id)}
                        >
                          Save
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
                        Custom Stock Event (+ / -)
                      </button>
                    </div>
                  )}

                  {/* Footer Action Bar */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                      {item.estimatedPrice ? `Est: ₹${item.estimatedPrice}` : ''}
                    </span>

                    <button
                      className={`btn btn-sm ${item.inCart ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ borderRadius: '8px', fontSize: '12px' }}
                      onClick={() => toggleResourceInCart(item.id)}
                    >
                      {item.inCart ? 'In Cart ✓' : '+ Add to Shopping Plan'}
                    </button>
                  </div>

                </div>
              );
            })}
          </div>
        </>
      )}

      {/* TAB 2: FEATURE 11 — WEEKLY RESOURCE FORECAST SECTION */}
      {activeSubTab === 'forecast' && (
        <div className="card">
          <div className="card-title">
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingUp size={18} color="var(--accent-purple)" /> Weekly Resource Depletion Forecast
            </span>
            <span className="badge badge-purple">7-Day Forward Window</span>
          </div>
          <div className="card-subtitle">
            Deterministic depletion dates & purchase recommendations calculated from current stock and actual Doctrine usage schedules.
          </div>

          {/* Filter Pills */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px', marginBottom: '16px', overflowX: 'auto' }}>
            {['ALL', 'PROJECTED DEPLETION', 'PURCHASE RECOMMENDED', 'SUFFICIENT'].map(st => (
              <button
                key={st}
                className={`btn btn-sm ${forecastFilter === st ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setForecastFilter(st)}
                style={{ borderRadius: '20px', padding: '4px 12px', fontSize: '12px' }}
              >
                {st}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {resourcesList
              .filter(item => {
                if (forecastFilter === 'ALL') return true;
                return item.forecast?.forecastState === forecastFilter;
              })
              .map(item => {
                const forecast = item.forecast || {};
                return (
                  <div
                    key={item.id}
                    style={{
                      padding: '16px',
                      borderRadius: '12px',
                      background: 'var(--bg-app)',
                      border: '1px solid var(--border-color)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                      <div>
                        <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>{item.name}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          Category: {item.category} • Source: <em>{forecast.usageSource}</em>
                        </div>
                      </div>

                      {getForecastStateBadge(forecast.forecastState, forecast.daysToDepletion)}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginTop: '12px' }}>
                      <div style={{ background: 'var(--bg-card)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Current Available</div>
                        <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                          {item.currentQty} {item.unit}
                        </div>
                      </div>

                      <div style={{ background: 'var(--bg-card)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Expected 7-Day Usage</div>
                        <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--accent-purple)', marginTop: '2px' }}>
                          {forecast.expectedWeeklyUsage} {item.unit}/wk
                        </div>
                      </div>

                      <div style={{ background: 'var(--bg-card)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Estimated Depletion</div>
                        <div style={{ fontSize: '15px', fontWeight: 700, color: forecast.daysToDepletion != null && forecast.daysToDepletion <= 7 ? 'var(--accent-red)' : 'var(--accent-green)', marginTop: '2px' }}>
                          {forecast.depletionDate ? forecast.depletionDate : 'No Depletion'}
                        </div>
                      </div>

                      <div style={{ background: 'var(--bg-card)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Recommended Purchase</div>
                        <div style={{ fontSize: '15px', fontWeight: 700, color: forecast.recommendedPurchaseQty > 0 ? 'var(--accent-amber)' : 'var(--accent-green)', marginTop: '2px' }}>
                          {forecast.recommendedPurchaseQty > 0 ? `${forecast.recommendedPurchaseQty} ${item.unit}` : 'None needed'}
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        Confidence: <strong style={{ color: 'var(--accent-blue)' }}>{forecast.confidence}</strong>
                      </span>

                      {forecast.recommendedPurchaseQty > 0 && (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleMarkPurchased(item)}
                          style={{ borderRadius: '8px' }}
                        >
                          <CheckCircle2 size={14} /> Record Purchase (+{forecast.recommendedPurchaseQty} {item.unit})
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* TAB 3: AUTOMATIC "NEEDS TO BUY" PURCHASE PLANNER */}
      {activeSubTab === 'to_buy' && (
        <div className="card">
          <div className="card-title">
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShoppingCart size={18} color="var(--accent-blue)" /> Auto-Derived Purchase Plan
            </span>
            <span className="badge badge-purple">{purchasePlanItems.length} Items Needed</span>
          </div>
          <div className="card-subtitle">
            Items automatically derived from your Doctrine requirements, projected forecast deficits, and available stock levels.
          </div>

          {purchasePlanItems.length === 0 ? (
            <div style={{ padding: '36px 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '14px' }}>
              🎉 You are fully stocked for all Doctrine requirements! No purchases needed.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
              {purchasePlanItems.map(item => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '14px 16px',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    background: 'var(--card-subtle-bg, #F9FAFB)'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>{item.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      Category: {item.category} • Needed: <strong style={{ color: 'var(--accent-amber, #F59E0B)' }}>{item.needed > 0 ? item.needed : (item.forecast?.recommendedPurchaseQty || item.purchaseQty || 1)} {item.unit}</strong>
                      {item.estimatedPrice ? ` • Est Price: ₹${item.estimatedPrice}` : ''}
                    </div>
                  </div>

                  <button
                    className="btn btn-primary btn-sm"
                    style={{ borderRadius: '8px' }}
                    onClick={() => handleMarkPurchased(item)}
                  >
                    <CheckCircle2 size={14} /> Mark Purchased (+{item.needed > 0 ? item.needed : (item.forecast?.recommendedPurchaseQty || item.purchaseQty || 1)} {item.unit})
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: PERMANENT RESOURCE EVENT HISTORY */}
      {activeSubTab === 'history' && (
        <div className="card">
          <div className="card-title">
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <History size={18} color="var(--accent-blue)" /> Resource Event History
            </span>
            <span className="badge badge-purple">{resourceState.events ? resourceState.events.length : 0} Events Logged</span>
          </div>
          <div className="card-subtitle">
            Permanent database record of all resource purchases and consumption events.
          </div>

          {(!resourceState.events || resourceState.events.length === 0) ? (
            <div style={{ padding: '36px 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '14px' }}>
              No resource events recorded yet. Purchases and usage will be permanently logged here.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
              {resourceState.events.map((ev) => (
                <div
                  key={ev.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 14px',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    fontSize: '13px'
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{ev.resourceName}</span>
                    <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginLeft: '8px' }}>({ev.date})</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span className={`badge ${ev.eventType === 'PURCHASE' ? 'badge-success' : 'badge-warning'}`}>
                      {ev.eventType === 'PURCHASE' ? `+${ev.amount} ${ev.unit}` : `-${ev.amount} ${ev.unit}`}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
                      {ev.eventType}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
};
