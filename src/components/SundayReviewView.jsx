import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import {
  Award,
  Calendar,
  Camera,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  TrendingUp,
  AlertCircle,
  RefreshCw,
  Clock,
  ShieldCheck,
  FileText
} from 'lucide-react';

export const SundayReviewView = () => {
  const { user, getTodayStr, userPreferences } = useApp();

  const todayStr = getTodayStr();

  // Determine current week start date based on weekStart preference
  const getWeekStartDate = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00');
    const day = d.getDay(); // 0 = Sun, 1 = Mon
    const isSundayStart = userPreferences?.weekStart === 'SUNDAY';
    const targetStartDay = isSundayStart ? 0 : 1;

    let diff = d.getDate() - day + (day < targetStartDay ? -6 : targetStartDay);
    const startDate = new Date(d.setDate(diff));
    return startDate.toISOString().split('T')[0];
  };

  const currentWeekStart = getWeekStartDate(todayStr);
  const currentWeekEnd = new Date(new Date(currentWeekStart + 'T00:00:00').getTime() + 6 * 84600000)
    .toISOString()
    .split('T')[0];

  const [activeTab, setActiveTab] = useState('current'); // 'current' | 'history'
  const [step, setStep] = useState(1); // 1: Measurements, 2: Indicators, 3: Photos, 4: Notes, 5: Submit/AI Summary

  const [review, setReview] = useState(null);
  const [prevReview, setPrevReview] = useState(null);
  const [deltas, setDeltas] = useState({});
  const [photos, setPhotos] = useState({ physique: null, face: null, hair: null });
  const [summaryRecord, setSummaryRecord] = useState(null);

  const [historyList, setHistoryList] = useState([]);
  const [selectedHistoryWeek, setSelectedHistoryWeek] = useState(null);

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [generatingAi, setGeneratingAi] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);

  // Form State
  const [formState, setFormState] = useState({
    bodyWeightKg: '',
    flexedBicepCm: '',
    chestCm: '',
    thighCm: '',
    morningHeightCm: '',
    workoutPerformance: 'STRONGER',
    complexion: 'BRIGHTER',
    activeBreakouts: '0',
    hairShedding: 'LESS',
    newBabyHairs: true,
    sleepQuality: 'BETTER',
    digestion: 'BETTER',
    energyLevels: 'HIGHER',
    protocolCompliancePct: '95',
    verdict: 'ON_TRACK',
    refinementNotes: 'Maintain 10:00 PM sleep shutoff.',
    financesSaved: '0',
    financesSpent: '0',
    financesWhatOn: '',
    financesWhy: ''
  });

  // 1. Fetch Current Week Review Data from Server DB
  const fetchCurrentWeekData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      const res = await fetch(`/api/weekly/reviews/${currentWeekStart}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setReview(data.review);
        setPrevReview(data.prevReview);
        setDeltas(data.deltas || {});
        setSummaryRecord(data.summaryRecord);

        // Populate photo map
        const photoMap = { physique: null, face: null, hair: null };
        (data.photos || []).forEach(p => {
          photoMap[p.category] = p.photoUrl;
        });
        setPhotos(photoMap);

        // Populate form if review exists
        if (data.review) {
          const r = data.review;
          setFormState({
            bodyWeightKg: r.bodyWeightKg !== null ? String(r.bodyWeightKg) : '',
            flexedBicepCm: r.flexedBicepCm !== null ? String(r.flexedBicepCm) : '',
            chestCm: r.chestCm !== null ? String(r.chestCm) : '',
            thighCm: r.thighCm !== null ? String(r.thighCm) : '',
            morningHeightCm: r.morningHeightCm !== null ? String(r.morningHeightCm) : '',
            workoutPerformance: r.workoutPerformance || 'STRONGER',
            complexion: r.complexion || 'BRIGHTER',
            activeBreakouts: r.activeBreakouts !== null ? String(r.activeBreakouts) : '0',
            hairShedding: r.hairShedding || 'LESS',
            newBabyHairs: Boolean(r.newBabyHairs),
            sleepQuality: r.sleepQuality || 'BETTER',
            digestion: r.digestion || 'BETTER',
            energyLevels: r.energyLevels || 'HIGHER',
            protocolCompliancePct: r.protocolCompliancePct !== null ? String(r.protocolCompliancePct) : '95',
            verdict: r.verdict || 'ON_TRACK',
            refinementNotes: r.refinementNotes || '',
            financesSaved: r.financesSaved !== null ? String(r.financesSaved) : '0',
            financesSpent: r.financesSpent !== null ? String(r.financesSpent) : '0',
            financesWhatOn: r.financesWhatOn || '',
            financesWhy: r.financesWhy || ''
          });
        }
      }
    } catch (e) {
      console.error('Fetch week review error:', e);
    } finally {
      setLoading(false);
    }
  }, [user, currentWeekStart]);

  // 2. Fetch All History
  const fetchHistoryList = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch('/api/weekly/reviews', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setHistoryList(data.reviews || []);
      }
    } catch (e) {
      console.error('Fetch history reviews error:', e);
    }
  }, [user]);

  useEffect(() => {
    fetchCurrentWeekData();
    fetchHistoryList();
  }, [fetchCurrentWeekData, fetchHistoryList]);

  // 3. Save Review Handler
  const handleSaveReview = async (generateAi = false) => {
    setSubmitting(true);
    setStatusMsg(null);

    try {
      const payload = {
        weekStartDate: currentWeekStart,
        weekEndDate: currentWeekEnd,
        bodyWeightKg: formState.bodyWeightKg,
        flexedBicepCm: formState.flexedBicepCm,
        chestCm: formState.chestCm,
        thighCm: formState.thighCm,
        morningHeightCm: formState.morningHeightCm,
        workoutPerformance: formState.workoutPerformance,
        complexion: formState.complexion,
        activeBreakouts: formState.activeBreakouts,
        hairShedding: formState.hairShedding,
        newBabyHairs: formState.newBabyHairs,
        sleepQuality: formState.sleepQuality,
        digestion: formState.digestion,
        energyLevels: formState.energyLevels,
        protocolCompliancePct: formState.protocolCompliancePct,
        verdict: formState.verdict,
        refinementNotes: formState.refinementNotes,
        financesSaved: formState.financesSaved,
        financesSpent: formState.financesSpent,
        financesWhatOn: formState.financesWhatOn,
        financesWhy: formState.financesWhy
      };

      const res = await fetch('/api/weekly/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        setReview(data.review);
        setStatusMsg({ type: 'success', text: 'Sunday Weekly Review saved successfully!' });
        await fetchHistoryList();

        if (generateAi) {
          await handleGenerateAiSummary(true);
        } else {
          setStep(5);
        }
      } else {
        const errData = await res.json();
        setStatusMsg({ type: 'error', text: errData.error || 'Failed to save review.' });
      }
    } catch (e) {
      console.error('Save review error:', e);
      setStatusMsg({ type: 'error', text: 'Network error saving weekly review.' });
    } finally {
      setSubmitting(false);
    }
  };

  // 4. Progress Photo Upload Handler
  const handlePhotoUpload = async (category, file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64Data = e.target.result;

      try {
        const res = await fetch('/api/weekly/photos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            weekStartDate: currentWeekStart,
            category,
            photoData: base64Data
          })
        });

        if (res.ok) {
          const data = await res.json();
          setPhotos(prev => ({ ...prev, [category]: data.photoUrl }));
        } else {
          alert('Failed to upload progress photo.');
        }
      } catch (err) {
        console.error('Photo upload error:', err);
      }
    };
    reader.readAsDataURL(file);
  };

  // 5. Generate AI Summary Handler
  const handleGenerateAiSummary = async (forceRegenerate = false) => {
    setGeneratingAi(true);

    try {
      const res = await fetch(`/api/weekly/reviews/${currentWeekStart}/generate-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ forceRegenerate })
      });

      if (res.ok) {
        const data = await res.json();
        setSummaryRecord(data.summaryRecord);
        setStep(5);
      } else {
        const errData = await res.json();
        alert(`AI Summary error: ${errData.details || errData.message || 'Generation failed.'}`);
      }
    } catch (e) {
      console.error('Weekly AI summary error:', e);
    } finally {
      setGeneratingAi(false);
    }
  };

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto' }}>
      
      {/* Sub-tab Navigation */}
      <div className="day-tabs" style={{ marginBottom: '20px' }}>
        <button
          className={`day-tab ${activeTab === 'current' ? 'active' : ''}`}
          onClick={() => setActiveTab('current')}
        >
          Sunday Weekly Review
        </button>
        <button
          className={`day-tab ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          Transformation History ({historyList.length})
        </button>
      </div>

      {activeTab === 'current' ? (
        <div>
          
          {/* Header Card */}
          <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Award size={20} color="var(--accent-amber)" />
                  <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                    Sunday Weekly Review
                  </h2>
                  <span className="badge badge-warning">Weekly Ritual</span>
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                  Week Period: <strong>{currentWeekStart}</strong> to <strong>{currentWeekEnd}</strong>
                </div>
              </div>

              {/* Multi-Step Wizard Indicator */}
              <div style={{ display: 'flex', gap: '6px' }}>
                {[1, 2, 3, 4, 5].map(stepNum => (
                  <div
                    key={stepNum}
                    onClick={() => setStep(stepNum)}
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      fontSize: '12px',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      backgroundColor: step === stepNum ? 'var(--accent-blue)' : step > stepNum ? 'var(--accent-green-subtle)' : 'var(--bg-card-subtle)',
                      color: step === stepNum ? '#fff' : step > stepNum ? 'var(--accent-green)' : 'var(--text-tertiary)',
                      border: `1px solid ${step === stepNum ? 'var(--accent-blue)' : 'var(--border-color)'}`
                    }}
                  >
                    {stepNum}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Status Message Alert */}
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

          {/* STEP 1: BODY MEASUREMENTS */}
          {step === 1 && (
            <div className="card" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px' }}>1. Physical Body Measurements</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                Record morning measurements. Week-over-week deltas are calculated automatically.
              </p>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">
                    Body Weight (kg) {deltas.weightDelta !== null && <span style={{ color: deltas.weightDelta >= 0 ? 'var(--accent-green)' : 'var(--accent-amber)', fontSize: '11px' }}>({deltas.weightDelta >= 0 ? '+' : ''}{deltas.weightDelta} kg)</span>}
                  </label>
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
                  <label className="form-label">
                    Flexed Bicep (cm) {deltas.bicepDelta !== null && <span style={{ color: 'var(--accent-blue)', fontSize: '11px' }}>({deltas.bicepDelta >= 0 ? '+' : ''}{deltas.bicepDelta} cm)</span>}
                  </label>
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
                  <label className="form-label">
                    Chest (cm) {deltas.chestDelta !== null && <span style={{ color: 'var(--accent-blue)', fontSize: '11px' }}>({deltas.chestDelta >= 0 ? '+' : ''}{deltas.chestDelta} cm)</span>}
                  </label>
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

                <div className="form-group">
                  <label className="form-label">Morning Height (cm)</label>
                  <input
                    type="number"
                    step="0.1"
                    className="form-input"
                    placeholder="e.g. 178.5"
                    value={formState.morningHeightCm}
                    onChange={e => setFormState({ ...formState, morningHeightCm: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button className="btn btn-primary" onClick={() => setStep(2)}>
                  Next: Physical & Appearance <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: PHYSICAL & APPEARANCE INDICATORS */}
          {step === 2 && (
            <div className="card" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px' }}>2. Physical & Appearance Indicators</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                Assess workout performance, skin complexion, hair growth, and recovery indicators.
              </p>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Workout Performance</label>
                  <select
                    className="form-select"
                    value={formState.workoutPerformance}
                    onChange={e => setFormState({ ...formState, workoutPerformance: e.target.value })}
                  >
                    <option value="STRONGER">STRONGER (+ Progressive Overload)</option>
                    <option value="SAME">SAME (Maintained Volume)</option>
                    <option value="WEAKER">WEAKER (Fatigue / Compromised)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Skin Complexion</label>
                  <select
                    className="form-select"
                    value={formState.complexion}
                    onChange={e => setFormState({ ...formState, complexion: e.target.value })}
                  >
                    <option value="BRIGHTER">BRIGHTER (Glow Shake / Barrier Clear)</option>
                    <option value="SAME">SAME</option>
                    <option value="DULLER">DULLER (Inflammatory)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Active Breakouts Count</label>
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
                    <option value="LESS">LESS (Dermarolling / Oil Effective)</option>
                    <option value="NORMAL">NORMAL</option>
                    <option value="MORE">MORE (Stress / Nutritional Gap)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">New Baby Hairs Visible</label>
                  <select
                    className="form-select"
                    value={formState.newBabyHairs ? 'Yes' : 'No'}
                    onChange={e => setFormState({ ...formState, newBabyHairs: e.target.value === 'Yes' })}
                  >
                    <option value="Yes">Yes (New Hairline Follicle Growth)</option>
                    <option value="No">No</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Sleep Quality</label>
                  <select
                    className="form-select"
                    value={formState.sleepQuality}
                    onChange={e => setFormState({ ...formState, sleepQuality: e.target.value })}
                  >
                    <option value="BETTER">BETTER (Deep Uninterrupted)</option>
                    <option value="SAME">SAME</option>
                    <option value="WORSE">WORSE (Interrupted / Delayed)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
                <button className="btn btn-secondary" onClick={() => setStep(1)}>
                  <ChevronLeft size={16} /> Back
                </button>
                <button className="btn btn-primary" onClick={() => setStep(3)}>
                  Next: Progress Photos <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: PROGRESS PHOTOS */}
          {step === 3 && (
            <div className="card" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px' }}>3. Private Progress Photos</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                Upload encrypted progress photos for this week. Photos persist securely in your local server storage.
              </p>

              <div className="grid-3">
                {[
                  { cat: 'physique', title: 'Physique Photo' },
                  { cat: 'face', title: 'Face / Skin Photo' },
                  { cat: 'hair', title: 'Hair / Scalp Photo' }
                ].map(item => (
                  <div
                    key={item.cat}
                    style={{
                      border: '1px dashed var(--border-color)',
                      borderRadius: '12px',
                      padding: '16px',
                      textAlign: 'center',
                      backgroundColor: 'var(--bg-card-subtle)'
                    }}
                  >
                    <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '10px' }}>{item.title}</div>
                    
                    {photos[item.cat] ? (
                      <div style={{ marginBottom: '10px' }}>
                        <img
                          src={photos[item.cat]}
                          alt={item.title}
                          style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: '8px' }}
                        />
                      </div>
                    ) : (
                      <div style={{ padding: '24px 0', color: 'var(--text-tertiary)' }}>
                        <Camera size={32} style={{ marginBottom: '6px' }} />
                        <div style={{ fontSize: '12px' }}>No photo uploaded</div>
                      </div>
                    )}

                    <label className="btn btn-secondary btn-sm" style={{ width: '100%', cursor: 'pointer', borderRadius: '8px' }}>
                      <Camera size={13} /> {photos[item.cat] ? 'Replace Photo' : 'Upload Photo'}
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={e => handlePhotoUpload(item.cat, e.target.files[0])}
                      />
                    </label>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
                <button className="btn btn-secondary" onClick={() => setStep(2)}>
                  <ChevronLeft size={16} /> Back
                </button>
                <button className="btn btn-primary" onClick={() => setStep(4)}>
                  Next: Refinement Notes <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: REFINEMENT NOTES & FINANCIALS */}
          {step === 4 && (
            <div className="card" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px' }}>4. Protocol Compliance & Weekly Refinement</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                Set compliance percentage, verdict, and weekly operational adjustments.
              </p>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Protocol Compliance %</label>
                  <input
                    type="number"
                    className="form-input"
                    value={formState.protocolCompliancePct}
                    onChange={e => setFormState({ ...formState, protocolCompliancePct: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Weekly Verdict</label>
                  <select
                    className="form-select"
                    value={formState.verdict}
                    onChange={e => setFormState({ ...formState, verdict: e.target.value })}
                  >
                    <option value="ON_TRACK">ON TRACK (Progressing as Designed)</option>
                    <option value="OFF_TRACK">OFF TRACK (Requires Immediate Correction)</option>
                    <option value="ADJUSTING">ADJUSTING (Fine-Tuning Schedule)</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Weekly Refinement Notes & Adjustments</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  placeholder="e.g. Ensure 10 PM sharp sleep shutoff. Increase water intake on Wednesday."
                  value={formState.refinementNotes}
                  onChange={e => setFormState({ ...formState, refinementNotes: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
                <button className="btn btn-secondary" onClick={() => setStep(3)}>
                  <ChevronLeft size={16} /> Back
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => handleSaveReview(true)}
                  disabled={submitting || generatingAi}
                >
                  <CheckCircle2 size={16} className={submitting || generatingAi ? 'animate-spin' : ''} />
                  {submitting ? 'Saving Review...' : generatingAi ? 'Generating AI Analysis...' : 'Complete Review & Generate AI Summary'}
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: REVIEW & AI SUMMARY */}
          {step === 5 && (
            <div>
              {/* Review Overview Banner */}
              <div className="card" style={{ padding: '20px', marginBottom: '20px', backgroundColor: 'var(--accent-green-subtle)', borderColor: 'var(--accent-green)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--accent-green)', margin: '0 0 4px 0' }}>
                      ✓ Weekly Review Saved & Verified
                    </h3>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                      Compliance Score: <strong>{formState.protocolCompliancePct}%</strong> • Verdict: <strong>{formState.verdict}</strong>
                    </p>
                  </div>
                  <button className="btn btn-secondary btn-sm" onClick={() => setStep(1)}>
                    Edit Review Inputs
                  </button>
                </div>
              </div>

              {/* Gemini AI Weekly Summary Card */}
              <div className="card" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Sparkles size={20} color="var(--accent-purple)" />
                    <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                      Sunday Night AI Weekly Summary
                    </h3>
                  </div>
                  <button
                    onClick={() => handleGenerateAiSummary(true)}
                    disabled={generatingAi}
                    className="btn btn-secondary btn-sm"
                  >
                    <RefreshCw size={13} className={generatingAi ? 'animate-spin' : ''} />
                    {generatingAi ? 'Analyzing Week...' : 'Regenerate AI Summary'}
                  </button>
                </div>

                {summaryRecord ? (
                  <div style={{ fontSize: '14px', lineHeight: '1.65', color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
                    {summaryRecord.summary}
                  </div>
                ) : (
                  <div style={{ padding: '20px 0', textAlign: 'center' }}>
                    <button
                      className="btn btn-primary"
                      onClick={() => handleGenerateAiSummary(false)}
                      disabled={generatingAi}
                    >
                      <Sparkles size={16} /> Generate AI Weekly Summary
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      ) : (

        /* HISTORICAL TRANSFORMATION TIMELINE TAB */
        <div>
          <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px 0' }}>
              Transformation History Timeline
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
              Permanent historical record of weekly measurements, physical indicators, and progress photos.
            </p>
          </div>

          {historyList.length === 0 ? (
            <div className="card" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              No historical weekly reviews saved yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {historyList.map(item => (
                <div
                  key={item.id}
                  className="card"
                  style={{
                    padding: '18px',
                    marginBottom: 0,
                    cursor: 'pointer',
                    borderColor: selectedHistoryWeek === item.weekStartDate ? 'var(--accent-blue)' : 'var(--border-color)'
                  }}
                  onClick={() => setSelectedHistoryWeek(selectedHistoryWeek === item.weekStartDate ? null : item.weekStartDate)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        Week Starting {item.weekStartDate} (to {item.weekEndDate})
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        Weight: <strong>{item.bodyWeightKg || 'N/A'} kg</strong> • Bicep: <strong>{item.flexedBicepCm || 'N/A'} cm</strong> • Compliance: <strong>{item.protocolCompliancePct}%</strong>
                      </div>
                    </div>
                    <span className="badge badge-purple">{item.verdict}</span>
                  </div>

                  {selectedHistoryWeek === item.weekStartDate && (
                    <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--border-color)', fontSize: '13px', lineHeight: '1.5' }}>
                      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '10px' }}>
                        <span>Chest: <strong>{item.chestCm} cm</strong></span>
                        <span>Thigh: <strong>{item.thighCm} cm</strong></span>
                        <span>Height: <strong>{item.morningHeightCm} cm</strong></span>
                        <span>Complexion: <strong>{item.complexion}</strong></span>
                        <span>Hair Shedding: <strong>{item.hairShedding}</strong></span>
                      </div>
                      <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                        <strong>Refinements:</strong> {item.refinementNotes || 'None recorded'}
                      </p>
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
