import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { db } from '../db/index.js';
import { dailyExecutions, taskExecutions, dailySummaries, weeklyReviews, deLearningSessions, resourceStock } from '../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { WEEKLY_DOCTRINE, INITIAL_INVENTORY } from '../../src/data/doctrineData.js';
import { calculateFailurePatterns } from '../services/failurePatternService.js';

const router = Router();

function getTodayISO() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatYMD(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getCurrentWeekRange(todayStr) {
  const parts = todayStr.split('-').map(Number);
  const year = parts[0] || new Date().getFullYear();
  const month = (parts[1] || 1) - 1;
  const day = parts[2] || 1;

  const d = new Date(year, month, day);
  const dayOfWeekNum = d.getDay();
  const diffToMon = d.getDate() - dayOfWeekNum + (dayOfWeekNum === 0 ? -6 : 1);

  const monday = new Date(year, month, diffToMon);
  const sunday = new Date(year, month, diffToMon + 6);

  return {
    startStr: formatYMD(monday),
    endStr: formatYMD(sunday)
  };
}

// GET /api/dashboard — Aggregated Home Command Center
router.get(['/', ''], requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const todayDate = (req.query.date && typeof req.query.date === 'string' && req.query.date.match(/^\d{4}-\d{2}-\d{2}$/))
      ? req.query.date
      : getTodayISO();

    const parts = todayDate.split('-').map(Number);
    const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
    const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    const dayOfWeek = dayNames[dateObj.getDay()] || 'MONDAY';

    const dayDoctrine = WEEKLY_DOCTRINE[dayOfWeek] || WEEKLY_DOCTRINE.MONDAY;
    const dayTheme = dayDoctrine?.theme || null;

    const result = {
      today: {
        date: todayDate,
        dayOfWeek,
        dayTheme,
        completionPercentage: 0,
        completedCount: 0,
        totalTasksCount: 0,
        remainingPriorities: [],
        hasRecord: false,
        status: 'ok'
      },
      primaryAction: {
        type: 'DOCTRINE',
        label: "Complete Today's Doctrine",
        targetTab: 'today'
      },
      dataEngineering: {
        status: 'ok',
        topic: 'Data Engineering Mastery',
        targetMinutes: ['MONDAY', 'WEDNESDAY', 'FRIDAY'].includes(dayOfWeek) ? 50 : 30,
        completedMinutes: 0,
        isCompleted: false
      },
      resources: {
        status: 'ok',
        needsAttentionCount: 0,
        itemsNeeded: [],
        isFullyStocked: true
      },
      dailyAiSummary: {
        status: 'ok',
        hasSummary: false,
        summary: null
      },
      weeklyProgress: {
        status: 'ok',
        recordedDaysCount: 0,
        weeklyAveragePct: 0,
        days: []
      },
      weeklyReview: {
        status: 'ok',
        isSunday: dayOfWeek === 'SUNDAY',
        isCompleted: false
      },
      recentHistory: {
        status: 'ok',
        days: []
      },
      skincare: {
        status: 'ok',
        morningCompleted: false,
        eveningCompleted: false,
        completedCount: 0,
        totalCount: 0
      }
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

        const completedTaskKeys = new Set(tasks.filter(t => t.status === 'COMPLETED').map(t => t.taskKey));
        const remainingTimeBlocks = (dayDoctrine.timeBlocks || []).filter(b => !completedTaskKeys.has(b.id));

        result.today.remainingPriorities = remainingTimeBlocks.slice(0, 3).map(b => ({
          id: b.id,
          time: b.time,
          activity: b.activity,
          category: b.category
        }));
      } else {
        const totalScheduled = (dayDoctrine.timeBlocks || []).length;
        result.today.totalTasksCount = totalScheduled;
        result.today.completedCount = 0;
        result.today.completionPercentage = 0;
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

    // 3. RESOURCE ALERTS & FORECASTS
    try {
      const dbStocks = await db.select().from(resourceStock).where(eq(resourceStock.userId, userId));
      const stockMap = new Map(dbStocks.map(s => [s.resourceId, s.currentQty]));

      const itemsNeeded = [];
      const forecastAlerts = [];

      (INITIAL_INVENTORY || []).forEach(item => {
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

        // Check 7-day projected depletion
        const dailyRate = item.id === 'inv-1' ? 3 : item.id === 'inv-2' ? 0.5 : item.minStockLevel ? (item.minStockLevel / 7) : 0.1;
        const daysRemaining = dailyRate > 0 ? currentQty / dailyRate : 999;
        if (daysRemaining <= 7 || currentQty <= item.minStockLevel) {
          forecastAlerts.push({
            id: item.id,
            name: item.name,
            currentQty,
            unit: item.unit,
            daysRemaining: Math.round(daysRemaining * 10) / 10,
            status: daysRemaining <= 3 ? 'PROJECTED DEPLETION' : 'PURCHASE RECOMMENDED'
          });
        }
      });

      result.resources = {
        status: 'ok',
        needsAttentionCount: itemsNeeded.length,
        itemsNeeded: itemsNeeded.slice(0, 3),
        isFullyStocked: itemsNeeded.length === 0,
        forecastAlertsCount: forecastAlerts.length,
        forecastAlerts: forecastAlerts.slice(0, 3)
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

    // 5. WEEKLY PROGRESS (Recorded Days Only in Current Week Range)
    try {
      const { startStr, endStr } = getCurrentWeekRange(todayDate);
      const allExecs = await db
        .select()
        .from(dailyExecutions)
        .where(eq(dailyExecutions.userId, userId))
        .orderBy(desc(dailyExecutions.date));

      const currentWeekExecs = allExecs.filter(e => e.date >= startStr && e.date <= endStr);

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

    // 7.5. SKINCARE & GROOMING TODAY STATUS
    try {
      const skincareBlocks = (dayDoctrine.timeBlocks || []).filter(b => b.category === 'SKINCARE' || b.category === 'HAIR');
      let mComp = 0, mTotal = 0, eComp = 0, eTotal = 0;

      const [exec] = await db
        .select()
        .from(dailyExecutions)
        .where(and(eq(dailyExecutions.userId, userId), eq(dailyExecutions.date, todayDate)))
        .limit(1);

      let dbTaskMap = new Map();
      if (exec) {
        const tasks = await db.select().from(taskExecutions).where(eq(taskExecutions.dailyExecutionId, exec.id));
        dbTaskMap = new Map(tasks.map(t => [t.taskKey, t]));
      }

      skincareBlocks.forEach(b => {
        const dbTask = dbTaskMap.get(b.id);
        const isDone = dbTask ? dbTask.status === 'COMPLETED' : false;
        if (b.startMinutes < 720) {
          mTotal++;
          if (isDone) mComp++;
        } else {
          eTotal++;
          if (isDone) eComp++;
        }
      });

      result.skincare = {
        status: 'ok',
        morningCompleted: mTotal > 0 && mComp === mTotal,
        eveningCompleted: eTotal > 0 && eComp === eTotal,
        completedCount: mComp + eComp,
        totalCount: mTotal + eTotal
      };
    } catch (err) {
      console.error('[Dashboard] Skincare status query failed:', err);
      result.skincare = { status: 'error', errorMessage: 'Unable to load skincare status' };
    }

    // 8. DYNAMIC PRIMARY ACTION DECISION LOGIC (Doctrine Priority Order)
    if (dayOfWeek === 'SUNDAY' && result.weeklyReview.status === 'ok' && !result.weeklyReview.isCompleted) {
      result.primaryAction = {
        type: 'WEEKLY_REVIEW',
        label: 'Complete Weekly Review',
        targetTab: 'week',
        goal: 'Sunday System Review & Reset Goal',
        contextReason: "Track weekly physical progress, calculate compliance deltas, and identify next week's 1% refinement."
      };
    } else if (result.dataEngineering.status === 'ok' && !result.dataEngineering.isCompleted) {
      const topicName = result.dataEngineering.topic || 'SQL JOINs';
      result.primaryAction = {
        type: 'DATA_ENG',
        label: 'Continue Data Engineering',
        targetTab: 'dataeng',
        goal: 'Data Engineering Mastery Goal',
        contextReason: `Part of your current ${topicName} stage in the ordered Data Engineering roadmap.`
      };
    } else if (result.today.status === 'ok' && result.today.completionPercentage < 100) {
      result.primaryAction = {
        type: 'DOCTRINE',
        label: "Complete Today's Doctrine",
        targetTab: 'today',
        goal: 'Caloric MED & Physical Mastery Goal',
        contextReason: "Completes today's scheduled Doctrine time-blocks and non-negotiable anchors."
      };
    } else if (result.resources.status === 'ok' && result.resources.needsAttentionCount > 0) {
      result.primaryAction = {
        type: 'RESOURCES',
        label: 'View Resources & Restock',
        targetTab: 'inventory',
        goal: 'Resource Intelligence & Stock Security Goal',
        contextReason: "Covers projected 7-day resource depletion and maintains ingredient stock levels."
      };
    } else {
      result.primaryAction = {
        type: 'SUMMARY',
        label: 'View Daily Progress',
        targetTab: 'today',
        goal: 'Daily Progress Reflection Goal',
        contextReason: "Reviews today's completed milestones and historical compliance."
      };
    }

    // 9. FAILURE PATTERNS SUMMARY (Feature 14)
    try {
      result.failurePattern = await calculateFailurePatterns(userId, 4);
    } catch (err) {
      console.error('[Dashboard] Failure patterns query failed:', err);
      result.failurePattern = null;
    }

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('[Dashboard API] Fatal Error:', error);
    res.status(500).json({ error: 'Failed to retrieve dashboard data', details: error.message });
  }
});

export default router;
