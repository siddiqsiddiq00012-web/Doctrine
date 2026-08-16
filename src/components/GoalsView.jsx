import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Target,
  Plus,
  Trash2,
  Edit2,
  ChevronRight,
  ChevronDown,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Zap,
  TrendingUp,
  Wallet,
  Calendar,
  Layers,
  Sparkles,
  RefreshCw,
  X
} from 'lucide-react';

export const GoalsView = () => {
  const {
    goalHierarchy,
    lifeAreas,
    goalLoading,
    goalError,
    fetchGoals,
    createGoal,
    updateGoal,
    deleteGoal,
    createMilestone,
    toggleMilestone,
    deleteMilestone,
    createTaskMapping,
    deleteTaskMapping
  } = useApp();

  const [activeFilter, setActiveFilter] = useState('ALL');
  const [expandedNodes, setExpandedNodes] = useState({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedGoalForAction, setSelectedGoalForAction] = useState(null);
  const [showMilestoneModal, setShowMilestoneModal] = useState(false);
  const [showTaskMappingModal, setShowTaskMappingModal] = useState(false);

  // Form states
  const [formLevel, setFormLevel] = useState('GOAL');
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formParentId, setFormParentId] = useState('');
  const [formLifeAreaId, setFormLifeAreaId] = useState('');
  const [formTargetDate, setFormTargetDate] = useState('');
  const [formStatus, setFormStatus] = useState('PLANNED');
  const [formPriority, setFormPriority] = useState(1);
  const [formError, setFormError] = useState('');

  // Milestone Form state
  const [msTitle, setMsTitle] = useState('');
  const [msTargetValue, setMsTargetValue] = useState(100);
  const [msCurrentValue, setMsCurrentValue] = useState(0);

  // Task Mapping Form state
  const [mappingTaskKey, setMappingTaskKey] = useState('de_session');
  const [mappingWeight, setMappingWeight] = useState(1);

  const toggleExpand = (id) => {
    setExpandedNodes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const openCreateModal = (presetLevel = 'GOAL', presetParentId = '') => {
    setFormLevel(presetLevel);
    setFormTitle('');
    setFormDescription('');
    setFormParentId(presetParentId);
    setFormLifeAreaId(lifeAreas.length > 0 ? lifeAreas[0].id : '');
    setFormTargetDate('');
    setFormStatus('PLANNED');
    setFormPriority(1);
    setFormError('');
    setShowCreateModal(true);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setFormError('Goal title is required');
      return;
    }
    setFormError('');
    try {
      await createGoal({
        title: formTitle,
        description: formDescription,
        level: formLevel,
        parentId: formParentId || null,
        lifeAreaId: formLifeAreaId || null,
        targetDate: formTargetDate || null,
        status: formStatus,
        priority: Number(formPriority) || 1
      });
      setShowCreateModal(false);
    } catch (err) {
      setFormError(err.message || 'Failed to create goal');
    }
  };

  const handleAddMilestone = async (e) => {
    e.preventDefault();
    if (!selectedGoalForAction || !msTitle.trim()) return;
    try {
      await createMilestone(selectedGoalForAction.id, {
        title: msTitle,
        targetValue: Number(msTargetValue) || 1,
        currentValue: Number(msCurrentValue) || 0
      });
      setShowMilestoneModal(false);
      setMsTitle('');
    } catch (err) {
      alert(err.message || 'Failed to add milestone');
    }
  };

  const handleAddTaskMapping = async (e) => {
    e.preventDefault();
    if (!selectedGoalForAction || !mappingTaskKey.trim()) return;
    try {
      await createTaskMapping(selectedGoalForAction.id, {
        taskKey: mappingTaskKey,
        weight: Number(mappingWeight) || 1
      });
      setShowTaskMappingModal(false);
    } catch (err) {
      alert(err.message || 'Failed to add task mapping');
    }
  };

  // Flatten goals for stats calculation
  const allVisions = goalHierarchy.visions || [];
  const allObjectives = [
    ...allVisions.flatMap(v => v.children || []),
    ...(goalHierarchy.standaloneObjectives || [])
  ];
  const allGoals = [
    ...allObjectives.flatMap(o => o.children || []),
    ...(goalHierarchy.standaloneGoals || [])
  ];

  const totalActive = allGoals.filter(g => g.derivedStatus === 'ACTIVE').length;
  const totalAtRisk = allGoals.filter(g => g.derivedStatus === 'AT_RISK' || g.risk?.isAtRisk).length;
  const totalCompleted = allGoals.filter(g => g.derivedStatus === 'COMPLETED').length;
  const overallAvgProgress = allGoals.length > 0
    ? Math.round(allGoals.reduce((acc, g) => acc + (g.progress || 0), 0) / allGoals.length)
    : 0;

  if (goalLoading && allVisions.length === 0 && allGoals.length === 0) {
    return (
      <div className="view-container" style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        <RefreshCw className="animate-spin" size={24} style={{ marginBottom: '12px' }} />
        <div>Loading Doctrine Goals & Hierarchy Engine...</div>
      </div>
    );
  }

  return (
    <div className="view-container" style={{ paddingBottom: '90px' }}>
      {/* HEADER BAR */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Target color="var(--accent-blue)" size={24} />
            <span>Goals & Progression Engine</span>
          </h1>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Vision → Objective → Goal → Milestone Hierarchy
          </div>
        </div>

        <button
          onClick={() => openCreateModal('VISION')}
          className="btn-primary"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 14px',
            fontSize: '13px',
            fontWeight: 600,
            borderRadius: '10px',
            background: 'var(--accent-blue)',
            color: '#fff',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          <Plus size={16} />
          <span>New Vision</span>
        </button>
      </div>

      {/* ERROR BANNER */}
      {goalError && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '12px',
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid var(--accent-red, #ef4444)',
          color: 'var(--accent-red, #ef4444)',
          fontSize: '13px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <span>{goalError}</span>
          <button onClick={fetchGoals} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontWeight: 600 }}>Retry</button>
        </div>
      )}

      {/* OVERVIEW STATS (A. Overview) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
        gap: '10px',
        marginBottom: '20px'
      }}>
        <div style={{ background: 'var(--bg-card)', padding: '14px', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Active Goals</div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--accent-blue)', marginTop: '4px' }}>{totalActive}</div>
        </div>

        <div style={{ background: 'var(--bg-card)', padding: '14px', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>At-Risk Goals</div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: totalAtRisk > 0 ? '#f59e0b' : 'var(--text-primary)', marginTop: '4px' }}>{totalAtRisk}</div>
        </div>

        <div style={{ background: 'var(--bg-card)', padding: '14px', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Completed</div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: '#10b981', marginTop: '4px' }}>{totalCompleted}</div>
        </div>

        <div style={{ background: 'var(--bg-card)', padding: '14px', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Overall Progress</div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>{overallAvgProgress}%</div>
        </div>
      </div>

      {/* FILTER TABS */}
      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '16px' }}>
        {['ALL', 'ACTIVE', 'AT_RISK', 'COMPLETED', 'PLANNED', 'ABANDONED'].map((filter) => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            style={{
              padding: '6px 12px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 600,
              border: '1px solid var(--border-color)',
              background: activeFilter === filter ? 'var(--accent-blue)' : 'var(--bg-card)',
              color: activeFilter === filter ? '#fff' : 'var(--text-secondary)',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            {filter.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* EMPTY STATE */}
      {allVisions.length === 0 && (goalHierarchy.standaloneObjectives || []).length === 0 && (goalHierarchy.standaloneGoals || []).length === 0 && (
        <div style={{
          padding: '40px 20px',
          textAlign: 'center',
          background: 'var(--bg-card)',
          borderRadius: '16px',
          border: '1px dashed var(--border-color)',
          marginTop: '20px'
        }}>
          <Target size={40} color="var(--text-secondary)" style={{ marginBottom: '12px', opacity: 0.5 }} />
          <h3 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 6px 0' }}>No Goals Defined Yet</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 16px 0', maxWidth: '360px', marginLeft: 'auto', marginRight: 'auto' }}>
            Create your first Vision to establish your top-level physical, tech, or personal transformation blueprint.
          </p>
          <button
            onClick={() => openCreateModal('VISION')}
            style={{
              padding: '10px 18px',
              borderRadius: '10px',
              background: 'var(--accent-blue)',
              color: '#fff',
              border: 'none',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            Create First Vision
          </button>
        </div>
      )}

      {/* HIERARCHY TREE VIEW (B. Hierarchy & C. Goal Details) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {allVisions.map((vision) => (
          <VisionCard
            key={vision.id}
            vision={vision}
            expandedNodes={expandedNodes}
            toggleExpand={toggleExpand}
            openCreateModal={openCreateModal}
            deleteGoal={deleteGoal}
            setSelectedGoalForAction={setSelectedGoalForAction}
            setShowMilestoneModal={setShowMilestoneModal}
            setShowTaskMappingModal={setShowTaskMappingModal}
            toggleMilestone={toggleMilestone}
            deleteMilestone={deleteMilestone}
            deleteTaskMapping={deleteTaskMapping}
            lifeAreas={lifeAreas}
          />
        ))}

        {/* Standalone Objectives */}
        {(goalHierarchy.standaloneObjectives || []).map((obj) => (
          <ObjectiveCard
            key={obj.id}
            objective={obj}
            expandedNodes={expandedNodes}
            toggleExpand={toggleExpand}
            openCreateModal={openCreateModal}
            deleteGoal={deleteGoal}
            setSelectedGoalForAction={setSelectedGoalForAction}
            setShowMilestoneModal={setShowMilestoneModal}
            setShowTaskMappingModal={setShowTaskMappingModal}
            toggleMilestone={toggleMilestone}
            deleteMilestone={deleteMilestone}
            deleteTaskMapping={deleteTaskMapping}
            lifeAreas={lifeAreas}
          />
        ))}

        {/* Standalone Goals */}
        {(goalHierarchy.standaloneGoals || []).map((goal) => (
          <GoalCard
            key={goal.id}
            goal={goal}
            deleteGoal={deleteGoal}
            setSelectedGoalForAction={setSelectedGoalForAction}
            setShowMilestoneModal={setShowMilestoneModal}
            setShowTaskMappingModal={setShowTaskMappingModal}
            toggleMilestone={toggleMilestone}
            deleteMilestone={deleteMilestone}
            deleteTaskMapping={deleteTaskMapping}
            lifeAreas={lifeAreas}
          />
        ))}
      </div>

      {/* CREATE GOAL MODAL (F. Forms) */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1200,
          padding: '16px'
        }}>
          <div style={{
            background: 'var(--bg-card)',
            borderRadius: '16px',
            border: '1px solid var(--border-color)',
            width: '100%',
            maxWidth: '480px',
            padding: '20px',
            boxShadow: 'var(--shadow-md)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '17px', fontWeight: 700, margin: 0 }}>
                Create New {formLevel}
              </h2>
              <button onClick={() => setShowCreateModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                <X size={18} />
              </button>
            </div>

            {formError && (
              <div style={{ color: 'var(--accent-red, #ef4444)', fontSize: '13px', marginBottom: '12px' }}>{formError}</div>
            )}

            <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Hierarchy Level</label>
                <select
                  value={formLevel}
                  onChange={(e) => setFormLevel(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                >
                  <option value="VISION">VISION (Top-Level Blueprint)</option>
                  <option value="OBJECTIVE">OBJECTIVE (Pillar Target under Vision)</option>
                  <option value="GOAL">GOAL (Actionable Target under Objective)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Title *</label>
                <input
                  type="text"
                  placeholder="e.g. Peak Lean Mass & Posture Floor"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  required
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Description</label>
                <textarea
                  rows={2}
                  placeholder="Contextual reasoning and success criteria"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                />
              </div>

              {/* Conditional Parent Dropdown */}
              {formLevel === 'OBJECTIVE' && (
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Parent Vision</label>
                  <select
                    value={formParentId}
                    onChange={(e) => setFormParentId(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                  >
                    <option value="">Select Parent Vision</option>
                    {allVisions.map(v => <option key={v.id} value={v.id}>{v.title}</option>)}
                  </select>
                </div>
              )}

              {formLevel === 'GOAL' && (
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Parent Objective</label>
                  <select
                    value={formParentId}
                    onChange={(e) => setFormParentId(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                  >
                    <option value="">Select Parent Objective</option>
                    {allObjectives.map(o => <option key={o.id} value={o.id}>{o.title}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Life Area</label>
                <select
                  value={formLifeAreaId}
                  onChange={(e) => setFormLifeAreaId(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                >
                  {lifeAreas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Target Date (Optional)</label>
                <input
                  type="date"
                  value={formTargetDate}
                  onChange={(e) => setFormTargetDate(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: 'var(--accent-blue)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
                >
                  Create {formLevel}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD MILESTONE MODAL */}
      {showMilestoneModal && selectedGoalForAction && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1200, padding: '16px'
        }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-color)', width: '100%', maxWidth: '420px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Add Milestone to {selectedGoalForAction.title}</h3>
              <button onClick={() => setShowMilestoneModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleAddMilestone} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input
                type="text"
                placeholder="Milestone Title (e.g. Reach 70kg floor)"
                value={msTitle}
                onChange={(e) => setMsTitle(e.target.value)}
                required
                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
              />
              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Target Value</label>
                  <input
                    type="number"
                    value={msTargetValue}
                    onChange={(e) => setMsTargetValue(e.target.value)}
                    style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Current Value</label>
                  <input
                    type="number"
                    value={msCurrentValue}
                    onChange={(e) => setMsCurrentValue(e.target.value)}
                    style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>
              <button type="submit" style={{ padding: '10px', borderRadius: '8px', background: 'var(--accent-blue)', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer', marginTop: '6px' }}>
                Add Milestone
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ADD TASK MAPPING MODAL */}
      {showTaskMappingModal && selectedGoalForAction && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1200, padding: '16px'
        }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-color)', width: '100%', maxWidth: '420px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Map Task to {selectedGoalForAction.title}</h3>
              <button onClick={() => setShowTaskMappingModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleAddTaskMapping} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Task Key</label>
                <select
                  value={mappingTaskKey}
                  onChange={(e) => setMappingTaskKey(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                >
                  <option value="workout_a">Workout A (Hypertrophy)</option>
                  <option value="de_session">Data Engineering Active Session</option>
                  <option value="skincare_am">Morning Skincare & Grooming</option>
                  <option value="namaz_fajr">Fajr Prayer</option>
                  <option value="mass_shake">Anabolic Mass Shake</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Contribution Weight</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={mappingWeight}
                  onChange={(e) => setMappingWeight(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                />
              </div>
              <button type="submit" style={{ padding: '10px', borderRadius: '8px', background: 'var(--accent-blue)', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer', marginTop: '6px' }}>
                Map Task Intent
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// Vision Card Component
const VisionCard = ({ vision, expandedNodes, toggleExpand, openCreateModal, deleteGoal, setSelectedGoalForAction, setShowMilestoneModal, setShowTaskMappingModal, toggleMilestone, deleteMilestone, deleteTaskMapping, lifeAreas }) => {
  const isExpanded = expandedNodes[vision.id] !== false; // Default expanded

  return (
    <div style={{
      background: 'var(--bg-card)',
      borderRadius: '16px',
      border: '1px solid var(--border-color)',
      padding: '16px',
      boxShadow: 'var(--shadow-sm)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }} onClick={() => toggleExpand(vision.id)}>
          {isExpanded ? <ChevronDown size={18} color="var(--text-secondary)" /> : <ChevronRight size={18} color="var(--text-secondary)" />}
          <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', background: 'rgba(59, 130, 246, 0.15)', color: 'var(--accent-blue)' }}>VISION</span>
          <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>{vision.title}</h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{vision.progress || 0}%</span>
          <button
            onClick={() => openCreateModal('OBJECTIVE', vision.id)}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', padding: '4px 8px', borderRadius: '6px', background: 'var(--accent-blue-subtle)', color: 'var(--accent-blue)', border: 'none', cursor: 'pointer' }}
          >
            <Plus size={14} /> Add Objective
          </button>
          <button onClick={() => deleteGoal(vision.id)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }} title="Delete Vision">
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {/* ProgressBar */}
      <div style={{ width: '100%', height: '6px', background: 'var(--border-color)', borderRadius: '3px', marginTop: '10px', overflow: 'hidden' }}>
        <div style={{ width: `${vision.progress || 0}%`, height: '100%', background: 'var(--accent-blue)', transition: 'width 0.3s ease' }} />
      </div>

      {/* Children Objectives */}
      {isExpanded && (
        <div style={{ marginTop: '14px', paddingLeft: '16px', borderLeft: '2px dashed var(--border-color)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {(vision.children || []).map((obj) => (
            <ObjectiveCard
              key={obj.id}
              objective={obj}
              expandedNodes={expandedNodes}
              toggleExpand={toggleExpand}
              openCreateModal={openCreateModal}
              deleteGoal={deleteGoal}
              setSelectedGoalForAction={setSelectedGoalForAction}
              setShowMilestoneModal={setShowMilestoneModal}
              setShowTaskMappingModal={setShowTaskMappingModal}
              toggleMilestone={toggleMilestone}
              deleteMilestone={deleteMilestone}
              deleteTaskMapping={deleteTaskMapping}
              lifeAreas={lifeAreas}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// Objective Card Component
const ObjectiveCard = ({ objective, expandedNodes, toggleExpand, openCreateModal, deleteGoal, setSelectedGoalForAction, setShowMilestoneModal, setShowTaskMappingModal, toggleMilestone, deleteMilestone, deleteTaskMapping, lifeAreas }) => {
  const isExpanded = expandedNodes[objective.id] !== false;

  return (
    <div style={{ background: 'var(--bg-main, rgba(0,0,0,0.02))', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => toggleExpand(objective.id)}>
          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: 'rgba(139, 92, 246, 0.15)', color: '#8b5cf6' }}>OBJECTIVE</span>
          <h3 style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>{objective.title}</h3>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', fontWeight: 700 }}>{objective.progress || 0}%</span>
          <button
            onClick={() => openCreateModal('GOAL', objective.id)}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', padding: '4px 8px', borderRadius: '6px', background: 'var(--accent-blue-subtle)', color: 'var(--accent-blue)', border: 'none', cursor: 'pointer' }}
          >
            <Plus size={13} /> Add Goal
          </button>
          <button onClick={() => deleteGoal(objective.id)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Children Goals */}
      {isExpanded && (
        <div style={{ marginTop: '12px', paddingLeft: '14px', borderLeft: '2px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {(objective.children || []).map((g) => (
            <GoalCard
              key={g.id}
              goal={g}
              deleteGoal={deleteGoal}
              setSelectedGoalForAction={setSelectedGoalForAction}
              setShowMilestoneModal={setShowMilestoneModal}
              setShowTaskMappingModal={setShowTaskMappingModal}
              toggleMilestone={toggleMilestone}
              deleteMilestone={deleteMilestone}
              deleteTaskMapping={deleteTaskMapping}
              lifeAreas={lifeAreas}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// Goal Card Component (C. Goal Details, D. Milestones, E. Task Mappings)
const GoalCard = ({ goal, deleteGoal, setSelectedGoalForAction, setShowMilestoneModal, setShowTaskMappingModal, toggleMilestone, deleteMilestone, deleteTaskMapping, lifeAreas }) => {
  const statusColorMap = {
    PLANNED: 'var(--text-secondary)',
    ACTIVE: 'var(--accent-blue)',
    AT_RISK: '#f59e0b',
    COMPLETED: '#10b981',
    ABANDONED: '#64748b'
  };

  const area = lifeAreas.find(a => a.id === goal.lifeAreaId);

  return (
    <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>GOAL</span>
          {area && (
            <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 6px', borderRadius: '4px', background: area.color ? `${area.color}22` : 'var(--bg-main)', color: area.color || 'var(--text-primary)' }}>
              {area.name}
            </span>
          )}
          <h4 style={{ fontSize: '13px', fontWeight: 600, margin: 0 }}>{goal.title}</h4>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: `${statusColorMap[goal.derivedStatus || 'PLANNED']}22`, color: statusColorMap[goal.derivedStatus || 'PLANNED'] }}>
            {goal.derivedStatus || 'PLANNED'}
          </span>
          <button onClick={() => deleteGoal(goal.id)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Progress & Risk */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
        <div style={{ flex: 1, height: '6px', background: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{ width: `${goal.progress || 0}%`, height: '100%', background: statusColorMap[goal.derivedStatus || 'ACTIVE'], transition: 'width 0.3s ease' }} />
        </div>
        <span style={{ fontSize: '12px', fontWeight: 700 }}>{goal.progress || 0}%</span>
      </div>

      {/* Risk Alert */}
      {goal.risk?.isAtRisk && (
        <div style={{ fontSize: '11px', color: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)', padding: '6px 10px', borderRadius: '6px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <AlertTriangle size={13} />
          <span>At Risk: {goal.risk.reason}</span>
        </div>
      )}

      {/* Milestones & Task Controls */}
      <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
        <button
          onClick={() => { setSelectedGoalForAction(goal); setShowMilestoneModal(true); }}
          style={{ flex: 1, fontSize: '11px', padding: '5px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
        >
          <Plus size={12} /> Add Milestone ({goal.milestoneSummary?.completed || 0}/{goal.milestoneSummary?.total || 0})
        </button>
        <button
          onClick={() => { setSelectedGoalForAction(goal); setShowTaskMappingModal(true); }}
          style={{ flex: 1, fontSize: '11px', padding: '5px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
        >
          <Zap size={12} /> Map Task ({goal.taskSummary?.completed || 0}/{goal.taskSummary?.mapped || 0})
        </button>
      </div>
    </div>
  );
};
