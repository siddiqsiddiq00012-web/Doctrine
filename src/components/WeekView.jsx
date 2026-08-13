import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { WEEKLY_DOCTRINE } from '../data/doctrineData';
import { Calendar, CheckCircle2, TrendingUp, DollarSign, Award, ArrowUpRight } from 'lucide-react';

export const WeekView = () => {
  const { dailyLogs, getTodayStr, sundayReviews, saveSundayReview, getOrCreateDailyLog } = useApp();

  // Sunday Log Form state
  const todayStr = getTodayStr();
  const existingReview = sundayReviews[todayStr] || {};

  const [formState, setFormState] = useState({
    bodyWeightKg: existingReview.bodyWeightKg || '',
    flexedBicepCm: existingReview.flexedBicepCm || '',
    chestCm: existingReview.chestCm || '',
    thighCm: existingReview.thighCm || '',
    morningHeightCm: existingReview.morningHeightCm || '',
    workoutPerformance: existingReview.workoutPerformance || 'STRONGER',
    complexion: existingReview.complexion || 'BRIGHTER',
    activeBreakouts: existingReview.activeBreakouts || '0',
    hairShedding: existingReview.hairShedding || 'LESS',
    newBabyHairs: existingReview.newBabyHairs || 'Yes',
    sleepQuality: existingReview.sleepQuality || 'BETTER',
    digestion: existingReview.digestion || 'BETTER',
    energyLevels: existingReview.energyLevels || 'HIGHER',
    protocolCompliancePct: existingReview.protocolCompliancePct || '95',
    verdict: existingReview.verdict || 'ON_TRACK',
    refinement1Pct: existingReview.refinement1Pct || 'Ensure 10 PM sharp sleep shutoff.',
    financesSaved: existingReview.finances?.saved || '',
    financesSpent: existingReview.finances?.spent || '',
    financesWhatOn: existingReview.finances?.whatItWentOn || '',
    financesWhy: existingReview.finances?.why || ''
  });

  const daysList = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

  const handleSaveReview = (e) => {
    e.preventDefault();
    const reviewObj = {
      weekStartDate: todayStr,
      bodyWeightKg: Number(formState.bodyWeightKg) || 0,
      flexedBicepCm: Number(formState.flexedBicepCm) || 0,
      chestCm: Number(formState.chestCm) || 0,
      thighCm: Number(formState.thighCm) || 0,
      morningHeightCm: Number(formState.morningHeightCm) || 0,
      workoutPerformance: formState.workoutPerformance,
      complexion: formState.complexion,
      activeBreakouts: Number(formState.activeBreakouts) || 0,
      hairShedding: formState.hairShedding,
      newBabyHairs: formState.newBabyHairs === 'Yes',
      sleepQuality: formState.sleepQuality,
      digestion: formState.digestion,
      energyLevels: formState.energyLevels,
      protocolCompliancePct: Number(formState.protocolCompliancePct) || 0,
      verdict: formState.verdict,
      refinement1Pct: formState.refinement1Pct,
      finances: {
        saved: Number(formState.financesSaved) || 0,
        spent: Number(formState.financesSpent) || 0,
        whatItWentOn: formState.financesWhatOn,
        why: formState.financesWhy
      }
    };
    saveSundayReview(todayStr, reviewObj);
    alert('Sunday Review Saved Successfully!');
  };

  return (
    <div className="week-view">
      <div className="card">
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
            // Find matched log if any
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

      {/* SUNDAY TRACKING LOG */}
      <div className="card">
        <div className="card-title">
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Award size={18} color="var(--accent-amber)" /> Sunday Tracking Log (Page 5 Verbatim)
          </span>
          <span className="badge badge-warning">System Review</span>
        </div>
        <div className="card-subtitle">
          Track measurements, complexion, hair shedding, digestion, and protocol compliance.
        </div>

        <form onSubmit={handleSaveReview}>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Body Weight (kg)</label>
              <input
                type="number"
                step="0.1"
                className="form-input"
                placeholder="e.g. 72.5"
                value={formState.bodyWeightKg}
                onChange={e => setFormState({ ...formState, bodyWeightKg: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Flexed Bicep (cm)</label>
              <input
                type="number"
                step="0.1"
                className="form-input"
                placeholder="e.g. 36.0"
                value={formState.flexedBicepCm}
                onChange={e => setFormState({ ...formState, flexedBicepCm: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Chest (cm)</label>
              <input
                type="number"
                step="0.1"
                className="form-input"
                placeholder="e.g. 98.0"
                value={formState.chestCm}
                onChange={e => setFormState({ ...formState, chestCm: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Thigh (cm)</label>
              <input
                type="number"
                step="0.1"
                className="form-input"
                placeholder="e.g. 56.0"
                value={formState.thighCm}
                onChange={e => setFormState({ ...formState, thighCm: e.target.value })}
              />
            </div>
          </div>

          <div className="grid-3" style={{ marginTop: '10px' }}>
            <div className="form-group">
              <label className="form-label">Workout Performance</label>
              <select
                className="form-select"
                value={formState.workoutPerformance}
                onChange={e => setFormState({ ...formState, workoutPerformance: e.target.value })}
              >
                <option value="STRONGER">Stronger</option>
                <option value="SAME">Same</option>
                <option value="WEAKER">Weaker</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Complexion vs Last Week</label>
              <select
                className="form-select"
                value={formState.complexion}
                onChange={e => setFormState({ ...formState, complexion: e.target.value })}
              >
                <option value="BRIGHTER">Brighter</option>
                <option value="SAME">Same</option>
                <option value="DULLER">Duller</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Active Breakouts (Count)</label>
              <input
                type="number"
                className="form-input"
                value={formState.activeBreakouts}
                onChange={e => setFormState({ ...formState, activeBreakouts: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Hair Shedding</label>
              <select
                className="form-select"
                value={formState.hairShedding}
                onChange={e => setFormState({ ...formState, hairShedding: e.target.value })}
              >
                <option value="LESS">Less</option>
                <option value="SAME">Same</option>
                <option value="MORE">More</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">New Baby Hairs Visible</label>
              <select
                className="form-select"
                value={formState.newBabyHairs}
                onChange={e => setFormState({ ...formState, newBabyHairs: e.target.value })}
              >
                <option value="Yes">Yes</option>
                <option value="Not yet">Not yet</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Sleep Quality</label>
              <select
                className="form-select"
                value={formState.sleepQuality}
                onChange={e => setFormState({ ...formState, sleepQuality: e.target.value })}
              >
                <option value="BETTER">Better</option>
                <option value="SAME">Same</option>
                <option value="WORSE">Worse</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Digestion</label>
              <select
                className="form-select"
                value={formState.digestion}
                onChange={e => setFormState({ ...formState, digestion: e.target.value })}
              >
                <option value="BETTER">Better</option>
                <option value="SAME">Same</option>
                <option value="WORSE">Worse</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Energy Levels</label>
              <select
                className="form-select"
                value={formState.energyLevels}
                onChange={e => setFormState({ ...formState, energyLevels: e.target.value })}
              >
                <option value="HIGHER">Higher</option>
                <option value="SAME">Same</option>
                <option value="LOWER">Lower</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Protocol Compliance (%)</label>
              <input
                type="number"
                className="form-input"
                placeholder="e.g. 90"
                value={formState.protocolCompliancePct}
                onChange={e => setFormState({ ...formState, protocolCompliancePct: e.target.value })}
              />
            </div>
          </div>

          <div className="grid-2" style={{ marginTop: '10px' }}>
            <div className="form-group">
              <label className="form-label">Weekly Verdict</label>
              <select
                className="form-select"
                value={formState.verdict}
                onChange={e => setFormState({ ...formState, verdict: e.target.value })}
              >
                <option value="ON_TRACK">On Track</option>
                <option value="NEEDS_ADJUSTMENT">Needs Adjustment</option>
                <option value="REBOOT_REQUIRED">Reboot Required</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">This Week's 1% Refinement</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Drink 1L electrolyte water immediately upon waking."
                value={formState.refinement1Pct}
                onChange={e => setFormState({ ...formState, refinement1Pct: e.target.value })}
              />
            </div>
          </div>

          {/* WEEKLY FINANCES */}
          <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <DollarSign size={16} color="var(--accent-green)" /> Finances This Week (Page 6 Verbatim)
            </h3>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Saved (₹)</label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="0"
                  value={formState.financesSaved}
                  onChange={e => setFormState({ ...formState, financesSaved: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Spent (₹)</label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="0"
                  value={formState.financesSpent}
                  onChange={e => setFormState({ ...formState, financesSpent: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">What It Went On</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Mass Shake oats, Whey, Skincare sunscreen refill"
                  value={formState.financesWhatOn}
                  onChange={e => setFormState({ ...formState, financesWhatOn: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Why / Rationale</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Essential nutrition stock replenishment"
                  value={formState.financesWhy}
                  onChange={e => setFormState({ ...formState, financesWhy: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div style={{ marginTop: '20px' }}>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
              Save Sunday Review & Log
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
