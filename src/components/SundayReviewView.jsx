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
  FileText,
  Sliders,
  Eye,
  Info,
  X,
  Grid,
  Layers,
  Lock
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

  const [activeTab, setActiveTab] = useState('current'); // 'current' | 'compare' | 'history'
  const [step, setStep] = useState(1); // 1: Measurements, 2: Indicators, 3: Photos, 4: Notes, 5: Submit/AI Summary

  const [review, setReview] = useState(null);
  const [prevReview, setPrevReview] = useState(null);
  const [deltas, setDeltas] = useState({});
  const [photos, setPhotos] = useState({ physique: null, face: null, hair: null });
  const [summaryRecord, setSummaryRecord] = useState(null);

  const [historyList, setHistoryList] = useState([]);
  const [timelineList, setTimelineList] = useState([]);
  const [failurePatterns, setFailurePatterns] = useState(null);
  const [selectedHistoryWeek, setSelectedHistoryWeek] = useState(null);

  // FEATURE 13: PREVIEW BEFORE SAVE STATE (Requirement 11)
  const [pendingPhoto, setPendingPhoto] = useState(null); // { category, file, base64Data, filename }
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // FEATURE 13: Side-by-Side Compare & Timeline Stepper State
  const [compareWeekA, setCompareWeekA] = useState(currentWeekStart);
  const [compareWeekB, setCompareWeekB] = useState('');
  const [compareCategory, setCompareCategory] = useState('physique'); // 'physique' | 'face' | 'hair'
  const [compareData, setCompareData] = useState(null);
  const [comparing, setComparing] = useState(false);
  const [compareViewMode, setCompareViewMode] = useState('sideBySide'); // 'sideBySide' | 'timeline'

  // AI Analysis State
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [analyzingAi, setAnalyzingAi] = useState(false);

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
        setFailurePatterns(data.failurePatterns || null);

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

  // 2. Fetch All History & Photo Timeline
  const fetchHistoryList = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch('/api/weekly/reviews', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const list = data.reviews || [];
        setHistoryList(list);
        if (list.length >= 2 && !compareWeekB) {
          setCompareWeekA(list[1].weekStartDate);
          setCompareWeekB(list[0].weekStartDate);
        } else if (list.length === 1 && !compareWeekB) {
          setCompareWeekB(list[0].weekStartDate);
        }
      }

      const timelineRes = await fetch('/api/weekly/timeline-photos', { credentials: 'include' });
      if (timelineRes.ok) {
        const timelineData = await timelineRes.json();
        setTimelineList(timelineData.timeline || []);
      }
    } catch (e) {
      console.error('Fetch history reviews error:', e);
    }
  }, [user, compareWeekB]);

  useEffect(() => {
    fetchCurrentWeekData();
    fetchHistoryList();
  }, [fetchCurrentWeekData, fetchHistoryList]);

  // Fetch Side-by-Side Comparison Data
  const fetchComparisonData = useCallback(async () => {
    if (!compareWeekA || !compareWeekB) return;
    setComparing(true);
    setAiAnalysis(null);
    try {
      const res = await fetch(`/api/weekly/compare?weekA=${compareWeekA}&weekB=${compareWeekB}&category=${compareCategory}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setCompareData(data);
      }
    } catch (e) {
      console.error('Fetch comparison error:', e);
    } finally {
      setComparing(false);
    }
  }, [compareWeekA, compareWeekB, compareCategory]);

  useEffect(() => {
    if (activeTab === 'compare' && compareWeekA && compareWeekB) {
      fetchComparisonData();
    }
  }, [activeTab, compareWeekA, compareWeekB, compareCategory, fetchComparisonData]);

  // FEATURE 13: PREVIEW BEFORE SAVE (Requirement 11)
  const handleSelectPhotoFile = (category, file) => {
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      alert('Invalid image format. Supported formats: JPEG, PNG, WebP.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('File size exceeds 5MB limit. Please select a smaller photo.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setPendingPhoto({
        category,
        file,
        base64Data: e.target.result,
        filename: file.name
      });
    };
    reader.readAsDataURL(file);
  };

  // Confirm and save selected photo to server DB
  const handleConfirmPhotoUpload = async () => {
    if (!pendingPhoto) return;
    setUploadingPhoto(true);

    try {
      const res = await fetch('/api/weekly/photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          weekStartDate: currentWeekStart,
          category: pendingPhoto.category,
          photoData: pendingPhoto.base64Data
        })
      });

      if (res.ok) {
        const data = await res.json();
        setPhotos(prev => ({ ...prev, [pendingPhoto.category]: data.photoUrl }));
        setStatusMsg({ type: 'success', text: `${pendingPhoto.category.toUpperCase()} progress photo saved securely!` });
        setPendingPhoto(null);
        setTimeout(() => setStatusMsg(null), 3000);
        fetchHistoryList();
      } else {
        const errData = await res.json();
        alert(`Upload failed: ${errData.message || 'Server error'}`);
      }
    } catch (err) {
      console.error('Photo upload error:', err);
      alert('Failed to upload progress photo to server.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Save Weekly Review Form
  const handleSaveReview = async () => {
    setSubmitting(true);
    setStatusMsg(null);

    try {
      const res = await fetch('/api/weekly/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          weekStartDate: currentWeekStart,
          weekEndDate: currentWeekEnd,
          ...formState
        })
      });

      if (res.ok) {
        const data = await res.json();
        setReview(data.review);
        setStatusMsg({ type: 'success', text: 'Sunday Weekly Review saved successfully!' });
        setTimeout(() => setStatusMsg(null), 4000);
        fetchCurrentWeekData();
        fetchHistoryList();
      } else {
        const errData = await res.json();
        setStatusMsg({ type: 'error', text: `Save error: ${errData.details || errData.message || 'Failed to save.'}` });
      }
    } catch (e) {
      console.error('Save review error:', e);
      setStatusMsg({ type: 'error', text: 'Network connection failed while saving review.' });
    } finally {
      setSubmitting(false);
    }
  };

  // Generate Weekly AI Summary
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

  // Request Optional AI Visual Comparison
  const handleRunAiPhotoCompare = async () => {
    setAnalyzingAi(true);
    setAiAnalysis(null);
    try {
      const res = await fetch('/api/weekly/photo-compare-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          weekA: compareWeekA,
          weekB: compareWeekB,
          category: compareCategory
        })
      });
      if (res.ok) {
        const data = await res.json();
        setAiAnalysis(data);
      }
    } catch (e) {
      console.error('AI photo compare error:', e);
    } finally {
      setAnalyzingAi(false);
    }
  };

  return (
    <div style={{ maxWidth: '780px', margin: '0 auto', paddingBottom: '40px' }}>
      
      {/* Sub-tab Navigation */}
      <div className="day-tabs" style={{ marginBottom: '20px', flexWrap: 'wrap' }}>
        <button
          className={`day-tab ${activeTab === 'current' ? 'active' : ''}`}
          onClick={() => setActiveTab('current')}
        >
          Sunday Weekly Review
        </button>
        <button
          className={`day-tab ${activeTab === 'compare' ? 'active' : ''}`}
          onClick={() => setActiveTab('compare')}
        >
          📸 Smart Photo Comparison ({historyList.length})
        </button>
        <button
          className={`day-tab ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          Transformation History ({historyList.length})
        </button>
      </div>

      {activeTab === 'current' && (
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
              border: `1px solid ${statusMsg.type === 'success' ? 'var(--accent-green)' : 'var(--accent-red)'}`,
              color: statusMsg.type === 'success' ? 'var(--accent-green)' : 'var(--accent-red)'
            }}>
              {statusMsg.text}
            </div>
          )}

          {/* STEP 1: PHYSICAL MEASUREMENTS */}
          {step === 1 && (
            <div className="card" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px' }}>1. Sunday Physical Measurements</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                Record morning fasted body metrics. Deltas are calculated automatically against previous Sunday records.
              </p>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Body Weight (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    className="form-input"
                    placeholder="e.g. 68.5"
                    value={formState.bodyWeightKg}
                    onChange={e => setFormState({ ...formState, bodyWeightKg: e.target.value })}
                  />
                  {deltas.weightDelta != null && (
                    <span style={{ fontSize: '11px', fontWeight: 600, color: deltas.weightDelta > 0 ? 'var(--accent-green)' : 'var(--accent-red)', marginTop: '4px', display: 'block' }}>
                      {deltas.weightDelta > 0 ? `+${deltas.weightDelta}` : deltas.weightDelta} kg vs last week
                    </span>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Flexed Bicep (cm)</label>
                  <input
                    type="number"
                    step="0.1"
                    className="form-input"
                    placeholder="e.g. 35.0"
                    value={formState.flexedBicepCm}
                    onChange={e => setFormState({ ...formState, flexedBicepCm: e.target.value })}
                  />
                  {deltas.bicepDelta != null && (
                    <span style={{ fontSize: '11px', fontWeight: 600, color: deltas.bicepDelta > 0 ? 'var(--accent-green)' : 'var(--accent-red)', marginTop: '4px', display: 'block' }}>
                      {deltas.bicepDelta > 0 ? `+${deltas.bicepDelta}` : deltas.bicepDelta} cm vs last week
                    </span>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Chest Girth (cm)</label>
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
                  <label className="form-label">Thigh Girth (cm)</label>
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

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button className="btn btn-primary" onClick={() => setStep(2)}>
                  Next: Subjective Indicators <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: SUBJECTIVE RECOVERY INDICATORS */}
          {step === 2 && (
            <div className="card" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px' }}>2. Subjective Recovery & Health Indicators</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                Evaluate skin barrier clarity, hair follicle growth, sleep, and digestive health.
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

          {/* STEP 3: FEATURE 13 — PROGRESS PHOTOS WITH PREVIEW & CONSISTENCY GUIDANCE */}
          {step === 3 && (
            <div className="card" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px' }}>3. Standardized Sunday Progress Photos</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                Upload standardized photos for weekly visual tracking. Photos are stored securely on your server filesystem.
              </p>

              {/* FEATURE 13: CONSISTENCY GUIDANCE BANNER (Requirement 9) */}
              <div style={{
                padding: '14px 16px',
                borderRadius: '12px',
                background: 'var(--bg-app)',
                border: '1px solid var(--border-color)',
                marginBottom: '20px',
                fontSize: '12px',
                color: 'var(--text-secondary)'
              }}>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Info size={15} color="var(--accent-blue)" /> Photo Standardization Guidelines
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '6px' }}>
                  <div>• <strong>Lighting</strong>: Natural daylight or constant AM bulb.</div>
                  <div>• <strong>Distance</strong>: ~1.5m (Body), ~0.5m (Face/Hair).</div>
                  <div>• <strong>Framing</strong>: Identical posture & eye height.</div>
                  <div>• <strong>Privacy</strong>: Authenticated session ownership enforced.</div>
                </div>
              </div>

              {/* PHOTO SELECTION CARDS */}
              <div className="grid-3">
                {[
                  { cat: 'physique', title: 'Body / Physique' },
                  { cat: 'face', title: 'Face / Skin' },
                  { cat: 'hair', title: 'Hair / Scalp' }
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
                      <div style={{ marginBottom: '10px', height: '150px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                        <img
                          src={photos[item.cat]}
                          alt={item.title}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      </div>
                    ) : (
                      <div style={{ height: '150px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', border: '1px dashed var(--border-color)', borderRadius: '8px', marginBottom: '10px', background: 'var(--bg-app)' }}>
                        <Camera size={28} style={{ marginBottom: '6px' }} />
                        <div style={{ fontSize: '12px' }}>No photo saved yet</div>
                      </div>
                    )}

                    <label className="btn btn-secondary btn-sm" style={{ width: '100%', cursor: 'pointer', borderRadius: '8px' }}>
                      <Camera size={13} /> {photos[item.cat] ? 'Replace Photo' : 'Select Photo'}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        style={{ display: 'none' }}
                        onChange={e => handleSelectPhotoFile(item.cat, e.target.files[0])}
                      />
                    </label>
                  </div>
                ))}
              </div>

              {/* FEATURE 13: PREVIEW MODAL / CONFIRMATION DIALOG (Requirement 11) */}
              {pendingPhoto && (
                <div style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: 'rgba(0,0,0,0.7)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 9999,
                  padding: '20px'
                }}>
                  <div className="card" style={{ maxWidth: '420px', width: '100%', padding: '24px', position: 'relative' }}>
                    <button
                      onClick={() => setPendingPhoto(null)}
                      style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }}
                    >
                      <X size={18} />
                    </button>

                    <h3 style={{ fontSize: '16px', fontWeight: 800, marginBottom: '6px' }}>
                      Confirm {pendingPhoto.category.toUpperCase()} Photo
                    </h3>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                      Preview your selected image before saving to your weekly record.
                    </p>

                    <div style={{ height: '240px', borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--border-color)', marginBottom: '16px' }}>
                      <img
                        src={pendingPhoto.base64Data}
                        alt="Preview"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </div>

                    <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '20px', fontStyle: 'italic' }}>
                      File: {pendingPhoto.filename} ({(pendingPhoto.file.size / 1024).toFixed(1)} KB)
                    </div>

                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                      <button
                        className="btn btn-secondary"
                        onClick={() => setPendingPhoto(null)}
                        disabled={uploadingPhoto}
                      >
                        Choose Different Image
                      </button>
                      <button
                        className="btn btn-primary"
                        onClick={handleConfirmPhotoUpload}
                        disabled={uploadingPhoto}
                      >
                        {uploadingPhoto ? <RefreshCw size={14} className="spin" /> : <ShieldCheck size={14} />}
                        <span>Confirm & Save</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

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

          {/* STEP 4: REFINEMENT NOTES & SUBMISSION */}
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

              {/* FEATURE 14: WEEKLY FAILURE PATTERN SUMMARY */}
              {failurePatterns && failurePatterns.totalFailures > 0 && (
                <div style={{
                  padding: '14px 16px',
                  borderRadius: '12px',
                  background: 'var(--bg-app)',
                  border: '1px solid var(--border-color)',
                  marginTop: '16px',
                  fontSize: '12px'
                }}>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertCircle size={14} color="var(--accent-amber)" /> 4-Week Failure Pattern Summary
                  </div>
                  <div style={{ color: 'var(--text-secondary)' }}>
                    {failurePatterns.patternSummary}
                  </div>
                  {failurePatterns.potentialIntervention && (
                    <div style={{ color: 'var(--accent-blue)', fontWeight: 600, marginTop: '6px' }}>
                      Suggested Focus: {failurePatterns.potentialIntervention}
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
                <button className="btn btn-secondary" onClick={() => setStep(3)}>
                  <ChevronLeft size={16} /> Back
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleSaveReview}
                  disabled={submitting}
                >
                  {submitting ? <RefreshCw size={16} className="spin" /> : <CheckCircle2 size={16} />}
                  <span>Save Weekly Review Record</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: AI SUMMARY & VERDICT */}
          {step === 5 && (
            <div className="card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sparkles size={20} color="var(--accent-purple)" /> Sunday AI Executive Summary
                </h3>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleGenerateAiSummary(true)}
                  disabled={generatingAi}
                >
                  {generatingAi ? <RefreshCw size={14} className="spin" /> : <RefreshCw size={14} />}
                  <span>Regenerate Summary</span>
                </button>
              </div>

              {summaryRecord ? (
                <div>
                  <div style={{
                    padding: '16px',
                    borderRadius: '12px',
                    backgroundColor: 'var(--bg-app)',
                    border: '1px solid var(--border-color)',
                    fontSize: '14px',
                    lineHeight: '1.6',
                    color: 'var(--text-primary)',
                    whiteSpace: 'pre-line'
                  }}>
                    {summaryRecord.summary}
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '30px 0' }}>
                  <button
                    className="btn btn-primary"
                    onClick={() => handleGenerateAiSummary(false)}
                    disabled={generatingAi}
                  >
                    {generatingAi ? <RefreshCw size={16} className="spin" /> : <Sparkles size={16} />}
                    <span>Generate 10:00 PM Sunday AI Summary</span>
                  </button>
                </div>
              )}
            </div>
          )}

        </div>
      )}

      {/* FEATURE 13: SUB-TAB 2 — SMART PHOTO COMPARISON & LONGITUDINAL TIMELINE */}
      {activeTab === 'compare' && (
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Camera size={20} color="var(--accent-purple)" />
                <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                  Smart Weekly Photo Comparison
                </h2>
                <span className="badge badge-purple">Longitudinal</span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                Compare standardized weekly progress photos and physical measurements side-by-side.
              </div>
            </div>

            {/* View Mode Switcher */}
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                className={`btn btn-sm ${compareViewMode === 'sideBySide' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setCompareViewMode('sideBySide')}
              >
                <Layers size={14} /> Side-by-Side
              </button>
              <button
                className={`btn btn-sm ${compareViewMode === 'timeline' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setCompareViewMode('timeline')}
              >
                <Grid size={14} /> Timeline Strip
              </button>
            </div>
          </div>

          {/* CATEGORY & WEEK SELECTORS */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '18px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)' }}>Category:</span>
            {[
              { key: 'physique', label: 'BODY (Physique)' },
              { key: 'face', label: 'FACE (Skin)' },
              { key: 'hair', label: 'HAIR (Scalp)' }
            ].map(cat => (
              <button
                key={cat.key}
                onClick={() => setCompareCategory(cat.key)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: `1px solid ${compareCategory === cat.key ? 'var(--accent-purple)' : 'var(--border-color)'}`,
                  background: compareCategory === cat.key ? 'var(--accent-purple-subtle)' : 'var(--bg-app)',
                  color: compareCategory === cat.key ? 'var(--accent-purple)' : 'var(--text-secondary)'
                }}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* VIEW MODE 1: SIDE-BY-SIDE COMPARISON */}
          {compareViewMode === 'sideBySide' && (
            <div>
              <div className="grid-2" style={{ gap: '16px', marginBottom: '20px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Week A (Baseline)</label>
                  <select
                    className="form-select"
                    value={compareWeekA}
                    onChange={e => setCompareWeekA(e.target.value)}
                  >
                    {historyList.map(h => (
                      <option key={h.id} value={h.weekStartDate}>Week starting {h.weekStartDate}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Week B (Comparison Target)</label>
                  <select
                    className="form-select"
                    value={compareWeekB}
                    onChange={e => setCompareWeekB(e.target.value)}
                  >
                    {historyList.map(h => (
                      <option key={h.id} value={h.weekStartDate}>Week starting {h.weekStartDate}</option>
                    ))}
                  </select>
                </div>
              </div>

              {comparing ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
                  <RefreshCw size={24} className="spin" style={{ margin: '0 auto 8px', display: 'block' }} />
                  Loading photo comparison data...
                </div>
              ) : compareData ? (
                <div>
                  <div className="grid-2" style={{ gap: '16px', marginBottom: '20px' }}>
                    
                    {/* WEEK A CARD */}
                    <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px', background: 'var(--bg-app)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                          Week A ({compareData.weekAData.weekStartDate})
                        </div>
                        <span className="badge badge-secondary">Baseline</span>
                      </div>

                      {compareData.weekAData.hasPhoto ? (
                        <div style={{ width: '100%', height: '260px', borderRadius: '10px', overflow: 'hidden', marginBottom: '12px', border: '1px solid var(--border-color)' }}>
                          <img
                            src={compareData.weekAData.photoUrl}
                            alt="Week A"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        </div>
                      ) : (
                        <div style={{ height: '260px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-card)', borderRadius: '10px', color: 'var(--text-tertiary)', fontSize: '13px', marginBottom: '12px', border: '1px dashed var(--border-color)' }}>
                          <Camera size={32} style={{ marginBottom: '8px', opacity: 0.5 }} />
                          <div>Photo unavailable for this week</div>
                        </div>
                      )}

                      {compareData.weekAData.review ? (
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', background: 'var(--bg-card-subtle)', padding: '10px', borderRadius: '8px' }}>
                          <div>Weight: <strong>{compareData.weekAData.review.bodyWeightKg ?? '—'} kg</strong></div>
                          <div>Bicep: <strong>{compareData.weekAData.review.flexedBicepCm ?? '—'} cm</strong></div>
                          <div>Chest: <strong>{compareData.weekAData.review.chestCm ?? '—'} cm</strong></div>
                          <div>Compliance: <strong>{compareData.weekAData.review.protocolCompliancePct ?? 100}%</strong></div>
                        </div>
                      ) : (
                        <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>No recorded measurements</div>
                      )}
                    </div>

                    {/* WEEK B CARD */}
                    <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px', background: 'var(--bg-app)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                          Week B ({compareData.weekBData.weekStartDate})
                        </div>
                        <span className="badge badge-purple">Comparison</span>
                      </div>

                      {compareData.weekBData.hasPhoto ? (
                        <div style={{ width: '100%', height: '260px', borderRadius: '10px', overflow: 'hidden', marginBottom: '12px', border: '1px solid var(--border-color)' }}>
                          <img
                            src={compareData.weekBData.photoUrl}
                            alt="Week B"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        </div>
                      ) : (
                        <div style={{ height: '260px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-card)', borderRadius: '10px', color: 'var(--text-tertiary)', fontSize: '13px', marginBottom: '12px', border: '1px dashed var(--border-color)' }}>
                          <Camera size={32} style={{ marginBottom: '8px', opacity: 0.5 }} />
                          <div>Photo unavailable for this week</div>
                        </div>
                      )}

                      {compareData.weekBData.review ? (
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', background: 'var(--bg-card-subtle)', padding: '10px', borderRadius: '8px' }}>
                          <div>Weight: <strong>{compareData.weekBData.review.bodyWeightKg ?? '—'} kg</strong></div>
                          <div>Bicep: <strong>{compareData.weekBData.review.flexedBicepCm ?? '—'} cm</strong></div>
                          <div>Chest: <strong>{compareData.weekBData.review.chestCm ?? '—'} cm</strong></div>
                          <div>Compliance: <strong>{compareData.weekBData.review.protocolCompliancePct ?? 100}%</strong></div>
                        </div>
                      ) : (
                        <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>No recorded measurements</div>
                      )}
                    </div>

                  </div>

                  {/* MEASUREMENT DELTAS BAR */}
                  <div style={{ padding: '14px 18px', borderRadius: '12px', background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)', marginBottom: '20px', display: 'flex', gap: '24px', flexWrap: 'wrap', fontSize: '13px' }}>
                    <div>Weight Delta: <strong>{compareData.deltas.weightDelta != null ? `${compareData.deltas.weightDelta > 0 ? '+' : ''}${compareData.deltas.weightDelta} kg` : 'N/A'}</strong></div>
                    <div>Bicep Delta: <strong>{compareData.deltas.bicepDelta != null ? `${compareData.deltas.bicepDelta > 0 ? '+' : ''}${compareData.deltas.bicepDelta} cm` : 'N/A'}</strong></div>
                    <div>Visual Category: <strong>{compareCategory.toUpperCase()}</strong></div>
                  </div>

                  {/* FEATURE 13: OPTIONAL AI VISUAL COMPARISON ACTION (Requirements 20-23) */}
                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                    <button
                      className="btn btn-secondary"
                      onClick={handleRunAiPhotoCompare}
                      disabled={analyzingAi}
                      style={{ borderRadius: '8px' }}
                    >
                      {analyzingAi ? <RefreshCw size={14} className="spin" /> : <Sparkles size={14} color="var(--accent-purple)" />}
                      <span>Analyze Visual Differences with AI</span>
                    </button>

                    {aiAnalysis && (
                      <div style={{ marginTop: '14px', padding: '16px', borderRadius: '12px', background: 'var(--bg-app)', border: '1px solid var(--border-color)', fontSize: '13px', lineHeight: '1.5' }}>
                        <div style={{ fontWeight: 700, color: 'var(--accent-purple)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Sparkles size={16} /> AI Visual Observation ({compareCategory.toUpperCase()})
                        </div>
                        <div style={{ whiteSpace: 'pre-line', color: 'var(--text-primary)' }}>{aiAnalysis.analysis}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '12px', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Lock size={12} /> ⚠️ {aiAnalysis.disclaimer}
                        </div>
                      </div>
                    )}
                  </div>

                </div>
              ) : (
                <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                  Select two weeks above to compare photo transformation.
                </div>
              )}
            </div>
          )}

          {/* VIEW MODE 2: CHRONOLOGICAL TIMELINE STRIP (Requirements 14 & 15) */}
          {compareViewMode === 'timeline' && (
            <div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                Chronological visual transformation timeline for category: <strong>{compareCategory.toUpperCase()}</strong>.
              </div>

              {timelineList.length === 0 ? (
                <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                  No saved weekly reviews found in timeline.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' }}>
                  {timelineList.map((item, idx) => {
                    const photoUrl = item.photos[compareCategory];
                    return (
                      <div
                        key={item.id}
                        style={{
                          border: '1px solid var(--border-color)',
                          borderRadius: '12px',
                          padding: '14px',
                          background: 'var(--bg-app)'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 700 }}>Week {timelineList.length - idx}</span>
                          <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{item.weekStartDate}</span>
                        </div>

                        {photoUrl ? (
                          <div style={{ width: '100%', height: '200px', borderRadius: '8px', overflow: 'hidden', marginBottom: '8px', border: '1px solid var(--border-color)' }}>
                            <img
                              src={photoUrl}
                              alt={`Week ${item.weekStartDate}`}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          </div>
                        ) : (
                          <div style={{ height: '200px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-card)', borderRadius: '8px', color: 'var(--text-tertiary)', fontSize: '12px', marginBottom: '8px', border: '1px dashed var(--border-color)' }}>
                            <Camera size={24} style={{ marginBottom: '4px', opacity: 0.5 }} />
                            <div>Photo unavailable</div>
                          </div>
                        )}

                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          Weight: <strong>{item.bodyWeightKg ?? '—'} kg</strong>
                          {item.flexedBicepCm != null && <span> • Bicep: <strong>{item.flexedBicepCm} cm</strong></span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </div>
      )}

      {/* SUB-TAB 3 — HISTORICAL RECORDS STREAM */}
      {activeTab === 'history' && (
        <div className="card" style={{ padding: '24px' }}>
          <div className="card-title">
            <span>Historical Weekly Reviews</span>
            <span className="badge badge-purple">{historyList.length} Total Saved</span>
          </div>

          {historyList.length === 0 ? (
            <div style={{ padding: '36px 0', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '14px' }}>
              No historical weekly reviews recorded yet. Saved reviews will appear here.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
              {historyList.map(rec => (
                <div
                  key={rec.id}
                  style={{
                    padding: '16px',
                    borderRadius: '12px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-app)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      Week of {rec.weekStartDate} to {rec.weekEndDate}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      Weight: <strong>{rec.bodyWeightKg ?? '—'} kg</strong> • Compliance: <strong>{rec.protocolCompliancePct ?? 100}%</strong> • Verdict: <span className="badge badge-success">{rec.verdict || 'ON_TRACK'}</span>
                    </div>
                  </div>

                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setCompareWeekA(rec.weekStartDate);
                      setActiveTab('compare');
                    }}
                  >
                    Compare Photo
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
};
