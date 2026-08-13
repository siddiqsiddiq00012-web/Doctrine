import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Terminal, Clock, BookOpen, ArrowRight, Save, History, CheckCircle2 } from 'lucide-react';

export const DataEngineeringView = () => {
  const { dataEngineering, updateDataEngState, addDataEngLog, getTodayStr } = useApp();

  const [formState, setFormState] = useState({
    minutes: '60',
    topic: '',
    courseModule: '',
    notes: '',
    nextStartingPoint: ''
  });

  const [isEditingAnchors, setIsEditingAnchors] = useState(false);
  const [anchorsState, setAnchorsState] = useState({
    lastStudied: dataEngineering.lastStudied,
    nextStartingPoint: dataEngineering.nextStartingPoint,
    currentCourse: dataEngineering.currentCourse
  });

  const handleSaveAnchors = (e) => {
    e.preventDefault();
    updateDataEngState(anchorsState);
    setIsEditingAnchors(false);
  };

  const handleLogSubmit = (e) => {
    e.preventDefault();
    if (!formState.topic.trim()) return;

    const newLog = {
      date: getTodayStr(),
      minutes: Number(formState.minutes) || 60,
      topic: formState.topic,
      courseModule: formState.courseModule,
      notes: formState.notes,
      nextStartingPoint: formState.nextStartingPoint
    };

    addDataEngLog(newLog);

    setFormState({
      minutes: '60',
      topic: '',
      courseModule: '',
      notes: '',
      nextStartingPoint: ''
    });

    alert('Data Engineering Session Logged Successfully!');
  };

  const totalHours = (dataEngineering.totalMinutes / 60).toFixed(1);

  return (
    <div className="data-engineering-view">
      {/* PERSISTENT ANCHORS HERO CARD */}
      <div className="card" style={{ background: 'linear-gradient(135deg, #1C1C1E 0%, #2C2C2E 100%)', color: '#FFFFFF' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Terminal size={20} color="#007AFF" />
            <span style={{ fontSize: '16px', fontWeight: 700, letterSpacing: '-0.3px' }}>Data Engineering Hub</span>
          </div>
          <span className="badge" style={{ background: 'rgba(0,122,255,0.2)', color: '#64D2FF' }}>
            Target: 1 Hr / Day
          </span>
        </div>

        {!isEditingAnchors ? (
          <div>
            <div style={{ marginBottom: '14px', background: 'rgba(255,255,255,0.06)', padding: '12px 14px', borderRadius: '12px' }}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px', color: '#8E8E93' }}>
                LAST STUDIED:
              </div>
              <div style={{ fontSize: '17px', fontWeight: 700, marginTop: '2px', color: '#FFFFFF' }}>
                {dataEngineering.lastStudied || 'Not specified'}
              </div>
            </div>

            <div style={{ background: 'rgba(52,199,89,0.12)', border: '1px solid rgba(52,199,89,0.3)', padding: '14px', borderRadius: '12px' }}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px', color: '#34C759', fontWeight: 700 }}>
                NEXT STARTING POINT (PERSISTENT):
              </div>
              <div style={{ fontSize: '18px', fontWeight: 700, marginTop: '4px', color: '#FFFFFF' }}>
                {dataEngineering.nextStartingPoint || 'Not specified'}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
              <div style={{ fontSize: '13px', color: '#AEAEB2' }}>
                Total Cumulated Time: <strong style={{ color: '#FFFFFF' }}>{totalHours} hrs</strong> ({dataEngineering.totalMinutes} mins)
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setIsEditingAnchors(true)} style={{ background: 'rgba(255,255,255,0.15)', color: '#FFFFFF', border: 'none' }}>
                Edit Next Starting Point
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSaveAnchors} style={{ background: 'rgba(255,255,255,0.06)', padding: '14px', borderRadius: '12px' }}>
            <div className="form-group">
              <label className="form-label" style={{ color: '#AEAEB2' }}>Last Studied Topic</label>
              <input
                type="text"
                className="form-input"
                value={anchorsState.lastStudied}
                onChange={e => setAnchorsState({ ...anchorsState, lastStudied: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ color: '#AEAEB2' }}>Next Starting Point (Exact Continuation)</label>
              <input
                type="text"
                className="form-input"
                value={anchorsState.nextStartingPoint}
                onChange={e => setAnchorsState({ ...anchorsState, nextStartingPoint: e.target.value })}
              />
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
              <button type="submit" className="btn btn-primary btn-sm" style={{ flex: 1 }}>Save Anchors</button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsEditingAnchors(false)}>Cancel</button>
            </div>
          </form>
        )}
      </div>

      {/* LOG TODAY'S STUDY SESSION */}
      <div className="card">
        <div className="card-title">
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BookOpen size={18} color="var(--accent-blue)" /> Log Daily Study Session
          </span>
          <span className="badge badge-success">Daily 1 Hour Goal</span>
        </div>

        <form onSubmit={handleLogSubmit} style={{ marginTop: '12px' }}>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Time Spent (Minutes)</label>
              <input
                type="number"
                className="form-input"
                value={formState.minutes}
                onChange={e => setFormState({ ...formState, minutes: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Topic Studied</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. PySpark Broadcast Joins & Memory Tuning"
                value={formState.topic}
                onChange={e => setFormState({ ...formState, topic: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Course / Module / Reference</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Module 4: Spark Optimization"
              value={formState.courseModule}
              onChange={e => setFormState({ ...formState, courseModule: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Next Starting Point for Tomorrow (Will update hero anchor)</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Start Spark Salting technique for skewed joins"
              value={formState.nextStartingPoint}
              onChange={e => setFormState({ ...formState, nextStartingPoint: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Study Notes / Insights</label>
            <textarea
              className="form-textarea"
              placeholder="Key takeaways, queries solved, or architecture notes..."
              value={formState.notes}
              onChange={e => setFormState({ ...formState, notes: e.target.value })}
            ></textarea>
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
            Log Study Session
          </button>
        </form>
      </div>

      {/* STUDY HISTORY */}
      <div className="card">
        <div className="card-title">
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <History size={18} color="var(--text-secondary)" /> Learning History & Logs
          </span>
        </div>

        {dataEngineering.logs.length === 0 ? (
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', padding: '12px 0' }}>
            No study sessions logged yet.
          </div>
        ) : (
          dataEngineering.logs.map((log, idx) => (
            <div key={idx} style={{ borderBottom: '1px solid var(--border-color)', padding: '12px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 600 }}>
                <span>{log.topic}</span>
                <span className="badge badge-purple">{log.minutes} mins</span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Date: {log.date} {log.courseModule ? `• Course: ${log.courseModule}` : ''}
              </div>
              {log.notes && (
                <div style={{ fontSize: '13px', color: 'var(--text-primary)', marginTop: '4px', fontStyle: 'italic', background: 'var(--bg-app)', padding: '6px 10px', borderRadius: '6px' }}>
                  "{log.notes}"
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
