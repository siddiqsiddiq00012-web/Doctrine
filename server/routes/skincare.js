import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { db } from '../db/index.js';
import { dailyExecutions, taskExecutions, resourceStock, weeklyReviews } from '../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { WEEKLY_DOCTRINE, INITIAL_INVENTORY, ACTIVE_INGREDIENTS, NON_NEGOTIABLE_RULES } from '../../src/data/doctrineData.js';

const router = Router();

function getTodayISO() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Map keywords in task activity text to inventory items
const RESOURCE_KEYWORD_MAP = [
  { keywords: ['cleanse', 'cleanser'], resourceId: 'inv-19', name: 'Gentle Cleanser' },
  { keywords: ['spf', 'sunscreen'], resourceId: 'inv-20', name: 'SPF 50+ PA++++ Sunscreen' },
  { keywords: ['ceramide', 'moisturiser', 'moisturizer'], resourceId: 'inv-21', name: 'Ceramide Moisturiser' },
  { keywords: ['salicylic'], resourceId: 'inv-22', name: '2% Salicylic Acid Serum' },
  { keywords: ['niacinamide'], resourceId: 'inv-23', name: '10% Niacinamide Serum' },
  { keywords: ['multani mitti'], resourceId: 'inv-24', name: 'Multani Mitti' },
  { keywords: ['rose water'], resourceId: 'inv-25', name: 'Rose Water' },
  { keywords: ['shampoo'], resourceId: 'inv-26', name: 'Mild Shampoo' },
  { keywords: ['hair oil', 'scalp oil'], resourceId: 'inv-27', name: 'Infused Hair Growth Oil Blend' },
  { keywords: ['aloe vera', 'aloe'], resourceId: 'inv-28', name: 'Fresh Aloe Vera' },
  { keywords: ['dermarolling', 'dermaroller'], resourceId: 'inv-29', name: '0.25mm Dermaroller' },
  { keywords: ['fenugreek', 'methi'], resourceId: 'inv-11', name: 'Fenugreek (Methi) Seeds' },
  { keywords: ['curd', 'yoghurt'], resourceId: 'inv-4', name: 'Curd / Yogurt' },
  { keywords: ['beetroot', 'carrots'], resourceId: 'inv-12', name: 'Beetroot & Carrots' },
  { keywords: ['papaya'], resourceId: 'inv-13', name: 'Papaya' }
];

function getAssociatedResources(activityText, stockMap) {
  const textLower = activityText.toLowerCase();
  const resources = [];
  const addedIds = new Set();

  for (const item of RESOURCE_KEYWORD_MAP) {
    if (item.keywords.some(kw => textLower.includes(kw)) && !addedIds.has(item.resourceId)) {
      addedIds.add(item.resourceId);
      const inventoryDef = INITIAL_INVENTORY.find(inv => inv.id === item.resourceId);
      const currentQty = stockMap.has(item.resourceId) ? stockMap.get(item.resourceId) : (inventoryDef ? inventoryDef.currentQty : 1);
      const minStock = inventoryDef ? inventoryDef.minStockLevel : 1;
      
      let stockStatus = 'IN_STOCK';
      if (currentQty <= 0) stockStatus = 'OUT_OF_STOCK';
      else if (currentQty <= minStock) stockStatus = 'LOW_STOCK';

      resources.push({
        id: item.resourceId,
        name: inventoryDef ? inventoryDef.name : item.name,
        category: inventoryDef ? inventoryDef.category : 'SKINCARE',
        currentQty,
        unit: inventoryDef ? inventoryDef.unit : 'pcs',
        minStockLevel: minStock,
        stockStatus
      });
    }
  }

  return resources;
}

// GET /api/skincare/today — Aggregated Skincare & Grooming Execution Status for Selected Date
router.get('/today', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const dateStr = (req.query.date && typeof req.query.date === 'string' && req.query.date.match(/^\d{4}-\d{2}-\d{2}$/))
      ? req.query.date
      : getTodayISO();

    const parts = dateStr.split('-').map(Number);
    const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
    const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    const dayOfWeek = dayNames[dateObj.getDay()] || 'MONDAY';

    // 1. Fetch User's Resource Stock Map
    const dbStocks = await db.select().from(resourceStock).where(eq(resourceStock.userId, userId));
    const stockMap = new Map(dbStocks.map(s => [s.resourceId, s.currentQty]));

    // 2. Fetch or Locate Daily Execution
    const [exec] = await db
      .select()
      .from(dailyExecutions)
      .where(and(eq(dailyExecutions.userId, userId), eq(dailyExecutions.date, dateStr)))
      .limit(1);

    let dbTasks = [];
    if (exec) {
      dbTasks = await db.select().from(taskExecutions).where(eq(taskExecutions.dailyExecutionId, exec.id));
    }
    const dbTaskMap = new Map(dbTasks.map(t => [t.taskKey, t]));

    // 3. Extract Skincare and Hair Tasks from WEEKLY_DOCTRINE for dayOfWeek
    const dayDoctrine = WEEKLY_DOCTRINE[dayOfWeek] || WEEKLY_DOCTRINE.MONDAY;
    const allBlocks = dayDoctrine.timeBlocks || [];

    const skincareBlocks = allBlocks.filter(b => b.category === 'SKINCARE' || b.category === 'HAIR');

    const morningTasks = [];
    const eveningTasks = [];

    skincareBlocks.forEach(b => {
      const dbTask = dbTaskMap.get(b.id);
      const isCompleted = dbTask ? dbTask.status === 'COMPLETED' : false;
      const completedAt = dbTask ? dbTask.completedAt : null;
      const associatedResources = getAssociatedResources(b.activity, stockMap);

      const taskItem = {
        id: b.id,
        time: b.time,
        activity: b.activity,
        category: b.category,
        startMinutes: b.startMinutes,
        endMinutes: b.endMinutes,
        isCompleted,
        completedAt,
        associatedResources
      };

      // Group into Morning (<12:00 PM / 720 min) vs Evening/Night (>=12:00 PM / 720 min)
      if (b.startMinutes < 720) {
        morningTasks.push(taskItem);
      } else {
        eveningTasks.push(taskItem);
      }
    });

    // 4. Check Anchors
    const amAnchorTask = dbTaskMap.get('anchor_amSkincare');
    const pmAnchorTask = dbTaskMap.get('anchor_pmSkincare');

    const amAnchorCompleted = amAnchorTask ? amAnchorTask.status === 'COMPLETED' : false;
    const pmAnchorCompleted = pmAnchorTask ? pmAnchorTask.status === 'COMPLETED' : false;

    // 5. Derive Active Ingredients for the Day
    let activeIngredientRule = 'Rest / Barrier Repair — Hydrate and moisturise without aggressive actives.';
    if (['MONDAY', 'WEDNESDAY', 'FRIDAY'].includes(dayOfWeek)) {
      activeIngredientRule = 'Mon / Wed / Fri AM: 2% Salicylic Acid (Minimalist) + Potato-Aloe Extract (Enzymatic). Never layer two actives in the same application!';
    } else {
      activeIngredientRule = 'Tue / Thu / Sat / Sun PM: 10% Niacinamide (Minimalist) for barrier repair.';
    }

    // 6. Gather Out-of-Stock / Low-Stock Warnings for Skincare & Hair Products
    const stockWarnings = [];
    (INITIAL_INVENTORY || [])
      .filter(item => item.category === 'SKINCARE' || item.category === 'HAIR')
      .forEach(item => {
        const qty = stockMap.has(item.id) ? stockMap.get(item.id) : item.currentQty;
        if (qty <= item.minStockLevel) {
          stockWarnings.push({
            id: item.id,
            name: item.name,
            category: item.category,
            currentQty: qty,
            minStockLevel: item.minStockLevel,
            unit: item.unit,
            isOutOfStock: qty <= 0
          });
        }
      });

    // 7. Latest Skin & Hair Observations from Sunday Review
    const [latestReview] = await db
      .select()
      .from(weeklyReviews)
      .where(eq(weeklyReviews.userId, userId))
      .orderBy(desc(weeklyReviews.createdAt))
      .limit(1);

    const skinObservations = {
      complexion: latestReview?.complexion || 'BRIGHTER',
      activeBreakouts: latestReview?.activeBreakouts ?? 0,
      hairShedding: latestReview?.hairShedding || 'LESS',
      newBabyHairs: latestReview?.newBabyHairs ?? true,
      lastReviewDate: latestReview?.weekEndDate || null
    };

    res.json({
      success: true,
      date: dateStr,
      dayOfWeek,
      theme: dayDoctrine.theme,
      subhead: dayDoctrine.subhead,
      morningTasks,
      eveningTasks,
      amAnchorCompleted,
      pmAnchorCompleted,
      activeIngredientRule,
      stockWarnings,
      skinObservations,
      totalCount: morningTasks.length + eveningTasks.length,
      completedCount: morningTasks.filter(t => t.isCompleted).length + eveningTasks.filter(t => t.isCompleted).length
    });

  } catch (error) {
    console.error('[Skincare API Error]:', error);
    res.status(500).json({ error: 'Failed to retrieve skincare execution status', details: error.message });
  }
});

// GET /api/skincare/history — Historical Skincare Adherence & Progress Metrics
router.get('/history', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    // Fetch all recorded daily executions for the user in descending order
    const recordedExecs = await db
      .select()
      .from(dailyExecutions)
      .where(eq(dailyExecutions.userId, userId))
      .orderBy(desc(dailyExecutions.date));

    if (recordedExecs.length === 0) {
      return res.json({
        success: true,
        recordedDaysCount: 0,
        morningAdherencePct: 0,
        eveningAdherencePct: 0,
        overallAdherencePct: 0,
        history: []
      });
    }

    let morningTotal = 0;
    let morningCompleted = 0;
    let eveningTotal = 0;
    let eveningCompleted = 0;

    const history = await Promise.all(recordedExecs.map(async (exec) => {
      const tasks = await db.select().from(taskExecutions).where(eq(taskExecutions.dailyExecutionId, exec.id));
      const dbTaskMap = new Map(tasks.map(t => [t.taskKey, t]));

      const dayDoctrine = WEEKLY_DOCTRINE[exec.dayOfWeek] || WEEKLY_DOCTRINE.MONDAY;
      const skincareBlocks = (dayDoctrine.timeBlocks || []).filter(b => b.category === 'SKINCARE' || b.category === 'HAIR');

      let mTotal = 0, mComp = 0, eTotal = 0, eComp = 0;

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

      morningTotal += mTotal;
      morningCompleted += mComp;
      eveningTotal += eTotal;
      eveningCompleted += eComp;

      const dayTotal = mTotal + eTotal;
      const dayComp = mComp + eComp;
      const dayPct = dayTotal > 0 ? Math.round((dayComp / dayTotal) * 100) : 0;

      return {
        date: exec.date,
        dayOfWeek: exec.dayOfWeek,
        morningCompleted: mComp === mTotal && mTotal > 0,
        eveningCompleted: eComp === eTotal && eTotal > 0,
        completedCount: dayComp,
        totalCount: dayTotal,
        adherencePct: dayPct
      };
    }));

    const morningAdherencePct = morningTotal > 0 ? Math.round((morningCompleted / morningTotal) * 100) : 0;
    const eveningAdherencePct = eveningTotal > 0 ? Math.round((eveningCompleted / eveningTotal) * 100) : 0;
    const totalAll = morningTotal + eveningTotal;
    const compAll = morningCompleted + eveningCompleted;
    const overallAdherencePct = totalAll > 0 ? Math.round((compAll / totalAll) * 100) : 0;

    res.json({
      success: true,
      recordedDaysCount: recordedExecs.length,
      morningAdherencePct,
      eveningAdherencePct,
      overallAdherencePct,
      history
    });

  } catch (error) {
    console.error('[Skincare History API Error]:', error);
    res.status(500).json({ error: 'Failed to retrieve skincare history', details: error.message });
  }
});

export default router;
