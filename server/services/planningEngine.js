import { db } from '../db/index.js';
import {
  schedules,
  scheduleEntries,
  tasks,
  taskResourceRequirements,
  resourceStock,
  cartItems,
  dailyExecutions,
  taskExecutions
} from '../db/schema.js';
import { eq, and, inArray, asc } from 'drizzle-orm';
import { INITIAL_INVENTORY } from '../../src/data/doctrineData.js';
import { calculateFinancialState } from './financialEngine.js';
import { calculateTaskReliability } from './adherenceEngine.js';
import { rupeesToPaise, paiseToRupees } from '../utils/money.js';

const DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

/**
 * Converts HH:MM or startMinutes into formatted 12-hour AM/PM string (e.g. 510 -> "8:30 AM")
 */
function formatMinutesToTimeString(startMinutes) {
  if (startMinutes === null || startMinutes === undefined || isNaN(startMinutes)) {
    return 'Flexible Time';
  }
  const hours = Math.floor(startMinutes / 60);
  const minutes = startMinutes % 60;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 === 0 ? 12 : hours % 12;
  const displayMinutes = String(minutes).padStart(2, '0');
  return `${displayHours}:${displayMinutes} ${ampm}`;
}

/**
 * Helper to add N days to a date string YYYY-MM-DD
 */
function addDaysToDateStr(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
}

/**
 * 1. FUTURE SCHEDULE RESOLUTION FOR A SINGLE DATE
 * Resolves all active scheduled tasks for a given user and dateStr (YYYY-MM-DD).
 */
export async function resolveScheduledTasksForDate(dbClient = db, userId, dateStr) {
  if (!userId || typeof userId !== 'string') {
    throw new Error('[PlanningEngine] userId is required');
  }
  if (!dateStr || typeof dateStr !== 'string') {
    throw new Error('[PlanningEngine] dateStr string is required');
  }

  const targetDate = new Date(`${dateStr}T00:00:00Z`);
  if (isNaN(targetDate.getTime())) {
    throw new Error(`[PlanningEngine] Invalid dateStr: ${dateStr}`);
  }
  const dayOfWeek = DAYS[targetDate.getUTCDay()];

  // Fetch all user schedules
  const userSchedules = await dbClient
    .select()
    .from(schedules)
    .where(eq(schedules.userId, userId));

  if (userSchedules.length === 0) {
    return [];
  }

  // Filter active schedules based on date boundaries & default status
  const activeSchedules = userSchedules.filter((s) => {
    if (s.activeFromDate && dateStr < s.activeFromDate) return false;
    if (s.activeToDate && dateStr > s.activeToDate) return false;
    return true;
  });

  const activeScheduleIds = activeSchedules.map((s) => s.id);
  if (activeScheduleIds.length === 0) {
    return [];
  }

  // Fetch schedule entries joined with task definitions
  const entriesWithTasks = await dbClient
    .select({
      entryId: scheduleEntries.id,
      scheduleId: scheduleEntries.scheduleId,
      taskId: scheduleEntries.taskId,
      timingType: scheduleEntries.timingType,
      recurrencePattern: scheduleEntries.recurrencePattern,
      dayOfWeek: scheduleEntries.dayOfWeek,
      activeDate: scheduleEntries.activeDate,
      startMinutes: scheduleEntries.startMinutes,
      endMinutes: scheduleEntries.endMinutes,
      sortOrder: scheduleEntries.sortOrder,
      taskKey: tasks.taskKey,
      title: tasks.title,
      category: tasks.category,
      defaultPriority: tasks.defaultPriority,
      defaultDurationMinutes: tasks.defaultDurationMinutes
    })
    .from(scheduleEntries)
    .innerJoin(tasks, eq(scheduleEntries.taskId, tasks.id))
    .where(inArray(scheduleEntries.scheduleId, activeScheduleIds))
    .orderBy(asc(scheduleEntries.startMinutes), asc(scheduleEntries.sortOrder));

  // Filter entries matching the specific target date
  const resolvedTasks = [];
  const scheduleMap = new Map(userSchedules.map((s) => [s.id, s]));

  for (const entry of entriesWithTasks) {
    let matchesDate = false;

    if (entry.recurrencePattern === 'DAILY') {
      matchesDate = true;
    } else if (entry.recurrencePattern === 'WEEKLY') {
      matchesDate = entry.dayOfWeek === dayOfWeek;
    } else if (entry.recurrencePattern === 'DATE_RANGE') {
      matchesDate = entry.activeDate === dateStr;
    }

    if (matchesDate) {
      const sched = scheduleMap.get(entry.scheduleId);
      resolvedTasks.push({
        date: dateStr,
        dayOfWeek,
        entryId: entry.entryId,
        scheduleId: entry.scheduleId,
        scheduleName: sched ? sched.name : 'Schedule',
        taskId: entry.taskId,
        taskKey: entry.taskKey,
        title: entry.title,
        category: entry.category,
        priority: entry.defaultPriority || 1,
        timingType: entry.timingType || 'FIXED',
        startMinutes: entry.startMinutes,
        endMinutes: entry.endMinutes,
        durationMinutes: entry.defaultDurationMinutes || 30,
        formattedTime: formatMinutesToTimeString(entry.startMinutes)
      });
    }
  }

  // Sort chronologically by startMinutes (nulls last) and priority ASC
  resolvedTasks.sort((a, b) => {
    if (a.startMinutes !== null && b.startMinutes !== null) {
      return a.startMinutes - b.startMinutes;
    }
    if (a.startMinutes !== null) return -1;
    if (b.startMinutes !== null) return 1;
    return (a.sortOrder || 0) - (b.sortOrder || 0);
  });

  return resolvedTasks;
}

/**
 * 2. RESOLVE UPCOMING SCHEDULE OVER A DATE RANGE (Bounded Horizon)
 */
export async function resolveUpcomingSchedule(dbClient = db, userId, startDateStr, endDateStr) {
  if (!startDateStr || !endDateStr) {
    throw new Error('[PlanningEngine] startDateStr and endDateStr are required');
  }

  const resolvedHorizon = [];
  let currDateStr = startDateStr;

  while (currDateStr <= endDateStr) {
    const dayTasks = await resolveScheduledTasksForDate(dbClient, userId, currDateStr);
    resolvedHorizon.push(...dayTasks);
    currDateStr = addDaysToDateStr(currDateStr, 1);
  }

  return resolvedHorizon;
}

/**
 * 3. 7-DAY RESOURCE DEMAND PROJECTION & SUFFICIENCY ANALYSIS
 */
export async function projectResourceDemand(dbClient = db, userId, resolvedTasks) {
  if (!userId) {
    throw new Error('[PlanningEngine] userId is required');
  }

  if (!resolvedTasks || resolvedTasks.length === 0) {
    return { demandMap: new Map(), demandItems: [] };
  }

  // Extract unique task keys
  const uniqueTaskKeys = Array.from(new Set(resolvedTasks.map((t) => t.taskKey)));

  // Batch query task resource requirements
  const requirements = await dbClient
    .select()
    .from(taskResourceRequirements)
    .where(and(eq(taskResourceRequirements.userId, userId), inArray(taskResourceRequirements.taskKey, uniqueTaskKeys)));

  const reqMap = new Map();
  requirements.forEach((req) => {
    if (!reqMap.has(req.taskKey)) {
      reqMap.set(req.taskKey, []);
    }
    reqMap.get(req.taskKey).push(req);
  });

  // Aggregate resource demands by resourceId
  const demandMap = new Map();

  for (const task of resolvedTasks) {
    const taskReqs = reqMap.get(task.taskKey) || [];

    for (const req of taskReqs) {
      const resId = req.resourceId;
      const qty = Number(req.quantityConsumed || 0);

      if (!demandMap.has(resId)) {
        demandMap.set(resId, {
          resourceId: resId,
          totalDemandQty: 0,
          unit: req.unit,
          firstRequiredDate: task.date,
          firstAffectedTaskKey: task.taskKey,
          firstAffectedTaskTitle: task.title,
          occurrences: []
        });
      }

      const resDemand = demandMap.get(resId);
      resDemand.totalDemandQty += qty;
      resDemand.occurrences.push({
        date: task.date,
        taskKey: task.taskKey,
        title: task.title,
        qty,
        unit: req.unit
      });
    }
  }

  const demandItems = Array.from(demandMap.values());
  return { demandMap, demandItems };
}

/**
 * 4. DETERMINISTIC PLANNING ENGINE — MAIN ENTRY POINT
 * Evaluates upcoming schedule, resource demand, inventory stock, cart intent, financial state,
 * and task reliability to produce a bounded, structured Daily Action Plan.
 */
export async function generateDeterministicPlan(dbClient = db, userId, targetDateStr = null, horizonDays = 7) {
  if (!userId) {
    throw new Error('[PlanningEngine] userId is required');
  }

  const todayStr = targetDateStr || new Date().toISOString().split('T')[0];
  const tomorrowStr = addDaysToDateStr(todayStr, 1);
  const horizonEndStr = addDaysToDateStr(todayStr, horizonDays - 1);

  // 1. Resolve Upcoming Schedule for 7-Day Horizon
  const horizonTasks = await resolveUpcomingSchedule(dbClient, userId, todayStr, horizonEndStr);
  const todayScheduledTasks = horizonTasks.filter((t) => t.date === todayStr);
  const tomorrowScheduledTasks = horizonTasks.filter((t) => t.date === tomorrowStr);

  // 2. Project Resource Demand over 7-Day Horizon
  const { demandMap } = await projectResourceDemand(dbClient, userId, horizonTasks);

  // 3. Fetch Current Inventory Stock & Active Cart Items
  const dbStocks = await dbClient
    .select()
    .from(resourceStock)
    .where(eq(resourceStock.userId, userId));

  const stockMap = new Map(dbStocks.map((s) => [s.resourceId, s]));

  const activeCart = await dbClient
    .select()
    .from(cartItems)
    .where(and(eq(cartItems.userId, userId), inArray(cartItems.status, ['PENDING', 'APPROVED'])));

  const activeCartResourceIds = new Set(
    activeCart.flatMap((c) => [c.resourceId, c.id, c.itemName ? c.itemName.toLowerCase() : null]).filter(Boolean)
  );

  // 4. Fetch Financial State (Morning Planned Capacity & Cash)
  let financialState = null;
  try {
    financialState = await calculateFinancialState(dbClient, userId, todayStr);
  } catch (err) {
    // Graceful financial fallback if unconfigured
  }

  const spendableCashPaise = financialState?.cash?.spendableCashPaise || 0;
  const plannedCapacityPaise = financialState?.morningPlan?.plannedCapacityPaise || 0;
  const planningAvailablePaise = Math.max(spendableCashPaise, plannedCapacityPaise);

  // 5. Fetch Task Reliability Data
  let reliabilityMap = new Map();
  try {
    const relOverview = await calculateTaskReliability(dbClient, userId, 30);
    (relOverview.tasks || []).forEach((t) => reliabilityMap.set(t.taskKey, t));
  } catch (err) {
    // Graceful reliability fallback
  }

  // Fetch authoritative resource forecasts for weekly consumption & stock rules
  let forecastMap = new Map();
  try {
    const forecastResult = await calculateResourceForecasts(dbClient, userId);
    (forecastResult.resources || []).forEach((r) => forecastMap.set(r.id, r));
  } catch (err) {
    // Graceful forecast fallback
  }

  // 6. SUFFICIENCY ANALYSIS & PURCHASE RECOMMENDATIONS (WHAT TO BUY THIS WEEK)
  const buyToday = [];
  const alreadyHandled = [];
  const dailyPurchases = [];
  const resourceRisks = [];

  INITIAL_INVENTORY.forEach((item) => {
    if (item.id === 'inv-29') return; // Durable tool, zero depletion rate

    const stockRec = stockMap.get(item.id);
    const currentQty = stockRec ? Number(stockRec.currentQty) : Number(item.currentQty);
    const demandInfo = demandMap.get(item.id);
    const scheduleDemand = demandInfo ? demandInfo.totalDemandQty : 0;
    const forecastObj = forecastMap.get(item.id);
    const forecastData = forecastObj?.forecast || {};

    const historicalWeekly = Number(forecastData.historicalWeeklyConsumption || 0);
    const expectedWeeklyDemand = Math.round(Math.max(scheduleDemand, historicalWeekly) * 100) / 100;

    const lowStockThreshold = item.lowStockThreshold !== undefined ? item.lowStockThreshold : (item.minStockLevel || 10);
    const isLowStock = currentQty < lowStockThreshold;

    const isInCart =
      (stockRec && Boolean(stockRec.inCart)) ||
      activeCartResourceIds.has(item.id) ||
      activeCartResourceIds.has(item.name.toLowerCase());

    const unitPriceRupees = Number(item.estimatedPrice || 0);

    const shortageQty = Math.max(0, Math.round((expectedWeeklyDemand - Math.max(0, currentQty)) * 100) / 100);
    let requiredPurchaseQty = 0;

    if (shortageQty > 0 || currentQty <= lowStockThreshold) {
      const packSize = Number(item.purchaseQty || 1);
      if (shortageQty > 0) {
        requiredPurchaseQty = item.procurementMode === 'DAILY_PURCHASE' ? Math.max(1, Math.ceil(shortageQty / packSize)) : shortageQty;
      } else {
        requiredPurchaseQty = 1;
      }
    }

    const isPurchaseRequired = requiredPurchaseQty > 0;

    if (item.procurementMode === 'DAILY_PURCHASE' && !isPurchaseRequired && !(currentQty <= lowStockThreshold)) {
      return;
    }

    const estimatedPriceRupees = Math.round(requiredPurchaseQty * unitPriceRupees * 100) / 100;
    const estimatedPricePaise = rupeesToPaise(estimatedPriceRupees);

    const isAffordableInPlan = planningAvailablePaise >= estimatedPricePaise && estimatedPricePaise > 0;
    const isAffordableActual = spendableCashPaise >= estimatedPricePaise && estimatedPricePaise > 0;

    const firstReqDate = demandInfo ? demandInfo.firstRequiredDate : 'Upcoming';
    const firstTask = demandInfo ? demandInfo.firstAffectedTaskTitle : 'Scheduled Routine';

    let reason = '';
    if (isLowStock && isPurchaseRequired) {
      reason = `Low stock (${currentQty} ${item.unit} remaining) and expected weekly consumption is ${expectedWeeklyDemand} ${item.unit}.`;
    } else if (isPurchaseRequired) {
      reason = `Buy ${requiredPurchaseQty} ${item.unit} this week to cover expected consumption (${expectedWeeklyDemand} ${item.unit}/week).`;
    } else {
      reason = `No purchase required this week — inventory covers expected consumption.`;
    }

    const deficitPaise = Math.max(0, estimatedPricePaise - Math.max(0, planningAvailablePaise));

    const recommendationItem = {
      resourceId: item.id,
      itemName: item.name,
      category: item.category,
      unit: item.unit,
      currentQty,
      minStockLevel: lowStockThreshold,
      lowStockThreshold,
      isLowStock,
      isPurchaseRequired,
      expectedWeeklyDemand,
      historicalWeeklyConsumption: historicalWeekly,
      scheduleDemand,
      shortageQty,
      requiredPurchaseQty,
      recommendedPurchaseQty: requiredPurchaseQty,
      firstRequiredDate: firstReqDate,
      firstAffectedTask: firstTask,
      unitPriceRupees,
      estimatedPriceRupees,
      estimatedPricePaise,
      isAffordable: isAffordableInPlan,
      isAffordableActual,
      affordabilityNote: isAffordableActual
        ? `Affordable with current cash (₹${paiseToRupees(Math.max(0, spendableCashPaise)).toFixed(0)} available)`
        : isAffordableInPlan
        ? `Affordable within today's plan (₹${paiseToRupees(Math.max(0, plannedCapacityPaise)).toFixed(0)} planned capacity)`
        : `Deficit of ₹${paiseToRupees(deficitPaise).toFixed(0)} against plan`,
      alreadyHandled: isInCart,
      priority: isLowStock ? 1 : 2,
      reason
    };

    if (isLowStock || currentQty <= item.minStockLevel) {
      resourceRisks.push({
        resourceId: item.id,
        itemName: item.name,
        currentQty,
        minStockLevel: lowStockThreshold,
        severity: isLowStock ? 'HIGH' : 'MEDIUM'
      });
    }

    if (item.procurementMode === 'DAILY_PURCHASE') {
      dailyPurchases.push(recommendationItem);
    }

    if (isInCart && (isPurchaseRequired || currentQty <= item.minStockLevel)) {
      alreadyHandled.push(recommendationItem);
    } else if (isPurchaseRequired || currentQty <= item.minStockLevel) {
      buyToday.push(recommendationItem);
    }
  });

  // Sort buyToday by priority ASC, then firstRequiredDate ASC
  buyToday.sort((a, b) => a.priority - b.priority || a.firstRequiredDate.localeCompare(b.firstRequiredDate));

  // 7. TASK RELIABILITY & AT-RISK ANALYSIS
  const atRiskTasks = [];
  const todayTomorrowTasks = horizonTasks.filter((t) => t.date === todayStr || t.date === tomorrowStr);

  todayTomorrowTasks.forEach((t) => {
    const rel = reliabilityMap.get(t.taskKey);
    const completionRate = rel ? rel.completionRate : 100;
    const reliabilityGrade = rel ? rel.reliabilityGrade : 'HIGH';
    const failureCount = rel ? rel.failureCount : 0;

    const isLowReliability = reliabilityGrade === 'LOW' || completionRate < 50;

    if (isLowReliability) {
      atRiskTasks.push({
        taskKey: t.taskKey,
        taskId: t.taskId,
        title: t.title,
        date: t.date,
        dayOfWeek: t.dayOfWeek,
        formattedTime: t.formattedTime,
        completionRate,
        reliabilityGrade,
        failureCount,
        riskScore: Math.round(100 - completionRate),
        reason: `Historically missed ${failureCount} times over 30 days (${completionRate}% completion rate)`
      });
    }
  });

  // 8. PREPARATION SIGNALS (e.g. Fenugreek, Glow Shake, Mass Shake prep)
  const prepare = [];
  const tomorrowTasks = horizonTasks.filter((t) => t.date === tomorrowStr);

  tomorrowTasks.forEach((t) => {
    if (t.taskKey === 'glow_shake' || t.taskKey === 'mon-6') {
      prepare.push({
        taskKey: t.taskKey,
        title: t.title,
        date: todayStr,
        targetDate: tomorrowStr,
        action: 'Prepare Carrot & Beet materials for tomorrow morning Glow Shake',
        reason: 'Required for scheduled Glow Shake tomorrow morning'
      });
    } else if (t.taskKey.includes('fenugreek') || t.taskKey.includes('hair_treatment')) {
      prepare.push({
        taskKey: t.taskKey,
        title: t.title,
        date: todayStr,
        targetDate: tomorrowStr,
        action: 'Soak 1 tsp Fenugreek (Methi) seeds in water overnight',
        reason: 'Required for tomorrow\'s scheduled Hair Treatment'
      });
    }
  });

  // 9. DO NOW (TODAY'S SCHEDULED TASKS)
  const doNow = todayScheduledTasks.map((t) => ({
    taskKey: t.taskKey,
    taskId: t.taskId,
    title: t.title,
    category: t.category,
    priority: t.priority,
    formattedTime: t.formattedTime,
    durationMinutes: t.durationMinutes
  }));

  // 10. INFORMATIONAL SIGNALS
  const informational = [];
  if (buyToday.length === 0 && resourceRisks.length === 0) {
    informational.push({
      type: 'INVENTORY_STABLE',
      title: 'Inventory Stocked',
      message: 'All resource inventory levels are sufficient for upcoming scheduled tasks.'
    });
  }
  if (financialState?.cash?.netCashPaise >= 0) {
    informational.push({
      type: 'FINANCE_STABLE',
      title: 'Financial Balance Positive',
      message: `Net cash is positive (₹${paiseToRupees(financialState.cash.netCashPaise).toFixed(0)}).`
    });
  }

  // Unified Bounded Output Contract
  return {
    todayDate: todayStr,
    tomorrowDate: tomorrowStr,
    horizonDays,

    today: {
      doNow,
      buyToday,
      prepare,
      atRisk: atRiskTasks.filter((t) => t.date === todayStr),
      alreadyHandled,
      informational
    },

    tomorrow: {
      date: tomorrowStr,
      scheduledTasks: tomorrowScheduledTasks.map((t) => ({
        taskKey: t.taskKey,
        title: t.title,
        formattedTime: t.formattedTime,
        category: t.category
      })),
      resourceRisks: resourceRisks.filter((r) => r.shortageDate === tomorrowStr),
      preparation: prepare,
      atRisk: atRiskTasks.filter((t) => t.date === tomorrowStr)
    },

    horizon: {
      startDate: todayStr,
      endDate: horizonEndStr,
      scheduledTaskCount: horizonTasks.length,
      projectedResourceDemand: Array.from(demandMap.values()),
      resourceRisks
    }
  };
}
