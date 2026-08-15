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
  ShieldAlert,
  ShieldCheck,
  Info,
  Lock,
  ArrowUpRight,
  TrendingDown,
  Calendar,
  CheckCircle2,
  Briefcase
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
  const [financialState, setFinancialState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
          color: 'var(--text-secondary)',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <RefreshCw className="spin-animation" size={18} color="var(--accent-blue)" />
          <span style={{ fontSize: '14px', fontWeight: 500 }}>Loading authoritative financial state...</span>
        </div>
      </div>
    );
  }

  if (error || !financialState) {
    return (
      <div className="workspace-fluid" style={{ padding: '40px 0' }}>
        <div style={{
          maxWidth: '520px',
          margin: '0 auto',
          padding: '28px',
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-card)',
          border: '1px solid var(--border-color)',
          textAlign: 'center',
          boxShadow: 'var(--shadow-md)'
        }}>
          <AlertCircle size={40} color="var(--accent-red)" style={{ marginBottom: '12px' }} />
          <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
            Financial State Unavailable
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '20px' }}>
            {error || 'Unable to connect to financial service.'}
          </p>
          <button
            onClick={fetchFinancialState}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              background: 'var(--accent-blue)',
              color: '#FFF',
              border: 'none',
              borderRadius: 'var(--radius-button)',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '14px'
            }}
          >
            <RefreshCw size={16} />
            <span>Try Again</span>
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
    upcomingObligations = [],
    resourceNeeds = [],
    cartCommitments = [],
    decisionState = {}
  } = financialState;

  // Determine status badge strictly from API state
  let statusBadge = {
    label: 'AVAILABLE',
    text: `${formatPaise(cash.discretionaryPaise)} available for discretionary spending`,
    color: 'var(--accent-green)',
    bgColor: 'var(--accent-green-subtle)',
    icon: ShieldCheck
  };

  if (cash.netCashPaise < 0) {
    statusBadge = {
      label: 'DEFICIT',
      text: `${formatPaise(cash.netCashPaise)} financial deficit recorded`,
      color: 'var(--accent-red)',
      bgColor: 'var(--accent-red-subtle)',
      icon: ShieldAlert
    };
  } else if (decisionState.blockedByObligations || cash.discretionaryPaise === 0) {
    statusBadge = {
      label: 'PROTECTED',
      text: 'Today\'s available money is committed to obligations',
      color: 'var(--accent-amber)',
      bgColor: 'var(--accent-amber-subtle)',
      icon: Lock
    };
  }

  const StatusIcon = statusBadge.icon;
  const highestGoal = goals.find(g => g.id === decisionState.highestPriorityGoalId) || goals[0];

  return (
    <div className="workspace-fluid" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* 1. TOP HEADER & REFRESH BAR */}
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
            <Wallet size={22} />
          </div>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 700, letterSpacing: '-0.3px', color: 'var(--text-primary)' }}>
              Budget & Finances
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
              <span>{dayOfWeek}, {date}</span>
              <span>•</span>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                color: income.isWorkday ? 'var(--accent-blue)' : 'var(--text-tertiary)',
                fontWeight: 500
              }}>
                <Briefcase size={12} />
                {income.isWorkday ? 'Workday' : 'Non-workday'}
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={fetchFinancialState}
          title="Refresh financial state"
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
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <RefreshCw size={14} className={loading ? 'spin-animation' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* 2. FINANCIAL STATUS INDICATOR */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 18px',
        background: statusBadge.bgColor,
        border: `1px solid ${statusBadge.color}`,
        borderRadius: 'var(--radius-card)',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <StatusIcon size={20} color={statusBadge.color} />
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: statusBadge.color, letterSpacing: '0.5px' }}>
              {statusBadge.label}
            </div>
            <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>
              {statusBadge.text}
            </div>
          </div>
        </div>

        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
          Workday Income Expected: <strong style={{ color: 'var(--text-primary)' }}>{formatPaise(income.todayExpectedPaise)}</strong>
        </div>
      </div>

      {/* 3. TODAY'S FINANCIAL POSITION GRID */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '12px'
      }}>
        {/* NET CASH */}
        <div style={{
          padding: '16px',
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-card)',
          border: '1px solid var(--border-color)'
        }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.5px', uppercase: 'true', marginBottom: '4px' }}>
            NET CASH
          </div>
          <div style={{
            fontSize: '22px',
            fontWeight: 700,
            color: cash.netCashPaise < 0 ? 'var(--accent-red)' : 'var(--text-primary)'
          }}>
            {formatPaise(cash.netCashPaise)}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Total Income - Expenses
          </div>
        </div>

        {/* SPENDABLE CASH */}
        <div style={{
          padding: '16px',
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-card)',
          border: '1px solid var(--border-color)'
        }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.5px', marginBottom: '4px' }}>
            SPENDABLE CASH
          </div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--accent-green)' }}>
            {formatPaise(cash.spendableCashPaise)}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Clamped spendable balance
          </div>
        </div>

        {/* RESERVED MONEY */}
        <div style={{
          padding: '16px',
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-card)',
          border: '1px solid var(--border-color)'
        }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.5px', marginBottom: '4px' }}>
            RESERVED
          </div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--accent-amber)' }}>
            {formatPaise(cash.reservedPaise)}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Mandatory commitments
          </div>
        </div>

        {/* ALLOCATED MONEY */}
        <div style={{
          padding: '16px',
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-card)',
          border: '1px solid var(--border-color)'
        }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.5px', marginBottom: '4px' }}>
            ALLOCATED
          </div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--accent-purple)' }}>
            {formatPaise(cash.allocatedPaise)}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Earmarked for goals
          </div>
        </div>

        {/* DISCRETIONARY MONEY */}
        <div style={{
          padding: '16px',
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-card)',
          border: '1px solid var(--accent-blue-subtle)'
        }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--accent-blue)', letterSpacing: '0.5px', marginBottom: '4px' }}>
            DISCRETIONARY
          </div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--accent-blue)' }}>
            {formatPaise(cash.discretionaryPaise)}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Uncommitted power
          </div>
        </div>
      </div>

      {/* 4. TWO-COLUMN LAYOUT: TRANSPORT & GOALS */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '20px'
      }}>

        {/* TRANSPORT OBLIGATION CARD */}
        <div style={{
          padding: '20px',
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-card)',
          border: '1px solid var(--border-color)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <Bus size={18} color="var(--accent-blue)" />
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Transport Requirements
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Required Today</span>
              <strong style={{ color: 'var(--text-primary)' }}>{formatPaise(transport.requiredTodayPaise)}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Reserve Required</span>
              <strong style={{ color: 'var(--accent-amber)' }}>{formatPaise(transport.reserveRequiredPaise)}</strong>
            </div>

            <div style={{
              marginTop: '6px',
              padding: '8px 12px',
              background: 'var(--bg-card-subtle)',
              borderRadius: '8px',
              fontSize: '12px',
              color: 'var(--text-secondary)'
            }}>
              Reason: {transport.reason || 'No current transport obligation'}
            </div>
          </div>
        </div>

        {/* RANKED FINANCIAL GOALS CARD */}
        <div style={{
          padding: '20px',
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-card)',
          border: '1px solid var(--border-color)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Target size={18} color="var(--accent-purple)" />
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Ranked Financial Goals
              </h3>
            </div>
            <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Strict User Ranking</span>
          </div>

          {goals.length === 0 ? (
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', padding: '12px 0' }}>
              No financial goals configured yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {goals.map((g) => (
                <div
                  key={g.id}
                  style={{
                    padding: '12px',
                    background: 'var(--bg-card-subtle)',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: 'var(--accent-purple-subtle)',
                        color: 'var(--accent-purple)'
                      }}>
                        #{g.priority}
                      </span>
                      <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {g.name}
                      </span>
                    </div>

                    <span style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: g.urgency === 'CRITICAL' ? 'var(--accent-red)' : 'var(--text-secondary)'
                    }}>
                      {g.urgency}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', fontSize: '12px', marginTop: '4px' }}>
                    <div>
                      <div style={{ color: 'var(--text-tertiary)' }}>Target</div>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{formatPaise(g.targetPricePaise)}</div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-tertiary)' }}>Saved</div>
                      <div style={{ fontWeight: 600, color: 'var(--accent-green)' }}>{formatPaise(g.allocatedPaise)}</div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-tertiary)' }}>Remaining</div>
                      <div style={{ fontWeight: 600, color: 'var(--accent-amber)' }}>{formatPaise(g.remainingPaise)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 5. TWO-COLUMN LAYOUT: RESOURCE NEEDS & CART COMMITMENTS */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '20px'
      }}>

        {/* RESOURCE PURCHASE CANDIDATES (Physical Inventory Needs Only) */}
        <div style={{
          padding: '20px',
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-card)',
          border: '1px solid var(--border-color)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <PackageCheck size={18} color="var(--accent-amber)" />
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Resource Purchase Candidates
              </h3>
            </div>
            <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: 'var(--radius-pill)', background: 'var(--accent-amber-subtle)', color: 'var(--accent-amber)', fontWeight: 600 }}>
              Physical Inventory
            </span>
          </div>

          {resourceNeeds.length === 0 ? (
            <div style={{
              padding: '16px',
              background: 'var(--bg-card-subtle)',
              borderRadius: '10px',
              fontSize: '13px',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <CheckCircle2 size={16} color="var(--accent-green)" />
              <span>All resource inventory stock levels healthy. No urgent purchases needed.</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {resourceNeeds.map((item, idx) => (
                <div key={item.resourceId || idx} style={{
                  padding: '10px 14px',
                  background: 'var(--bg-card-subtle)',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {item.itemName}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--accent-red)' }}>
                      {item.reason} (Stock: {item.currentQty})
                    </div>
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {formatPaise(item.estimatedPricePaise)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* CART COMMITMENTS (Planned Purchase Intent) */}
        <div style={{
          padding: '20px',
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-card)',
          border: '1px solid var(--border-color)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShoppingBag size={18} color="var(--accent-blue)" />
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Cart Commitments
              </h3>
            </div>
            <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: 'var(--radius-pill)', background: 'var(--accent-blue-subtle)', color: 'var(--accent-blue)', fontWeight: 600 }}>
              Planned Intent (Pending)
            </span>
          </div>

          {cartCommitments.length === 0 ? (
            <div style={{
              padding: '16px',
              background: 'var(--bg-card-subtle)',
              borderRadius: '10px',
              fontSize: '13px',
              color: 'var(--text-secondary)'
            }}>
              No pending cart commitments.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {cartCommitments.map((item) => (
                <div key={item.id} style={{
                  padding: '10px 14px',
                  background: 'var(--bg-card-subtle)',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {item.itemName} (x{item.quantity})
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      Status: {item.status}
                    </div>
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent-blue)' }}>
                    Planned {formatPaise(item.totalEstimatedPaise)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 6. UPCOMING OBLIGATIONS CARD */}
      <div style={{
        padding: '20px',
        background: 'var(--bg-card)',
        borderRadius: 'var(--radius-card)',
        border: '1px solid var(--border-color)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <Info size={18} color="var(--accent-amber)" />
          <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
            Upcoming Obligations
          </h3>
        </div>

        {upcomingObligations.length === 0 ? (
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            No upcoming high-urgency goal obligations detected.
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {upcomingObligations.map((ob, idx) => (
              <div key={ob.id || idx} style={{
                padding: '8px 14px',
                background: 'var(--bg-card-subtle)',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{ob.name}</span>
                <span style={{ color: 'var(--accent-amber)' }}>{formatPaise(ob.remainingPaise)} remaining</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 7. DECISION PREVIEW (Preparation for future 12:30 PM Intelligence) */}
      <div style={{
        padding: '20px',
        background: 'var(--bg-card)',
        borderRadius: 'var(--radius-card)',
        border: '1px solid var(--accent-blue-subtle)',
        marginBottom: '20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyBetween: 'space-between', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={18} color="var(--accent-blue)" />
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
              TODAY'S DECISION PREVIEW
            </h3>
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Engine Facts (Pre-AI)</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', fontSize: '13px' }}>
          <div style={{ padding: '10px', background: 'var(--bg-card-subtle)', borderRadius: '8px' }}>
            <div style={{ color: 'var(--text-tertiary)', fontSize: '11px', marginBottom: '2px' }}>Available for Discretionary Allocation</div>
            <strong style={{ color: 'var(--accent-blue)' }}>{formatPaise(decisionState.canAllocatePaise)}</strong>
          </div>

          <div style={{ padding: '10px', background: 'var(--bg-card-subtle)', borderRadius: '8px' }}>
            <div style={{ color: 'var(--text-tertiary)', fontSize: '11px', marginBottom: '2px' }}>Highest Priority Goal</div>
            <strong style={{ color: 'var(--text-primary)' }}>{highestGoal ? highestGoal.name : 'None'}</strong>
          </div>

          <div style={{ padding: '10px', background: 'var(--bg-card-subtle)', borderRadius: '8px' }}>
            <div style={{ color: 'var(--text-tertiary)', fontSize: '11px', marginBottom: '2px' }}>Must Reserve</div>
            <strong style={{ color: 'var(--accent-amber)' }}>{formatPaise(decisionState.mustReservePaise)}</strong>
          </div>
        </div>
      </div>

    </div>
  );
};
