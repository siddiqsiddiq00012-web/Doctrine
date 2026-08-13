import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { db } from '../db/index.js';
import { dailyExecutions, taskExecutions, dailySummaries, weeklyReviews, deLearningSessions, resourceStock } from '../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { WEEKLY_DOCTRINE, INITIAL_INVENTORY } from '../../src/data/doctrineData.js';

const router = Router();

// GET /api/dashboard — Aggregated Home Command Center
router.get('/', requireAuth, async (req, res) => {
  const userId = req.user.id;
  const todayDate = new Date().toISOString().split('T')[0];
  const dateObj = new Date(todayDate + 'T00:00:00');
  const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const dayOfWeek = dayNames[dateObj.getDay()];

  const dayDoctrine = WEEKLY_DOCTRINE[dayOfWeek] || WEEKLY_DOCTRINE.MONDAY;
  const dayTheme = dayDoctrine.theme || null;

  const result = {
    today: {
      date: todayDate,
      dayOfWeek,
      dayTheme,
      completionPercentage: 0,
      completedCount: 0,
      totalTasksCount: 0,
      remainingPriorities: [],
      hasRecord: false
    },
    primaryAction: {
      type: 'DOCTRINE',
      label: "Complete Today's Doctrine",
      targetTab: 'today'
    },
    dataEngineering: { status: 'ok', topic: 'Data Engineering Mastery', targetMinutes: ['MONDAY', 'WEDNESDAY', 'FRIDAY'].includes(dayOfWeek) ? 50 : 30, completedMinutes: 0, isCompleted: false },
    resources: { status: 'ok', needsAttentionCount: 0, itemsNeeded: [], isFullyStocked: true },
    dailyAiSummary: { status: 'ok', hasSummary: false, summary: null },
    weeklyProgress: { status: 'ok', recordedDaysCount: 0, weeklyAveragePct: 0, days: [] },
    weeklyReview: { status: 'ok', isSunday: dayOfWeek === 'SUNDAY', isCompleted: false },
    recentHistory: { status: 'ok', days: [] }
  };

  // 1. TODAY'S DOCTRINE EXECUTION & PRIORITIES
  try {
    const [exec] = await db
      .select()
      .from(dailyExecutions)
      .where(and(eq(dailyExecutions.userId, userId), eq(dailyExecutions.date, todayDate)))
      .limit(1);

    if (exec) {
      result.today.hasRecord = true;
      const tasks = await db
        .select()
        .from(taskExecutions)
        .where(eq(taskExecutions.dailyExecutionId, exec.id));

      const totalTasksCount = tasks.length;
      const completedCount = tasks.filter(t => t.status === 'COMPLETED').length;
      result.today.totalTasksCount = totalTasksCount;
      result.today.completedCount = completedCount;
      result.today.completionPercentage = totalTasksCount > 0 ? Math.round((completedCount / totalTasksCount) * 100) : 0;

      // Map task completion by taskKey
      const completedTaskKeys = new Set(tasks.filter(t => t.status === 'COMPLETED').map(t => t.taskKey));

      // Filter remaining priorities in exact scheduled order from WEEKLY_DOCTRINE
      const remainingTimeBlocks = (dayDoctrine.timeBlocks || []).filter(b => !completedTaskKeys.has(b.id));
      result.today.remainingPriorities = remainingTimeBlocks.slice(0, 3).map(b => ({
        id: b.id,
        time: b.time,
        activity: b.activity,
        category: b.category
      }));
    } else {
      result.today.remainingPriorities = (dayDoctrine.timeBlocks || []).slice(0, 3).map(b => ({
        id: b.id,
        time: b.time,
        activity: b.activity,
        category: b.category
      }));
    }
  } catch (err) {
    console.error('[Dashboard] Today query failed:', err);
    result.today.status = 'error';
    result.today.errorMessage = 'Unable to load today execution';
  }

  // 2. DATA ENGINEERING STATUS
  try {
    const deSessions = await db
      .select()
      .from(deLearningSessions)
      .where(and(eq(deLearningSessions.userId, userId), eq(deLearningSessions.date, todayDate)));

    const completedMinutes = deSessions.reduce((acc, s) => acc + (s.actualMinutes || 0), 0);
    const targetMinutes = result.dataEngineering.targetMinutes;
    const isCompleted = completedMinutes >= targetMinutes;

    result.dataEngineering = {
      status: 'ok',
      topic: deSessions.length > 0 ? deSessions[deSessions.length - 1].topicName : 'Data Engineering Mastery',
      targetMinutes,
      completedMinutes,
      isCompleted
    };
  } catch (err) {
    console.error('[Dashboard] DE query failed:', err);
    result.dataEngineering = { status: 'error', errorMessage: 'Unable to load Data Engineering status' };
  }

  // 3. RESOURCE ALERTS
  try {
    const dbStocks = await db.select().from(resourceStock).where(eq(resourceStock.userId, userId));
    const stockMap = new Map(dbStocks.map(s => [s.resourceId, s.currentQty]));

    const itemsNeeded = [];
    INITIAL_INVENTORY.forEach(item => {
      const currentQty = stockMap.has(item.id) ? stockMap.get(item.id) : item.currentQty;
      const required = item.purchaseQty || (item.minStockLevel ? item.minStockLevel * 2 : 1);
      const needed = Math.max(0, required - currentQty);

      if (needed > 0 || currentQty <= item.minStockLevel) {
        itemsNeeded.push({
          id: item.id,
          name: item.name,
          category: item.category,
          currentQty,
          required,
          needed: needed > 0 ? needed : item.purchaseQty,
          unit: item.unit
        });
      }
    });

    result.resources = {
      status: 'ok',
      needsAttentionCount: itemsNeeded.length,
      itemsNeeded: itemsNeeded.slice(0, 3),
      isFullyStocked: itemsNeeded.length === 0
    };
  } catch (err) {
    console.error('[Dashboard] Resources query failed:', err);
    result.resources = { status: 'error', errorMessage: 'Unable to load resources status' };
  }

  // 4. STORED DAILY AI SUMMARY (No Auto-Generation)
  try {
    const [summaryRec] = await db
      .select()
      .from(dailySummaries)
      .where(and(eq(dailySummaries.userId, userId), eq(dailySummaries.date, todayDate)))
      .limit(1);

    if (summaryRec) {
      result.dailyAiSummary = {
        status: 'ok',
        hasSummary: true,
        summary: summaryRec.summary,
        completionPercentage: summaryRec.completionPercentage,
        generatedAt: summaryRec.generatedAt
      };
    } else {
      result.dailyAiSummary = { status: 'ok', hasSummary: false, summary: null };
    }
  } catch (err) {
    console.error('[Dashboard] Summary query failed:', err);
    result.dailyAiSummary = { status: 'error', errorMessage: 'Unable to load daily AI summary' };
  }

  // 5. WEEKLY PROGRESS (Recorded Days Only)
  try {
    const allExecs = await db
      .select()
      .from(dailyExecutions)
      .where(eq(dailyExecutions.userId, userId))
      .orderBy(desc(dailyExecutions.date));

    // Get recorded executions for current week
    const currentWeekExecs = allExecs.filter(e => {
      const d = new Date(e.date + 'T00:00:00');
      const diffDays = Math.floor((dateObj - d) / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays < 7;
    });

    let sumPct = 0;
    const days = await Promise.all(currentWeekExecs.map(async (e) => {
      const tasks = await db.select().from(taskExecutions).where(eq(taskExecutions.dailyExecutionId, e.id));
      const totalCount = tasks.length;
      const compCount = tasks.filter(t => t.status === 'COMPLETED').length;
      const pct = totalCount > 0 ? Math.round((compCount / totalCount) * 100) : 0;
      sumPct += pct;
      return { date: e.date, dayOfWeek: e.dayOfWeek, completionPercentage: pct };
    }));

    const weeklyAveragePct = currentWeekExecs.length > 0 ? Math.round(sumPct / currentWeekExecs.length) : 0;

    result.weeklyProgress = {
      status: 'ok',
      recordedDaysCount: currentWeekExecs.length,
      weeklyAveragePct,
      days
    };
  } catch (err) {
    console.error('[Dashboard] Weekly progress query failed:', err);
    result.weeklyProgress = { status: 'error', errorMessage: 'Unable to load weekly progress' };
  }

  // 6. SUNDAY WEEKLY REVIEW STATUS
  try {
    const [revRec] = await db
      .select()
      .from(weeklyReviews)
      .where(eq(weeklyReviews.userId, userId))
      .orderBy(desc(weeklyReviews.createdAt))
      .limit(1);

    result.weeklyReview = {
      status: 'ok',
      isSunday: dayOfWeek === 'SUNDAY',
      isCompleted: Boolean(revRec),
      protocolCompliancePct: revRec?.protocolCompliancePct || 0,
      verdict: revRec?.verdict || null
    };
  } catch (err) {
    console.error('[Dashboard] Weekly review query failed:', err);
    result.weeklyReview = { status: 'error', errorMessage: 'Unable to load weekly review status' };
  }

  // 7. RECENT RECORDED HISTORY STREAM (Last 3 Days)
  try {
    const historyExecs = await db
      .select()
      .from(dailyExecutions)
      .where(eq(dailyExecutions.userId, userId))
      .orderBy(desc(dailyExecutions.date))
      .limit(3);

    const historyDays = await Promise.all(historyExecs.map(async (e) => {
      const tasks = await db.select().from(taskExecutions).where(eq(taskExecutions.dailyExecutionId, e.id));
      const totalCount = tasks.length;
      const compCount = tasks.filter(t => t.status === 'COMPLETED').length;
      const pct = totalCount > 0 ? Math.round((compCount / totalCount) * 100) : 0;
      return { date: e.date, dayOfWeek: e.dayOfWeek, completionPercentage: pct, completedCount: compCount, totalTasksCount: totalCount };
    }));

    result.recentHistory = { status: 'ok', days: historyDays };
  } catch (err) {
    console.error('[Dashboard] History stream query failed:', err);
    result.recentHistory = { status: 'error', errorMessage: 'Unable to load recent history' };
  }

  // 8. DYNAMIC PRIMARY ACTION DECISION LOGIC (Doctrine Priority Order)
  if (dayOfWeek === 'SUNDAY' && result.weeklyReview.status === 'ok' && !result.weeklyReview.isCompleted) {
    result.primaryAction = { type: 'WEEKLY_REVIEW', label: 'Complete Weekly Review', targetTab: 'week' };
  } else if (result.dataEngineering.status === 'ok' && !result.dataEngineering.isCompleted) {
    result.primaryAction = { type: 'DATA_ENG', label: 'Continue Data Engineering', targetTab: 'dataeng' };
  } else if (result.today.status === 'ok' && result.today.completionPercentage < 100) {
    result.primaryAction = { type: 'DOCTRINE', label: "Complete Today's Doctrine", targetTab: 'today' };
  } else if (result.resources.status === 'ok' && result.resources.needsAttentionCount > 0) {
    result.primaryAction = { type: 'RESOURCES', label: 'View Resources & Restock', targetTab: 'inventory' };
  } else {
    result.primaryAction = { type: 'SUMMARY', label: 'View Daily Progress', targetTab: 'today' };
  }

  res.json({ success: true, ...result });
});

export default router;
