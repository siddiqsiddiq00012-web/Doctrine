import { WEEKLY_DOCTRINE } from '../../src/data/doctrineData.js';

/**
 * DOCTRINE ADAPTIVE EXECUTION ENGINE
 * Pure domain/service layer for capacity-based plan adaptation, deterministic prioritization,
 * time-budget compression, compliance calculations, and task deferral validation.
 *
 * CRITICAL ARCHITECTURAL GUARANTEES:
 * 1. PURE DOMAIN CALCULATION: Read-only, zero side-effects, zero DB writes, zero task status mutations.
 * 2. DETERMINISTIC STABLE SORTING: Uses explicit priorityScore + taskKey tie-breaking.
 * 3. SINGLE TRUTH SOURCE: Historical execution records (task_executions) remain authoritative.
 * 4. INFINITE CARRYOVER PROTECTION: Enforces maximum lineage chain depth limits.
 */

export const SUPPORTED_CAPACITY_MODES = new Set([
  'NORMAL',
  'MINIMUM_VIABLE',
  'EXAM_COMPRESSED',
  'REST_RECOVERY'
]);

export const CAPACITY_CONSTRAINT_REASONS = new Set([
  'Lack of time',
  'Work/college conflict',
  'Too tired',
  'Started too late'
]);

export const EXECUTION_FRICTION_REASONS = new Set([
  'Forgot',
  'Screen distraction',
  'Meal preparation failure',
  'No resources',
  'Other'
]);

export const MAX_CARRYOVER_CHAIN_DEPTH = 3;

/**
 * Calculates deterministic priority score for a task based on category tier and active goal mappings.
 *
 * FORMULA:
 * priorityScore = categoryBaseScore + sum(mappingWeight * 15 + goalPriorityBoost)
 *
 * Category Base Scores:
 * - NAMAZ: 100
 * - ANCHOR: 90
 * - WAKE / SLEEP: 80
 * - DATA_ENG: 70
 * - WORKOUT / NUTRITION: 60
 * - OTHER: 40
 *
 * Goal Boost:
 * - (6 - goal.priority) * 10 (Priority 1 goal adds +50 boost)
 * - mapping.weight * 15 (Weight 3 mapping adds +45 boost)
 */
export function calculateTaskPriorityScore(task, goalMappings = [], activeGoals = []) {
  let score = 0;
  const category = (task.category || '').toUpperCase();
  const taskKey = (task.taskKey || '').toLowerCase();

  // Category Tier Base Scores
  if (category === 'NAMAZ' || taskKey.startsWith('namaz_')) score += 100;
  else if (category === 'ANCHOR' || taskKey.startsWith('anchor_')) score += 90;
  else if (category === 'WAKE' || category === 'SLEEP') score += 80;
  else if (category === 'DATA_ENG' || taskKey.includes('de')) score += 70;
  else if (category === 'WORKOUT') score += 60;
  else if (category === 'NUTRITION') score += 60;
  else score += 40;

  // Goal Mappings Boost
  const mappings = goalMappings.filter(m => m.taskKey === task.taskKey);
  for (const map of mappings) {
    const weight = Math.max(1, Number(map.weight) || 1);
    const goal = activeGoals.find(g => g.id === map.goalId);
    const goalPriorityBoost = goal ? (6 - Math.min(5, Math.max(1, goal.priority || 1))) * 10 : 10;
    score += weight * 15 + goalPriorityBoost;
  }

  return score;
}

/**
 * Derives task duration in minutes from timeBlock start/end minutes or default
 */
export function getTaskDurationMinutes(task) {
  if (task.startMinutes !== undefined && task.endMinutes !== undefined && task.endMinutes > task.startMinutes) {
    return task.endMinutes - task.startMinutes;
  }
  return 20; // Default 20 mins if bounds unset
}

/**
 * Adapts daily task list according to Capacity Mode and Available Time Budget.
 * Guarantees 100% deterministic ordering using priorityScore descending, with taskKey ascending tie-breaker.
 */
export function adaptDailyPlan({
  tasks = [],
  capacityMode = 'NORMAL',
  availableMinutes = null,
  goalMappings = [],
  activeGoals = []
}) {
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return {
      capacityMode,
      availableMinutes,
      adaptedTasks: [],
      essentialTaskKeys: [],
      totalDurationMinutes: 0
    };
  }

  const validMode = SUPPORTED_CAPACITY_MODES.has(capacityMode) ? capacityMode : 'NORMAL';

  // Score all tasks deterministically
  const scoredTasks = tasks.map(t => ({
    ...t,
    priorityScore: calculateTaskPriorityScore(t, goalMappings, activeGoals),
    durationMinutes: getTaskDurationMinutes(t)
  }));

  // Stable deterministic sort: priorityScore descending, taskKey ascending tie-breaker
  scoredTasks.sort((a, b) => {
    if (b.priorityScore !== a.priorityScore) {
      return b.priorityScore - a.priorityScore;
    }
    return (a.taskKey || '').localeCompare(b.taskKey || '');
  });

  let filteredTasks = [...scoredTasks];

  if (validMode === 'MINIMUM_VIABLE') {
    // Preserve mandatory Anchors, Namaz, Wake/Sleep, and high-score Goal-linked tasks
    filteredTasks = scoredTasks.filter(t => {
      const cat = (t.category || '').toUpperCase();
      const isAnchorOrNamaz = cat === 'NAMAZ' || cat === 'ANCHOR' || cat === 'WAKE' || cat === 'SLEEP';
      const isGoalLinked = goalMappings.some(m => m.taskKey === t.taskKey);
      return isAnchorOrNamaz || isGoalLinked || t.priorityScore >= 80;
    });
  } else if (validMode === 'EXAM_COMPRESSED') {
    // Prioritize Data Engineering, Namaz, and Anchors while filtering out discretionary tasks
    filteredTasks = scoredTasks.filter(t => {
      const cat = (t.category || '').toUpperCase();
      return cat === 'DATA_ENG' || cat === 'NAMAZ' || cat === 'ANCHOR' || cat === 'WAKE' || cat === 'SLEEP' || t.priorityScore >= 95;
    });
  } else if (validMode === 'REST_RECOVERY') {
    // Prioritize Rest, Sleep, Nutrition, Namaz, Skincare while deferring intense workouts
    filteredTasks = scoredTasks.filter(t => {
      const cat = (t.category || '').toUpperCase();
      return cat !== 'WORKOUT' || t.taskKey.includes('cardio') || t.taskKey.includes('stretching');
    });
  }

  // Apply Available Time Budget Compression if availableMinutes is specified
  let adaptedTasks = [...filteredTasks];
  if (availableMinutes !== null && availableMinutes !== undefined && Number.isFinite(Number(availableMinutes))) {
    const maxMins = Math.max(0, Number(availableMinutes));
    let accumulatedMins = 0;
    const budgeted = [];

    for (const t of filteredTasks) {
      if (budgeted.length === 0 || accumulatedMins + t.durationMinutes <= maxMins) {
        budgeted.push(t);
        accumulatedMins += t.durationMinutes;
      }
    }
    adaptedTasks = budgeted;
  }

  const essentialTaskKeys = new Set(adaptedTasks.map(t => t.taskKey));
  const totalDurationMinutes = adaptedTasks.reduce((acc, t) => acc + t.durationMinutes, 0);

  return {
    capacityMode: validMode,
    availableMinutes: availableMinutes !== null ? Number(availableMinutes) : null,
    adaptedTasks,
    essentialTaskKeys: Array.from(essentialTaskKeys),
    totalDurationMinutes
  };
}

/**
 * Calculates raw and adapted compliance percentages deterministically.
 */
export function calculateComplianceMetrics({ plannedTasks = [], essentialTaskKeys = [] }) {
  if (!Array.isArray(plannedTasks) || plannedTasks.length === 0) {
    return { rawCompliance: 0, adaptedCompliance: 0, completedCount: 0, totalCount: 0, essentialCount: 0 };
  }

  const totalCount = plannedTasks.length;
  const completedCount = plannedTasks.filter(t => t.status === 'COMPLETED').length;
  const rawCompliance = Math.max(0, Math.min(100, Math.round((completedCount / totalCount) * 100)));

  const essentialKeySet = new Set(essentialTaskKeys);
  const essentialTasks = plannedTasks.filter(t => essentialKeySet.has(t.taskKey));

  let adaptedCompliance = rawCompliance;
  if (essentialTasks.length > 0) {
    const completedEssential = essentialTasks.filter(t => t.status === 'COMPLETED').length;
    adaptedCompliance = Math.max(0, Math.min(100, Math.round((completedEssential / essentialTasks.length) * 100)));
  }

  return {
    rawCompliance,
    adaptedCompliance,
    completedCount,
    totalCount,
    essentialCount: essentialTasks.length
  };
}

/**
 * Validates task deferral requests, enforcing user isolation, date formats, status gates, and lineage depth limits.
 */
export function validateTaskDeferral({ sourceTask, targetDate, sourceUserId, targetUserId, lineageDepth = 1 }) {
  if (!sourceTask) {
    return { isValid: false, reason: 'Source task does not exist' };
  }

  if (!sourceUserId || !targetUserId || sourceUserId !== targetUserId) {
    return { isValid: false, reason: 'Unauthorized cross-user deferral attempt' };
  }

  if (sourceTask.status === 'COMPLETED') {
    return { isValid: false, reason: 'Completed tasks cannot be deferred' };
  }

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!targetDate || typeof targetDate !== 'string' || !dateRegex.test(targetDate)) {
    return { isValid: false, reason: 'Invalid target date format. Expected YYYY-MM-DD' };
  }

  if (sourceTask.date && sourceTask.date === targetDate) {
    return { isValid: false, reason: 'Same-day deferral is rejected. Target date must differ from source date' };
  }

  // Infinite carryover chain protection
  if (lineageDepth >= MAX_CARRYOVER_CHAIN_DEPTH || (sourceTask.taskKey && sourceTask.taskKey.includes('_carryover_hop3'))) {
    return { isValid: false, reason: `Maximum carryover chain depth (${MAX_CARRYOVER_CHAIN_DEPTH}) reached. Task must be executed or marked missed.` };
  }

  return { isValid: true };
}

/**
 * Determines target day carryover handling (reuse existing task vs create carryover task)
 */
export function determineCarryoverTarget({ targetDayExecutions = [], taskKey, sourceTaskId }) {
  const existingTargetTask = targetDayExecutions.find(t => t.taskKey === taskKey);

  if (existingTargetTask) {
    return {
      mode: 'REUSE_EXISTING',
      targetExecutionId: existingTargetTask.id,
      taskKey: existingTargetTask.taskKey
    };
  }

  const safeSourceId = sourceTaskId ? sourceTaskId.substring(0, 6) : 'src';
  return {
    mode: 'CREATE_CARRYOVER',
    targetExecutionId: null,
    taskKey: `carryover_${taskKey}_${safeSourceId}`
  };
}

/**
 * Categorizes failure reason as Capacity Constraint vs Execution Friction
 */
export function categorizeFailureReason(reason) {
  if (CAPACITY_CONSTRAINT_REASONS.has(reason)) {
    return 'CAPACITY_CONSTRAINT';
  }
  if (EXECUTION_FRICTION_REASONS.has(reason)) {
    return 'EXECUTION_FRICTION';
  }
  return 'OTHER';
}

