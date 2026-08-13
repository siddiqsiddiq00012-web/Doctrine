import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { Sparkles, RefreshCw, AlertCircle, CheckCircle2, Award, Zap, ArrowRight, Shield } from 'lucide-react';

export const DailySummaryView = ({ dateStr }) => {
  const { user, getOrCreateDailyLog, formatTimeDisplay } = useApp();

  const [summaryRecord, setSummaryRecord] = useState(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const targetDate = dateStr || new Date().toISOString().split('T')[0];
  const dailyLog = getOrCreateDailyLog(targetDate);

  // Calculate deterministic metrics on frontend for instant display
  const totalTasks = Object.keys(dailyLog.completedTasks || {}).length;
  const completedCount = Object.values(dailyLog.completedTasks || {}).filter(t => t.completed).length;
  const executionPercentage = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

  // 1. Fetch Existing Saved Daily Summary from Server DB
  const fetchSummary = useCallback(async () => {
    if (!user || !targetDate) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/summary/${targetDate}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setSummaryRecord(data.summaryRecord);
      } else {
        setSummaryRecord(null);
      }
    } catch (e) {
      console.error('Fetch daily summary error:', e);
      setSummaryRecord(null);
    } finally {
      setLoading(false);
    }
  }, [user, targetDate]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  // 2. Generate or Regenerate Daily Summary via Backend AI Service
  const handleGenerateSummary = async (forceRegenerate = false) => {
    setGenerating(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/summary/${targetDate}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ forceRegenerate })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.summaryRecord) {
          setSummaryRecord(data.summaryRecord);
        } else {
          setErrorMsg(data.error || 'Failed to generate daily summary.');
        }
      } else {
        const errData = await res.json();
        setErrorMsg(errData.details || errData.message || errData.error || 'Daily summary generation failed.');
      }
    } catch (e) {
      console.error('Generate daily summary error:', e);
      setErrorMsg('Network error. Could not connect to AI service.');
    } finally {
      setGenerating(false);
    }
  };

  const formattedDateTitle = new Date(targetDate + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  return (
    <div className="card" style={{ padding: '24px', marginBottom: '24px', position: 'relative' }}>
      
      {/* Header Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            padding: '8px',
            borderRadius: '10px',
            backgroundColor: 'var(--accent-purple-subtle)',
            color: 'var(--accent-purple)'
          }}>
            <Sparkles size={20} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.4px' }}>
                10:00 PM Daily AI Summary
              </h3>
              <span className="badge badge-purple" style={{ fontSize: '11px', textTransform: 'uppercase' }}>
                AI Analysis
              </span>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', margin: '2px 0 0 0' }}>
              {formattedDateTitle}
            </p>
          </div>
        </div>

        {/* Deterministic Execution Percentage Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '18px', fontWeight: 800, color: executionPercentage >= 80 ? 'var(--accent-green)' : 'var(--accent-amber)' }}>
              {summaryRecord ? summaryRecord.completionPercentage : executionPercentage}%
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Execution Score</div>
          </div>
        </div>
      </div>

      {/* Error Alert with Retry */}
      {errorMsg && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '10px',
          backgroundColor: 'var(--accent-red-subtle)',
          color: 'var(--accent-red)',
          border: '1px solid var(--accent-red)',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '13px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} />
            <span>Daily summary generation failed. Your recorded task execution remains 100% intact.</span>
          </div>
          <button
            onClick={() => handleGenerateSummary(true)}
            className="btn btn-sm"
            style={{ backgroundColor: 'var(--accent-red)', color: '#fff', border: 'none', cursor: 'pointer' }}
          >
            <RefreshCw size={13} /> Retry
          </button>
        </div>
      )}

      {/* State 1: Loading Saved Record */}
      {loading ? (
        <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '13px' }}>
          Loading daily summary...
        </div>
      ) : summaryRecord ? (

        /* State 2: Display Generated AI Summary */
        <div>
          {/* Summary Metadata Metrics Row */}
          <div style={{
            display: 'flex',
            gap: '12px',
            flexWrap: 'wrap',
            padding: '12px 16px',
            borderRadius: '10px',
            backgroundColor: 'var(--bg-card-subtle)',
            border: '1px solid var(--border-color)',
            marginBottom: '18px',
            fontSize: '12px',
            color: 'var(--text-secondary)'
          }}>
            <span>Completed Tasks: <strong>{summaryRecord.completedCount} / {summaryRecord.totalTasksCount}</strong></span>
            <span>•</span>
            <span>Model: <strong>{summaryRecord.model}</strong></span>
            <span>•</span>
            <span>Generated: <strong>{summaryRecord.generatedAt ? new Date(summaryRecord.generatedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }) : '10:00 PM'}</strong></span>
          </div>

          {/* Structured Markdown Content */}
          <div style={{
            fontSize: '14px',
            lineHeight: '1.65',
            color: 'var(--text-primary)',
            whiteSpace: 'pre-wrap',
            marginBottom: '20px'
          }}>
            {summaryRecord.summary}
          </div>

          {/* Action Bar: Regenerate */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '14px' }}>
            <button
              onClick={() => handleGenerateSummary(true)}
              disabled={generating}
              className="btn btn-secondary btn-sm"
              style={{ borderRadius: '8px', cursor: 'pointer' }}
            >
              <RefreshCw size={13} className={generating ? 'animate-spin' : ''} />
              {generating ? 'Regenerating AI Analysis...' : 'Regenerate Summary'}
            </button>
          </div>
        </div>

      ) : (

        /* State 3: Empty State (No summary generated yet for this date) */
        <div style={{
          padding: '24px 16px',
          textAlign: 'center',
          backgroundColor: 'var(--bg-card-subtle)',
          borderRadius: '12px',
          border: '1px dashed var(--border-color)'
        }}>
          <Sparkles size={32} color="var(--accent-purple)" style={{ marginBottom: '10px' }} />
          <h4 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px 0' }}>
            No AI Daily Summary Generated Yet
          </h4>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '440px', margin: '0 auto 16px auto', lineHeight: '1.5' }}>
            Daily summaries are generated automatically at 10:00 PM based strictly on your actual recorded task completions. You can also generate one instantly below for testing.
          </p>

          <button
            onClick={() => handleGenerateSummary(false)}
            disabled={generating}
            className="btn btn-primary"
            style={{
              padding: '10px 20px',
              fontSize: '14px',
              fontWeight: 600,
              borderRadius: '20px',
              backgroundColor: 'var(--accent-purple)',
              color: '#fff',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            <Sparkles size={16} className={generating ? 'animate-spin' : ''} />
            {generating ? 'Analyzing Recorded Data...' : 'Generate AI Daily Summary'}
          </button>
        </div>
      )}

    </div>
  );
};
