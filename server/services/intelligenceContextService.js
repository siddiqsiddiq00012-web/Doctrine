import { db } from '../db/index.js';
import {
  dailyExecutions,
  taskExecutions,
  dailyAdaptations,
  cartItems,
  financialTransactions,
  financialPreferences,
  goals
} from '../db/schema.js';
import { eq, and, gte, lte, inArray, desc } from 'drizzle-orm';
import {
  calculateDailyAdherence,
  calculateWindowAdherence,
  calculateExecutionStreaks,
  calculateLifeAreaAdherence,
  calculateTaskReliability,
  calculateGoalExecutionAdherence
} from './adherenceEngine.js';
import { calculateResourceForecasts } from './resourceForecastService.js';
import { calculateFailurePatterns } from './failurePatternService.js';
import { calculateFinancialState } from './financialEngine.js';
import { generateDeterministicPlan } from './planningEngine.js';

/**
 * DOCTRINE INTELLIGENCE CONTEXT SERVICE
 * Authoritative context builder for intelligence and decision layers.
 * Gathers structured, bounded facts from verified deterministic domain services.
 *
 * CRITICAL ARCHITECTURAL GUARANTEES:
 * 1. ZERO LLM RE-CALCULATION: Fact sources are 100% deterministic backend services.
 * 2. BOUNDED CONTEXT: Contains only metrics and facts necessary for decision-making.
 * 3. SECURITY & PRIVACY: Zero secrets, zero passwords, zero session tokens, zero API keys.
 * 4. MULTI-TENANT ISOLATION: Strict userId scoping across all queries and services.
 */

/**
 * Builds a structured, bounded intelligence context object for a given user.
 */
export async function buildIntelligenceContext(dbClient = db, userId, options = {}) {
  if (!userId) {
    throw new Error('[IntelligenceContext] userId is required');
  }

  const daysWindow = options.daysWindow ? Math.min(90, Math.max(7, Number(options.daysWindow))) : 30;
  const todayStr = options.date || new Date().toISOString().split('T')[0];

  // 1. TODAY EXECUTION & CAPACITY
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

  const capacityMode = todayRecord?.currentCapacityMode || 'NORMAL';
  const todayAdherence = calculateDailyAdherence(todayRecord, todayTasks, capacityMode);

  // 2. RECENT ADAPTATIONS
  const recentAdaptations = await dbClient
    .select()
    .from(dailyAdaptations)
    .where(eq(dailyAdaptations.userId, userId))
    .orderBy(desc(dailyAdaptations.createdAt))
    .limit(5);

  // 3. ADHERENCE & WINDOW METRICS
  const window7 = await calculateWindowAdherence(dbClient, userId, 7, todayStr);
  const window30 = await calculateWindowAdherence(dbClient, userId, 30, todayStr);
  const window90 = await calculateWindowAdherence(dbClient, userId, 90, todayStr);

  // 4. STREAKS
  const dailyRecords = await dbClient
    .select()
    .from(dailyExecutions)
    .where(eq(dailyExecutions.userId, userId))
    .orderBy(desc(dailyExecutions.date));

  const dailyAdherenceList = dailyRecords.map((d) => calculateDailyAdherence(d, []));
  const streaks = calculateExecutionStreaks(dailyAdherenceList);

  // 5. LIFE AREA ADHERENCE
  const lifeAreaOverview = await calculateLifeAreaAdherence(dbClient, userId, daysWindow);

  // 6. TASK RELIABILITY
  const reliabilityOverview = await calculateTaskReliability(dbClient, userId, daysWindow);
  const lowReliabilityTasks = (reliabilityOverview.tasks || []).filter((t) => t.reliabilityGrade === 'LOW' || t.completionRate < 50);

  // 7. GOAL PROGRESS & EXECUTION
  const goalOverview = await calculateGoalExecutionAdherence(dbClient, userId, daysWindow);

  // 8. RESOURCE FORECAST & ACTIVE CART
  const resourceOverview = await calculateResourceForecasts(dbClient, userId);
  const activeCart = await dbClient
    .select()
    .from(cartItems)
    .where(and(eq(cartItems.userId, userId), inArray(cartItems.status, ['PENDING', 'APPROVED'])));

  const activeCartCostPaise = activeCart.reduce((sum, item) => sum + (item.estimatedPricePaise || 0), 0);
  const activeCartResourceIds = new Set(
    activeCart.flatMap((c) => [c.resourceId, c.id, c.itemName ? c.itemName.toLowerCase() : null]).filter(Boolean)
  );

  // Enriched resource alerts
  const constrainedResources = (resourceOverview.resources || []).filter((r) => {
    const daysToDep = r.forecast?.daysToDepletion;
    const recQty = r.forecast?.recommendedPurchaseQty || 0;
    return r.currentQty <= r.minStockLevel || recQty > 0 || (daysToDep !== null && daysToDep <= 7);
  }).map((r) => ({
    id: r.id,
    resourceId: r.resourceId,
    name: r.name,
    currentQty: r.currentQty,
    minStockLevel: r.minStockLevel,
    daysToDepletion: r.forecast?.daysToDepletion,
    recommendedPurchaseQty: r.forecast?.recommendedPurchaseQty,
    inCart: Boolean(r.inCart) ||
      activeCartResourceIds.has(r.id) ||
      (r.resourceId && activeCartResourceIds.has(r.resourceId)) ||
      (r.name && activeCartResourceIds.has(r.name.toLowerCase())),
  }));

  // 9. FINANCIAL STATE
  let financialState = { spendableCashPaise: 0, reserveBalancePaise: 0, netCashPaise: 0, unconfigured: true };
  try {
    financialState = await calculateFinancialState(dbClient, userId, todayStr);
  } catch (err) {
    // Graceful financial state retrieval
  }

  // 10. FAILURE PATTERNS
  let failureOverview = { totalFailures: 0, breakdown: [], primaryPattern: null };
  try {
    failureOverview = await calculateFailurePatterns(userId, Math.ceil(daysWindow / 7));
  } catch (err) {
    // Graceful failure pattern retrieval
  }

  // 11. DETERMINISTIC SCHEDULE-DRIVEN PLAN
  let plan = null;
  try {
    plan = await generateDeterministicPlan(dbClient, userId, todayStr, 7);
  } catch (err) {
    // Graceful plan retrieval
  }

  // Bounded, validated context output
  return {
    userId,
    generatedAt: new Date().toISOString(),
    todayDate: todayStr,
    plan,
    execution: {
      capacityMode,
      todayAdherence,
      todayScheduledTasksCount: todayAdherence.scheduledCount,
      todayCompletedTasksCount: todayAdherence.completedCount,
    },
    adherence: {
      days7: window7,
      days30: window30,
      days90: window90,
      trend: window30.trend,
    },
    streaks,
    lifeAreas: lifeAreaOverview,
    taskReliability: {
      totalTaskTypes: reliabilityOverview.totalTaskTypes,
      lowReliabilityTasks,
      allTasks: reliabilityOverview.tasks,
    },
    goals: goalOverview,
    resources: {
      totalItems: resourceOverview.totalItems,
      constrainedCount: constrainedResources.length,
      constrainedResources,
      activeCartCount: activeCart.length,
      activeCartCostPaise,
    },
    finances: {
      spendableCashPaise: financialState.spendableCashPaise || 0,
      reserveBalancePaise: financialState.reserveBalancePaise || 0,
      netCashPaise: financialState.netCashPaise || 0,
      activeCartCostPaise,
      isDeficit: (financialState.netCashPaise || 0) < 0,
    },
    failures: {
      totalFailures: failureOverview.totalFailures || 0,
      primaryPattern: failureOverview.primaryPattern || null,
      breakdown: failureOverview.breakdown || [],
    },
    capacity: {
      mode: capacityMode,
      recentAdaptations,
    },
  };
}
