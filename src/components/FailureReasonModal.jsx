import React, { useState } from 'react';
import { AlertCircle, Clock, X, CheckCircle2, MessageSquare, Info } from 'lucide-react';

export const VALID_FAILURE_REASONS = [
  { id: 'Lack of time', label: 'Lack of time', icon: '🕒' },
  { id: 'Forgot', label: 'Forgot', icon: '❓' },
  { id: 'No resources', label: 'No resources', icon: '📦' },
  { id: 'Too tired', label: 'Too tired', icon: '😴' },
  { id: 'Work/college conflict', label: 'Work/college conflict', icon: '🎓' },
  { id: 'Started too late', label: 'Started too late', icon: '⏳' },
  { id: 'Screen distraction', label: 'Screen distraction', icon: '📱' },
  { id: 'Meal preparation failure', label: 'Meal preparation failure', icon: '🍱' },
  { id: 'Other', label: 'Other', icon: '✏️' }
];

export const FailureReasonModal = ({ task, onSave, onClose, lastRecordedReason = null }) => {
  const [selectedReason, setSelectedReason] = useState(lastRecordedReason || '');
  const [userNote, setUserNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!task) return null;

  const handleConfirm = async () => {
    if (!selectedReason) {
      alert('Please select a failure reason category.');
      return;
    }
    setSubmitting(true);
    try {
      await onSave({
        date: task.date,
        taskKey: task.taskKey,
        taskName: task.taskName || task.taskKey,
        category: task.category || 'DOCTRINE',
        status: task.status || 'SKIPPED',
        reason: selectedReason,
        userNote
      });
    } catch (e) {
      console.error('Save failure reason error:', e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '16px'
    }}>
      <div className="card" style={{ maxWidth: '480px', width: '100%', padding: '24px', position: 'relative', borderRadius: '16px' }}>
        
        {/* Header & Close Button */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={20} color="var(--accent-amber)" />
            <h3 style={{ fontSize: '17px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              Why was this missed?
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: '4px' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Task Name Badge */}
        <div style={{
          padding: '10px 14px',
          borderRadius: '10px',
          background: 'var(--bg-app)',
          border: '1px solid var(--border-color)',
          marginBottom: '16px',
          fontSize: '13px'
        }}>
          <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 700 }}>
            {task.category || 'TASK'} • {task.date}
          </div>
          <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
            {task.taskName || task.taskKey}
          </div>
        </div>

        {/* Repeat Assistance Hint */}
        {lastRecordedReason && (
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Info size={13} color="var(--accent-blue)" /> Last time recorded as: <strong>{lastRecordedReason}</strong>
          </div>
        )}

        {/* Reason Selection Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginBottom: '16px' }}>
          {VALID_FAILURE_REASONS.map(r => {
            const isSelected = selectedReason === r.id;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelectedReason(r.id)}
                style={{
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: `1px solid ${isSelected ? 'var(--accent-blue)' : 'var(--border-color)'}`,
                  background: isSelected ? 'var(--accent-blue-subtle)' : 'var(--bg-card-subtle)',
                  color: isSelected ? 'var(--accent-blue)' : 'var(--text-primary)',
                  fontSize: '12px',
                  fontWeight: 600,
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>{r.icon}</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</span>
              </button>
            );
          })}
        </div>

        {/* Optional Custom Note Input */}
        <div style={{ marginBottom: '20px' }}>
          <label className="form-label" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            Additional Context (Optional)
          </label>
          <input
            type="text"
            className="form-input"
            placeholder={selectedReason === 'Other' ? 'e.g. Unexpected family commitment...' : 'e.g. College ran late today...'}
            value={userNote}
            onChange={e => setUserNote(e.target.value)}
            style={{ fontSize: '13px' }}
          />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onClose}
            disabled={submitting}
          >
            Skip Without Reason
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleConfirm}
            disabled={submitting || !selectedReason}
          >
            <CheckCircle2 size={14} /> Save Reason
          </button>
        </div>

      </div>
    </div>
  );
};
