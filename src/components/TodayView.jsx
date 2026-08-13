import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { WEEKLY_DOCTRINE, NON_NEGOTIABLE_RULES, ACTIVE_INGREDIENTS, PREPARED_FOR_TOMORROW_TEMPLATES } from '../data/doctrineData';
import { CheckCircle2, Circle, Clock, Flame, ShieldAlert, Sparkles, Moon, Sun, ArrowRight, Check } from 'lucide-react';

export const TodayView = () => {
  const {
    selectedDate,
    setSelectedDate,
    getTodayStr,
    getOrCreateDailyLog,
    toggleTask,
    toggleNamaz,
    toggleTahajjud,
    toggleAnchor,
    togglePrepItem
  } = useApp();

  const [nowMinutes, setNowMinutes] = useState(() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  });

  // Update live time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      const d = new Date();
      setNowMinutes(d.getHours() * 60 + d.getMinutes());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const currentLog = getOrCreateDailyLog(selectedDate);
  const dayName = currentLog.dayOfWeek;
  const dayDoctrine = WEEKLY_DOCTRINE[dayName] || WEEKLY_DOCTRINE.MONDAY;

  const totalTasks = dayDoctrine.timeBlocks.length;
  const completedCount = dayDoctrine.timeBlocks.filter(b => !!currentLog.completedTasks[b.id]?.completed).length;
  const progressPct = Math.round((completedCount / totalTasks) * 100);

  // Namaz total
  const namazKeys = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
  const namazCompletedCount = namazKeys.filter(k => currentLog.namaz[k]).length;

  // Active Ingredient check for today
  const isMonWedFriAM = ['MONDAY', 'WEDNESDAY', 'FRIDAY'].includes(dayName);

  // Determine "What Now?" block
  const getCurrentAndNextBlock = () => {
    const blocks = dayDoctrine.timeBlocks;
    let currentBlock = blocks[0];
    let nextBlock = blocks[1];

    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      if (nowMinutes >= b.startMinutes && nowMinutes < b.endMinutes) {
        currentBlock = b;
        nextBlock = blocks[i + 1] || null;
        break;
      } else if (nowMinutes < b.startMinutes) {
        currentBlock = b;
        nextBlock = blocks[i + 1] || null;
        break;
      }
    }
    return { currentBlock, nextBlock };
  };

  const { currentBlock, nextBlock } = getCurrentAndNextBlock();

  const formattedDate = new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric'
  });

  return (
    <div className="today-view">
      {/* Date Header & Selector */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              {formattedDate} {selectedDate === getTodayStr() ? '• TODAY' : ''}
            </div>
            <h1 style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '-0.5px', marginTop: '2px', color: 'var(--text-primary)' }}>
              {dayDoctrine.day} — {dayDoctrine.theme}
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              {dayDoctrine.subhead}
            </p>
          </div>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="form-input"
            style={{ width: 'auto', padding: '6px 10px', fontSize: '13px' }}
          />
        </div>

        {/* Progress Bar */}
        <div style={{ marginTop: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Doctrine Completion</span>
            <span style={{ color: 'var(--accent-blue)' }}>{completedCount} of {totalTasks} ({progressPct}%)</span>
          </div>
          <div className="progress-container">
            <div className="progress-fill" style={{ width: `${progressPct}%` }}></div>
          </div>
        </div>
      </div>

      {/* HERO "WHAT NOW?" CARD */}
      {selectedDate === getTodayStr() && currentBlock && (
        <div className="hero-what-now">
          <div className="what-now-badge">
            <Clock size={14} /> WHAT NOW? • {currentBlock.time}
          </div>
          <div className="current-activity-title">
            {currentBlock.activity}
          </div>
          <div className="current-activity-time">
            Category: <span className="badge badge-purple">{currentBlock.category}</span>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '14px', marginBottom: '14px' }}>
            <button
              className={`btn ${currentLog.completedTasks[currentBlock.id]?.completed ? 'btn-secondary' : 'btn-primary'}`}
              onClick={() => toggleTask(selectedDate, currentBlock.id)}
              style={{ flex: 1 }}
            >
              {currentLog.completedTasks[currentBlock.id]?.completed ? (
                <> <Check size={16} /> Completed </>
              ) : (
                <> <CheckCircle2 size={16} /> Mark Completed Now </>
              )}
            </button>
          </div>

          {nextBlock && (
            <div className="next-up-box">
              <div>
                <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Coming Next: </span>
                <span className="next-up-title">{nextBlock.time} — {nextBlock.activity}</span>
              </div>
              <ArrowRight size={16} color="var(--text-tertiary)" />
            </div>
          )}
        </div>
      )}

      {/* NAMAZ & TAHAJJUD PRAYER BAR */}
      <div className="card" style={{ padding: '16px', marginBottom: '16px' }}>
        <div className="card-title">
          <span>Namaz & Prayer Record</span>
          <span className="badge badge-success">{namazCompletedCount} / 5 Done</span>
        </div>
        <div className="prayer-bar" style={{ marginTop: '10px' }}>
          {['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'].map((p) => {
            const isDone = !!currentLog.namaz[p];
            return (
              <div
                key={p}
                className={`prayer-pill ${isDone ? 'active' : ''}`}
                onClick={() => toggleNamaz(selectedDate, p)}
              >
                <div className="prayer-name">{p.toUpperCase()}</div>
                <div className="prayer-status">{isDone ? '✓ Prayed' : '○ Pending'}</div>
              </div>
            );
          })}
          <div
            className={`prayer-pill ${currentLog.tahajjud ? 'active' : ''}`}
            onClick={() => toggleTahajjud(selectedDate)}
            style={{ background: currentLog.tahajjud ? 'var(--accent-purple-subtle)' : '', borderColor: currentLog.tahajjud ? 'var(--accent-purple)' : '' }}
          >
            <div className="prayer-name" style={{ color: currentLog.tahajjud ? 'var(--accent-purple)' : '' }}>TAHAJJUD</div>
            <div className="prayer-status" style={{ color: currentLog.tahajjud ? 'var(--accent-purple)' : '' }}>
              {currentLog.tahajjud ? '★ Prayed' : '○ Pending'}
            </div>
          </div>
        </div>
      </div>

      {/* ANCHORS & NON-NEGOTIABLES */}
      <div className="card">
        <div className="card-title">
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Flame size={18} color="var(--accent-amber)" /> Anchors & Non-Negotiable Rules
          </span>
          <span className="badge badge-warning">Core Directives</span>
        </div>
        <div className="card-subtitle">
          Rule: Mass Shake + Morning Skincare + Evening Skincare + MED 2,700 kcal mandatory every day.
        </div>

        <div className="grid-2">
          <div
            className={`check-item ${currentLog.anchors.medKcalReached ? 'completed' : ''}`}
            onClick={() => toggleAnchor(selectedDate, 'medKcalReached')}
          >
            <div className="checkbox-custom">
              {currentLog.anchors.medKcalReached && <Check size={14} />}
            </div>
            <div>
              <div className="task-text">MED Rule: 2,700 kcal Minimum Reached</div>
              <div className="task-category">Nutrition Anchor</div>
            </div>
          </div>

          <div
            className={`check-item ${currentLog.anchors.massShakeTaken ? 'completed' : ''}`}
            onClick={() => toggleAnchor(selectedDate, 'massShakeTaken')}
          >
            <div className="checkbox-custom">
              {currentLog.anchors.massShakeTaken && <Check size={14} />}
            </div>
            <div>
              <div className="task-text">Mass Shake (~1000 kcal) Drank</div>
              <div className="task-category">Anabolic Anchor</div>
            </div>
          </div>

          <div
            className={`check-item ${currentLog.anchors.amSkincare ? 'completed' : ''}`}
            onClick={() => toggleAnchor(selectedDate, 'amSkincare')}
          >
            <div className="checkbox-custom">
              {currentLog.anchors.amSkincare && <Check size={14} />}
            </div>
            <div>
              <div className="task-text">Morning Skincare & SPF 50+ Completed</div>
              <div className="task-category">Skin Barrier Anchor</div>
            </div>
          </div>

          <div
            className={`check-item ${currentLog.anchors.pmSkincare ? 'completed' : ''}`}
            onClick={() => toggleAnchor(selectedDate, 'pmSkincare')}
          >
            <div className="checkbox-custom">
              {currentLog.anchors.pmSkincare && <Check size={14} />}
            </div>
            <div>
              <div className="task-text">Evening Skincare Routine Completed</div>
              <div className="task-category">Skin Repair Anchor (Priority)</div>
            </div>
          </div>
        </div>
      </div>

      {/* ACTIVE INGREDIENT SAFETY BANNER */}
      <div className="card" style={{ background: 'linear-gradient(135deg, #FFFDF8 0%, #FFF9EF 100%)', borderColor: '#FFE8C8' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Sparkles size={20} color="var(--accent-amber)" />
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#8A5300' }}>
              TODAY'S ACTIVE INGREDIENT ROUTINE ({dayName})
            </div>
            <div style={{ fontSize: '13px', color: '#593800', marginTop: '2px' }}>
              {isMonWedFriAM ? (
                <><strong>Morning Active:</strong> Salicylic Acid + Potato-Aloe Extract (Do not layer with Niacinamide)</>
              ) : (
                <><strong>Evening Active:</strong> Niacinamide (PM Routine only — keep Morning simple with Cleanse + Moisturiser + SPF)</>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* TODAY'S TIME-BLOCK TIMELINE */}
      <div className="card">
        <div className="card-title">
          <span>Today's Doctrine Time-Blocks</span>
          <span className="badge badge-purple">{dayName}</span>
        </div>
        <div className="card-subtitle">
          Tap any activity to mark it complete. Timestamps are recorded automatically.
        </div>

        <div>
          {dayDoctrine.timeBlocks.map((block) => {
            const isCompleted = !!currentLog.completedTasks[block.id]?.completed;
            const timestamp = currentLog.completedTasks[block.id]?.timestamp;

            return (
              <div
                key={block.id}
                className={`check-item ${isCompleted ? 'completed' : ''}`}
                onClick={() => toggleTask(selectedDate, block.id)}
              >
                <div className="checkbox-custom">
                  {isCompleted && <Check size={14} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="task-time">{block.time}</span>
                    {timestamp && (
                      <span style={{ fontSize: '11px', color: 'var(--accent-green)', fontWeight: 600 }}>
                        Done at {timestamp}
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

      {/* PREPARED FOR TOMORROW CHECKLIST */}
      <div className="card" style={{ borderColor: 'var(--accent-blue-subtle)' }}>
        <div className="card-title">
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Moon size={18} color="var(--accent-blue)" /> Prepared For Tomorrow Checklist
          </span>
          <span className="badge badge-success">Nightly Ritual</span>
        </div>
        <div className="card-subtitle">
          Complete these items before sleeping to prevent tomorrow morning from collapsing.
        </div>

        <div className="grid-2">
          {PREPARED_FOR_TOMORROW_TEMPLATES.map((item) => {
            const isChecked = !!currentLog.preparedForTomorrow[item.id];
            return (
              <div
                key={item.id}
                className={`check-item ${isChecked ? 'completed' : ''}`}
                onClick={() => togglePrepItem(selectedDate, item.id)}
              >
                <div className="checkbox-custom">
                  {isChecked && <Check size={14} />}
                </div>
                <div className="task-text" style={{ fontSize: '14px' }}>
                  {item.text}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
