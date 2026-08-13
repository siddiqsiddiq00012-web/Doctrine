import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { DATA_ENGINEERING_ROADMAP } from '../data/deRoadmapData';
import {
  BookOpen,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Clock,
  Code,
  Search,
  ChevronDown,
  ChevronRight,
  ShieldAlert,
  Brain
} from 'lucide-react';

export const DataEngineeringView = () => {
  const { user, getTodayStr } = useApp();
  const todayStr = getTodayStr();

  const [activeSubTab, setActiveSubTab] = useState('today'); // 'today' | 'roadmap' | 'history'
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);

  // Active Session Target
  const [selectedModule, setSelectedModule] = useState(DATA_ENGINEERING_ROADMAP[0].module);
  const [selectedTopic, setSelectedTopic] = useState(DATA_ENGINEERING_ROADMAP[0].topics[0].name);
  const [selectedSubtopic, setSelectedSubtopic] = useState(DATA_ENGINEERING_ROADMAP[0].topics[0].subtopics[0]);

  // Session Form & Live Timer State
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);

  // Doctrine Schedule Planned Time (Mon/Wed/Fri: 50m, Tue/Thu/Sat/Sun: 30m)
  const getDoctrinePlannedMinutes = () => {
    const dayOfWeek = new Date().getDay();
    if (dayOfWeek === 1 || dayOfWeek === 3 || dayOfWeek === 5) return 50;
    return 30;
  };

  const [plannedMinutes, setPlannedMinutes] = useState(getDoctrinePlannedMinutes());
  const [learningResource, setLearningResource] = useState('');
  const [whatILearned, setWhatILearned] = useState('');
  const [confidenceRating, setConfidenceRating] = useState(4);
  const [activeRecallText, setActiveRecallText] = useState('');
  const [codeEvidence, setCodeEvidence] = useState('');

  const [aiEvaluation, setAiEvaluation] = useState('');
  const [evaluatingAi, setEvaluatingAi] = useState(false);
  const [submittingSession, setSubmittingSession] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);

  const [historySearch, setHistorySearch] = useState('');

  // 1. Live Timer Interval Effect
  useEffect(() => {
    let interval = null;
    if (timerRunning) {
      interval = setInterval(() => {
        setTimerSeconds(prev => prev + 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [timerRunning]);

  const formatTimerDisplay = (totalSecs) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // 2. Fetch Sessions from Backend
  const fetchSessions = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch('/api/de/sessions', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
      }
    } catch (e) {
      console.error('Fetch DE sessions error:', e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Auto-select first uncompleted topic in sequential order
  const findNextUncompletedTopic = useCallback((currentSessions) => {
    for (const mod of DATA_ENGINEERING_ROADMAP) {
      for (const topic of mod.topics) {
        for (const sub of topic.subtopics) {
          const sess = currentSessions.find(s => s.subtopicName === sub);
          if (!sess || sess.status !== 'COMPLETED') {
            return {
              module: mod.module,
              topic: topic.name,
              subtopic: sub
            };
          }
        }
      }
    }
    return {
      module: DATA_ENGINEERING_ROADMAP[0].module,
      topic: DATA_ENGINEERING_ROADMAP[0].topics[0].name,
      subtopic: DATA_ENGINEERING_ROADMAP[0].topics[0].subtopics[0]
    };
  }, []);

  useEffect(() => {
    if (sessions.length > 0) {
      const nextTarget = findNextUncompletedTopic(sessions);
      setSelectedModule(nextTarget.module);
      setSelectedTopic(nextTarget.topic);
      setSelectedSubtopic(nextTarget.subtopic);
    }
  }, [sessions, findNextUncompletedTopic]);

  // Compute Subtopic Status Helper
  const getSubtopicStatus = (subName) => {
    const s = sessions.find(sess => sess.subtopicName === subName);
    if (!s) return 'NOT_STARTED';
    return s.status || 'COMPLETED';
  };

  const completedSubtopicsCount = sessions.filter(s => s.status === 'COMPLETED').length;
  const totalRoadmapSubtopics = DATA_ENGINEERING_ROADMAP.reduce(
    (acc, m) => acc + m.topics.reduce((tAcc, t) => tAcc + t.subtopics.length, 0),
    0
  );
  const overallProgressPct = Math.round((completedSubtopicsCount / totalRoadmapSubtopics) * 100);

  // 3. AI Evaluation Handler
  const handleAiEvaluate = async () => {
    if (!whatILearned || whatILearned.trim().length < 5) {
      alert('Please enter your written explanation of "What I Learned" first.');
      return;
    }
    setEvaluatingAi(true);
    setAiEvaluation('');

    try {
      const res = await fetch('/api/de/ai-evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          moduleName: selectedModule,
          topicName: selectedTopic,
          subtopicName: selectedSubtopic,
          whatILearned,
          codeEvidence
        })
      });

      if (res.ok) {
        const data = await res.json();
        setAiEvaluation(data.feedback || 'Evaluation completed.');
      } else {
        const errData = await res.json();
        alert(errData.message || 'AI Evaluation unavailable.');
      }
    } catch (e) {
      console.error('AI evaluation error:', e);
    } finally {
      setEvaluatingAi(false);
    }
  };

  // 4. Save Learning Session Handler
  const handleSaveSession = async (e) => {
    e.preventDefault();
    if (!whatILearned || whatILearned.trim().length < 5) {
      setStatusMsg({ type: 'error', text: 'Evidence Required: You must explain "What I Learned" in your own words before completing a topic.' });
      return;
    }

    setSubmittingSession(true);
    setStatusMsg(null);

    const actualMins = Math.max(1, Math.round(timerSeconds / 60));

    try {
      const payload = {
        date: todayStr,
        moduleName: selectedModule,
        topicName: selectedTopic,
        subtopicName: selectedSubtopic,
        plannedMinutes: Number(plannedMinutes) || 60,
        actualMinutes: actualMins,
        learningResource,
        whatILearned,
        confidenceRating: Number(confidenceRating) || 3,
        status: Number(confidenceRating) <= 2 ? 'REVIEW_REQUIRED' : 'COMPLETED',
        activeRecallText,
        codeEvidence
      };

      const res = await fetch('/api/de/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        setStatusMsg({ type: 'success', text: `Learning topic "${selectedSubtopic}" completed and saved with evidence!` });
        setTimerRunning(false);
        setTimerSeconds(0);
        await fetchSessions();
      } else {
        const errData = await res.json();
        setStatusMsg({ type: 'error', text: errData.message || 'Failed to save learning session.' });
      }
    } catch (err) {
      console.error('Save session error:', err);
      setStatusMsg({ type: 'error', text: 'Network error saving learning session.' });
    } finally {
      setSubmittingSession(false);
    }
  };

  const filteredHistory = sessions.filter(s => {
    if (!historySearch) return true;
    const q = historySearch.toLowerCase();
    return (
      s.subtopicName.toLowerCase().includes(q) ||
      s.topicName.toLowerCase().includes(q) ||
      s.moduleName.toLowerCase().includes(q) ||
      s.whatILearned.toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      
      {/* Header Banner */}
      <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.4px' }}>
              Data Engineering Mastery
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
              Active Learning Tracker derived from your custom roadmap.sh curriculum.
            </p>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--accent-blue)' }}>
              {overallProgressPct}% <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-tertiary)' }}>({completedSubtopicsCount}/{totalRoadmapSubtopics})</span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Mastery Progress</div>
          </div>
        </div>
      </div>

      {/* Sub-tab Navigation */}
      <div className="day-tabs" style={{ marginBottom: '20px' }}>
        <button
          className={`day-tab ${activeSubTab === 'today' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('today')}
        >
          Today's Active Session
        </button>
        <button
          className={`day-tab ${activeSubTab === 'roadmap' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('roadmap')}
        >
          Curriculum Roadmap (12 Modules)
        </button>
        <button
          className={`day-tab ${activeSubTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('history')}
        >
          Learning History Log ({sessions.length})
        </button>
      </div>

      {/* ALERT MESSAGE */}
      {statusMsg && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '10px',
          marginBottom: '20px',
          fontSize: '13px',
          fontWeight: 600,
          backgroundColor: statusMsg.type === 'success' ? 'var(--accent-green-subtle)' : 'var(--accent-red-subtle)',
          color: statusMsg.type === 'success' ? 'var(--accent-green)' : 'var(--accent-red)',
          border: `1px solid ${statusMsg.type === 'success' ? 'var(--accent-green)' : 'var(--accent-red)'}`
        }}>
          {statusMsg.text}
        </div>
      )}

      {/* TAB 1: TODAY'S ACTIVE LEARNING SESSION */}
      {activeSubTab === 'today' && (
        <div>
          {/* Target Focus Banner */}
          <div className="card" style={{ padding: '20px', marginBottom: '20px', backgroundColor: 'var(--bg-card-subtle)', borderColor: 'var(--accent-blue)' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--accent-blue)', marginBottom: '4px' }}>
              TODAY'S STUDY TARGET — {selectedModule}
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 6px 0' }}>
              {selectedTopic} → <span style={{ color: 'var(--accent-blue)' }}>{selectedSubtopic}</span>
            </h2>
            <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: 'var(--text-secondary)' }}>
              <span>Target: <strong>60 min</strong></span>
              <span>•</span>
              <span>Status: <strong style={{ textTransform: 'capitalize' }}>{getSubtopicStatus(selectedSubtopic).replace('_', ' ')}</strong></span>
            </div>
          </div>

          {/* Active Session & Timer Controls */}
          <div className="card" style={{ padding: '24px' }}>
            <form onSubmit={handleSaveSession}>
              
              {/* Live Session Timer */}
              <div style={{
                display: 'flex',
                justify: 'space-between',
                alignItems: 'center',
                padding: '16px 20px',
                borderRadius: '14px',
                backgroundColor: 'var(--bg-app)',
                border: '1px solid var(--border-color)',
                marginBottom: '20px'
              }}>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>Live Session Timer</div>
                  <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                    {formatTimerDisplay(timerSeconds)}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className={`btn ${timerRunning ? 'btn-secondary' : 'btn-primary'}`}
                    onClick={() => setTimerRunning(!timerRunning)}
                    style={{ borderRadius: '10px' }}
                  >
                    {timerRunning ? <Pause size={16} /> : <Play size={16} />}
                    {timerRunning ? 'Pause Timer' : 'Start Study Timer'}
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => { setTimerRunning(false); setTimerSeconds(0); }}
                    style={{ borderRadius: '10px' }}
                  >
                    <RotateCcw size={15} />
                  </button>
                </div>
              </div>

              {/* Resource & Time Inputs */}
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Learning Resource Used</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. CS50 SQL, PySpark Documentation, Video URL"
                    value={learningResource}
                    onChange={e => setLearningResource(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Planned Time (Minutes)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={plannedMinutes}
                    onChange={e => setPlannedMinutes(e.target.value)}
                  />
                </div>
              </div>

              {/* Mandatory What I Learned Input */}
              <div className="form-group">
                <label className="form-label" style={{ color: 'var(--accent-blue)' }}>
                  * WHAT I LEARNED (Mandatory Evidence — Explain in your own words)
                </label>
                <textarea
                  className="form-textarea"
                  rows={4}
                  placeholder="Describe the concept, key syntax, transformations, or architecture you learned today..."
                  value={whatILearned}
                  onChange={e => setWhatILearned(e.target.value)}
                  required
                />
              </div>

              {/* Understanding Check: 1 to 5 */}
              <div className="form-group">
                <label className="form-label">Understanding Check (Confidence Rating 1-5)</label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {[
                    { val: 1, label: "1 — Don't Understand" },
                    { val: 2, label: '2 — Partial' },
                    { val: 3, label: '3 — Basics' },
                    { val: 4, label: '4 — Can Use' },
                    { val: 5, label: '5 — Can Explain/Teach' }
                  ].map(rating => (
                    <button
                      key={rating.val}
                      type="button"
                      onClick={() => setConfidenceRating(rating.val)}
                      style={{
                        flex: 1,
                        padding: '8px',
                        fontSize: '12px',
                        fontWeight: 600,
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: confidenceRating === rating.val ? 'var(--accent-blue-subtle)' : 'transparent',
                        color: confidenceRating === rating.val ? 'var(--accent-blue)' : 'var(--text-secondary)',
                        cursor: 'pointer'
                      }}
                    >
                      {rating.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Optional Active Recall & Code Evidence */}
              <div className="form-group">
                <label className="form-label">Practice Code / SQL Queries / Commands Written (Optional)</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  style={{ fontFamily: 'monospace', fontSize: '13px' }}
                  placeholder="e.g. SELECT u.name, COUNT(o.id) FROM users u LEFT JOIN orders o ON u.id = o.user_id GROUP BY u.name;"
                  value={codeEvidence}
                  onChange={e => setCodeEvidence(e.target.value)}
                />
              </div>

              {/* Optional Gemini AI Evaluation */}
              <div style={{ marginBottom: '20px' }}>
                <button
                  type="button"
                  onClick={handleAiEvaluate}
                  disabled={evaluatingAi}
                  className="btn btn-secondary btn-sm"
                  style={{ borderRadius: '8px', gap: '6px' }}
                >
                  <Sparkles size={14} color="var(--accent-purple)" className={evaluatingAi ? 'animate-spin' : ''} />
                  {evaluatingAi ? 'Evaluating with Gemini AI...' : 'Evaluate My Explanation with Gemini AI'}
                </button>

                {aiEvaluation && (
                  <div style={{
                    marginTop: '12px',
                    padding: '14px',
                    borderRadius: '10px',
                    backgroundColor: 'var(--accent-purple-subtle)',
                    border: '1px solid var(--accent-purple)',
                    fontSize: '13px',
                    color: 'var(--text-primary)',
                    lineHeight: '1.5'
                  }}>
                    <strong style={{ color: 'var(--accent-purple)', display: 'block', marginBottom: '4px' }}>Gemini AI Feedback:</strong>
                    {aiEvaluation}
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={submittingSession}
                style={{ width: '100%', padding: '12px', borderRadius: '10px', fontSize: '14px', fontWeight: 700 }}
              >
                <CheckCircle2 size={16} /> Complete & Save Learning Session
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 2: CURRICULUM ROADMAP (12 MODULES) */}
      {activeSubTab === 'roadmap' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {DATA_ENGINEERING_ROADMAP.map((mod, modIdx) => (
            <div key={mod.id} className="card" style={{ padding: '20px', marginBottom: 0 }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 12px 0' }}>
                Phase {modIdx + 1}: {mod.module}
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {mod.topics.map(topic => (
                  <div key={topic.id} style={{ backgroundColor: 'var(--bg-app)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
                      {topic.name}
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {topic.subtopics.map(sub => {
                        const status = getSubtopicStatus(sub);
                        const isSelected = selectedSubtopic === sub;

                        return (
                          <button
                            key={sub}
                            onClick={() => {
                              setSelectedModule(mod.module);
                              setSelectedTopic(topic.name);
                              setSelectedSubtopic(sub);
                              setActiveSubTab('today');
                            }}
                            style={{
                              padding: '6px 12px',
                              fontSize: '12px',
                              fontWeight: 600,
                              borderRadius: '8px',
                              border: `1px solid ${isSelected ? 'var(--accent-blue)' : 'var(--border-color)'}`,
                              backgroundColor: status === 'COMPLETED' ? 'var(--accent-green-subtle)' : status === 'REVIEW_REQUIRED' ? 'var(--accent-amber-subtle)' : 'var(--bg-card)',
                              color: status === 'COMPLETED' ? 'var(--accent-green)' : status === 'REVIEW_REQUIRED' ? 'var(--accent-amber)' : 'var(--text-secondary)',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                          >
                            <span>{status === 'COMPLETED' ? '✓' : status === 'REVIEW_REQUIRED' ? '⚠' : '○'}</span>
                            <span>{sub}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 3: HISTORICAL LEARNING LOG */}
      {activeSubTab === 'history' && (
        <div>
          <div className="card" style={{ padding: '14px 18px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Search size={16} color="var(--text-tertiary)" />
              <input
                type="text"
                className="form-input"
                placeholder="Search learning topics, explanations, or modules..."
                value={historySearch}
                onChange={e => setHistorySearch(e.target.value)}
                style={{ border: 'none', padding: 0 }}
              />
            </div>
          </div>

          {filteredHistory.length === 0 ? (
            <div className="card" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              No completed learning sessions found matching search.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {filteredHistory.map(sess => (
                <div key={sess.id} className="card" style={{ padding: '18px', marginBottom: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div>
                      <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {sess.topicName} → <span style={{ color: 'var(--accent-blue)' }}>{sess.subtopicName}</span>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                        Module: {sess.moduleName} • Date: {sess.date} • Spent: {sess.actualMinutes} min
                      </div>
                    </div>

                    <span className={`badge ${sess.status === 'COMPLETED' ? 'badge-success' : 'badge-warning'}`}>
                      Confidence {sess.confidenceRating}/5
                    </span>
                  </div>

                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5', marginTop: '10px', backgroundColor: 'var(--bg-app)', padding: '12px', borderRadius: '8px' }}>
                    <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '2px' }}>What I Learned:</strong>
                    {sess.whatILearned}
                  </div>

                  {sess.codeEvidence && (
                    <div style={{ marginTop: '8px', fontSize: '12px', fontFamily: 'monospace', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card-subtle)', padding: '8px 12px', borderRadius: '6px' }}>
                      {sess.codeEvidence}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
};
