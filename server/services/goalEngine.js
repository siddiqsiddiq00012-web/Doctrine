import { db } from '../db/index.js';
import {
  goals,
  goalMilestones,
  goalTaskMappings,
  financialGoals,
  taskExecutions,
  dailyExecutions
} from '../db/schema.js';
import { eq, and, inArray } from 'drizzle-orm';

/**
 * Pure calculation: Clamps value to integer percentage bounds [0, 100]
 */
export function clampPercentage(value) {
  if (value === null || value === undefined || Number.isNaN(value) || !Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(value)));
}

/**
 * Pure calculation: Calculates milestone progress summary
 */
export function calculateMilestoneProgress(milestones = []) {
  if (!Array.isArray(milestones) || milestones.length === 0) {
    return { total: 0, completed: 0, progress: 0 };
  }

  let totalScore = 0;
  let completedCount = 0;

  for (const m of milestones) {
    if (m.isCompleted) {
      completedCount++;
      totalScore += 1;
    } else if (m.targetValue && m.targetValue > 0) {
      const current = Math.max(0, Number(m.currentValue) || 0);
      const ratio = Math.min(1, current / Number(m.targetValue));
      totalScore += ratio;
    }
  }

  const progress = clampPercentage((totalScore / milestones.length) * 100);
  return {
    total: milestones.length,
    completed: completedCount,
    progress
  };
}

/**
 * Pure calculation: Calculates task mapping progress based on task execution status
 */
export function calculateTaskMappingProgress(mappings = [], executions = []) {
  if (!Array.isArray(mappings) || mappings.length === 0) {
    return { mapped: 0, completed: 0, progress: 0 };
  }

  // Map of taskKey -> Array of execution records for fast lookup
  const execMap = new Map();
  for (const exec of executions) {
    if (!execMap.has(exec.taskKey)) {
      execMap.set(exec.taskKey, []);
    }
    execMap.get(exec.taskKey).push(exec);
  }

  let totalWeight = 0;
  let completedWeight = 0;
  let completedCount = 0;

  for (const mapItem of mappings) {
    const weight = Math.max(1, Number(mapItem.weight) || 1);
    totalWeight += weight;

    const taskExecs = execMap.get(mapItem.taskKey) || [];
    const hasCompleted = taskExecs.some(e => e.status === 'COMPLETED');

    if (hasCompleted) {
      completedCount++;
      completedWeight += weight;
    }
  }

  const progress = totalWeight > 0 ? clampPercentage((completedWeight / totalWeight) * 100) : 0;
  return {
    mapped: mappings.length,
    completed: completedCount,
    progress
  };
}

/**
 * Pure calculation: Calculates financial progress from authoritative financial goal cache
 */
export function calculateFinancialGoalProgress(financialGoal = null) {
  if (!financialGoal || !financialGoal.targetPricePaise || financialGoal.targetPricePaise <= 0) {
    return { linked: Boolean(financialGoal), financialGoalId: financialGoal?.id || null, progress: 0 };
  }

  const allocated = Math.max(0, Number(financialGoal.allocatedAmountPaise) || 0);
  const target = Number(financialGoal.targetPricePaise);
  const progress = clampPercentage((allocated / target) * 100);

  return {
    linked: true,
    financialGoalId: financialGoal.id,
    progress
  };
}

/**
 * Pure calculation: Combines progress sources deterministically
 */
export function combineProgressSources({ milestoneSummary, taskSummary, financialSummary }) {
  const hasMilestones = milestoneSummary.total > 0;
  const hasTasks = taskSummary.mapped > 0;
  const hasFinancial = financialSummary.linked;

  if (hasMilestones && hasTasks) {
    // 70% milestone weight + 30% task execution weight
    return clampPercentage((milestoneSummary.progress * 0.7) + (taskSummary.progress * 0.3));
  }
  if (hasMilestones) {
    return milestoneSummary.progress;
  }
  if (hasTasks) {
    return taskSummary.progress;
  }
  if (hasFinancial) {
    return financialSummary.progress;
  }

  return 0;
}

/**
 * Pure calculation: Derives risk state & velocity calculations
 */
export function calculateRiskAndVelocity({ progress, targetDate, historicalTaskCount = 0, activeDaysCount = 0 }) {
  let isAtRisk = false;
  let reason = null;
  let daysRemaining = null;
  let velocity = null;
  let requiredVelocity = null;

  const todayStr = new Date().toISOString().split('T')[0];

  if (targetDate) {
    const todayMs = new Date(todayStr + 'T00:00:00Z').getTime();
    const targetMs = new Date(targetDate + 'T00:00:00Z').getTime();
    daysRemaining = Math.ceil((targetMs - todayMs) / (1000 * 60 * 60 * 24));

    if (daysRemaining < 0 && progress < 100) {
      isAtRisk = true;
      reason = 'Target date elapsed';
    } else if (daysRemaining > 0 && progress < 100) {
      requiredVelocity = Math.round(((100 - progress) / daysRemaining) * 100) / 100;
    }
  }

  // Velocity calculation (requires >= 2 active days)
  if (activeDaysCount >= 2) {
    velocity = Math.round((progress / activeDaysCount) * 100) / 100;
  }

  if (velocity !== null && requiredVelocity !== null && requiredVelocity > velocity * 2 && progress < 100) {
    isAtRisk = true;
    reason = 'Required velocity exceeds historical completion rate by >2x';
  }

  return {
    isAtRisk,
    reason,
    daysRemaining,
    velocity,
    requiredVelocity
  };
}

/**
 * Pure calculation: Derives goal status deterministically
 */
export function deriveGoalStatus({ status, progress, milestones = [], risk = {} }) {
  // ABANDONED is a terminal user decision -> never overwrite
  if (status === 'ABANDONED') {
    return 'ABANDONED';
  }

  if (progress >= 100 || (milestones.length > 0 && milestones.every(m => m.isCompleted))) {
    return 'COMPLETED';
  }

  if (risk.isAtRisk) {
    return 'AT_RISK';
  }

  if (progress === 0 && status !== 'ACTIVE') {
    return 'PLANNED';
  }

  return 'ACTIVE';
}

/**
 * Database Domain Reader: Get details for a single Goal
 */
export async function getGoalDetails(userId, goalId) {
  if (!userId || !goalId) {
    throw new Error('[Goal Engine Error] Missing required userId or goalId');
  }

  // 1. Fetch Goal record (User isolated)
  const [goal] = await db
    .select()
    .from(goals)
    .where(and(eq(goals.id, goalId), eq(goals.userId, userId)))
    .limit(1);

  if (!goal) return null;

  // 2. Fetch Milestones
  const milestones = await db
    .select()
    .from(goalMilestones)
    .where(and(eq(goalMilestones.goalId, goalId), eq(goalMilestones.userId, userId)));

  // 3. Fetch Task Mappings
  const mappings = await db
    .select()
    .from(goalTaskMappings)
    .where(and(eq(goalTaskMappings.goalId, goalId), eq(goalTaskMappings.userId, userId)));

  // 4. Fetch Task Executions for mapped task keys (if mappings exist)
  let executions = [];
  if (mappings.length > 0) {
    const taskKeys = Array.from(new Set(mappings.map(m => m.taskKey)));
    // Fetch user executions for these task keys
    const userDailyExecs = await db
      .select({ id: dailyExecutions.id })
      .from(dailyExecutions)
      .where(eq(dailyExecutions.userId, userId));

    const dailyExecIds = userDailyExecs.map(d => d.id);
    if (dailyExecIds.length > 0) {
      executions = await db
        .select()
        .from(taskExecutions)
        .where(and(
          inArray(taskExecutions.dailyExecutionId, dailyExecIds),
          inArray(taskExecutions.taskKey, taskKeys)
        ));
    }
  }

  // 5. Fetch Financial Goal if linked
  let financialGoal = null;
  if (goal.financialGoalId) {
    const [finG] = await db
      .select()
      .from(financialGoals)
      .where(and(eq(financialGoals.id, goal.financialGoalId), eq(financialGoals.userId, userId)))
      .limit(1);
    financialGoal = finG || null;
  }

  // 6. Perform Calculations
  const milestoneSummary = calculateMilestoneProgress(milestones);
  const taskSummary = calculateTaskMappingProgress(mappings, executions);
  const financialSummary = calculateFinancialGoalProgress(financialGoal);
  const progress = combineProgressSources({ milestoneSummary, taskSummary, financialSummary });
  const risk = calculateRiskAndVelocity({ progress, targetDate: goal.targetDate });
  const derivedStatus = deriveGoalStatus({ status: goal.status, progress, milestones, risk });

  return {
    id: goal.id,
    userId: goal.userId,
    parentId: goal.parentId,
    lifeAreaId: goal.lifeAreaId,
    level: goal.level,
    title: goal.title,
    description: goal.description,
    status: goal.status,
    derivedStatus,
    priority: goal.priority,
    targetDate: goal.targetDate,
    progress,
    milestoneSummary,
    taskSummary,
    financialSummary,
    risk
  };
}

/**
 * Database Domain Reader: Get Goal Hierarchy for User
 */
export async function getGoalHierarchy(userId) {
  if (!userId) {
    throw new Error('[Goal Engine Error] Missing required userId');
  }

  const allGoals = await db
    .select()
    .from(goals)
    .where(eq(goals.userId, userId));

  const goalDetailsList = await Promise.all(allGoals.map(g => getGoalDetails(userId, g.id)));
  const goalMap = new Map(goalDetailsList.filter(Boolean).map(g => [g.id, g]));

  const visions = [];
  const objectivesMap = new Map();

  for (const g of goalDetailsList) {
    if (!g) continue;
    if (g.level === 'VISION') {
      visions.push({ ...g, children: [] });
    } else if (g.level === 'OBJECTIVE') {
      objectivesMap.set(g.id, { ...g, children: [] });
    }
  }

  // Attach GOALs to OBJECTIVEs
  for (const g of goalDetailsList) {
    if (!g || g.level !== 'GOAL') continue;
    if (g.parentId && objectivesMap.has(g.parentId)) {
      objectivesMap.get(g.parentId).children.push(g);
    }
  }

  // Aggregate OBJECTIVE progress from child GOALs
  for (const obj of objectivesMap.values()) {
    const validChildren = obj.children.filter(c => c.derivedStatus !== 'ABANDONED');
    if (validChildren.length > 0) {
      const avg = validChildren.reduce((sum, c) => sum + c.progress, 0) / validChildren.length;
      obj.progress = clampPercentage(avg);
      obj.derivedStatus = deriveGoalStatus({ status: obj.status, progress: obj.progress, risk: obj.risk });
    }
  }

  // Attach OBJECTIVEs to VISIONs
  const visionMap = new Map(visions.map(v => [v.id, v]));
  for (const obj of objectivesMap.values()) {
    if (obj.parentId && visionMap.has(obj.parentId)) {
      visionMap.get(obj.parentId).children.push(obj);
    }
  }

  // Aggregate VISION progress from child OBJECTIVEs
  for (const vis of visionMap.values()) {
    const validChildren = vis.children.filter(c => c.derivedStatus !== 'ABANDONED');
    if (validChildren.length > 0) {
      const avg = validChildren.reduce((sum, c) => sum + c.progress, 0) / validChildren.length;
      vis.progress = clampPercentage(avg);
      vis.derivedStatus = deriveGoalStatus({ status: vis.status, progress: vis.progress, risk: vis.risk });
    }
  }

  return {
    visions: Array.from(visionMap.values()),
    standaloneObjectives: Array.from(objectivesMap.values()).filter(o => !o.parentId),
    standaloneGoals: goalDetailsList.filter(g => g.level === 'GOAL' && !g.parentId)
  };
}
