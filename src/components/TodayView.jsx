import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { WEEKLY_DOCTRINE, NON_NEGOTIABLE_RULES, ACTIVE_INGREDIENTS, PREPARED_FOR_TOMORROW_TEMPLATES, SHAKE_RECIPES } from '../data/doctrineData';
import { DailySummaryView } from './DailySummaryView';
import { CheckCircle2, Circle, Clock, Flame, ShieldAlert, Sparkles, Moon, Sun, ArrowRight, Check, FileText, Utensils } from 'lucide-react';


const ContextSnippet = ({ taskKey, category, activity, dayName }) => {
  const [open, setOpen] = useState(false);

  const getContext = () => {
    const actLower = (activity || '').toLowerCase();
    const keyLower = (taskKey || '').toLowerCase();

    if (category === 'DATA_ENG' || actLower.includes('data engineering')) {
      return {
        goal: 'Data Engineering Mastery Goal',
        reason: 'Part of your ordered Data Engineering roadmap. Completing today\'s session advances prerequisite topics toward full pipeline competency.'
      };
    }
    if (category === 'WORKOUT' || actLower.includes('workout') || actLower.includes('cardio')) {
      if (dayName === 'MONDAY' || dayName === 'FRIDAY' || actLower.includes('workout a')) {
        return {
          goal: 'Strength & Hypertrophy Goal',
          reason: 'Stimulates primary muscle groups through progressive overload, setting an anabolic tone for muscle growth.'
        };
      } else if (dayName === 'WEDNESDAY' || actLower.includes('workout b')) {
        return {
          goal: 'Stability & Connective Tissue Goal',
          reason: 'Reinforces stabilizer muscles, core endurance, and connective tissue integrity for long-term joint health.'
        };
      } else {
        return {
          goal: 'Cardio & Active Recovery Goal',
          reason: 'Increases peripheral circulation to shuttle oxygen and essential nutrients to muscle tissues, hair follicles, and skin cells.'
        };
      }
    }
    if (category === 'POSTURE' || actLower.includes('dead hang') || actLower.includes('wall angel')) {
      return {
        goal: 'Spinal Health & Posture Correction Goal',
        reason: 'Decompresses intervertebral discs and corrects thoracic kyphosis to realign spinal posture.'
      };
    }
    if (category === 'SKINCARE' || actLower.includes('skincare')) {
      if (actLower.includes('morning') || actLower.includes('cleanse') || actLower.includes('spf')) {
        return {
          goal: 'Skin Barrier & Photoprotection Goal',
          reason: 'Protects skin from UV damage, maintains hydration, and prevents free radical oxidation during daylight hours.'
        };
      } else {
        return {
          goal: 'Cellular Turnover & Barrier Repair Goal',
          reason: 'Clears accumulated impurities, delivers active ingredients, and locks in ceramide barrier repair overnight.'
        };
      }
    }
    if (category === 'HAIR' || actLower.includes('hair') || actLower.includes('scalp') || actLower.includes('dermaroll')) {
      return {
        goal: 'Hair Density & Follicle Nourishment Goal',
        reason: 'Supplies essential fatty acids and stimulates scalp micro-circulation to nourish hair follicles.'
      };
    }
    if (category === 'NUTRITION' || actLower.includes('mass shake') || actLower.includes('dinner') || actLower.includes('kanji')) {
      if (actLower.includes('mass shake')) {
        return {
          goal: 'Caloric MED Goal (2,700 kcal)',
          reason: 'Provides critical 950–1000 kcal baseline floor to prevent catabolism of muscle, skin, and hair.'
        };
      } else if (actLower.includes('glow') || actLower.includes('papaya')) {
        return {
          goal: 'Nutrient Density & Skin Brightening Goal',
          reason: 'Delivers potent carotenoids, nitrates, and vitamin C for gut-skin axis health.'
        };
      } else if (actLower.includes('kanji') || actLower.includes('curd')) {
        return {
          goal: 'Gut Microflora & Probiotic Goal',
          reason: 'Enriches gut microbiome to optimize nutrient absorption and reduce systemic inflammation.'
        };
      } else {
        return {
          goal: 'Caloric MED & Anabolic Nutrition Goal',
          reason: 'Contributes to daily 2,700 kcal threshold and 100g protein floor to sustain cellular repair.'
        };
      }
    }
    if (category === 'SLEEP' || actLower.includes('sleep')) {
      return {
        goal: 'Growth Hormone & Deep Recovery Goal',
        reason: 'Triggers peak nocturnal growth hormone release and cellular repair window.'
      };
    }
    if (category === 'NAMAZ' || keyLower.startsWith('namaz_')) {
      return {
        goal: 'Spiritual Anchor & Mindfulness Goal',
        reason: 'Establishes daily spiritual grounding, structured pause, and mental discipline.'
      };
    }
    if (category === 'ANCHOR' || keyLower.startsWith('anchor_')) {
      return {
        goal: 'Doctrine Anchor Non-Negotiable',
        reason: 'Core non-negotiable anchor required to maintain daily momentum even on minimum viable days.'
      };
    }
    return {
      goal: 'Doctrine Plan',
      reason: 'Part of today\'s scheduled Doctrine plan.'
    };
  };

  const context = getContext();

  return (
    <div style={{ marginTop: '4px' }}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          fontSize: '11px',
          fontWeight: 600,
          color: 'var(--accent-blue)',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px'
        }}
      >
        <span>ⓘ Why this matters</span>
        <span style={{ fontSize: '9px' }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            marginTop: '6px',
            padding: '8px 10px',
            borderRadius: '8px',
            background: 'var(--card-subtle-bg, #F8FAFC)',
            border: '1px solid var(--border-color)',
            fontSize: '12px',
            lineHeight: '1.4',
            color: 'var(--text-secondary)'
          }}
        >
          <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '2px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            Goal: {context.goal}
          </div>
          <div>{context.reason}</div>
        </div>
      )}
    </div>
  );
};

export const TodayView = () => {
  const {
    getTodayStr,
    getOrCreateDailyLog,
    toggleTask,
    toggleNamaz,
    toggleTahajjud,
    toggleAnchor,
    togglePrepItem,
    updateDailyNotes,
    adaptationState,
    fetchAdaptation,
    rescheduleTask
  } = useApp();

  const todayStr = getTodayStr();

  const [rescheduleModalTask, setRescheduleModalTask] = useState(null);
  const [targetDateInput, setTargetDateInput] = useState('');
  const [rescheduleError, setRescheduleError] = useState(null);
  const [rescheduleSubmitting, setRescheduleSubmitting] = useState(false);

  useEffect(() => {
    fetchAdaptation(todayStr);
  }, [todayStr, fetchAdaptation]);

  const handleRescheduleConfirm = async () => {
    if (!rescheduleModalTask || !targetDateInput) return;
    setRescheduleSubmitting(true);
    setRescheduleError(null);
    try {
      await rescheduleTask(rescheduleModalTask.id, targetDateInput);
      setRescheduleModalTask(null);
      setTargetDateInput('');
    } catch (err) {
      setRescheduleError(err.message || 'Task could not be rescheduled. It may already be completed or max carryover depth reached.');
    } finally {
      setRescheduleSubmitting(false);
    }
  };

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

  const currentLog = getOrCreateDailyLog(todayStr);
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

  const formattedDate = new Date(todayStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric'
  });

  return (
    <div className="today-view workspace-medium" style={{ paddingBottom: '40px' }}>
      {/* Date Header */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              {formattedDate} • TODAY
            </div>
            <h1 style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '-0.5px', marginTop: '2px', color: 'var(--text-primary)' }}>
              {dayDoctrine.day} — {dayDoctrine.theme}
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              {dayDoctrine.subhead}
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div style={{ marginTop: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Today's Progress</span>
            <span style={{ color: 'var(--accent-blue)' }}>{completedCount} of {totalTasks} ({progressPct}%)</span>
          </div>
          <div className="progress-container" style={{ height: '6px' }}>
            <div className="progress-fill" style={{ width: `${progressPct}%` }}></div>
          </div>
        </div>
      </div>

      {/* RESCHEDULE TASK MODAL */}
      {rescheduleModalTask && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '20px'
        }}>
          <div className="card" style={{ maxWidth: '420px', width: '100%', padding: '24px', background: 'var(--bg-card)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px' }}>Reschedule / Defer Task</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Defer <strong>{rescheduleModalTask.activity || rescheduleModalTask.taskKey}</strong> to a future target date. The origin execution will be marked SKIPPED with a carryover link.
            </p>

            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Select Target Date</label>
            <input
              type="date"
              value={targetDateInput}
              onChange={(e) => setTargetDateInput(e.target.value)}
              className="form-input"
              style={{ width: '100%', padding: '8px 12px', marginBottom: '16px' }}
            />

            {rescheduleError && (
              <div style={{ fontSize: '12px', color: '#EF4444', marginBottom: '12px', padding: '8px', borderRadius: '6px', background: '#FEE2E2' }}>
                ⚠ {rescheduleError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-secondary"
                onClick={() => setRescheduleModalTask(null)}
                disabled={rescheduleSubmitting}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleRescheduleConfirm}
                disabled={rescheduleSubmitting || !targetDateInput}
              >
                {rescheduleSubmitting ? 'Rescheduling...' : 'Confirm Reschedule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HERO "WHAT NOW?" EXECUTION COMMAND SURFACE */}
      {currentBlock && (
        <div className="hero-what-now">
          <div className="what-now-meta">
            <span>CURRENT TIME BLOCK</span>
            <span>•</span>
            <span>{currentBlock.time}</span>
          </div>

          <div className="what-now-activity">
            {currentBlock.activity}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div className="what-now-subtext">
              <span className="badge badge-purple">{currentBlock.category}</span>
              <span className={`badge ${currentLog.completedTasks[currentBlock.id]?.completed ? 'badge-success' : 'badge-warning'}`}>
                {currentLog.completedTasks[currentBlock.id]?.completed ? '✓ Task Completed' : '○ Action Pending'}
              </span>
            </div>

            <button
              className={`btn ${currentLog.completedTasks[currentBlock.id]?.completed ? 'btn-secondary' : 'btn-primary'}`}
              onClick={() => toggleTask(todayStr, currentBlock.id)}
              style={{
                minHeight: '44px',
                padding: '10px 20px',
                fontSize: '14px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              {currentLog.completedTasks[currentBlock.id]?.completed ? (
                <> <Check size={16} /> Completed </>
              ) : (
                <> <CheckCircle2 size={16} /> Mark Completed Now </>
              )}
            </button>
          </div>

          {nextBlock && (
            <div className="what-now-next-row">
              <div>
                <strong style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-tertiary)', marginRight: '6px' }}>
                  COMING NEXT
                </strong>
                <span>{nextBlock.time} — {nextBlock.activity}</span>
              </div>
              <ArrowRight size={15} color="var(--text-tertiary)" />
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
                onClick={() => toggleNamaz(todayStr, p)}
              >
                <div className="prayer-name">{p.toUpperCase()}</div>
                <div className="prayer-status">{isDone ? '✓ Prayed' : '○ Pending'}</div>
              </div>
            );
          })}
          <div
            className={`prayer-pill ${currentLog.tahajjud ? 'active' : ''}`}
            onClick={() => toggleTahajjud(todayStr)}
            style={{ background: currentLog.tahajjud ? 'var(--accent-purple-subtle)' : '', borderColor: currentLog.tahajjud ? 'var(--accent-purple)' : '' }}
          >
            <div className="prayer-name" style={{ color: currentLog.tahajjud ? 'var(--accent-purple)' : '' }}>TAHAJJUD</div>
            <div className="prayer-status" style={{ color: currentLog.tahajjud ? 'var(--accent-purple)' : '' }}>
              {currentLog.tahajjud ? '★ Prayed' : '○ Pending'}
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
          {(() => {
            const sortedTimeBlocks = [...dayDoctrine.timeBlocks].sort((a, b) => {
              const aDone = !!currentLog.completedTasks[a.id]?.completed;
              const bDone = !!currentLog.completedTasks[b.id]?.completed;
              if (aDone === bDone) return 0;
              return aDone ? 1 : -1;
            });

            return sortedTimeBlocks.map((block) => {
              const isCompleted = !!currentLog.completedTasks[block.id]?.completed;
              const timestamp = currentLog.completedTasks[block.id]?.timestamp;

              return (
                <div
                  key={block.id}
                  className={`check-item ${isCompleted ? 'completed' : ''}`}
                  onClick={() => toggleTask(todayStr, block.id)}
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
                    {isCompleted && (
                      <div style={{ fontSize: '11px', color: 'var(--accent-purple)', marginTop: '2px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span>⚡ Completed • Resources & Adherence automatically updated</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <div className="task-category">{block.category}</div>
                        {(block.id.startsWith('carryover_') || block.sourceTaskExecutionId) && (
                          <span className="badge badge-purple" style={{ fontSize: '10px', padding: '2px 6px' }}>
                            Carryover Task
                          </span>
                        )}
                      </div>

                      {!isCompleted && (
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            setRescheduleModalTask(block);
                            // Default target date to tomorrow
                            const nextD = new Date(todayStr + 'T00:00:00');
                            nextD.setDate(nextD.getDate() + 1);
                            const y = nextD.getFullYear();
                            const m = String(nextD.getMonth() + 1).padStart(2, '0');
                            const d = String(nextD.getDate()).padStart(2, '0');
                            setTargetDateInput(`${y}-${m}-${d}`);
                          }}
                          style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px' }}
                        >
                          Reschedule / Defer →
                        </button>
                      )}
                    </div>

                    {/* FEATURE 12: WHY THIS MATTERS CONTEXTUAL SNIPPET */}
                    <ContextSnippet
                      taskKey={block.id}
                      category={block.category}
                      activity={block.activity}
                      dayName={dayName}
                    />
                  </div>
                </div>
              );
            });
          })()}
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

      {/* ANCHORS & NON-NEGOTIABLES */}
      <div className="card">
        <div className="card-title">
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Flame size={18} color="var(--accent-amber)" /> Anchors & Non-Negotiable Rules
          </span>
          <span className="badge badge-warning">Core Directives</span>
        </div>
        <div className="card-subtitle">
          Rule: Mass Shake + Morning Skincare + Evening Skincare mandatory every day.
        </div>

        <div className="grid-2">
          {(() => {
            const anchorItems = [
              { key: 'massShakeTaken', title: 'Mass Shake (~1000 kcal) Drank', category: 'Anabolic Anchor' },
              { key: 'amSkincare', title: 'Morning Skincare & SPF 50+ Completed', category: 'Skin Barrier Anchor' },
              { key: 'pmSkincare', title: 'Evening Skincare Routine Completed', category: 'Skin Repair Anchor (Priority)' }
            ];

            const sortedAnchors = [...anchorItems].sort((a, b) => {
              const aDone = !!currentLog.anchors[a.key];
              const bDone = !!currentLog.anchors[b.key];
              if (aDone === bDone) return 0;
              return aDone ? 1 : -1;
            });

            return sortedAnchors.map((item) => {
              const isChecked = !!currentLog.anchors[item.key];
              return (
                <div
                  key={item.key}
                  className={`check-item ${isChecked ? 'completed' : ''}`}
                  onClick={() => toggleAnchor(todayStr, item.key)}
                >
                  <div className="checkbox-custom">
                    {isChecked && <Check size={14} />}
                  </div>
                  <div>
                    <div className="task-text">{item.title}</div>
                    <div className="task-category">{item.category}</div>
                  </div>
                </div>
              );
            });
          })()}
        </div>
      </div>

      {/* PREPARED FOR TOMORROW CHECKLIST */}
      <div className="card" style={{ borderColor: 'var(--accent-blue-subtle)', marginBottom: '24px' }}>
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
          {(() => {
            const sortedPrep = [...PREPARED_FOR_TOMORROW_TEMPLATES].sort((a, b) => {
              const aDone = !!currentLog.preparedForTomorrow[a.id];
              const bDone = !!currentLog.preparedForTomorrow[b.id];
              if (aDone === bDone) return 0;
              return aDone ? 1 : -1;
            });

            return sortedPrep.map((item) => {
              const isChecked = !!currentLog.preparedForTomorrow[item.id];
              return (
                <div
                  key={item.id}
                  className={`check-item ${isChecked ? 'completed' : ''}`}
                  onClick={() => togglePrepItem(todayStr, item.id)}
                >
                  <div className="checkbox-custom">
                    {isChecked && <Check size={14} />}
                  </div>
                  <div className="task-text" style={{ fontSize: '14px' }}>
                    {item.text}
                  </div>
                </div>
              );
            });
          })()}
        </div>
      </div>

      {/* DAILY NOTES & REFLECTIONS */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-title">
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={18} color="var(--accent-blue)" /> Daily Notes & Observations
          </span>
          <span className="badge badge-purple">Attached to {todayStr}</span>
        </div>
        <div className="card-subtitle">
          Record observations, wins, obstacles, or adjustments for today ({todayStr}).
        </div>

        <textarea
          className="form-textarea"
          rows={4}
          placeholder="Type your reflections, observations, or reasons for missed tasks today..."
          value={currentLog.notes || ''}
          onChange={(e) => updateDailyNotes(todayStr, e.target.value)}
          style={{ width: '100%', marginTop: '8px', fontSize: '13px', lineHeight: '1.5' }}
        />
      </div>

      {/* FOODS & DRINKS OF THE DAY (INFORMATIONAL NUTRITION REFERENCE) */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-title">
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Utensils size={18} color="var(--accent-purple)" /> Foods & Drinks of the Day
          </span>
          <span className="badge badge-purple">{dayName}</span>
        </div>
        <div className="card-subtitle">
          Planned nutrition schedule for {dayName.charAt(0) + dayName.slice(1).toLowerCase()}. Informational reference only.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {(() => {
            const dayDoctrine = WEEKLY_DOCTRINE[dayName] || WEEKLY_DOCTRINE.MONDAY;
            const items = [];
            const addedKeywords = new Set();
            const hasMatch = (str, keyword) => (str || '').toLowerCase().includes(keyword.toLowerCase());

            if (SHAKE_RECIPES) {
              if (SHAKE_RECIPES.MASS_SHAKE) {
                items.push({
                  id: 'recipe-mass-shake',
                  title: SHAKE_RECIPES.MASS_SHAKE.title,
                  subtitle: SHAKE_RECIPES.MASS_SHAKE.subtitle,
                  scheduleLabel: 'Daily'
                });
                addedKeywords.add('mass shake');
              }

              if (SHAKE_RECIPES.CARROT_BEET_GLOW) {
                const isScheduledToday = dayDoctrine.timeBlocks.some(b => hasMatch(b.activity, 'glow shake')) ||
                  hasMatch(SHAKE_RECIPES.CARROT_BEET_GLOW.title, dayName.substring(0, 3));
                if (isScheduledToday) {
                  items.push({
                    id: 'recipe-glow-shake',
                    title: SHAKE_RECIPES.CARROT_BEET_GLOW.title,
                    subtitle: SHAKE_RECIPES.CARROT_BEET_GLOW.subtitle,
                    scheduleLabel: 'Mon, Thu, Sat AM'
                  });
                  addedKeywords.add('glow shake');
                  addedKeywords.add('carrot-beet');
                }
              }

              if (SHAKE_RECIPES.PAPAYA_REPAIR) {
                const isScheduledToday = dayDoctrine.timeBlocks.some(b => hasMatch(b.activity, 'papaya')) ||
                  hasMatch(SHAKE_RECIPES.PAPAYA_REPAIR.title, dayName);
                if (isScheduledToday) {
                  items.push({
                    id: 'recipe-papaya-repair',
                    title: SHAKE_RECIPES.PAPAYA_REPAIR.title,
                    subtitle: SHAKE_RECIPES.PAPAYA_REPAIR.subtitle,
                    scheduleLabel: 'Every Tuesday'
                  });
                  addedKeywords.add('papaya');
                }
              }
            }

            dayDoctrine.timeBlocks.forEach((block) => {
              const actLower = (block.activity || '').toLowerCase();
              let isDuplicate = false;
              addedKeywords.forEach(k => {
                if (actLower.includes(k)) isDuplicate = true;
              });

              if (isDuplicate) return;

              if (block.category === 'NUTRITION' || actLower.includes('kanji') || actLower.includes('curd') || actLower.includes('flaxseed')) {
                items.push({
                  id: block.id,
                  title: block.activity,
                  subtitle: `Scheduled at ${block.time}`,
                  scheduleLabel: dayName
                });
              }
            });

            return items.map((food) => (
              <div
                key={food.id}
                style={{
                  padding: '12px 14px',
                  borderRadius: '12px',
                  background: 'var(--bg-app)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '12px'
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {food.title}
                  </div>
                  {food.subtitle && (
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      {food.subtitle}
                    </div>
                  )}
                </div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.4px', whiteSpace: 'nowrap' }}>
                  {food.scheduleLabel}
                </div>
              </div>
            ));
          })()}
        </div>
      </div>

      {/* 10:00 PM DAILY AI SUMMARY */}
      <DailySummaryView dateStr={todayStr} />
    </div>
  );
};
