import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { db } from '../db/index.js';
import { dailyExecutions, taskExecutions, doctrineVersions } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { cryptoNative } from '../utils/crypto.js';
import { WEEKLY_DOCTRINE, PREPARED_FOR_TOMORROW_TEMPLATES } from '../../src/data/doctrineData.js';

const router = Router();

// Validate YYYY-MM-DD format
function isValidDateStr(dateStr) {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr) && !isNaN(Date.parse(dateStr));
}

// Get or Create Daily Execution for Authenticated User
async function getOrCreateDailyExecution(userId, dateStr) {
  // Check if daily execution record exists for this user and date
  const [existing] = await db
    .select()
    .from(dailyExecutions)
    .where(and(eq(dailyExecutions.userId, userId), eq(dailyExecutions.date, dateStr)))
    .limit(1);

  if (existing) {
    // Fetch associated task executions
    const tasks = await db
      .select()
      .from(taskExecutions)
      .where(eq(taskExecutions.dailyExecutionId, existing.id));

    const totalTasksCount = tasks.length;
    const completedCount = tasks.filter((t) => t.status === 'COMPLETED').length;
    const skippedCount = tasks.filter((t) => t.status === 'SKIPPED').length;
    const missedCount = tasks.filter((t) => t.status === 'MISSED').length;
    const completionPercentage = totalTasksCount > 0 ? Math.round((completedCount / totalTasksCount) * 100) : 0;

    return {
      execution: {
        ...existing,
        completionPercentage,
        completedCount,
        totalTasksCount,
        skippedCount,
        missedCount,
      },
      tasks,
    };
  }

  // Get user's active doctrine version
  const [activeVersion] = await db
    .select()
    .from(doctrineVersions)
    .where(eq(doctrineVersions.userId, userId))
    .limit(1);

  const dateObj = new Date(dateStr + 'T00:00:00');
  const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const dayOfWeek = dayNames[dateObj.getDay()];

  const newExecutionId = cryptoNative.randomUUID();
  const nowIso = new Date().toISOString();

  // Create database daily execution record
  await db.insert(dailyExecutions).values({
    id: newExecutionId,
    userId,
    date: dateStr,
    doctrineVersionId: activeVersion ? activeVersion.id : null,
    dayOfWeek,
    waterLiters: 0,
    tahajjud: false,
    notes: '',
    createdAt: nowIso,
    updatedAt: nowIso,
  });

  // Seed default task execution templates
  const initialTaskValues = [];

  // 1. Time Blocks from Doctrine Schedule
  const dayDoctrine = WEEKLY_DOCTRINE[dayOfWeek] || WEEKLY_DOCTRINE.MONDAY;
  if (dayDoctrine && Array.isArray(dayDoctrine.timeBlocks)) {
    dayDoctrine.timeBlocks.forEach((block) => {
      initialTaskValues.push({
        id: cryptoNative.randomUUID(),
        dailyExecutionId: newExecutionId,
        taskKey: block.id,
        category: 'DOCTRINE',
        taskName: block.activity,
        status: 'SCHEDULED',
        createdAt: nowIso,
        updatedAt: nowIso,
      });
    });
  }

  // 2. Namaz Tasks
  ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'].forEach((prayer) => {
    initialTaskValues.push({
      id: cryptoNative.randomUUID(),
      dailyExecutionId: newExecutionId,
      taskKey: `namaz_${prayer}`,
      category: 'NAMAZ',
      taskName: `Namaz ${prayer.toUpperCase()}`,
      status: 'SCHEDULED',
      createdAt: nowIso,
      updatedAt: nowIso,
    });
  });

  // 3. Anchors
  ['medKcalReached', 'amSkincare', 'pmSkincare', 'massShakeTaken'].forEach((anchorKey) => {
    initialTaskValues.push({
      id: cryptoNative.randomUUID(),
      dailyExecutionId: newExecutionId,
      taskKey: `anchor_${anchorKey}`,
      category: 'ANCHOR',
      taskName: anchorKey,
      status: 'SCHEDULED',
      createdAt: nowIso,
      updatedAt: nowIso,
    });
  });

  // 4. Prep items
  PREPARED_FOR_TOMORROW_TEMPLATES.forEach((item) => {
    initialTaskValues.push({
      id: cryptoNative.randomUUID(),
      dailyExecutionId: newExecutionId,
      taskKey: `prep_${item.id}`,
      category: 'PREPARATION',
      taskName: item.title || item.text,
      status: 'SCHEDULED',
      createdAt: nowIso,
      updatedAt: nowIso,
    });
  });

  if (initialTaskValues.length > 0) {
    await db.insert(taskExecutions).values(initialTaskValues);
  }

  const [newExecution] = await db
    .select()
    .from(dailyExecutions)
    .where(eq(dailyExecutions.id, newExecutionId))
    .limit(1);

  const seededTasks = await db
    .select()
    .from(taskExecutions)
    .where(eq(taskExecutions.dailyExecutionId, newExecutionId));

  const totalTasksCount = seededTasks.length;
  const completedCount = seededTasks.filter((t) => t.status === 'COMPLETED').length;
  const skippedCount = seededTasks.filter((t) => t.status === 'SKIPPED').length;
  const missedCount = seededTasks.filter((t) => t.status === 'MISSED').length;
  const completionPercentage = totalTasksCount > 0 ? Math.round((completedCount / totalTasksCount) * 100) : 0;

  return {
    execution: {
      ...newExecution,
      completionPercentage,
      completedCount,
      totalTasksCount,
      skippedCount,
      missedCount,
    },
    tasks: seededTasks,
  };
}

// GET /api/history/:date (Authenticated Endpoint)
router.get('/:date', requireAuth, async (req, res) => {
  const { date } = req.params;

  if (!isValidDateStr(date)) {
    return res.status(400).json({ error: 'Invalid Date Format', message: 'Date must be formatted YYYY-MM-DD' });
  }

  try {
    const userId = req.user.id;
    const data = await getOrCreateDailyExecution(userId, date);
    res.json(data);
  } catch (error) {
    console.error(`Error retrieving history for date ${date}:`, error);
    res.status(500).json({ error: 'Failed to retrieve historical record' });
  }
});

// POST /api/history/:date/toggle (Authenticated Endpoint)
router.post('/:date/toggle', requireAuth, async (req, res) => {
  const { date } = req.params;
  const { taskKey, status: targetStatus } = req.body;

  if (!isValidDateStr(date) || !taskKey) {
    return res.status(400).json({ error: 'Invalid Parameters', message: 'Valid date and taskKey required' });
  }

  try {
    const userId = req.user.id;
    const { execution, tasks } = await getOrCreateDailyExecution(userId, date);

    const existingTask = tasks.find((t) => t.taskKey === taskKey);
    const nowIso = new Date().toISOString();

    if (existingTask) {
      let nextStatus = 'SCHEDULED';
      if (targetStatus && ['COMPLETED', 'SKIPPED', 'SCHEDULED', 'MISSED'].includes(targetStatus)) {
        nextStatus = targetStatus;
      } else {
        nextStatus = existingTask.status === 'COMPLETED' ? 'SCHEDULED' : 'COMPLETED';
      }
      const completedAt = nextStatus === 'COMPLETED' ? nowIso : null;

      await db
        .update(taskExecutions)
        .set({
          status: nextStatus,
          completedAt,
          updatedAt: nowIso,
        })
        .where(eq(taskExecutions.id, existingTask.id));
    } else {
      const nextStatus = (targetStatus && ['COMPLETED', 'SKIPPED', 'SCHEDULED', 'MISSED'].includes(targetStatus)) ? targetStatus : 'COMPLETED';
      const completedAt = nextStatus === 'COMPLETED' ? nowIso : null;

      await db.insert(taskExecutions).values({
        id: cryptoNative.randomUUID(),
        dailyExecutionId: execution.id,
        taskKey,
        category: 'DOCTRINE',
        status: nextStatus,
        completedAt,
        createdAt: nowIso,
        updatedAt: nowIso,
      });
    }

    const updatedData = await getOrCreateDailyExecution(userId, date);
    res.json(updatedData);
  } catch (error) {
    console.error(`Error toggling task ${taskKey} for date ${date}:`, error);
    res.status(500).json({ error: 'Failed to update task state' });
  }
});

// POST /api/history/:date/update (Authenticated Endpoint for Water / Notes / Tahajjud)
router.post('/:date/update', requireAuth, async (req, res) => {
  const { date } = req.params;
  const { waterLiters, tahajjud, notes } = req.body;

  if (!isValidDateStr(date)) {
    return res.status(400).json({ error: 'Invalid Date Format' });
  }

  try {
    const userId = req.user.id;
    const { execution } = await getOrCreateDailyExecution(userId, date);
    const nowIso = new Date().toISOString();

    const updateFields = { updatedAt: nowIso };
    if (waterLiters !== undefined) updateFields.waterLiters = Number(waterLiters);
    if (tahajjud !== undefined) updateFields.tahajjud = Boolean(tahajjud);
    if (notes !== undefined) updateFields.notes = String(notes);

    await db.update(dailyExecutions).set(updateFields).where(eq(dailyExecutions.id, execution.id));

    const updatedData = await getOrCreateDailyExecution(userId, date);
    res.json(updatedData);
  } catch (error) {
    console.error(`Error updating daily execution for date ${date}:`, error);
    res.status(500).json({ error: 'Failed to update daily execution' });
  }
});

export default router;
