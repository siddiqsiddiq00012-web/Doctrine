import { db } from '../db/index.js';
import {
  dailyExecutions,
  taskExecutions,
  tasks,
  lifeAreas,
  goals,
  goalTaskMappings,
  taskFailureReasons
} from '../db/schema.js';
import { eq, and, gte, lte, inArray, desc, asc } from 'drizzle-orm';
import { adaptDailyPlan } from './adaptiveExecutionService.js';
import { calculateFailurePatterns } from './failurePatternService.js';

/**
 * DOCTRINE UNIFIED PROGRESS & ADHERENCE ENGINE
 * Authoritative, deterministic backend engine for calculating execution consistency,
 * capacity-aware adherence, execution streaks, life-area progress, task reliability,
 * and goal execution signals.
 *
 * CRITICAL ARCHITECTURAL GUARANTEES:
 * 1. 100% DETERMINISTIC: Pure mathematical & database-derived metrics. Zero LLM/AI.
 * 2. DERIVED STATE ONLY: Zero new database tables. Derived dynamically from existing records.
 * 3. CAPACITY-AWARE: Evaluated against expected workload per capacity mode.
 * 4. MULTI-TENANT ISOLATION: Strict userId scoping on all queries and aggregations.
 */

/**
 * Checks if a task qualifies as High Priority.
 * Rule: defaultPriority <= 2 OR priorityScore >= 80 OR category in ['NAMAZ', 'ANCHOR', 'WAKE', 'SLEEP']
 */
export function isHighPriorityTask(task) {
  if (!task) return false;
  const category = (task.category || '').toUpperCase();
  const taskKey = (task.taskKey || '').toLowerCase();
  const priority = Number(task.defaultPriority || task.priority || 5);

  if (priority <= 2) return true;
  if (['NAMAZ', 'ANCHOR', 'WAKE', 'SLEEP'].includes(category)) return true;
  if (taskKey.startsWith('namaz_') || taskKey.startsWith('anchor_')) return true;
  if (task.priorityScore && Number(task.priorityScore) >= 80) return true;

  return false;
}

/**
 * Pure calculation: Computes daily execution metrics for a single date.
 */
export function calculateDailyAdherence(dailyExecution, taskExecutionsList = [], customCapacityMode = null) {
  const tasksList = Array.isArray(taskExecutionsList) ? taskExecutionsList : [];
  const scheduledCount = tasksList.length;

  const completedTasks = tasksList.filter((t) => t.status === 'COMPLETED');
  const skippedTasks = tasksList.filter((t) => t.status === 'SKIPPED');
  const missedTasks = tasksList.filter((t) => t.status === 'MISSED');
  const deferredTasks = tasksList.filter(
    (t) => Boolean(t.deferredToDate) || (t.status === 'SKIPPED' && Boolean(t.deferredToDate))
  );

  const completedCount = completedTasks.length;
  const skippedCount = skippedTasks.length;
  const missedCount = missedTasks.length;
  const deferredCount = deferredTasks.length;

  const rawCompletionPercentage =
    scheduledCount > 0 ? Math.max(0, Math.min(100, Math.round((completedCount / scheduledCount) * 100))) : 0;

  const executionPercentage =
    scheduledCount > 0
      ? Math.max(0, Math.min(100, Math.round(((completedCount + skippedCount) / scheduledCount) * 100)))
      : 0;

  // High-Priority Adherence
  const highPriorityTasks = tasksList.filter(isHighPriorityTask);
  const highPriorityScheduledCount = highPriorityTasks.length;
  const highPriorityCompletedCount = highPriorityTasks.filter((t) => t.status === 'COMPLETED').length;
  const highPriorityAdherence =
    highPriorityScheduledCount > 0
      ? Math.max(0, Math.min(100, Math.round((highPriorityCompletedCount / highPriorityScheduledCount) * 100)))
      : rawCompletionPercentage;

  // Capacity-Aware Adherence
  const capacityMode =
    customCapacityMode || dailyExecution?.currentCapacityMode || dailyExecution?.capacityMode || 'NORMAL';

  let capacityAdherencePercentage = rawCompletionPercentage;
  if (capacityMode !== 'NORMAL' && scheduledCount > 0) {
    const adaptation = adaptDailyPlan({ tasks: tasksList, capacityMode });
    const essentialKeys = new Set(adaptation.essentialTaskKeys || []);
    const essentialTasks = tasksList.filter((t) => essentialKeys.has(t.taskKey));

    if (essentialTasks.length > 0) {
      const completedEssential = essentialTasks.filter((t) => t.status === 'COMPLETED').length;
      capacityAdherencePercentage = Math.max(
        0,
        Math.min(100, Math.round((completedEssential / essentialTasks.length) * 100))
      );
    }
  }

  return {
    date: dailyExecution?.date || null,
    capacityMode,
    scheduledCount,
    completedCount,
    skippedCount,
    missedCount,
    deferredCount,
    rawCompletionPercentage,
    executionPercentage,
    highPriorityScheduledCount,
    highPriorityCompletedCount,
    highPriorityAdherence,
    capacityAdherencePercentage,
  };
}

/**
 * Calculates time-window adherence metrics (7, 30, 90 days) for a user.
 */
export async function calculateWindowAdherence(dbClient, userId, daysWindow = 30, endDateStr = null) {
  const targetEnd = endDateStr || new Date().toISOString().split('T')[0];
  const endDateObj = new Date(targetEnd + 'T00:00:00');
  const startDateObj = new Date(endDateObj.getTime() - (daysWindow - 1) * 86400000);
  const startDateStr = startDateObj.toISOString().split('T')[0];

  // Bounded query for daily_executions in range
  const dailyRecords = await dbClient
    .select()
    .from(dailyExecutions)
    .where(
      and(
        eq(dailyExecutions.userId, userId),
        gte(dailyExecutions.date, startDateStr),
        lte(dailyExecutions.date, targetEnd)
      )
    )
    .orderBy(asc(dailyExecutions.date));

  const dailyIds = dailyRecords.map((d) => d.id);

  // Fetch all task executions in window
  let taskRecords = [];
  if (dailyIds.length > 0) {
    taskRecords = await dbClient
      .select()
      .from(taskExecutions)
      .where(inArray(taskExecutions.dailyExecutionId, dailyIds));
  }

  const tasksByDailyId = new Map();
  taskRecords.forEach((t) => {
    if (!tasksByDailyId.has(t.dailyExecutionId)) {
      tasksByDailyId.set(t.dailyExecutionId, []);
    }
    tasksByDailyId.get(t.dailyExecutionId).push(t);
  });

  const dailyAdherences = dailyRecords.map((d) => {
    const dTasks = tasksByDailyId.get(d.id) || [];
    return calculateDailyAdherence(d, dTasks);
  });

  const activeDaysList = dailyAdherences.filter((d) => d.scheduledCount > 0 || d.completedCount > 0);
  const activeDays = activeDaysList.length;
  const recordedDaysCount = dailyRecords.length;

  let totalScheduledTasks = 0;
  let totalCompletedTasks = 0;
  let totalSkippedTasks = 0;
  let totalMissedTasks = 0;
  let totalDeferredTasks = 0;

  dailyAdherences.forEach((d) => {
    totalScheduledTasks += d.scheduledCount;
    totalCompletedTasks += d.completedCount;
    totalSkippedTasks += d.skippedCount;
    totalMissedTasks += d.missedCount;
    totalDeferredTasks += d.deferredCount;
  });

  const averageRawAdherence =
    activeDays > 0
      ? Math.round(dailyAdherences.reduce((acc, d) => acc + d.rawCompletionPercentage, 0) / activeDays)
      : 0;

  const averageCapacityAdherence =
    activeDays > 0
      ? Math.round(dailyAdherences.reduce((acc, d) => acc + d.capacityAdherencePercentage, 0) / activeDays)
      : 0;

  const highPriorityAdherence =
    activeDays > 0
      ? Math.round(dailyAdherences.reduce((acc, d) => acc + d.highPriorityAdherence, 0) / activeDays)
      : 0;

  // Best & Worst Days
  let bestDay = { date: null, completionPercentage: 0, completedCount: 0 };
  let worstDay = { date: null, completionPercentage: 0, completedCount: 0 };

  if (activeDaysList.length > 0) {
    const sortedBest = [...activeDaysList].sort((a, b) => b.rawCompletionPercentage - a.rawCompletionPercentage);
    bestDay = {
      date: sortedBest[0].date,
      completionPercentage: sortedBest[0].rawCompletionPercentage,
      completedCount: sortedBest[0].completedCount,
    };

    const sortedWorst = [...activeDaysList].sort((a, b) => a.rawCompletionPercentage - b.rawCompletionPercentage);
    worstDay = {
      date: sortedWorst[0].date,
      completionPercentage: sortedWorst[0].rawCompletionPercentage,
      completedCount: sortedWorst[0].completedCount,
    };
  }

  // Deterministic Trend Calculation
  const halfWindow = Math.floor(daysWindow / 2);
  const midDateObj = new Date(startDateObj.getTime() + halfWindow * 86400000);
  const midDateStr = midDateObj.toISOString().split('T')[0];

  const priorPeriodAdherences = dailyAdherences.filter((d) => d.date < midDateStr);
  const recentPeriodAdherences = dailyAdherences.filter((d) => d.date >= midDateStr);

  const priorAvg =
    priorPeriodAdherences.length > 0
      ? priorPeriodAdherences.reduce((acc, d) => acc + d.capacityAdherencePercentage, 0) / priorPeriodAdherences.length
      : averageCapacityAdherence;

  const recentAvg =
    recentPeriodAdherences.length > 0
      ? recentPeriodAdherences.reduce((acc, d) => acc + d.capacityAdherencePercentage, 0) / recentPeriodAdherences.length
      : averageCapacityAdherence;

  const deltaPct = Math.round(recentAvg - priorAvg);
  let direction = 'STABLE';
  if (deltaPct >= 3) direction = 'IMPROVING';
  else if (deltaPct <= -3) direction = 'DECLINING';

  return {
    daysWindow,
    startDate: startDateStr,
    endDate: targetEnd,
    totalDays: daysWindow,
    recordedDaysCount,
    activeDays,
    zeroExecutionDays: Math.max(0, daysWindow - activeDays),
    totalScheduledTasks,
    totalCompletedTasks,
    totalSkippedTasks,
    totalMissedTasks,
    totalDeferredTasks,
    averageRawAdherence,
    averageCapacityAdherence,
    highPriorityAdherence,
    bestDay,
    worstDay,
    trend: {
      direction,
      deltaPct,
      recentAvg: Math.round(recentAvg),
      priorAvg: Math.round(priorAvg),
    },
  };
}

/**
 * Calculates execution streaks (current and longest) from historical daily execution records.
 */
export function calculateExecutionStreaks(dailyAdherenceList = []) {
  if (!Array.isArray(dailyAdherenceList) || dailyAdherenceList.length === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  // Sort chronologically by date ascending
  const sorted = [...dailyAdherenceList].sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;

  for (let i = 0; i < sorted.length; i++) {
    const d = sorted[i];

    // Rule: Day is valid for streak if capacityAdherence >= 70 OR rawCompletion >= 70 OR
    // (under REST_RECOVERY/MINIMUM_VIABLE: highPriorityCompletedCount >= 1)
    const isValid =
      d.capacityAdherencePercentage >= 70 ||
      d.rawCompletionPercentage >= 70 ||
      ((d.capacityMode === 'REST_RECOVERY' || d.capacityMode === 'MINIMUM_VIABLE') && d.highPriorityCompletedCount >= 1);

    if (isValid) {
      tempStreak++;
      if (tempStreak > longestStreak) {
        longestStreak = tempStreak;
      }
    } else {
      tempStreak = 0;
    }
  }

  // Calculate current streak ending on latest date
  currentStreak = tempStreak;

  return {
    currentStreak,
    longestStreak,
  };
}

/**
 * Calculates Life-Area adherence using existing life_areas records and task/goal mappings.
 */
export async function calculateLifeAreaAdherence(dbClient, userId, daysWindow = 30) {
  const targetEnd = new Date().toISOString().split('T')[0];
  const startDateObj = new Date(Date.now() - (daysWindow - 1) * 86400000);
  const startDateStr = startDateObj.toISOString().split('T')[0];

  // 1. Fetch user life areas (or default set if empty)
  let dbLifeAreas = await dbClient
    .select()
    .from(lifeAreas)
    .where(eq(lifeAreas.userId, userId));

  if (dbLifeAreas.length === 0) {
    dbLifeAreas = [
      { key: 'PHYSICAL', name: 'Physical Transformation', color: '#3B82F6' },
      { key: 'SKINCARE_GROOMING', name: 'Skin & Hair Protocol', color: '#10B981' },
      { key: 'FITNESS_NUTRITION', name: 'Fitness & Anabolic Nutrition', color: '#F59E0B' },
      { key: 'DATA_ENGINEERING', name: 'Data Engineering & Tech', color: '#8B5CF6' },
      { key: 'FINANCE', name: 'Financial Independence', color: '#06B6D4' },
      { key: 'CAREER_PROJECTS', name: 'Career & Projects', color: '#EC4899' },
      { key: 'SPIRITUAL_MINDFULNESS', name: 'Spiritual Grounding & Mindfulness', color: '#6366F1' },
      { key: 'PERSONAL_DEVELOPMENT', name: 'Habits & Self-Mastery', color: '#64748B' },
    ];
  }

  const lifeAreaMap = new Map(dbLifeAreas.map((la) => [la.key, la]));

  // 2. Fetch daily executions & task executions in window
  const dailyRecords = await dbClient
    .select()
    .from(dailyExecutions)
    .where(
      and(
        eq(dailyExecutions.userId, userId),
        gte(dailyExecutions.date, startDateStr),
        lte(dailyExecutions.date, targetEnd)
      )
    );

  const dailyIds = dailyRecords.map((d) => d.id);
  let taskRecords = [];
  if (dailyIds.length > 0) {
    taskRecords = await dbClient
      .select()
      .from(taskExecutions)
      .where(inArray(taskExecutions.dailyExecutionId, dailyIds));
  }

  // 3. Fetch goals & goal_task_mappings for lifeArea linkage
  const userGoals = await dbClient
    .select()
    .from(goals)
    .where(eq(goals.userId, userId));

  const goalMap = new Map(userGoals.map((g) => [g.id, g]));

  const goalMappings = await dbClient
    .select()
    .from(goalTaskMappings)
    .where(eq(goalTaskMappings.userId, userId));

  const taskGoalMap = new Map();
  goalMappings.forEach((m) => {
    const parentGoal = goalMap.get(m.goalId);
    if (parentGoal && parentGoal.lifeAreaId) {
      taskGoalMap.set(m.taskKey, parentGoal.lifeAreaId);
    }
  });

  // Category -> Life Area Key Mapping helper
  const mapCategoryToLifeAreaKey = (category = '', taskKey = '') => {
    const catUpper = category.toUpperCase();
    const keyLower = taskKey.toLowerCase();

    if (catUpper === 'NAMAZ' || catUpper === 'SPIRITUAL' || keyLower.startsWith('namaz_')) {
      return 'SPIRITUAL_MINDFULNESS';
    }
    if (catUpper === 'DATA_ENG' || keyLower.includes('de_') || keyLower.includes('python')) {
      return 'DATA_ENGINEERING';
    }
    if (catUpper === 'WORKOUT' || catUpper === 'NUTRITION' || keyLower.includes('shake')) {
      return 'FITNESS_NUTRITION';
    }
    if (catUpper === 'SKINCARE' || catUpper === 'GROOMING') {
      return 'SKINCARE_GROOMING';
    }
    if (catUpper === 'FINANCE') {
      return 'FINANCE';
    }
    if (catUpper === 'CAREER') {
      return 'CAREER_PROJECTS';
    }
    if (catUpper === 'PHYSICAL') {
      return 'PHYSICAL';
    }
    return 'PERSONAL_DEVELOPMENT';
  };

  // Aggregation per life area
  const areaStats = new Map();
  dbLifeAreas.forEach((la) => {
    areaStats.set(la.key, {
      id: la.id || `la_${userId}_${la.key.toLowerCase()}`,
      key: la.key,
      name: la.name,
      color: la.color || '#64748B',
      scheduledCount: 0,
      completedCount: 0,
      adherencePercentage: 0,
    });
  });

  taskRecords.forEach((t) => {
    let targetAreaKey = 'PERSONAL_DEVELOPMENT';

    // Check direct goal mapping first
    const mappedAreaId = taskGoalMap.get(t.taskKey);
    if (mappedAreaId) {
      const foundArea = dbLifeAreas.find((a) => a.id === mappedAreaId || a.key === mappedAreaId);
      if (foundArea) targetAreaKey = foundArea.key;
    } else {
      targetAreaKey = mapCategoryToLifeAreaKey(t.category, t.taskKey);
    }

    if (!areaStats.has(targetAreaKey)) {
      areaStats.set(targetAreaKey, {
        id: `la_${userId}_${targetAreaKey.toLowerCase()}`,
        key: targetAreaKey,
        name: targetAreaKey.replace('_', ' '),
        color: '#64748B',
        scheduledCount: 0,
        completedCount: 0,
        adherencePercentage: 0,
      });
    }

    const stat = areaStats.get(targetAreaKey);
    stat.scheduledCount++;
    if (t.status === 'COMPLETED') {
      stat.completedCount++;
    }
  });

  const resultAreas = Array.from(areaStats.values()).map((stat) => ({
    ...stat,
    adherencePercentage:
      stat.scheduledCount > 0 ? Math.round((stat.completedCount / stat.scheduledCount) * 100) : 0,
  }));

  const activeAreas = resultAreas.filter((a) => a.scheduledCount > 0);

  let strongestArea = null;
  let weakestArea = null;

  if (activeAreas.length > 0) {
    const sortedStrongest = [...activeAreas].sort((a, b) => b.adherencePercentage - a.adherencePercentage);
    strongestArea = {
      key: sortedStrongest[0].key,
      name: sortedStrongest[0].name,
      adherencePercentage: sortedStrongest[0].adherencePercentage,
    };

    const sortedWeakest = [...activeAreas].sort((a, b) => a.adherencePercentage - b.adherencePercentage);
    weakestArea = {
      key: sortedWeakest[0].key,
      name: sortedWeakest[0].name,
      adherencePercentage: sortedWeakest[0].adherencePercentage,
    };
  }

  return {
    daysWindow,
    lifeAreas: resultAreas,
    strongestArea,
    weakestArea,
  };
}

/**
 * Calculates Task Reliability metrics by aggregating historical task execution data per taskKey.
 */
export async function calculateTaskReliability(dbClient, userId, daysWindow = 30) {
  const targetEnd = new Date().toISOString().split('T')[0];
  const startDateObj = new Date(Date.now() - (daysWindow - 1) * 86400000);
  const startDateStr = startDateObj.toISOString().split('T')[0];

  const recent7DateObj = new Date(Date.now() - 6 * 86400000);
  const recent7DateStr = recent7DateObj.toISOString().split('T')[0];

  const dailyRecords = await dbClient
    .select()
    .from(dailyExecutions)
    .where(
      and(
        eq(dailyExecutions.userId, userId),
        gte(dailyExecutions.date, startDateStr),
        lte(dailyExecutions.date, targetEnd)
      )
    );

  const dailyMap = new Map(dailyRecords.map((d) => [d.id, d.date]));
  const dailyIds = dailyRecords.map((d) => d.id);

  let taskRecords = [];
  if (dailyIds.length > 0) {
    taskRecords = await dbClient
      .select()
      .from(taskExecutions)
      .where(inArray(taskExecutions.dailyExecutionId, dailyIds));
  }

  const taskStats = new Map();

  taskRecords.forEach((t) => {
    const key = t.taskKey;
    if (!taskStats.has(key)) {
      taskStats.set(key, {
        taskKey: key,
        taskName: t.taskName || key,
        category: t.category,
        scheduledOccurrences: 0,
        completedOccurrences: 0,
        skippedOccurrences: 0,
        missedOccurrences: 0,
        recentScheduledCount: 0,
        recentCompletedCount: 0,
      });
    }

    const stat = taskStats.get(key);
    stat.scheduledOccurrences++;

    if (t.status === 'COMPLETED') stat.completedOccurrences++;
    else if (t.status === 'SKIPPED') stat.skippedOccurrences++;
    else if (t.status === 'MISSED') stat.missedOccurrences++;

    const date = dailyMap.get(t.dailyExecutionId);
    if (date && date >= recent7DateStr) {
      stat.recentScheduledCount++;
      if (t.status === 'COMPLETED') stat.recentCompletedCount++;
    }
  });

  const reliabilityList = Array.from(taskStats.values()).map((stat) => {
    const completionRate =
      stat.scheduledOccurrences > 0
        ? Math.round((stat.completedOccurrences / stat.scheduledOccurrences) * 100)
        : 0;

    const recentCompletionRate =
      stat.recentScheduledCount > 0
        ? Math.round((stat.recentCompletedCount / stat.recentScheduledCount) * 100)
        : completionRate;

    let reliabilityGrade = 'MEDIUM';
    if (completionRate >= 80) reliabilityGrade = 'HIGH';
    else if (completionRate < 50) reliabilityGrade = 'LOW';

    return {
      taskKey: stat.taskKey,
      taskName: stat.taskName,
      category: stat.category,
      scheduledOccurrences: stat.scheduledOccurrences,
      completedOccurrences: stat.completedOccurrences,
      skippedOccurrences: stat.skippedOccurrences,
      missedOccurrences: stat.missedOccurrences,
      failureCount: stat.skippedOccurrences + stat.missedOccurrences,
      completionRate,
      recentCompletionRate,
      reliabilityGrade,
    };
  });

  // Sort by scheduledOccurrences descending
  reliabilityList.sort((a, b) => b.scheduledOccurrences - a.scheduledOccurrences);

  return {
    daysWindow,
    totalTaskTypes: reliabilityList.length,
    tasks: reliabilityList,
  };
}

/**
 * Calculates Goal Execution Adherence for active goals based on mapped task completion rates.
 */
export async function calculateGoalExecutionAdherence(dbClient, userId, daysWindow = 30) {
  const activeGoals = await dbClient
    .select()
    .from(goals)
    .where(and(eq(goals.userId, userId), inArray(goals.status, ['PLANNED', 'ACTIVE', 'AT_RISK'])));

  if (activeGoals.length === 0) {
    return { daysWindow, goals: [] };
  }

  const goalIds = activeGoals.map((g) => g.id);

  const mappings = await dbClient
    .select()
    .from(goalTaskMappings)
    .where(and(eq(goalTaskMappings.userId, userId), inArray(goalTaskMappings.goalId, goalIds)));

  const targetEnd = new Date().toISOString().split('T')[0];
  const startDateObj = new Date(Date.now() - (daysWindow - 1) * 86400000);
  const startDateStr = startDateObj.toISOString().split('T')[0];

  const dailyRecords = await dbClient
    .select()
    .from(dailyExecutions)
    .where(
      and(
        eq(dailyExecutions.userId, userId),
        gte(dailyExecutions.date, startDateStr),
        lte(dailyExecutions.date, targetEnd)
      )
    );

  const dailyIds = dailyRecords.map((d) => d.id);
  let taskRecords = [];
  if (dailyIds.length > 0) {
    taskRecords = await dbClient
      .select()
      .from(taskExecutions)
      .where(inArray(taskExecutions.dailyExecutionId, dailyIds));
  }

  const taskExecMap = new Map();
  taskRecords.forEach((t) => {
    if (!taskExecMap.has(t.taskKey)) taskExecMap.set(t.taskKey, []);
    taskExecMap.get(t.taskKey).push(t);
  });

  const goalResults = activeGoals.map((goal) => {
    const gMappings = mappings.filter((m) => m.goalId === goal.id);
    if (gMappings.length === 0) {
      return {
        goalId: goal.id,
        title: goal.title,
        level: goal.level,
        status: goal.status,
        mappedTaskCount: 0,
        executionAdherencePct: 0,
      };
    }

    let totalWeight = 0;
    let completedWeight = 0;

    gMappings.forEach((mapItem) => {
      const weight = Math.max(1, Number(mapItem.weight) || 1);
      totalWeight += weight;

      const execs = taskExecMap.get(mapItem.taskKey) || [];
      if (execs.length > 0) {
        const completedCount = execs.filter((e) => e.status === 'COMPLETED').length;
        const taskRate = completedCount / execs.length;
        completedWeight += weight * taskRate;
      }
    });

    const executionAdherencePct =
      totalWeight > 0 ? Math.max(0, Math.min(100, Math.round((completedWeight / totalWeight) * 100))) : 0;

    return {
      goalId: goal.id,
      title: goal.title,
      level: goal.level,
      status: goal.status,
      mappedTaskCount: gMappings.length,
      executionAdherencePct,
    };
  });

  return {
    daysWindow,
    goals: goalResults,
  };
}

/**
 * Main Authoritative Entry Point: Aggregates complete unified progress overview for a user.
 */
export async function getUserUnifiedProgressOverview(dbClient, userId, daysWindow = 30) {
  const todayStr = new Date().toISOString().split('T')[0];

  // Fetch today's execution record
  const [todayRecord] = await dbClient
    .select()
    .from(dailyExecutions)
    .where(and(eq(dailyExecutions.userId, userId), eq(dailyExecutions.date, todayStr)))
    .limit(1);

  let todayTasks = [];
  if (todayRecord) {
    todayTasks = await dbClient
      .select()
      .from(taskExecutions)
      .where(eq(taskExecutions.dailyExecutionId, todayRecord.id));
  }

  const todayAdherence = calculateDailyAdherence(todayRecord, todayTasks);

  // Fetch Window Adherence for 7, 30, 90 days
  const window7 = await calculateWindowAdherence(dbClient, userId, 7, todayStr);
  const window30 = await calculateWindowAdherence(dbClient, userId, 30, todayStr);
  const window90 = await calculateWindowAdherence(dbClient, userId, 90, todayStr);

  // Fetch all daily adherence for streak calculation
  const allDailyRecords = await dbClient
    .select()
    .from(dailyExecutions)
    .where(eq(dailyExecutions.userId, userId))
    .orderBy(asc(dailyExecutions.date));

  const allDailyIds = allDailyRecords.map((d) => d.id);
  let allTaskRecords = [];
  if (allDailyIds.length > 0) {
    allTaskRecords = await dbClient
      .select()
      .from(taskExecutions)
      .where(inArray(taskExecutions.dailyExecutionId, allDailyIds));
  }

  const tasksByDailyId = new Map();
  allTaskRecords.forEach((t) => {
    if (!tasksByDailyId.has(t.dailyExecutionId)) tasksByDailyId.set(t.dailyExecutionId, []);
    tasksByDailyId.get(t.dailyExecutionId).push(t);
  });

  const dailyAdherenceList = allDailyRecords.map((d) => {
    const dTasks = tasksByDailyId.get(d.id) || [];
    return calculateDailyAdherence(d, dTasks);
  });

  const streaks = calculateExecutionStreaks(dailyAdherenceList);

  // Life Area & Task Reliability & Goal Integration
  const lifeAreaOverview = await calculateLifeAreaAdherence(dbClient, userId, daysWindow);
  const taskReliability = await calculateTaskReliability(dbClient, userId, daysWindow);
  const goalAdherence = await calculateGoalExecutionAdherence(dbClient, userId, daysWindow);

  // Failure Pattern Integration
  const failurePatterns = await calculateFailurePatterns(userId, Math.ceil(daysWindow / 7));

  return {
    userId,
    todayDate: todayStr,
    today: todayAdherence,
    streaks,
    windows: {
      days7: window7,
      days30: window30,
      days90: window90,
    },
    lifeAreaAdherence: lifeAreaOverview,
    taskReliability,
    goalExecutionAdherence: goalAdherence,
    failurePatterns,
  };
}
