import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { WORKOUT_TEMPLATES } from '../data/doctrineData';
import { Dumbbell, TrendingUp, History, Plus, CheckCircle2, Award } from 'lucide-react';

export const TrainingView = () => {
  const { workoutLogs, logWorkoutSession, getTodayStr } = useApp();

  const [selectedWorkout, setSelectedWorkout] = useState('WORKOUT_A');
  const template = WORKOUT_TEMPLATES[selectedWorkout];

  // State for session exercises
  const [exerciseEntries, setExerciseEntries] = useState(() => {
    return template.exercises.reduce((acc, ex) => {
      acc[ex.id] = { weightKg: '', reps: ex.defaultReps, completed: false, notes: '' };
      return acc;
    }, {});
  });

  const handleWorkoutChange = (key) => {
    setSelectedWorkout(key);
    const newTmpl = WORKOUT_TEMPLATES[key];
    setExerciseEntries(newTmpl.exercises.reduce((acc, ex) => {
      acc[ex.id] = { weightKg: '', reps: ex.defaultReps, completed: false, notes: '' };
      return acc;
    }, {}));
  };

  const handleEntryChange = (exId, field, value) => {
    setExerciseEntries(prev => ({
      ...prev,
      [exId]: { ...prev[exId], [field]: value }
    }));
  };

  const handleSaveWorkout = () => {
    const session = {
      id: 'wlog-' + Date.now(),
      date: getTodayStr(),
      workoutType: selectedWorkout,
      workoutName: template.name,
      exercises: template.exercises.map(ex => ({
        id: ex.id,
        name: ex.name,
        weightKg: exerciseEntries[ex.id]?.weightKg || 'BW',
        reps: exerciseEntries[ex.id]?.reps,
        completed: exerciseEntries[ex.id]?.completed
      }))
    };
    logWorkoutSession(session);
    alert(`${template.name} Session Logged Successfully!`);
  };

  // Find previous session of same workout type
  const previousSession = workoutLogs.find(log => log.workoutType === selectedWorkout);

  return (
    <div className="training-view">
      {/* Workout Selector Tabs */}
      <div className="day-tabs">
        {Object.keys(WORKOUT_TEMPLATES).map((key) => {
          const w = WORKOUT_TEMPLATES[key];
          return (
            <button
              key={key}
              className={`day-tab ${selectedWorkout === key ? 'active' : ''}`}
              onClick={() => handleWorkoutChange(key)}
            >
              {w.name}
            </button>
          );
        })}
      </div>

      {/* Active Workout Card */}
      <div className="card">
        <div className="card-title">
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Dumbbell size={18} color="var(--accent-blue)" /> {template.name}
          </span>
          <span className="badge badge-purple">{template.subtitle}</span>
        </div>
        <div className="card-subtitle">
          Record your weight & reps to enforce Progressive Overload.
        </div>

        <div style={{ marginTop: '16px' }}>
          {template.exercises.map((ex) => {
            const entry = exerciseEntries[ex.id] || {};
            // Find previous weight/reps for this exercise if available
            const prevEx = previousSession?.exercises?.find(p => p.id === ex.id);

            return (
              <div
                key={ex.id}
                style={{
                  background: 'var(--bg-app)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  padding: '14px',
                  marginBottom: '12px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {ex.name}
                  </div>
                  {prevEx && (
                    <div style={{ fontSize: '11px', color: 'var(--accent-blue)', background: 'var(--accent-blue-subtle)', padding: '2px 8px', borderRadius: '99px', fontWeight: 600 }}>
                      Previous: {prevEx.weightKg} kg × {prevEx.reps}
                    </div>
                  )}
                </div>

                <div className="grid-2">
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Weight / Resistance (kg)</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. 12"
                      value={entry.weightKg}
                      onChange={e => handleEntryChange(ex.id, 'weightKg', e.target.value)}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Reps / Duration Completed</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder={ex.defaultReps}
                      value={entry.reps}
                      onChange={e => handleEntryChange(ex.id, 'reps', e.target.value)}
                    />
                  </div>
                </div>

                {/* Progressive Overload Target Hint */}
                <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <TrendingUp size={14} color="var(--accent-green)" />
                  <span>
                    <strong>Target Rule:</strong> Increase weight when max reps ({ex.defaultReps}) reached with clean form.
                  </span>
                </div>
              </div>
            );
          })}

          <button className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }} onClick={handleSaveWorkout}>
            Log Completed Workout Session
          </button>
        </div>
      </div>

      {/* POSTURE & SPINAL DECOMPRESSION PROTOCOL */}
      <div className="card">
        <div className="card-title">
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Award size={18} color="var(--accent-green)" /> Posture & Spinal Decompression
          </span>
          <span className="badge badge-success">Daily Non-Negotiable</span>
        </div>
        <div className="card-subtitle">
          Mandatory posture correction to lengthen spine and align shoulders.
        </div>

        <div className="grid-2">
          <div className="check-item">
            <div className="checkbox-custom">✓</div>
            <div>
              <div className="task-text">Dead Hang (3x30 sec)</div>
              <div className="task-category">Spinal Decompression</div>
            </div>
          </div>
          <div className="check-item">
            <div className="checkbox-custom">✓</div>
            <div>
              <div className="task-text">Wall Angels (2x10 reps)</div>
              <div className="task-category">Scapular & Thoracic Mobility</div>
            </div>
          </div>
          <div className="check-item">
            <div className="checkbox-custom">✓</div>
            <div>
              <div className="task-text">Cat-Cow Stretch (15 min)</div>
              <div className="task-category">Spinal Mobility</div>
            </div>
          </div>
          <div className="check-item">
            <div className="checkbox-custom">✓</div>
            <div>
              <div className="task-text">10-min Posture Walk</div>
              <div className="task-category">Weekend Alignment</div>
            </div>
          </div>
        </div>
      </div>

      {/* WORKOUT HISTORY */}
      <div className="card">
        <div className="card-title">
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <History size={18} color="var(--text-secondary)" /> Recent Training Logs
          </span>
        </div>

        {workoutLogs.length === 0 ? (
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', padding: '12px 0' }}>
            No workouts logged yet. Complete today's session above.
          </div>
        ) : (
          workoutLogs.slice(0, 5).map((log) => (
            <div key={log.id} style={{ borderBottom: '1px solid var(--border-color)', padding: '10px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 600 }}>
                <span>{log.workoutName}</span>
                <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{log.date}</span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                {log.exercises.map(e => `${e.name}: ${e.weightKg}kg (${e.reps})`).join(' • ')}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
