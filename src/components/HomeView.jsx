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
  Award
} from 'lucide-react';

export const HomeView = () => {
  const { setActiveTab, getTodayStr, userPreferences, user } = useApp();

  const [dashboardData, setDashboardData] = useState(null);
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

      const res = await fetch(`/api/dashboard?date=${todayStr}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setDashboardData(data);
      } else if (res.status === 401) {
        setError('Active session required. Please sign in to view your Command Center.');
      } else if (res.status === 404) {
        setError('Backend dashboard route not found (404). Please restart your backend Node server (node server/index.js) so Express loads the new /api/dashboard endpoint.');
      } else {
        const text = await res.text().catch(() => '');
        let errData = {};
        try { errData = JSON.parse(text); } catch (e) {}
        setError(errData.details || errData.message || errData.error || `Server Response Error (${res.status}): ${text.substring(0, 120) || 'Unable to communicate with backend server'}`);
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
    <div className="home-view" style={{ maxWidth: '840px', margin: '0 auto', paddingBottom: '40px' }}>
      
      {/* COMMAND CENTER HEADER */}
      <div className="card" style={{ padding: '24px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <LayoutDashboard size={14} color="var(--accent-blue)" /> DOCTRINE COMMAND CENTER • {formattedDate}
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '-0.5px', marginTop: '4px', color: 'var(--text-primary)' }}>
              Welcome back, {displayName}
            </h1>
            {today.dayTheme && (
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px', fontWeight: 500 }}>
                Theme: <strong style={{ color: 'var(--accent-purple)' }}>{today.dayTheme}</strong>
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

      {/* DYNAMIC HIGHEST-PRIORITY ACTION BANNER */}
      {primaryAction && (
        <div className="card" style={{
          background: 'linear-gradient(135deg, var(--bg-card) 0%, var(--card-subtle-bg, #F9FAFB) 100%)',
          borderColor: 'var(--accent-blue)',
          borderWidth: '1.5px',
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
              onClick={() => setActiveTab(primaryAction.targetTab)}
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
          background: 'var(--bg-app)'
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

      {/* TWO COLUMN GRID: TODAY'S PRIORITIES + DATA ENGINEERING */}
      <div className="grid-2" style={{ marginBottom: '16px', gap: '16px' }}>
        
        {/* TODAY'S PRIORITIES CARD */}
        <div className="card" style={{ marginBottom: 0, padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Clock size={16} color="var(--accent-amber, #F59E0B)" /> Today's Scheduled Priorities
            </span>
            <button className="btn btn-ghost btn-sm" onClick={() => setActiveTab('today')} style={{ fontSize: '12px', color: 'var(--accent-blue)' }}>
              Checklist →
            </button>
          </div>

          {(today.remainingPriorities || []).length === 0 ? (
            <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--accent-green, #10B981)', fontSize: '13px', fontWeight: 600 }}>
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
            <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Terminal size={16} color="var(--accent-blue)" /> Data Engineering Tracker
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
            <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={16} color="var(--accent-purple)" /> Skincare & Grooming
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

      </div>

      {/* TWO COLUMN GRID: RESOURCE ALERTS + WEEKLY PROGRESS */}
      <div className="grid-2" style={{ marginBottom: '16px', gap: '16px' }}>
        
        {/* RESOURCE ALERTS CARD */}
        <div className="card" style={{ marginBottom: 0, padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShoppingBag size={16} color="var(--accent-purple)" /> Resource Intelligence
            </span>
            <button className="btn btn-ghost btn-sm" onClick={() => setActiveTab('inventory')} style={{ fontSize: '12px', color: 'var(--accent-blue)' }}>
              Resources →
            </button>
          </div>

          {resources.status === 'error' ? (
            <div style={{ padding: '16px 0', color: '#EF4444', fontSize: '13px' }}>
              ⚠️ Unable to load resources status
            </div>
          ) : resources.isFullyStocked ? (
            <div style={{ padding: '16px 0', color: 'var(--accent-green, #10B981)', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={16} /> All Doctrine resources are fully stocked
            </div>
          ) : (
            <div>
              <div style={{ fontSize: '12px', color: 'var(--accent-amber, #F59E0B)', fontWeight: 600, marginBottom: '8px' }}>
                ⚠️ {resources.needsAttentionCount} Item(s) Need Purchase/Restock
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {(resources.itemsNeeded || []).map((item) => (
                  <div key={item.id} style={{ fontSize: '12px', color: 'var(--text-primary)', padding: '6px 8px', background: 'var(--card-subtle-bg, #F9FAFB)', borderRadius: '6px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{item.name}</span>
                    <strong style={{ color: 'var(--accent-amber, #F59E0B)' }}>Need {item.needed} {item.unit}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* WEEKLY COMPLIANCE CARD */}
        <div className="card" style={{ marginBottom: 0, padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Calendar size={16} color="var(--accent-blue)" /> Weekly Compliance
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
                <span>Weekly Avg: <strong style={{ color: 'var(--accent-green, #10B981)' }}>{weeklyProgress.weeklyAveragePct}%</strong></span>
              </div>

              {weeklyReview.isSunday && (
                <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border-color)', fontSize: '12px' }}>
                  <strong>Sunday Review Status:</strong> {weeklyReview.isCompleted ? '✓ Completed' : 'Pending Review'}
                </div>
              )}
            </div>
          )}
        </div>

      </div>

      {/* STORED DAILY AI SUMMARY PREVIEW CARD */}
      <div className="card" style={{ marginBottom: '16px', padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Sparkles size={16} color="var(--accent-purple)" /> Daily AI Summary Preview
          </span>
          <button className="btn btn-ghost btn-sm" onClick={() => setActiveTab('today')} style={{ fontSize: '12px', color: 'var(--accent-blue)' }}>
            Summary →
          </button>
        </div>

        {dailyAiSummary.status === 'error' ? (
          <div style={{ color: '#EF4444', fontSize: '13px' }}>⚠️ Unable to load daily AI summary</div>
        ) : dailyAiSummary.hasSummary ? (
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', background: 'var(--card-subtle-bg, #F9FAFB)', padding: '12px', borderRadius: '8px', lineHeight: '1.5' }}>
            "{dailyAiSummary.summary.length > 180 ? dailyAiSummary.summary.substring(0, 180) + '...' : dailyAiSummary.summary}"
          </div>
        ) : (
          <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
            Daily AI summary not generated yet for today. Summaries generate automatically at 10:00 PM or via manual trigger on Today's view.
          </div>
        )}
      </div>

      {/* RECENT HISTORICAL STREAM CARD */}
      <div className="card" style={{ marginBottom: 0, padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <History size={16} color="var(--accent-blue)" /> Recent Execution Stream
          </span>
          <button className="btn btn-ghost btn-sm" onClick={() => setActiveTab('history')} style={{ fontSize: '12px', color: 'var(--accent-blue)' }}>
            Full History →
          </button>
        </div>

        {recentHistory.status === 'error' ? (
          <div style={{ color: '#EF4444', fontSize: '13px' }}>⚠️ Unable to load recent history</div>
        ) : (!recentHistory.days || recentHistory.days.length === 0) ? (
          <div style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>No recent historical records logged yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {(recentHistory.days || []).map((item) => (
              <div
                key={item.date}
                onClick={() => setActiveTab('history')}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 12px',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                <div>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{item.date}</span>
                  <span style={{ color: 'var(--text-secondary)', marginLeft: '8px' }}>{item.dayOfWeek}</span>
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

    </div>
  );
};
