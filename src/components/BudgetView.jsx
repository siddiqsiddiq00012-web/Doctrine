import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import {
  Wallet,
  RefreshCw,
  AlertCircle,
  Bus,
  Target,
  ShoppingBag,
  PackageCheck,
  CheckCircle2,
  Briefcase,
  Plus
} from 'lucide-react';

/**
 * Deterministic string formatting helper for integer Paise.
 * Performs ZERO financial arithmetic / state calculations.
 */
export function formatPaise(paise) {
  if (typeof paise !== 'number' || isNaN(paise)) return '₹0';
  const isNegative = paise < 0;
  const absPaise = Math.abs(paise);
  const rupees = (absPaise / 100).toLocaleString('en-IN', {
    minimumFractionDigits: absPaise % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  });
  return `${isNegative ? '-' : ''}₹${rupees}`;
}

export const BudgetView = () => {
  const { setActiveTab } = useApp();
  const [financialState, setFinancialState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [addingResourceMap, setAddingResourceMap] = useState({});

  const fetchFinancialState = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/financial/state', { credentials: 'include' });
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error('Authentication required. Please log in.');
        }
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Financial state unavailable');
      }
      const data = await res.json();
      if (data.success && data.financialState) {
        setFinancialState(data.financialState);
      } else {
        throw new Error('Invalid financial response structure');
      }
    } catch (err) {
      console.error('[BudgetView Fetch Error]:', err);
      setError(err.message || 'Financial state unavailable. Try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFinancialState();
  }, [fetchFinancialState]);

  const handleAddToCart = async (item) => {
    const key = item.resourceId || item.itemName;
    setAddingResourceMap(prev => ({ ...prev, [key]: true }));
    try {
      const payload = {
        itemName: item.itemName,
        quantity: item.suggestedPurchaseQty || 1,
        estimatedPricePaise: item.estimatedPricePaise || 0,
        resourceId: item.resourceId,
        priority: item.urgency === 'CRITICAL' ? 1 : item.urgency === 'HIGH' ? 2 : 3
      };
      const res = await fetch('/api/financial/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        await fetchFinancialState();
      }
    } catch (err) {
      console.error('Failed to add recommendation to cart:', err);
    } finally {
      setAddingResourceMap(prev => ({ ...prev, [key]: false }));
    }
  };

  if (loading && !financialState) {
    return (
      <div className="workspace-fluid" style={{ maxWidth: '840px', margin: '0 auto', padding: '40px 20px', textAlign: 'center' }}>
        <div className="card" style={{ padding: '40px', color: 'var(--text-secondary)' }}>
          <RefreshCw className="spin" size={24} style={{ margin: '0 auto 12px', display: 'block' }} />
          Loading Financial Position...
        </div>
      </div>
    );
  }

  if (error && !financialState) {
    return (
      <div className="workspace-fluid" style={{ maxWidth: '840px', margin: '0 auto', padding: '40px 20px' }}>
        <div className="card" style={{ padding: '30px', textAlign: 'center', borderColor: 'var(--accent-red)' }}>
          <AlertCircle size={36} color="var(--accent-red)" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
            Financial State Unavailable
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '16px' }}>
            {error}
          </p>
          <button className="btn btn-secondary" onClick={fetchFinancialState}>
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      </div>
    );
  }

  const {
    date,
    dayOfWeek,
    cash = {},
    income = {},
    transport = {},
    goals = [],
    resourceNeeds = [],
    cartCommitments = []
  } = financialState || {};

  // Build a Set of resource IDs or item names currently in cart
  const activeCartResourceIds = new Set(
    cartCommitments
      .filter(c => c.status !== 'PURCHASED' && c.status !== 'CANCELLED')
      .map(c => c.resourceId || c.itemName.toLowerCase())
  );

  return (
    <div className="budget-view" style={{ maxWidth: '840px', margin: '0 auto', paddingBottom: '40px' }}>

      {/* 1. HEADER BAR */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Wallet size={14} color="var(--accent-blue)" /> BUDGET & FINANCES
            </div>
            <h1 style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '-0.5px', marginTop: '4px', color: 'var(--text-primary)' }}>
              Financial Position & Planning
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              <span>{dayOfWeek}, {date}</span>
              <span>•</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: income.isWorkday ? 'var(--accent-blue)' : 'var(--text-secondary)', fontWeight: 500 }}>
                <Briefcase size={13} />
                {income.isWorkday ? 'Workday' : 'Non-workday'}
              </span>
            </div>
          </div>

          <button
            className="btn btn-secondary btn-sm"
            onClick={fetchFinancialState}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* 2. MORNING FINANCIAL PLAN & BALANCE HIERARCHY */}
      <div className="card" style={{ marginBottom: '16px', background: 'var(--bg-card)', border: '1px solid var(--accent-blue-subtle, rgba(59, 130, 246, 0.2))' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '16px' }}>
          {/* ACTUAL CASH */}
          <div style={{ background: 'var(--bg-app)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              ACTUAL CASH (LEDGER)
            </div>
            <div style={{ fontSize: '26px', fontWeight: 800, color: cash.netCashPaise < 0 ? 'var(--accent-red)' : 'var(--text-primary)', marginTop: '4px' }}>
              {formatPaise(cash.spendableCashPaise || cash.netCashPaise || 0)}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Realized ledger balance
            </div>
          </div>

          {/* EXPECTED TODAY */}
          <div style={{ background: 'var(--bg-app)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent-blue)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              EXPECTED TODAY
            </div>
            <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--accent-blue)', marginTop: '4px' }}>
              +{formatPaise(income.todayExpectedPaise || 0)}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Workday income expectation
            </div>
          </div>

          {/* TODAY'S PLANNED CAPACITY */}
          <div style={{ background: 'var(--accent-blue-subtle, rgba(59, 130, 246, 0.08))', padding: '16px', borderRadius: '10px', border: '1px solid var(--accent-blue)' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent-blue)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              TODAY'S PLANNED CAPACITY
            </div>
            <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--accent-blue)', marginTop: '4px' }}>
              {formatPaise(financialState?.morningPlan?.plannedCapacityPaise || cash.plannedCapacityPaise || 0)}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Expected income minus mandatory commitments
            </div>
          </div>

        </div>

        {/* SECONDARY FIGURES GRID */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
          <div style={{ background: 'var(--bg-app)', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>NET CASH</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: cash.netCashPaise < 0 ? 'var(--accent-red)' : 'var(--text-primary)', marginTop: '2px' }}>
              {formatPaise(cash.netCashPaise)}
            </div>
          </div>

          <div style={{ background: 'var(--bg-app)', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>RESERVED</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--accent-amber)', marginTop: '2px' }}>
              {formatPaise(cash.reservedPaise)}
            </div>
          </div>

          <div style={{ background: 'var(--bg-app)', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>GOAL ALLOCATIONS</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--accent-purple)', marginTop: '2px' }}>
              {formatPaise(cash.allocatedPaise)}
            </div>
          </div>
        </div>
      </div>

      {/* 3. RECOMMENDED PURCHASES (PRIMARY ACTIONABLE SECTION) */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <PackageCheck size={18} color="var(--accent-amber)" /> Recommended Purchases
          </span>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setActiveTab('cart')}
            style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <ShoppingBag size={14} /> Open Cart ({cartCommitments.length})
          </button>
        </div>

        {resourceNeeds.length === 0 ? (
          <div style={{ padding: '16px', background: 'var(--bg-app)', borderRadius: '10px', fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px' }}>
            <CheckCircle2 size={16} color="var(--accent-green)" />
            <span>All resource stock levels healthy. No immediate purchases recommended.</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
            {resourceNeeds.map((item, idx) => {
              const resId = item.resourceId || item.itemName.toLowerCase();
              const isInCart = item.inCart || activeCartResourceIds.has(resId) || activeCartResourceIds.has(item.itemName.toLowerCase());
              const isAdding = addingResourceMap[resId] || false;

              return (
                <div
                  key={item.resourceId || idx}
                  style={{
                    padding: '12px 14px',
                    background: 'var(--bg-app)',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '10px'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {item.itemName}
                      </span>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '1px 6px',
                        borderRadius: '4px',
                        background: item.urgency === 'CRITICAL' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                        color: item.urgency === 'CRITICAL' ? 'var(--accent-red)' : 'var(--accent-amber)'
                      }}>
                        {item.urgency || 'HIGH'}
                      </span>
                      {item.isAffordable ? (
                        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--accent-green)' }}>
                          ✓ Affordable
                        </span>
                      ) : (
                        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--accent-amber)' }}>
                          Exceeds Budget
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      Qty: {item.suggestedPurchaseQty || 1} • Est. Cost: {formatPaise(item.estimatedPricePaise)}
                    </div>
                  </div>

                  <div>
                    {isInCart ? (
                      <span className="badge badge-blue" style={{ fontSize: '12px', padding: '4px 10px' }}>
                        ✓ Already in Cart
                      </span>
                    ) : (
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleAddToCart(item)}
                        disabled={isAdding}
                        style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Plus size={14} /> {isAdding ? 'Adding...' : 'Add to Cart'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. TWO-COLUMN LAYOUT: TODAY'S COMMITMENTS & FINANCIAL GOALS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>

        {/* TODAY'S COMMITMENTS */}
        <div className="card">
          <div className="card-title" style={{ marginBottom: '12px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Bus size={18} color="var(--accent-blue)" /> Today's Commitments
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Transport Required Today</span>
              <strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{formatPaise(transport.requiredTodayPaise || 0)}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Transport Reserve Needed</span>
              <strong style={{ fontSize: '14px', color: 'var(--accent-amber)' }}>{formatPaise(transport.reserveRequiredPaise || 0)}</strong>
            </div>
          </div>
        </div>

        {/* FINANCIAL GOALS */}
        <div className="card">
          <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Target size={18} color="var(--accent-purple)" /> Financial Goals
            </span>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setActiveTab('cart')}
              style={{ fontSize: '11px', padding: '2px 8px' }}
            >
              Manage Goals
            </button>
          </div>

          {goals.length === 0 ? (
            <div style={{ padding: '16px', background: 'var(--bg-app)', borderRadius: '8px', fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'center' }}>
              No financial goals configured yet. Create a goal to start allocating funds.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {goals.map((g) => {
                const target = g.targetPricePaise || 1;
                const allocated = g.allocatedPaise || 0;
                const pct = Math.min(100, Math.round((allocated / target) * 100));

                return (
                  <div
                    key={g.id}
                    style={{
                      padding: '10px 12px',
                      background: 'var(--bg-app)',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        #{g.priority} {g.name}
                      </span>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent-purple)' }}>
                        {pct}%
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div style={{ height: '6px', width: '100%', background: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden', marginBottom: '6px' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent-purple)', borderRadius: '3px', transition: 'width 0.3s ease' }} />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)' }}>
                      <span>Saved: {formatPaise(allocated)}</span>
                      <span>Target: {formatPaise(target)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

    </div>
  );
};
