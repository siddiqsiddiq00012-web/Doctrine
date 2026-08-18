import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import {
  LayoutDashboard,
  CheckCircle2,
  Clock,
  ArrowRight,
  Terminal,
  ShoppingBag,
  Sparkles,
  Calendar,
  History,
  AlertCircle,
  RefreshCw,
  Flame,
  Award,
  Target
} from 'lucide-react';

export const HomeView = () => {
  const { setActiveTab, getTodayStr, userPreferences, user, goalHierarchy, adaptationState } = useApp();

  const [dashboardData, setDashboardData] = useState(null);
  const [intelligenceData, setIntelligenceData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const todayStr = getTodayStr ? getTodayStr() : (function() {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${dd}`;
      })();

      const [dashRes, intelRes] = await Promise.all([
        fetch(`/api/dashboard?date=${todayStr}`, { credentials: 'include' }),
        fetch(`/api/dashboard/intelligence?date=${todayStr}`, { credentials: 'include' }).catch(() => null)
      ]);

      if (dashRes.ok) {
        const data = await dashRes.json();
        setDashboardData(data);
      } else if (dashRes.status === 401) {
        setError('Active session required. Please sign in to view your Command Center.');
      } else {
        const text = await dashRes.text().catch(() => '');
        let errData = {};
        try { errData = JSON.parse(text); } catch (e) {}
        setError(errData.details || errData.message || errData.error || `Server Response Error (${dashRes.status})`);
      }

      if (intelRes && intelRes.ok) {
        const intelJson = await intelRes.json().catch(() => null);
        if (intelJson?.success) {
          setIntelligenceData(intelJson.intelligence);
        }
      }
    } catch (e) {
      console.error('Dashboard fetch error:', e);
      setError(e.message || 'Network connection failed. Verify backend server is running.');
    } finally {
      setLoading(false);
    }
  }, [getTodayStr]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const displayName = userPreferences?.customDisplayName || user?.displayName || 'Doctrine User';

  const formattedDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  if (loading && !dashboardData) {
    return (
      <div style={{ maxWidth: '840px', margin: '0 auto', padding: '40px 20px', textAlign: 'center' }}>
        <div className="card" style={{ padding: '40px', color: 'var(--text-secondary)' }}>
          <RefreshCw size={24} className="spin" style={{ margin: '0 auto 12px', display: 'block' }} />
          Loading Doctrine Command Center...
        </div>
      </div>
    );
  }

  if (error && !dashboardData) {
    const isAuthError = error.toLowerCase().includes('session') || error.toLowerCase().includes('sign in') || error.toLowerCase().includes('401');

    const handleQuickSignIn = async () => {
      try {
        const res = await fetch('/api/auth/dev-login', { method: 'POST', credentials: 'include' });
        if (res.ok) {
          fetchDashboardData();
        } else {
          window.location.href = '/api/auth/dev-login';
        }
      } catch (e) {
        window.location.href = '/api/auth/dev-login';
      }
    };

    return (
      <div style={{ maxWidth: '840px', margin: '0 auto', padding: '40px 20px' }}>
        <div className="card" style={{ padding: '30px', textAlign: 'center', borderColor: '#EF4444' }}>
          <AlertCircle size={32} color="#EF4444" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>Command Center Session Alert</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px', marginBottom: '16px' }}>{error}</p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={handleQuickSignIn}>
              Quick Sign In / Establish Session
            </button>
            <button className="btn btn-secondary" onClick={fetchDashboardData}>
              Retry Load
            </button>
          </div>
        </div>
      </div>
    );
  }

  const today = dashboardData?.today || { date: formattedDate, completionPercentage: 0, completedCount: 0, totalTasksCount: 0, remainingPriorities: [] };
  const primaryAction = dashboardData?.primaryAction || { type: 'DOCTRINE', label: "Complete Today's Doctrine", targetTab: 'today' };
  const dataEngineering = dashboardData?.dataEngineering || { status: 'ok', topic: 'Data Engineering Mastery', targetMinutes: 60, completedMinutes: 0, isCompleted: false };
  const resources = dashboardData?.resources || { status: 'ok', needsAttentionCount: 0, itemsNeeded: [], isFullyStocked: true };
  const dailyAiSummary = dashboardData?.dailyAiSummary || { status: 'ok', hasSummary: false, summary: null };
  const weeklyProgress = dashboardData?.weeklyProgress || { status: 'ok', recordedDaysCount: 0, weeklyAveragePct: 0, days: [] };
  const weeklyReview = dashboardData?.weeklyReview || { status: 'ok', isSunday: false, isCompleted: false };
  const recentHistory = dashboardData?.recentHistory || { status: 'ok', days: [] };
  const skincare = dashboardData?.skincare || { status: 'ok', morningCompleted: false, eveningCompleted: false, completedCount: 0, totalCount: 0 };

  return (
    <div className="home-view workspace-fluid" style={{ paddingBottom: '40px' }}>
      
      {/* COMMAND CENTER HERO BANNER */}
      <div className="hero-banner">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              {formattedDate}
            </div>
            <h1 style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.6px', marginTop: '4px', color: 'var(--text-primary)' }}>
              Welcome back, {displayName}
            </h1>
            {today.dayTheme && (
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px', fontWeight: 500 }}>
                Day Theme: <strong style={{ color: 'var(--accent-purple)' }}>{today.dayTheme}</strong>
              </div>
            )}
          </div>

          <div style={{ textAlign: 'right' }}>
            <div className="badge badge-success" style={{ fontSize: '14px', padding: '6px 14px', fontWeight: 700 }}>
              {today.completionPercentage}% Done
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              {today.completedCount} of {today.totalTasksCount} tasks completed
            </div>
          </div>
        </div>

        {/* OVERALL PROGRESS BAR */}
        <div style={{ marginTop: '16px' }}>
          <div className="progress-container">
            <div className="progress-fill" style={{ width: `${today.completionPercentage}%` }}></div>
          </div>
        </div>
      </div>



      {/* DECISIONS & RECOMMENDATIONS CARD */}
      {intelligenceData && (
        <div className="card" style={{
          background: 'var(--bg-card)',
          borderColor: 'var(--accent-purple)',
          borderLeft: '4px solid var(--accent-purple)',
          padding: '18px 20px',
          marginBottom: '16px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent-purple)', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={14} /> SYSTEM DECISIONS & RECOMMENDATIONS
            </div>
            <div className="badge badge-purple" style={{ fontSize: '11px' }}>
              Confidence {Math.round((intelligenceData.confidence || 0.95) * 100)}%
            </div>
          </div>

          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: '1.5', marginBottom: '12px' }}>
            {intelligenceData.summary}
          </div>

          {Array.isArray(intelligenceData.recommendations) && intelligenceData.recommendations.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
              {intelligenceData.recommendations.map((rec, i) => (
                <div key={i} style={{
                  padding: '10px 12px',
                  borderRadius: '8px',
                  background: 'var(--bg-app)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px'
                }}>
                  <div style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
                    <strong style={{ display: 'block', fontSize: '13px' }}>{rec.action}</strong>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{rec.reason}</span>
                  </div>

                  {!rec.automated && (
                    <span className="badge badge-warning" style={{ fontSize: '11px', whiteSpace: 'nowrap' }}>
                      ACTION REQUIRED
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {primaryAction && (
        <div className="card interactive" onClick={() => setActiveTab(primaryAction.targetTab)} style={{
          background: 'var(--bg-card)',
          borderColor: 'var(--accent-blue)',
          borderLeft: '4px solid var(--accent-blue)',
          padding: '18px 20px',
          marginBottom: '16px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent-blue)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                PRIORITY ACTION REQUIRED NOW
              </div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                {primaryAction.label}
              </div>
              {primaryAction.contextReason && (
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', fontStyle: 'italic' }}>
                  Why this matters: {primaryAction.contextReason}
                </div>
              )}
            </div>

            <button
              className="btn btn-primary"
              onClick={(e) => { e.stopPropagation(); setActiveTab(primaryAction.targetTab); }}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', fontSize: '14px' }}
            >
              Take Action <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* FEATURE 14: EXECUTION BOTTLENECK BANNER */}
      {dashboardData?.failurePattern?.hasStrongPattern && (
        <div className="card" style={{
          padding: '16px 20px',
          marginBottom: '16px',
          borderLeft: '4px solid var(--accent-amber)',
          background: 'var(--bg-card)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent-amber)', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertCircle size={14} color="var(--accent-amber)" /> EXECUTION BOTTLENECK DETECTED
              </div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                {dashboardData.failurePattern.patternSummary}
              </div>
            </div>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setActiveTab('history')}
            >
              View Pattern Log →
            </button>
          </div>
        </div>
      )}

      {/* GOAL PROGRESSION ENGINE SUMMARY CARD */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--accent-blue-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-blue)' }}>
              <Target size={20} />
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Goal Progression Engine</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                {goalHierarchy?.visions?.length || 0} Visions • {((goalHierarchy?.visions || []).flatMap(v => v.children || []).length + (goalHierarchy?.standaloneObjectives || []).length)} Objectives Active
              </div>
            </div>
          </div>

          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setActiveTab('goals')}
            style={{ fontSize: '12px', color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            Goals Engine →
          </button>
        </div>
      </div>

      {/* TWO COLUMN GRID: TODAY'S PRIORITIES + DATA ENGINEERING */}
      <div className="grid-2" style={{ marginBottom: '16px', gap: '16px' }}>
        
        {/* TODAY'S PRIORITIES CARD */}
        <div className="card" style={{ marginBottom: 0, padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Today's Scheduled Priorities
            </span>
            <button className="btn btn-ghost btn-sm" onClick={() => setActiveTab('today')} style={{ fontSize: '12px', color: 'var(--accent-blue)' }}>
              Checklist →
            </button>
          </div>

          {(today.remainingPriorities || []).length === 0 ? (
            <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--accent-green)', fontSize: '13px', fontWeight: 600 }}>
              ✓ All scheduled time-block tasks for today are completed!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {(today.remainingPriorities || []).map((item) => (
                <div
                  key={item.id}
                  onClick={() => setActiveTab('today')}
                  style={{
                    padding: '10px 12px',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    background: 'var(--bg-app)'
                  }}
                >
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>{item.time}</div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>{item.activity}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* DATA ENGINEERING COMMAND CARD */}
        <div className="card" style={{ marginBottom: 0, padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Data Engineering Tracker
            </span>
            <button className="btn btn-ghost btn-sm" onClick={() => setActiveTab('dataeng')} style={{ fontSize: '12px', color: 'var(--accent-blue)' }}>
              Continue →
            </button>
          </div>

          {dataEngineering.status === 'error' ? (
            <div style={{ padding: '16px 0', color: '#EF4444', fontSize: '13px' }}>
              ⚠️ Unable to load Data Engineering status
            </div>
          ) : (
            <div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                Topic: <strong style={{ color: 'var(--text-primary)' }}>{dataEngineering.topic}</strong>
              </div>

              <div style={{ marginTop: '10px', fontSize: '13px', display: 'flex', justifyContent: 'space-between' }}>
                <span>Today's Target: <strong>{dataEngineering.targetMinutes} min</strong></span>
                <span>Completed: <strong>{dataEngineering.completedMinutes} min</strong></span>
              </div>

              <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className={`badge ${dataEngineering.isCompleted ? 'badge-success' : 'badge-purple'}`}>
                  {dataEngineering.isCompleted ? '✓ Target Met' : 'In Progress'}
                </span>

                <button className="btn btn-secondary btn-sm" onClick={() => setActiveTab('dataeng')}>
                  Open DE Tracker
                </button>
              </div>
            </div>
          )}
        </div>

        {/* SKINCARE & GROOMING COMMAND CARD */}
        <div className="card" style={{ marginBottom: 0, padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Skincare & Grooming
            </span>
            <button className="btn btn-ghost btn-sm" onClick={() => setActiveTab('skincare')} style={{ fontSize: '12px', color: 'var(--accent-blue)' }}>
              Routine →
            </button>
          </div>

          {skincare.status === 'error' ? (
            <div style={{ padding: '16px 0', color: '#EF4444', fontSize: '13px' }}>
              ⚠️ Unable to load skincare status
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                <div style={{ flex: 1, padding: '10px', background: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>Morning</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: skincare.morningCompleted ? 'var(--accent-green)' : 'var(--text-secondary)', marginTop: '2px' }}>
                    {skincare.morningCompleted ? '✓ Done' : 'Pending'}
                  </div>
                </div>

                <div style={{ flex: 1, padding: '10px', background: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>Evening</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: skincare.eveningCompleted ? 'var(--accent-green)' : 'var(--text-secondary)', marginTop: '2px' }}>
                    {skincare.eveningCompleted ? '✓ Done' : 'Pending'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Completed: <strong>{skincare.completedCount} of {skincare.totalCount} tasks</strong>
                </span>

                <button className="btn btn-secondary btn-sm" onClick={() => setActiveTab('skincare')}>
                  Open Routine
                </button>
              </div>
            </div>
          )}
        </div>

        {/* WHAT TO BUY THIS WEEK — DETERMINISTIC PURCHASE PLAN CARD */}
        <div className="card" style={{ marginBottom: 0, padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShoppingBag size={16} color="var(--accent-purple)" /> What to Buy This Week
            </span>
            <button className="btn btn-ghost btn-sm" onClick={() => setActiveTab('cart')} style={{ fontSize: '12px', color: 'var(--accent-blue)' }}>
              Cart →
            </button>
          </div>

          {(() => {
            const buyThisWeekList = dashboardData?.plan?.today?.buyThisWeek || dashboardData?.plan?.today?.buyToday || dashboardData?.resources?.buyToday || [];
            const dailyPurchasesList = dashboardData?.plan?.today?.dailyPurchases || [];
            const alreadyHandledList = dashboardData?.plan?.today?.alreadyHandled || dashboardData?.resources?.alreadyHandled || [];

            if (resources.status === 'error') {
              return (
                <div style={{ padding: '12px 0', color: '#EF4444', fontSize: '13px' }}>
                  ⚠️ Unable to load purchase recommendations
                </div>
              );
            }

            if (buyThisWeekList.length === 0 && dailyPurchasesList.length === 0 && alreadyHandledList.length === 0) {
              return (
                <div style={{ padding: '14px 0', color: 'var(--accent-green)', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle2 size={16} /> No purchase required this week — inventory covers expected consumption
                </div>
              );
            }

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {/* BUY THIS WEEK RECOMMENDATIONS */}
                {buyThisWeekList.length > 0 ? (
                  buyThisWeekList.map((item) => (
                    <div
                      key={item.resourceId}
                      style={{
                        padding: '12px',
                        background: 'var(--bg-app)',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>
                            {item.itemName} — {item.requiredPurchaseQty || item.recommendedPurchaseQty} {item.unit || 'units'}
                          </strong>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 500, marginTop: '2px' }}>
                            Expected weekly consumption: <strong>{item.expectedWeeklyDemand || 0} {item.unit}</strong> • Current stock: <strong>{item.currentQty} {item.unit}</strong>
                          </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                          {item.isLowStock ? (
                            <span className="badge badge-amber" style={{ fontSize: '10px', whiteSpace: 'nowrap' }}>
                              ⚠️ LOW STOCK
                            </span>
                          ) : (
                            <span className="badge badge-purple" style={{ fontSize: '10px', whiteSpace: 'nowrap' }}>
                              Stock Normal
                            </span>
                          )}

                          <span className={`badge ${item.isAffordable ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '10px', whiteSpace: 'nowrap' }}>
                            {item.isAffordable ? '✓ Affordable' : 'Exceeds Plan'}
                          </span>
                        </div>
                      </div>

                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                        {item.reason}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', paddingTop: '6px', borderTop: '1px solid var(--border-color)' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                          Est. Cost: ₹{item.estimatedPriceRupees || 0}
                        </span>

                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              const res = await fetch('/api/financial/cart', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                credentials: 'include',
                                body: JSON.stringify({
                                  itemName: item.itemName,
                                  resourceId: item.resourceId,
                                  quantity: item.requiredPurchaseQty || item.recommendedPurchaseQty,
                                  estimatedPricePaise: item.estimatedPricePaise || 0,
                                  priority: item.priority || 1
                                })
                              });
                              if (res.ok) {
                                fetchDashboardData();
                              }
                            } catch (err) {
                              console.error('Add to cart failed:', err);
                            }
                          }}
                          style={{ fontSize: '11px', padding: '4px 10px' }}
                        >
                          + Add to Cart
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ padding: '8px 0', color: 'var(--accent-green)', fontSize: '12px', fontWeight: 600 }}>
                    ✓ No stock-managed replenishment needed this week
                  </div>
                )}

                {/* DAILY PURCHASES SECTION */}
                {dailyPurchasesList.length > 0 && (
                  <div style={{ marginTop: '6px', paddingTop: '8px', borderTop: '1px dashed var(--border-color)' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '6px' }}>
                      DAILY PURCHASES (SCHEDULE DERIVED)
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {dailyPurchasesList.map((dItem) => (
                        <div
                          key={dItem.resourceId}
                          style={{
                            padding: '8px 10px',
                            borderRadius: '6px',
                            background: 'var(--bg-app)',
                            fontSize: '12px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <div>
                            <strong style={{ color: 'var(--text-primary)' }}>{dItem.itemName}</strong>
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block' }}>
                              {dItem.reason}
                            </span>
                          </div>
                          <span className="badge badge-purple" style={{ fontSize: '10px' }}>
                            Daily Purchase
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ALREADY HANDLED SECTION */}
                {alreadyHandledList.length > 0 && (
                  <div style={{ marginTop: '6px', paddingTop: '8px', borderTop: '1px dashed var(--border-color)' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '6px' }}>
                      ALREADY HANDLED
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {alreadyHandledList.map((hItem) => (
                        <div
                          key={hItem.resourceId}
                          onClick={() => setActiveTab('cart')}
                          style={{
                            padding: '6px 10px',
                            borderRadius: '6px',
                            background: 'var(--bg-app)',
                            fontSize: '12px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            cursor: 'pointer'
                          }}
                        >
                          <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                            {hItem.itemName} — {hItem.requiredPurchaseQty || hItem.recommendedPurchaseQty} {hItem.unit || 'units'}
                          </span>
                          <span className="badge badge-purple" style={{ fontSize: '10px' }}>
                            ✓ In Cart
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>

      </div>

      {/* UN-BOXED SECONDARY STREAMS: WEEKLY COMPLIANCE & AI SUMMARY */}
      <div className="grid-2" style={{ marginBottom: '16px', gap: '16px' }}>
        
        {/* WEEKLY COMPLIANCE CARD */}
        <div className="card" style={{ marginBottom: 0, padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Weekly Compliance
            </span>
            <button className="btn btn-ghost btn-sm" onClick={() => setActiveTab('week')} style={{ fontSize: '12px', color: 'var(--accent-blue)' }}>
              Week →
            </button>
          </div>

          {weeklyProgress.status === 'error' ? (
            <div style={{ padding: '16px 0', color: '#EF4444', fontSize: '13px' }}>
              ⚠️ Unable to load weekly progress
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '8px' }}>
                <span>Recorded Days: <strong>{weeklyProgress.recordedDaysCount}</strong></span>
                <span>Weekly Avg: <strong style={{ color: 'var(--accent-green)' }}>{weeklyProgress.weeklyAveragePct}%</strong></span>
              </div>

              {weeklyReview.isSunday && (
                <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border-color)', fontSize: '12px' }}>
                  <strong>Weekly Summary Status:</strong> {weeklyReview.isCompleted ? '✓ Completed' : 'Pending Review'}
                </div>
              )}
            </div>
          )}
        </div>

        {/* STORED DAILY AI SUMMARY PREVIEW CARD */}
        <div className="card" style={{ marginBottom: 0, padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Daily AI Summary Preview
            </span>
            <button className="btn btn-ghost btn-sm" onClick={() => setActiveTab('today')} style={{ fontSize: '12px', color: 'var(--accent-blue)' }}>
              Summary →
            </button>
          </div>

          {dailyAiSummary.status === 'error' ? (
            <div style={{ color: '#EF4444', fontSize: '13px' }}>⚠️ Unable to load daily AI summary</div>
          ) : dailyAiSummary.hasSummary ? (
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', background: 'var(--bg-app)', padding: '12px', borderRadius: '8px', lineHeight: '1.5' }}>
              "{dailyAiSummary.summary.length > 180 ? dailyAiSummary.summary.substring(0, 180) + '...' : dailyAiSummary.summary}"
            </div>
          ) : (
            <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
              Daily AI summary not generated yet for today. Summaries generate automatically at 10:00 PM or via manual trigger on Today's view.
            </div>
          )}
        </div>

      </div>

      {/* UN-BOXED RECENT EXECUTION STREAM SECTION */}
      <div className="section-header">
        <h2 className="section-title">Recent Execution Stream</h2>
        <button className="btn btn-ghost btn-sm" onClick={() => setActiveTab('history')} style={{ fontSize: '12px', color: 'var(--accent-blue)' }}>
          Full History →
        </button>
      </div>

      {recentHistory.status === 'error' ? (
        <div style={{ color: '#EF4444', fontSize: '13px', marginBottom: '16px' }}>⚠️ Unable to load recent history</div>
      ) : (!recentHistory.days || recentHistory.days.length === 0) ? (
        <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginBottom: '16px' }}>No recent historical records logged yet.</div>
      ) : (
        <div className="unboxed-list">
          {(recentHistory.days || []).map((item) => (
            <div
              key={item.date}
              className="row-item interactive"
              onClick={() => setActiveTab('history')}
            >
              <div>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{item.date}</span>
                <span style={{ color: 'var(--text-secondary)', marginLeft: '8px', fontSize: '13px' }}>{item.dayOfWeek}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{item.completedCount} / {item.totalTasksCount}</span>
                <span className={`badge ${item.completionPercentage >= 80 ? 'badge-success' : 'badge-purple'}`} style={{ fontWeight: 700 }}>
                  {item.completionPercentage}%
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
};
