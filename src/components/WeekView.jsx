import React from 'react';
import { useApp } from '../context/AppContext';
import { WEEKLY_DOCTRINE } from '../data/doctrineData';
import { Calendar, Award } from 'lucide-react';
import { SundayReviewView } from './SundayReviewView';

export const WeekView = () => {
  const { dailyLogs } = useApp();

  const daysList = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

  return (
    <div className="week-view">
      
      {/* 7-DAY DOCTRINE OVERVIEW */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-title">
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={18} color="var(--accent-blue)" /> 7-Day Doctrine Overview
          </span>
          <span className="badge badge-purple">Weekly Consistency</span>
        </div>
        <div className="card-subtitle">
          Weekly completion score across muscle, skin, hair, and posture discipline.
        </div>

        <div className="grid-3" style={{ marginTop: '16px' }}>
          {daysList.map((dayName) => {
            const dayDoc = WEEKLY_DOCTRINE[dayName];
            const matchedLog = Object.values(dailyLogs).find(l => l.dayOfWeek === dayName);
            const completedCount = matchedLog
              ? dayDoc.timeBlocks.filter(b => !!matchedLog.completedTasks[b.id]?.completed).length
              : 0;
            const pct = Math.round((completedCount / dayDoc.timeBlocks.length) * 100);
            const namazCount = matchedLog
              ? ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'].filter(p => matchedLog.namaz[p]).length
              : 0;

            return (
              <div key={dayName} className="card" style={{ padding: '14px', marginBottom: 0, background: 'var(--bg-app)' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  {dayName}
                </div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', margin: '4px 0' }}>
                  {dayDoc.theme}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  {completedCount} / {dayDoc.timeBlocks.length} Tasks ({pct}%)
                </div>
                <div className="progress-container" style={{ height: '6px', margin: '6px 0' }}>
                  <div className="progress-fill" style={{ width: `${pct}%` }}></div>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--accent-green)', fontWeight: 600, marginTop: '4px' }}>
                  Namaz: {namazCount} / 5 {matchedLog?.tahajjud ? '• Tahajjud ✓' : ''}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* FEATURE 4: SUNDAY WEEKLY REVIEW & PROGRESS TRACKING SYSTEM */}
      <SundayReviewView />
    </div>
  );
};
