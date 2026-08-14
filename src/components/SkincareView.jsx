import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sun,
  Moon,
  Package,
  Calendar,
  RefreshCw,
  AlertCircle,
  ShieldCheck,
  ChevronRight,
  Droplets,
  HeartPulse
} from 'lucide-react';

export const SkincareView = () => {
  const { selectedDate, setSelectedDate, getTodayStr, getOrCreateDailyLog, toggleTask, toggleAnchor, setActiveTab, user } = useApp();

  const [skincareData, setSkincareData] = useState(null);
  const [historyData, setHistoryData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSkincareData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const todayStr = selectedDate || (getTodayStr ? getTodayStr() : new Date().toISOString().split('T')[0]);

      // Fetch Today Skincare Aggregation
      const res = await fetch(`/api/skincare/today?date=${todayStr}`, { credentials: 'include' });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Server Response Error (${res.status}): ${text.substring(0, 100)}`);
      }
      const data = await res.json();
      setSkincareData(data);

      // Fetch Skincare History
      const histRes = await fetch('/api/skincare/history', { credentials: 'include' });
      if (histRes.ok) {
        const histJson = await histRes.json();
        setHistoryData(histJson);
      }
    } catch (e) {
      console.error('[SkincareView] Load error:', e);
      setError(e.message || 'Failed to communicate with backend server.');
    } finally {
      setLoading(false);
    }
  }, [selectedDate, getTodayStr]);

  useEffect(() => {
    fetchSkincareData();
  }, [fetchSkincareData]);

  const currentLog = getOrCreateDailyLog(selectedDate);

  if (loading && !skincareData) {
    return (
      <div style={{ maxWidth: '840px', margin: '0 auto', padding: '40px 20px', textAlign: 'center' }}>
        <div className="card" style={{ padding: '40px', color: 'var(--text-secondary)' }}>
          <RefreshCw size={24} className="spin" style={{ margin: '0 auto 12px', display: 'block' }} />
          Loading Skincare & Grooming Execution System...
        </div>
      </div>
    );
  }

  if (error && !skincareData) {
    const handleQuickSignIn = async () => {
      try {
        const res = await fetch('/api/auth/dev-login', { method: 'POST', credentials: 'include' });
        if (res.ok) {
          fetchSkincareData();
        } else {
          window.location.href = '/api/auth/dev-login';
        }
      } catch (e) {
        window.location.href = '/api/auth/dev-login';
      }
    };

    return (
      <div style={{ maxWidth: '840px', margin: '0 auto', padding: '40px 20px' }}>
        <div className="card" style={{ padding: '30px', textAlign: 'center', borderColor: 'var(--accent-red)' }}>
          <AlertCircle size={32} color="var(--accent-red)" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>Unable to load today's routine</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px', marginBottom: '16px' }}>{error}</p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={handleQuickSignIn}>
              Quick Sign In / Establish Session
            </button>
            <button className="btn btn-secondary" onClick={fetchSkincareData}>
              <RefreshCw size={14} /> Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const morningTasks = skincareData?.morningTasks || [];
  const eveningTasks = skincareData?.eveningTasks || [];
  const stockWarnings = skincareData?.stockWarnings || [];
  const skinObs = skincareData?.skinObservations || {};

  const handleToggleTask = async (taskId) => {
    await toggleTask(selectedDate, taskId);
    fetchSkincareData();
  };

  return (
    <div className="skincare-view" style={{ maxWidth: '840px', margin: '0 auto', paddingBottom: '40px' }}>
      
      {/* HEADER CARD */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={14} color="var(--accent-purple)" /> SKINCARE & GROOMING SYSTEM • {skincareData?.dayOfWeek}
            </div>
            <h1 style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '-0.5px', marginTop: '4px', color: 'var(--text-primary)' }}>
              {skincareData?.theme || 'Skincare Execution'}
            </h1>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              {skincareData?.subhead}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="date"
              className="form-control"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{ padding: '6px 12px', fontSize: '13px', borderRadius: '8px' }}
            />
          </div>
        </div>

        {/* ANCHOR RULE BANNER */}
        <div style={{
          marginTop: '16px',
          padding: '12px 14px',
          borderRadius: '10px',
          background: 'var(--accent-blue-subtle, rgba(59, 130, 246, 0.08))',
          border: '1px solid var(--accent-blue)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShieldCheck size={20} color="var(--accent-blue)" />
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Anchor Rule Enforcement
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Morning & Evening skincare are daily Anchors. Prioritise Evening skincare above all else if time is limited.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            <span className={`badge ${currentLog.anchors?.amSkincare ? 'badge-success' : 'badge-warning'}`}>
              AM: {currentLog.anchors?.amSkincare ? '✓ Done' : 'Pending'}
            </span>
            <span className={`badge ${currentLog.anchors?.pmSkincare ? 'badge-success' : 'badge-warning'}`}>
              PM: {currentLog.anchors?.pmSkincare ? '✓ Done' : 'Pending'}
            </span>
          </div>
        </div>
      </div>

      {/* OUT OF STOCK WARNINGS */}
      {stockWarnings.length > 0 && (
        <div className="card" style={{ marginBottom: '16px', borderColor: 'var(--accent-amber)', background: 'rgba(245, 158, 11, 0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <AlertTriangle size={20} color="var(--accent-amber)" />
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Resource Stock Attention ({stockWarnings.length} Product{stockWarnings.length > 1 ? 's' : ''})
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {stockWarnings.map(w => `${w.name} (${w.isOutOfStock ? 'Out of stock' : 'Low stock: ' + w.currentQty + ' ' + w.unit})`).join(' • ')}
                </div>
              </div>
            </div>

            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setActiveTab('inventory')}
              style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <Package size={14} /> View Resources
            </button>
          </div>
        </div>
      )}

      {/* MORNING SKINCARE & GROOMING */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sun size={18} color="var(--accent-amber)" /> Morning Routine
          </span>
          <span className="badge badge-blue">
            {morningTasks.filter(t => t.isCompleted).length} / {morningTasks.length} Done
          </span>
        </div>

        {morningTasks.length === 0 ? (
          <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
            No morning skincare or hair tasks scheduled for today in Doctrine.
          </div>
        ) : (
          <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {morningTasks.map(task => (
              <div
                key={task.id}
                className={`check-item ${task.isCompleted ? 'completed' : ''}`}
                onClick={() => handleToggleTask(task.id)}
                style={{ padding: '12px', borderRadius: '10px', transition: 'all 0.15s ease' }}
              >
                <div className="checkbox-custom">
                  {task.isCompleted && <CheckCircle2 size={16} />}
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '6px' }}>
                    <span className="task-text" style={{ fontSize: '14px', fontWeight: 600 }}>
                      {task.activity}
                    </span>
                    <span className="task-time" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent-blue)' }}>
                      <Clock size={12} style={{ display: 'inline', marginRight: '3px' }} /> {task.time}
                    </span>
                  </div>

                  {/* Associated Resource Stock Badges */}
                  {task.associatedResources.length > 0 && (
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                      {task.associatedResources.map(res => (
                        <span
                          key={res.id}
                          style={{
                            fontSize: '11px',
                            padding: '2px 8px',
                            borderRadius: '6px',
                            fontWeight: 600,
                            background: res.stockStatus === 'OUT_OF_STOCK'
                              ? 'rgba(239, 68, 68, 0.12)'
                              : res.stockStatus === 'LOW_STOCK'
                              ? 'rgba(245, 158, 11, 0.12)'
                              : 'var(--bg-subtle, rgba(0,0,0,0.04))',
                            color: res.stockStatus === 'OUT_OF_STOCK'
                              ? 'var(--accent-red)'
                              : res.stockStatus === 'LOW_STOCK'
                              ? 'var(--accent-amber)'
                              : 'var(--text-secondary)',
                            border: '1px solid var(--border-color)'
                          }}
                        >
                          <Package size={10} style={{ display: 'inline', marginRight: '3px' }} />
                          {res.name}: {res.currentQty} {res.unit}
                          {res.stockStatus === 'OUT_OF_STOCK' && ' (OUT)'}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* EVENING / NIGHT SKINCARE & GROOMING */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Moon size={18} color="var(--accent-purple)" /> Evening / Night Routine
          </span>
          <span className="badge badge-purple">
            {eveningTasks.filter(t => t.isCompleted).length} / {eveningTasks.length} Done
          </span>
        </div>

        {eveningTasks.length === 0 ? (
          <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
            No evening skincare or hair tasks scheduled for today in Doctrine.
          </div>
        ) : (
          <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {eveningTasks.map(task => (
              <div
                key={task.id}
                className={`check-item ${task.isCompleted ? 'completed' : ''}`}
                onClick={() => handleToggleTask(task.id)}
                style={{ padding: '12px', borderRadius: '10px', transition: 'all 0.15s ease' }}
              >
                <div className="checkbox-custom">
                  {task.isCompleted && <CheckCircle2 size={16} />}
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '6px' }}>
                    <span className="task-text" style={{ fontSize: '14px', fontWeight: 600 }}>
                      {task.activity}
                    </span>
                    <span className="task-time" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent-purple)' }}>
                      <Clock size={12} style={{ display: 'inline', marginRight: '3px' }} /> {task.time}
                    </span>
                  </div>

                  {/* Associated Resource Stock Badges */}
                  {task.associatedResources.length > 0 && (
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                      {task.associatedResources.map(res => (
                        <span
                          key={res.id}
                          style={{
                            fontSize: '11px',
                            padding: '2px 8px',
                            borderRadius: '6px',
                            fontWeight: 600,
                            background: res.stockStatus === 'OUT_OF_STOCK'
                              ? 'rgba(239, 68, 68, 0.12)'
                              : res.stockStatus === 'LOW_STOCK'
                              ? 'rgba(245, 158, 11, 0.12)'
                              : 'var(--bg-subtle, rgba(0,0,0,0.04))',
                            color: res.stockStatus === 'OUT_OF_STOCK'
                              ? 'var(--accent-red)'
                              : res.stockStatus === 'LOW_STOCK'
                              ? 'var(--accent-amber)'
                              : 'var(--text-secondary)',
                            border: '1px solid var(--border-color)'
                          }}
                        >
                          <Package size={10} style={{ display: 'inline', marginRight: '3px' }} />
                          {res.name}: {res.currentQty} {res.unit}
                          {res.stockStatus === 'OUT_OF_STOCK' && ' (OUT)'}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ACTIVE INGREDIENTS & BARRIER PROTECTION RULE */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="card-title">
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Droplets size={18} color="var(--accent-blue)" /> Barrier Protection & Active Ingredients
          </span>
        </div>

        <div style={{ background: 'var(--bg-app)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-color)', marginTop: '8px' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
            Today's Active Protocol:
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
            {skincareData?.activeIngredientRule}
          </div>
        </div>
      </div>

      {/* HISTORICAL ADHERENCE & CONSISTENCY */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={18} color="var(--accent-blue)" /> Historical Skincare Adherence
          </span>
          <span className="badge badge-success">
            {historyData?.overallAdherencePct || 0}% Overall
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginTop: '12px' }}>
          <div style={{ background: 'var(--bg-app)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Morning Adherence</div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--accent-amber)', marginTop: '2px' }}>
              {historyData?.morningAdherencePct || 0}%
            </div>
          </div>

          <div style={{ background: 'var(--bg-app)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Evening Adherence</div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--accent-purple)', marginTop: '2px' }}>
              {historyData?.eveningAdherencePct || 0}%
            </div>
          </div>

          <div style={{ background: 'var(--bg-app)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Recorded Days</div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--accent-blue)', marginTop: '2px' }}>
              {historyData?.recordedDaysCount || 0} Days
            </div>
          </div>
        </div>

        {/* RECENT HISTORICAL EXECUTION STREAM */}
        {historyData?.history && historyData.history.length > 0 && (
          <div style={{ marginTop: '14px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px' }}>
              Recent Execution Records
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {historyData.history.slice(0, 5).map(h => (
                <div
                  key={h.date}
                  onClick={() => setSelectedDate(h.date)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: 'var(--bg-app)',
                    border: '1px solid var(--border-color)',
                    cursor: 'pointer'
                  }}
                >
                  <div>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{h.date}</span>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginLeft: '8px' }}>({h.dayOfWeek})</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '12px', color: h.morningCompleted ? 'var(--accent-green)' : 'var(--text-secondary)' }}>
                      AM {h.morningCompleted ? '✓' : '⊘'}
                    </span>
                    <span style={{ fontSize: '12px', color: h.eveningCompleted ? 'var(--accent-green)' : 'var(--text-secondary)' }}>
                      PM {h.eveningCompleted ? '✓' : '⊘'}
                    </span>
                    <span className="badge badge-purple" style={{ fontSize: '11px' }}>
                      {h.adherencePct}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* WEEKLY SKIN & HAIR OBSERVATIONS */}
      <div className="card">
        <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <HeartPulse size={18} color="var(--accent-red)" /> Skin & Hair Observations
          </span>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setActiveTab('week')}
            style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            Sunday Review <ChevronRight size={14} />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginTop: '12px' }}>
          <div style={{ background: 'var(--bg-app)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Skin Complexion</div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--accent-purple)', marginTop: '2px' }}>
              {skinObs.complexion}
            </div>
          </div>

          <div style={{ background: 'var(--bg-app)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Active Breakouts</div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: skinObs.activeBreakouts > 0 ? 'var(--accent-amber)' : 'var(--accent-green)', marginTop: '2px' }}>
              {skinObs.activeBreakouts} Breakouts
            </div>
          </div>

          <div style={{ background: 'var(--bg-app)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Hair Shedding</div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--accent-blue)', marginTop: '2px' }}>
              {skinObs.hairShedding} Shedding
            </div>
          </div>

          <div style={{ background: 'var(--bg-app)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Baby Hair Growth</div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--accent-green)', marginTop: '2px' }}>
              {skinObs.newBabyHairs ? 'Active Growth' : 'Stable'}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};
