import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { WEEKLY_DOCTRINE } from '../data/doctrineData';
import { DailySummaryView } from './DailySummaryView';
import { FailurePatternsView } from './FailurePatternsView';
import { Calendar, Clock, CheckCircle2, Circle, XCircle, FileText, Sparkles, Terminal, ArrowLeft, ChevronRight, Award, Flame, AlertCircle } from 'lucide-react';

export const HistoryView = () => {
  const {
    selectedDate,
    setSelectedDate,
    getTodayStr,
    dailyLogs,
    fetchHistoryForDate,
    toggleTask,
    toggleNamaz,
    toggleTahajjud,
    toggleAnchor,
    togglePrepItem,
    updateDailyNotes,
    setActiveTab
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState('detail'); // 'detail' | 'timeline'
  const [timelineData, setTimelineData] = useState([]);
  const [overviewMetrics, setOverviewMetrics] = useState({ totalDaysTracked: 0, activeDaysCount: 0, averageCompletionPct: 0 });
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [deSessionForDate, setDeSessionForDate] = useState(null);

  const todayStr = getTodayStr();

  // Fetch Timeline & Overview Data from Backend
  const fetchTimelineAndOverview = useCallback(async () => {
    setLoadingTimeline(true);
    try {
      const [tlRes, ovRes] = await Promise.all([
        fetch('/api/history/timeline', { credentials: 'include' }),
        fetch('/api/history/overview', { credentials: 'include' })
      ]);

      if (tlRes.ok) {
        const tlData = await tlRes.json();
        setTimelineData(tlData.timeline || []);
      }

      if (ovRes.ok) {
        const ovData = await ovRes.json();
        setOverviewMetrics(ovData.overview || { totalDaysTracked: 0, activeDaysCount: 0, averageCompletionPct: 0 });
      }
    } catch (e) {
      console.error('Failed to fetch timeline or overview:', e);
    } finally {
      setLoadingTimeline(false);
    }
  }, []);

  // Fetch Data Engineering session for selectedDate if available
  const fetchDeForDate = useCallback(async (dateStr) => {
    try {
      const res = await fetch(`/api/de/sessions?date=${dateStr}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (data.sessions && data.sessions.length > 0) {
          setDeSessionForDate(data.sessions[0]);
        } else {
          setDeSessionForDate(null);
        }
      }
    } catch (e) {
      setDeSessionForDate(null);
    }
  }, []);

  useEffect(() => {
    fetchTimelineAndOverview();
  }, [fetchTimelineAndOverview]);

  useEffect(() => {
    if (selectedDate) {
      fetchHistoryForDate(selectedDate);
      fetchDeForDate(selectedDate);
    }
  }, [selectedDate, fetchHistoryForDate, fetchDeForDate]);

  const currentLog = dailyLogs[selectedDate];

  // Helper date status
  const isFutureDate = selectedDate > todayStr;
  const isToday = selectedDate === todayStr;
  const hasRecordForDate = Boolean(currentLog && currentLog.date === selectedDate);

  // Derived metrics for current selected date
  const dayName = currentLog?.dayOfWeek || new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
  const dayDoctrine = WEEKLY_DOCTRINE[dayName] || WEEKLY_DOCTRINE.MONDAY;

  const formattedSelectedDate = new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  const getRelativeDateStr = (daysAgo) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().split('T')[0];
  };

  // Performance Report Calculations for selected historical date
  const rawTasks = currentLog?.rawTasks || [];
  const rawExec = currentLog?.rawExecution;

  const completedTasksList = rawTasks.length > 0
    ? rawTasks.filter(t => t.status === 'COMPLETED')
    : (dayDoctrine.timeBlocks || []).filter(b => !!currentLog?.completedTasks[b.id]?.completed).map(b => ({
        id: b.id,
        taskName: b.activity,
        category: b.category,
        time: b.time,
        status: 'COMPLETED',
        completedAt: currentLog?.completedTasks[b.id]?.timestamp
      }));

  const missedTasksList = rawTasks.length > 0
    ? rawTasks.filter(t => t.status !== 'COMPLETED' && t.status !== 'SKIPPED')
    : (dayDoctrine.timeBlocks || []).filter(b => !currentLog?.completedTasks[b.id]?.completed).map(b => ({
        id: b.id,
        taskName: b.activity,
        category: b.category,
        time: b.time,
        status: 'MISSED'
      }));

  const totalTrackedCount = rawExec?.totalTasksCount ?? (completedTasksList.length + missedTasksList.length);
  const completedCount = rawExec?.completedCount ?? completedTasksList.length;
  const missedCount = rawExec?.missedCount ?? missedTasksList.length;

  const completionPct = totalTrackedCount > 0
    ? Math.round((completedCount / totalTrackedCount) * 100)
    : 0;

  // Exact Hydration evaluation (0 L is preserved as 0 L; only null/undefined/unrecorded is 'Not recorded')
  const waterLitersVal = currentLog?.waterLiters;
  const hydrationText = (waterLitersVal !== null && waterLitersVal !== undefined && currentLog)
    ? `${waterLitersVal} L`
    : 'Not recorded';

  // Namaz & Anchors metrics
  const namazCompletedCount = currentLog?.namaz
    ? ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'].filter(p => !!currentLog.namaz[p]).length
    : null;
  const namazText = namazCompletedCount !== null ? `${namazCompletedCount} / 5 Prayed` : 'Not recorded';

  const anchorsCompletedCount = currentLog?.anchors
    ? ['massShakeTaken', 'amSkincare', 'pmSkincare'].filter(a => !!currentLog.anchors[a]).length
    : null;
  const anchorsText = anchorsCompletedCount !== null ? `${anchorsCompletedCount} / 3 Anchors` : 'Not recorded';

  const getDeterministicSummary = () => {
    if (totalTrackedCount === 0) return 'No tracked tasks recorded for this date.';
    if (completedCount === totalTrackedCount) return `Complete execution. All ${totalTrackedCount} tracked tasks for this day were completed.`;
    if (completionPct >= 80) return `Strong execution day. ${completedCount} of ${totalTrackedCount} scheduled tasks were completed, with ${missedCount} missed task${missedCount === 1 ? '' : 's'}.`;
    if (completionPct >= 50) return `Partial execution day. ${completedCount} of ${totalTrackedCount} scheduled tasks were completed. ${missedCount} task${missedCount === 1 ? '' : 's'} remained incomplete.`;
    if (completedCount > 0) return `Minimum execution day. ${completedCount} of ${totalTrackedCount} tasks completed, with ${missedCount} missed tasks.`;
    return `Zero tasks completed on this day. ${missedCount} tracked tasks remained incomplete.`;
  };

  return (
    <div className="history-view workspace-fluid" style={{ paddingBottom: '40px' }}>
      {/* BRAND & HEADER BAR */}
      <div className="card" style={{ padding: '20px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Clock size={14} color="var(--accent-blue)" /> DOCTRINE EXECUTION TIMELINE
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '-0.5px', marginTop: '2px', color: 'var(--text-primary)' }}>
              Historical Progress
            </h1>
          </div>

          {/* Sub-tab view toggle */}
          <div style={{ display: 'flex', gap: '6px', background: 'var(--bg-secondary, #F4F4F6)', padding: '4px', borderRadius: '8px' }}>
            <button
              className={`btn ${activeSubTab === 'detail' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setActiveSubTab('detail')}
              style={{ fontSize: '13px', padding: '6px 12px' }}
            >
              Date Detail
            </button>
            <button
              className={`btn ${activeSubTab === 'timeline' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => { setActiveSubTab('timeline'); fetchTimelineAndOverview(); }}
              style={{ fontSize: '13px', padding: '6px 12px' }}
            >
              Timeline Stream
            </button>
            <button
              className={`btn ${activeSubTab === 'patterns' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setActiveSubTab('patterns')}
              style={{ fontSize: '13px', padding: '6px 12px' }}
            >
              Failure Patterns
            </button>
          </div>
        </div>

        {/* CONSISTENCY OVERVIEW METRICS BAR */}
        <div className="grid-3" style={{ marginTop: '16px', gap: '12px' }}>
          <div style={{ background: 'var(--card-subtle-bg, #F9FAFB)', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Total Days Tracked</div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>{overviewMetrics.totalDaysTracked}</div>
          </div>
          <div style={{ background: 'var(--card-subtle-bg, #F9FAFB)', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Active Execution Days</div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--accent-blue)', marginTop: '2px' }}>{overviewMetrics.activeDaysCount}</div>
          </div>
          <div style={{ background: 'var(--card-subtle-bg, #F9FAFB)', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Avg Compliance</div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--accent-green, #10B981)', marginTop: '2px' }}>{overviewMetrics.averageCompletionPct}%</div>
          </div>
        </div>
      </div>

      {/* DATE SELECTOR & QUICK BUTTONS BAR */}
      <div className="card" style={{ padding: '14px 20px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={18} color="var(--text-secondary)" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => { setSelectedDate(e.target.value); setActiveSubTab('detail'); }}
              className="form-input"
              style={{ width: 'auto', padding: '6px 12px', fontSize: '14px', fontWeight: 600 }}
            />
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              className={`btn ${selectedDate === todayStr ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => { setSelectedDate(todayStr); setActiveSubTab('detail'); }}
              style={{ fontSize: '12px', padding: '4px 10px' }}
            >
              Today
            </button>
            <button
              className={`btn ${selectedDate === getRelativeDateStr(1) ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => { setSelectedDate(getRelativeDateStr(1)); setActiveSubTab('detail'); }}
              style={{ fontSize: '12px', padding: '4px 10px' }}
            >
              Yesterday
            </button>
            <button
              className={`btn ${selectedDate === getRelativeDateStr(7) ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => { setSelectedDate(getRelativeDateStr(7)); setActiveSubTab('detail'); }}
              style={{ fontSize: '12px', padding: '4px 10px' }}
            >
              7 Days Ago
            </button>
          </div>
        </div>
      </div>

      {/* VIEW SUB-TAB 1: CHRONOLOGICAL TIMELINE STREAM */}
      {activeSubTab === 'timeline' && (
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            RECORDED HISTORICAL DAYS ({timelineData.length})
          </div>

          {loadingTimeline ? (
            <div className="card" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              Loading historical timeline stream...
            </div>
          ) : timelineData.length === 0 ? (
            <div className="card" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              No historical execution records found. Start completing daily activities to build your timeline.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {timelineData.map((item) => (
                <div
                  key={item.id}
                  className="card"
                  onClick={() => { setSelectedDate(item.date); setActiveSubTab('detail'); }}
                  style={{
                    padding: '16px 20px',
                    cursor: 'pointer',
                    transition: 'transform 0.15s ease, border-color 0.15s ease',
                    borderColor: item.date === selectedDate ? 'var(--accent-blue)' : undefined
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {item.date} — {item.dayOfWeek}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        {item.completedCount} of {item.totalTasksCount} tasks completed
                        {item.skippedCount > 0 ? ` • ${item.skippedCount} skipped` : ''}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {item.hasAiSummary && (
                        <span className="badge badge-purple" style={{ fontSize: '11px' }}>AI Summary</span>
                      )}
                      {item.hasDeActivity && (
                        <span className="badge badge-success" style={{ fontSize: '11px' }}>Data Eng</span>
                      )}
                      <span className={`badge ${item.completionPercentage >= 80 ? 'badge-success' : item.completionPercentage >= 50 ? 'badge-warning' : 'badge-purple'}`} style={{ fontSize: '13px', fontWeight: 700 }}>
                        {item.completionPercentage}%
                      </span>
                      <ChevronRight size={18} color="var(--text-tertiary)" />
                    </div>
                  </div>

                  {item.notes && (
                    <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic', background: 'var(--card-subtle-bg, #F9FAFB)', padding: '6px 10px', borderRadius: '4px' }}>
                      "{item.notes.length > 90 ? item.notes.substring(0, 90) + '...' : item.notes}"
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* VIEW SUB-TAB 2: DETAILED HISTORICAL DAY RECORD */}
      {activeSubTab === 'detail' && (
        <div>
          {/* FUTURE DATES STATE */}
          {isFutureDate ? (
            <div className="card" style={{ padding: '30px', textAlign: 'center' }}>
              <Calendar size={32} color="var(--accent-blue)" style={{ margin: '0 auto 12px' }} />
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>Future Date — Plan Ahead</h2>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px', maxWidth: '460px', margin: '8px auto 16px' }}>
                {formattedSelectedDate} is in the future. Daily execution tasks will be recorded as you execute them on that date.
              </p>
              <button className="btn btn-primary" onClick={() => setSelectedDate(todayStr)}>
                Return to Today
              </button>
            </div>
          ) : !hasRecordForDate ? (
            /* UNRECORDED PAST DATE STATE */
            <div className="card" style={{ padding: '30px', textAlign: 'center' }}>
              <Clock size={32} color="var(--text-tertiary)" style={{ margin: '0 auto 12px' }} />
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>No Execution Recorded</h2>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px', maxWidth: '460px', margin: '8px auto 16px' }}>
                No execution data was recorded for {formattedSelectedDate}.
              </p>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                <button className="btn btn-primary" onClick={() => setSelectedDate(todayStr)}>
                  Return to Today
                </button>
                <button className="btn btn-secondary" onClick={() => setActiveSubTab('timeline')}>
                  View Recent Timeline
                </button>
              </div>
            </div>
          ) : (
            /* ACTUAL RECORDED HISTORICAL DAY */
            <div>
              {/* DAILY PERFORMANCE REPORT */}
              <div className="card" style={{ padding: '24px', marginBottom: '20px', borderLeft: '4px solid var(--accent-blue)' }}>
                {/* Report Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent-blue)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                      DAILY PERFORMANCE REPORT
                    </div>
                    <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px', letterSpacing: '-0.5px' }}>
                      {formattedSelectedDate} {isToday ? '• TODAY' : ''}
                    </h2>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      {dayDoctrine.day} — {dayDoctrine.theme}
                    </div>
                  </div>

                  {/* Completion Score Badge */}
                  <div style={{ textAlign: 'right' }}>
                    <div style={{
                      fontSize: '28px',
                      fontWeight: 800,
                      color: totalTrackedCount === 0 ? 'var(--text-tertiary)' : completionPct >= 80 ? 'var(--accent-green, #10B981)' : completionPct >= 50 ? 'var(--accent-amber, #F59E0B)' : 'var(--accent-red, #EF4444)',
                      lineHeight: '1'
                    }}>
                      {totalTrackedCount === 0 ? 'N/A' : `${completionPct}%`}
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginTop: '4px' }}>
                      {totalTrackedCount === 0 ? 'No tracked tasks' : `${completedCount} of ${totalTrackedCount} tasks completed`}
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                {totalTrackedCount > 0 && (
                  <div style={{ marginTop: '16px' }}>
                    <div className="progress-container" style={{ height: '8px', marginBottom: '0' }}>
                      <div
                        className="progress-fill"
                        style={{
                          width: `${completionPct}%`,
                          backgroundColor: completionPct >= 80 ? 'var(--accent-green, #10B981)' : completionPct >= 50 ? 'var(--accent-amber, #F59E0B)' : 'var(--accent-red, #EF4444)'
                        }}
                      ></div>
                    </div>
                  </div>
                )}

                {/* COMPLETED TASKS BREAKDOWN */}
                <div style={{ marginTop: '24px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent-green, #10B981)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircle2 size={15} /> COMPLETED ({completedTasksList.length})
                  </div>

                  {completedTasksList.length === 0 ? (
                    <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', fontStyle: 'italic', padding: '8px 12px', background: 'var(--card-subtle-bg, #F9FAFB)', borderRadius: '8px' }}>
                      No tasks completed on this date.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {completedTasksList.map((t, idx) => (
                        <div
                          key={t.id || t.taskKey || idx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '10px 14px',
                            borderRadius: '10px',
                            background: 'var(--bg-app, #F8F9FA)',
                            border: '1px solid var(--border-color)',
                            gap: '12px'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                            <CheckCircle2 size={16} color="var(--accent-green, #10B981)" style={{ flexShrink: 0 }} />
                            <div>
                              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                {t.taskName || t.activity}
                              </span>
                              {t.category && (
                                <span className="badge badge-purple" style={{ fontSize: '10px', marginLeft: '8px' }}>
                                  {t.category}
                                </span>
                              )}
                            </div>
                          </div>

                          {(t.completedAt || t.time) && (
                            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--accent-green, #10B981)', whiteSpace: 'nowrap' }}>
                              {t.completedAt ? `Done at ${new Date(t.completedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}` : t.time}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* MISSED TASKS BREAKDOWN */}
                <div style={{ marginTop: '20px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent-red, #EF4444)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <XCircle size={15} /> MISSED ({missedTasksList.length})
                  </div>

                  {missedTasksList.length === 0 ? (
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontStyle: 'italic', padding: '8px 12px', background: 'var(--card-subtle-bg, #F9FAFB)', borderRadius: '8px' }}>
                      Zero missed tasks recorded for this date.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {missedTasksList.map((t, idx) => (
                        <div
                          key={t.id || t.taskKey || idx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '10px 14px',
                            borderRadius: '10px',
                            background: 'var(--bg-app, #F8F9FA)',
                            border: '1px solid var(--border-color)',
                            gap: '12px'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                            <XCircle size={16} color="var(--accent-red, #EF4444)" style={{ flexShrink: 0 }} />
                            <div>
                              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                {t.taskName || t.activity}
                              </span>
                              {t.category && (
                                <span className="badge badge-warning" style={{ fontSize: '10px', marginLeft: '8px' }}>
                                  {t.category}
                                </span>
                              )}
                              {t.failureReason && (
                                <div style={{ fontSize: '12px', color: 'var(--accent-red)', marginTop: '2px' }}>
                                  Reason: {t.failureReason.reasonText || t.failureReason.category}
                                </div>
                              )}
                            </div>
                          </div>

                          {t.time && (
                            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                              {t.time}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* PERFORMANCE METRICS SUMMARY */}
                <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '12px' }}>
                    PERFORMANCE METRICS
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
                    <div style={{ background: 'var(--card-subtle-bg, #F9FAFB)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Completion</div>
                      <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>{totalTrackedCount === 0 ? 'N/A' : `${completionPct}%`}</div>
                    </div>

                    <div style={{ background: 'var(--card-subtle-bg, #F9FAFB)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Completed</div>
                      <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--accent-green, #10B981)', marginTop: '2px' }}>{completedCount} tasks</div>
                    </div>

                    <div style={{ background: 'var(--card-subtle-bg, #F9FAFB)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Missed</div>
                      <div style={{ fontSize: '15px', fontWeight: 700, color: missedCount > 0 ? 'var(--accent-red, #EF4444)' : 'var(--text-primary)', marginTop: '2px' }}>{missedCount} tasks</div>
                    </div>

                    <div style={{ background: 'var(--card-subtle-bg, #F9FAFB)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Hydration</div>
                      <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>{hydrationText}</div>
                    </div>

                    <div style={{ background: 'var(--card-subtle-bg, #F9FAFB)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Namaz</div>
                      <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>{namazText}</div>
                    </div>

                    <div style={{ background: 'var(--card-subtle-bg, #F9FAFB)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Anchors</div>
                      <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>{anchorsText}</div>
                    </div>
                  </div>
                </div>

                {/* DAILY SUMMARY / INTERPRETATION */}
                <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '6px' }}>
                    DAILY SUMMARY
                  </div>
                  <div style={{ fontSize: '14px', lineHeight: '1.6', color: 'var(--text-primary)', background: 'var(--card-subtle-bg, #F9FAFB)', padding: '12px 14px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                    {getDeterministicSummary()}
                  </div>
                </div>
              </div>

              {/* RECORDED TIME-BLOCK ACTIVITY CHECKLIST */}
              <div className="card" style={{ marginBottom: '16px' }}>
                <div className="card-title">
                  <span>Execution Checklist & Timestamps</span>
                  <span className="badge badge-purple">{dayName}</span>
                </div>
                <div className="card-subtitle">
                  Actual recorded execution status for {formattedSelectedDate}.
                </div>

                <div style={{ marginTop: '12px' }}>
                  {dayDoctrine.timeBlocks.map((block) => {
                    const taskState = currentLog.completedTasks[block.id];
                    const isCompleted = !!taskState?.completed;
                    const timestamp = taskState?.timestamp;

                    return (
                      <div
                        key={block.id}
                        className={`check-item ${isCompleted ? 'completed' : ''}`}
                        onClick={() => toggleTask(selectedDate, block.id)}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="checkbox-custom">
                          {isCompleted && <CheckCircle2 size={16} color="var(--accent-green, #10B981)" />}
                          {!isCompleted && <Circle size={16} color="var(--text-tertiary)" />}
                        </div>

                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span className="task-time">{block.time}</span>
                            {timestamp && (
                              <span style={{ fontSize: '11px', color: 'var(--accent-green, #10B981)', fontWeight: 600 }}>
                                Completed at {timestamp}
                              </span>
                            )}
                          </div>
                          <div className="task-text" style={{ marginTop: '2px' }}>
                            {block.activity}
                          </div>
                          <div className="task-category">{block.category}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* HISTORICAL REFLECTION NOTES */}
              <div className="card" style={{ marginBottom: '16px' }}>
                <div className="card-title">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FileText size={18} color="var(--accent-blue)" /> Daily Notes & Reflections
                  </span>
                  <span className="badge badge-purple">Attached to {selectedDate}</span>
                </div>

                <textarea
                  className="form-textarea"
                  rows={3}
                  placeholder="Record observations or notes for this date..."
                  value={currentLog.notes || ''}
                  onChange={(e) => updateDailyNotes(selectedDate, e.target.value)}
                  style={{ width: '100%', marginTop: '8px', fontSize: '13px', lineHeight: '1.5' }}
                />
              </div>

              {/* DATA ENGINEERING ACTIVITY LINKED FOR THIS DATE */}
              {deSessionForDate && (
                <div className="card" style={{ marginBottom: '16px', borderColor: 'var(--accent-blue-subtle)' }}>
                  <div className="card-title">
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Terminal size={18} color="var(--accent-blue)" /> Data Engineering Learning Session
                    </span>
                    <span className="badge badge-success">{deSessionForDate.actualMinutes} Minutes</span>
                  </div>

                  <div style={{ marginTop: '8px', fontSize: '13px', color: 'var(--text-primary)' }}>
                    <div><strong>Module:</strong> {deSessionForDate.moduleName}</div>
                    <div style={{ marginTop: '2px' }}><strong>Topic:</strong> {deSessionForDate.topicName} — {deSessionForDate.subtopicName}</div>
                    <div style={{ marginTop: '2px' }}><strong>Confidence:</strong> Rating {deSessionForDate.confidenceRating} / 5</div>
                    {deSessionForDate.whatILearned && (
                      <div style={{ marginTop: '6px', fontSize: '12px', color: 'var(--text-secondary)', background: 'var(--card-subtle-bg, #F9FAFB)', padding: '8px 10px', borderRadius: '6px' }}>
                        "{deSessionForDate.whatILearned}"
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* EMBEDDED 10:00 PM DAILY AI SUMMARY */}
              <DailySummaryView dateStr={selectedDate} />
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 3: PERSONAL FAILURE PATTERNS LOG */}
      {activeSubTab === 'patterns' && (
        <FailurePatternsView />
      )}
    </div>
  );
};
