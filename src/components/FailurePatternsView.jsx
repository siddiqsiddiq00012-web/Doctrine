import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import {
  AlertCircle,
  TrendingDown,
  Sparkles,
  Clock,
  Calendar,
  RefreshCw,
  Info,
  ShieldCheck,
  CheckCircle2,
  ListFilter,
  Layers,
  ArrowRight
} from 'lucide-react';

export const FailurePatternsView = () => {
  const { user } = useApp();
  const [weeksCount, setWeeksCount] = useState(4);
  const [analysis, setAnalysis] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchPatternsAndLogs = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [patRes, recRes] = await Promise.all([
        fetch(`/api/history/failure-patterns?weeks=${weeksCount}`, { credentials: 'include' }),
        fetch('/api/history/failure-records', { credentials: 'include' })
      ]);

      if (patRes.ok) {
        const patData = await patRes.json();
        setAnalysis(patData.analysis);
      } else {
        throw new Error('Failed to fetch failure pattern analytics');
      }

      if (recRes.ok) {
        const recData = await recRes.json();
        setRecords(recData.records || []);
      }
    } catch (e) {
      console.error('[FailurePatternsView] Error loading analytics:', e);
      setError(e.message || 'Failed to load failure pattern data.');
    } finally {
      setLoading(false);
    }
  }, [user, weeksCount]);

  useEffect(() => {
    fetchPatternsAndLogs();
  }, [fetchPatternsAndLogs]);

  const filteredRecords = records.filter(r => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (r.taskName && r.taskName.toLowerCase().includes(q)) ||
      (r.reason && r.reason.toLowerCase().includes(q)) ||
      (r.userNote && r.userNote.toLowerCase().includes(q)) ||
      (r.date && r.date.includes(q))
    );
  });

  if (loading && !analysis) {
    return (
      <div style={{ maxWidth: '820px', margin: '0 auto', padding: '40px 20px', textAlign: 'center' }}>
        <div className="card" style={{ padding: '40px', color: 'var(--text-secondary)' }}>
          <RefreshCw size={24} className="spin" style={{ margin: '0 auto 12px', display: 'block' }} />
          Calculating failure pattern analytics & contextual correlations...
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '820px', margin: '0 auto', paddingBottom: '40px' }}>
      
      {/* Header Bar & Window Filter */}
      <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={20} color="var(--accent-amber)" />
              <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                Personal Failure Pattern Log
              </h2>
              <span className="badge badge-warning">Diagnostic</span>
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
              Identifies recurring operational bottlenecks to determine the highest-impact intervention.
            </div>
          </div>

          {/* Time Window Selectors */}
          <div style={{ display: 'flex', gap: '6px', background: 'var(--bg-app)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            {[
              { label: 'Last 2 Weeks', weeks: 2 },
              { label: 'Last 4 Weeks', weeks: 4 },
              { label: 'Last 8 Weeks', weeks: 8 }
            ].map(w => (
              <button
                key={w.weeks}
                onClick={() => setWeeksCount(w.weeks)}
                className={`btn btn-sm ${weeksCount === w.weeks ? 'btn-primary' : 'btn-ghost'}`}
                style={{ fontSize: '12px', padding: '5px 10px' }}
              >
                {w.label}
              </button>
            ))}
          </div>
        </div>

        {/* Date Window Summary Bar */}
        {analysis && (
          <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-color)', fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <div>Window: <strong>{analysis.startDateStr}</strong> to <strong>{analysis.endDateStr}</strong></div>
            <div>Total Recorded Failures: <strong style={{ color: 'var(--accent-amber)' }}>{analysis.totalFailures}</strong></div>
            <div>Analyzed Period: <strong>{analysis.weeksCount} Weeks</strong></div>
          </div>
        )}
      </div>

      {error && (
        <div style={{ padding: '12px 16px', borderRadius: '10px', backgroundColor: 'var(--accent-red-subtle)', border: '1px solid var(--accent-red)', color: 'var(--accent-red)', marginBottom: '20px', fontSize: '13px' }}>
          {error}
        </div>
      )}

      {analysis && (
        <div>

          {/* PRIMARY BOTTLENECK & INTERVENTION CARD */}
          <div className="card" style={{ padding: '24px', marginBottom: '20px' }}>
            <div className="card-title">
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <TrendingDown size={18} color="var(--accent-amber)" /> Primary Execution Bottleneck
              </span>
              {analysis.hasStrongPattern ? (
                <span className="badge badge-warning">High Frequency</span>
              ) : (
                <span className="badge badge-secondary">Early Data</span>
              )}
            </div>

            {analysis.totalFailures === 0 ? (
              <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '14px' }}>
                <CheckCircle2 size={32} color="var(--accent-green)" style={{ margin: '0 auto 8px', display: 'block' }} />
                No task failures recorded in the analyzed period ({analysis.weeksCount} weeks).
              </div>
            ) : (
              <div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>
                  {analysis.patternSummary}
                </div>

                {/* Contextual Correlations Pills */}
                {analysis.correlations && analysis.correlations.length > 0 && (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px', marginTop: '10px' }}>
                    {analysis.correlations.map((corr, idx) => (
                      <span
                        key={idx}
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          padding: '4px 10px',
                          borderRadius: '12px',
                          background: 'var(--bg-app)',
                          border: '1px solid var(--border-color)',
                          color: 'var(--text-secondary)'
                        }}
                      >
                        🔗 {corr}
                      </span>
                    ))}
                  </div>
                )}

                {/* Potential Grounded Intervention */}
                {analysis.potentialIntervention && (
                  <div style={{
                    padding: '14px 16px',
                    borderRadius: '12px',
                    background: 'var(--accent-blue-subtle)',
                    border: '1px solid var(--accent-blue)',
                    marginTop: '14px'
                  }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent-blue)', textTransform: 'uppercase', marginBottom: '2px' }}>
                      Primary Operational Intervention
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      💡 {analysis.potentialIntervention}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* FAILURE REASONS BREAKDOWN */}
          {analysis.breakdown && analysis.breakdown.length > 0 && (
            <div className="card" style={{ padding: '24px', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '14px' }}>
                Failure Reason Distribution
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {analysis.breakdown.map((item, idx) => (
                  <div key={item.reason}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {idx + 1}. {item.reason}
                      </span>
                      <span style={{ color: 'var(--text-secondary)' }}>
                        <strong>{item.count}</strong> ({item.percentage}%)
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div style={{ height: '8px', borderRadius: '4px', background: 'var(--bg-app)', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${item.percentage}%`,
                          backgroundColor: idx === 0 ? 'var(--accent-amber)' : 'var(--accent-blue)',
                          borderRadius: '4px'
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI OPERATIONAL INTERPRETATION CARD (Requirements 15, 16, 17) */}
          {analysis.aiInterpretation && (
            <div className="card" style={{ padding: '24px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <Sparkles size={18} color="var(--accent-purple)" />
                <h3 style={{ fontSize: '15px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                  AI Analytical Interpretation
                </h3>
              </div>

              <div style={{
                padding: '16px',
                borderRadius: '12px',
                background: 'var(--bg-app)',
                border: '1px solid var(--border-color)',
                fontSize: '13px',
                lineHeight: '1.6',
                color: 'var(--text-primary)'
              }}>
                {analysis.aiInterpretation}
              </div>

              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '8px', fontStyle: 'italic' }}>
                ℹ️ Analytical interpretation grounded strictly in calculated data facts. No motivational fluff.
              </div>
            </div>
          )}

          {/* INDIVIDUAL FAILURE HISTORY STREAM (Requirement 19) */}
          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0 }}>
                Historical Failure Log ({records.length})
              </h3>

              <div style={{ position: 'relative', width: '220px' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Filter records..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{ fontSize: '12px', padding: '6px 10px' }}
                />
              </div>
            </div>

            {filteredRecords.length === 0 ? (
              <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '13px' }}>
                No failure records match your filter query.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {filteredRecords.map(rec => (
                  <div
                    key={rec.id}
                    style={{
                      padding: '14px 16px',
                      borderRadius: '10px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-app)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '10px'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {rec.taskName || rec.taskKey}
                        </span>
                        <span className="badge badge-warning">{rec.reason}</span>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '3px' }}>
                        Date: <strong>{rec.date}</strong> • Category: <strong>{rec.category || 'DOCTRINE'}</strong>
                        {rec.userNote && <span> • Context: <em>"{rec.userNote}"</em></span>}
                      </div>
                    </div>

                    <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                      {new Date(rec.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

    </div>
  );
};
