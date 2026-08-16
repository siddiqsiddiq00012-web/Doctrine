import express from 'express';
import { db } from '../db/index.js';
import {
  goals,
  goalMilestones,
  goalTaskMappings,
  lifeAreas,
  financialGoals
} from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { requireAuth } from '../middleware/authMiddleware.js';
import { cryptoNative } from '../utils/crypto.js';
import {
  getGoalDetails,
  getGoalHierarchy
} from '../services/goalEngine.js';

const router = express.Router();

// Enforce authentication middleware across all routes
router.use(requireAuth);

const VALID_LEVELS = new Set(['VISION', 'OBJECTIVE', 'GOAL']);
const VALID_STATUSES = new Set(['PLANNED', 'ACTIVE', 'AT_RISK', 'COMPLETED', 'ABANDONED']);

/**
 * GET /api/goals
 * Returns user's full goal hierarchy, life areas, and summary details
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const hierarchy = await getGoalHierarchy(userId);
    const userLifeAreas = await db
      .select()
      .from(lifeAreas)
      .where(eq(lifeAreas.userId, userId));

    res.json({
      success: true,
      hierarchy,
      lifeAreas: userLifeAreas
    });
  } catch (err) {
    console.error('[Goals API Error] Failed fetching goals hierarchy:', err);
    res.status(500).json({ error: 'Failed to fetch goal hierarchy', details: err.message });
  }
});

/**
 * GET /api/goals/life-areas
 * Returns user's configured life areas
 */
router.get('/life-areas', async (req, res) => {
  try {
    const userId = req.user.id;
    const areas = await db
      .select()
      .from(lifeAreas)
      .where(eq(lifeAreas.userId, userId));

    res.json({ success: true, lifeAreas: areas });
  } catch (err) {
    console.error('[Goals API Error] Failed fetching life areas:', err);
    res.status(500).json({ error: 'Failed to fetch life areas', details: err.message });
  }
});

/**
 * GET /api/goals/:id
 * Returns calculated domain details for a single goal
 */
router.get('/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const goalId = req.params.id;

    const details = await getGoalDetails(userId, goalId);
    if (!details) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    res.json({ success: true, goal: details });
  } catch (err) {
    console.error('[Goals API Error] Failed fetching goal details:', err);
    res.status(500).json({ error: 'Failed to fetch goal details', details: err.message });
  }
});

/**
 * POST /api/goals
 * Creates a new Vision, Objective, or Goal
 */
router.post('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      title,
      description = '',
      level = 'GOAL',
      parentId = null,
      lifeAreaId = null,
      targetDate = null,
      priority = 1,
      status = 'PLANNED',
      financialGoalId = null
    } = req.body;

    if (!title || typeof title !== 'string' || title.trim() === '') {
      return res.status(400).json({ error: 'Goal title is required' });
    }

    if (!VALID_LEVELS.has(level)) {
      return res.status(400).json({ error: `Invalid level '${level}'. Allowed: VISION, OBJECTIVE, GOAL` });
    }

    if (!VALID_STATUSES.has(status)) {
      return res.status(400).json({ error: `Invalid status '${status}'. Allowed: PLANNED, ACTIVE, AT_RISK, COMPLETED, ABANDONED` });
    }

    // Hierarchy Validation
    if (level === 'VISION' && parentId) {
      return res.status(400).json({ error: 'VISION level goals cannot have a parent' });
    }

    if (parentId) {
      const [parent] = await db
        .select()
        .from(goals)
        .where(and(eq(goals.id, parentId), eq(goals.userId, userId)))
        .limit(1);

      if (!parent) {
        return res.status(400).json({ error: 'Parent goal does not exist or belong to user' });
      }

      if (level === 'OBJECTIVE' && parent.level !== 'VISION') {
        return res.status(400).json({ error: 'OBJECTIVE level goals must have a VISION parent' });
      }
      if (level === 'GOAL' && parent.level !== 'OBJECTIVE') {
        return res.status(400).json({ error: 'GOAL level goals must have an OBJECTIVE parent' });
      }
    }

    // Life Area Validation
    let assignedLifeAreaId = lifeAreaId;
    if (lifeAreaId) {
      const [area] = await db
        .select()
        .from(lifeAreas)
        .where(and(eq(lifeAreas.id, lifeAreaId), eq(lifeAreas.userId, userId)))
        .limit(1);

      if (!area) {
        return res.status(400).json({ error: 'Invalid or unowned lifeAreaId' });
      }
    } else {
      // Auto-assign default life area for user if unassigned
      const [firstArea] = await db
        .select()
        .from(lifeAreas)
        .where(eq(lifeAreas.userId, userId))
        .limit(1);

      assignedLifeAreaId = firstArea ? firstArea.id : null;
    }

    // Financial Goal Validation
    if (financialGoalId) {
      const [finG] = await db
        .select()
        .from(financialGoals)
        .where(and(eq(financialGoals.id, financialGoalId), eq(financialGoals.userId, userId)))
        .limit(1);

      if (!finG) {
        return res.status(400).json({ error: 'Invalid or unowned financialGoalId' });
      }
    }

    const nowIso = new Date().toISOString();
    const newGoalId = cryptoNative.randomUUID();

    await db.insert(goals).values({
      id: newGoalId,
      userId,
      parentId,
      lifeAreaId: assignedLifeAreaId,
      level,
      title: title.trim(),
      description: description.trim(),
      status,
      priority: Math.max(1, Number(priority) || 1),
      targetDate: targetDate || null,
      financialGoalId: financialGoalId || null,
      createdAt: nowIso,
      updatedAt: nowIso
    });

    const details = await getGoalDetails(userId, newGoalId);
    res.status(201).json({ success: true, goal: details });
  } catch (err) {
    console.error('[Goals API Error] Failed creating goal:', err);
    res.status(500).json({ error: 'Failed to create goal', details: err.message });
  }
});

/**
 * PUT /api/goals/:id
 * Updates an existing goal
 */
router.put('/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const goalId = req.params.id;

    const [existing] = await db
      .select()
      .from(goals)
      .where(and(eq(goals.id, goalId), eq(goals.userId, userId)))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    const {
      title,
      description,
      level,
      parentId,
      lifeAreaId,
      targetDate,
      priority,
      status,
      financialGoalId
    } = req.body;

    const updatePayload = { updatedAt: new Date().toISOString() };

    if (title !== undefined) {
      if (!title || typeof title !== 'string' || title.trim() === '') {
        return res.status(400).json({ error: 'Title cannot be empty' });
      }
      updatePayload.title = title.trim();
    }

    if (description !== undefined) {
      updatePayload.description = String(description).trim();
    }

    if (level !== undefined) {
      if (!VALID_LEVELS.has(level)) {
        return res.status(400).json({ error: `Invalid level '${level}'` });
      }
      updatePayload.level = level;
    }

    if (status !== undefined) {
      if (!VALID_STATUSES.has(status)) {
        return res.status(400).json({ error: `Invalid status '${status}'` });
      }
      updatePayload.status = status;
    }

    if (parentId !== undefined && parentId !== existing.parentId) {
      if (parentId) {
        if (parentId === goalId) {
          return res.status(400).json({ error: 'Goal cannot be its own parent' });
        }
        // Cycle detection: check if goalId is an ancestor of proposed parentId
        let currId = parentId;
        const visited = new Set();
        let cycleDetected = false;
        while (currId) {
          if (visited.has(currId)) {
            cycleDetected = true;
            break;
          }
          visited.add(currId);
          if (currId === goalId) {
            cycleDetected = true;
            break;
          }
          const [parentRecord] = await db
            .select({ parentId: goals.parentId })
            .from(goals)
            .where(and(eq(goals.id, currId), eq(goals.userId, userId)))
            .limit(1);
          if (!parentRecord || !parentRecord.parentId) break;
          currId = parentRecord.parentId;
        }

        if (cycleDetected) {
          return res.status(400).json({ error: 'Cannot set parent: cycle detected in goal hierarchy' });
        }

        const [parent] = await db
          .select()
          .from(goals)
          .where(and(eq(goals.id, parentId), eq(goals.userId, userId)))
          .limit(1);

        if (!parent) {
          return res.status(400).json({ error: 'Parent goal does not exist or belong to user' });
        }

        const targetLevel = level || existing.level;
        if (targetLevel === 'OBJECTIVE' && parent.level !== 'VISION') {
          return res.status(400).json({ error: 'OBJECTIVE level goals must have a VISION parent' });
        }
        if (targetLevel === 'GOAL' && parent.level !== 'OBJECTIVE') {
          return res.status(400).json({ error: 'GOAL level goals must have an OBJECTIVE parent' });
        }
      }
      updatePayload.parentId = parentId || null;
    }

    if (lifeAreaId !== undefined && lifeAreaId !== existing.lifeAreaId) {
      if (lifeAreaId) {
        const [area] = await db
          .select()
          .from(lifeAreas)
          .where(and(eq(lifeAreas.id, lifeAreaId), eq(lifeAreas.userId, userId)))
          .limit(1);

        if (!area) {
          return res.status(400).json({ error: 'Invalid or unowned lifeAreaId' });
        }
      }
      updatePayload.lifeAreaId = lifeAreaId || null;
    }

    if (financialGoalId !== undefined && financialGoalId !== existing.financialGoalId) {
      if (financialGoalId) {
        const [finG] = await db
          .select()
          .from(financialGoals)
          .where(and(eq(financialGoals.id, financialGoalId), eq(financialGoals.userId, userId)))
          .limit(1);

        if (!finG) {
          return res.status(400).json({ error: 'Invalid or unowned financialGoalId' });
        }
      }
      updatePayload.financialGoalId = financialGoalId || null;
    }

    if (targetDate !== undefined) updatePayload.targetDate = targetDate || null;
    if (priority !== undefined) updatePayload.priority = Math.max(1, Number(priority) || 1);

    await db
      .update(goals)
      .set(updatePayload)
      .where(and(eq(goals.id, goalId), eq(goals.userId, userId)));

    const updatedDetails = await getGoalDetails(userId, goalId);
    res.json({ success: true, goal: updatedDetails });
  } catch (err) {
    console.error('[Goals API Error] Failed updating goal:', err);
    res.status(500).json({ error: 'Failed to update goal', details: err.message });
  }
});

/**
 * DELETE /api/goals/:id
 * Deletes a goal (Cascades to milestones/mappings, SET NULL on parent/financial links, NEVER touches execution logs)
 */
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const goalId = req.params.id;

    const [existing] = await db
      .select()
      .from(goals)
      .where(and(eq(goals.id, goalId), eq(goals.userId, userId)))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    await db
      .delete(goals)
      .where(and(eq(goals.id, goalId), eq(goals.userId, userId)));

    res.json({ success: true, deletedId: goalId });
  } catch (err) {
    console.error('[Goals API Error] Failed deleting goal:', err);
    res.status(500).json({ error: 'Failed to delete goal', details: err.message });
  }
});

/**
 * POST /api/goals/:id/milestones
 * Creates a milestone for a goal
 */
router.post('/:id/milestones', async (req, res) => {
  try {
    const userId = req.user.id;
    const goalId = req.params.id;

    const [goal] = await db
      .select()
      .from(goals)
      .where(and(eq(goals.id, goalId), eq(goals.userId, userId)))
      .limit(1);

    if (!goal) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    const {
      title,
      description = '',
      targetValue = 1,
      currentValue = 0,
      dueDate = null,
      sortOrder = 1
    } = req.body;

    if (!title || typeof title !== 'string' || title.trim() === '') {
      return res.status(400).json({ error: 'Milestone title is required' });
    }

    const nowIso = new Date().toISOString();
    const milestoneId = cryptoNative.randomUUID();

    await db.insert(goalMilestones).values({
      id: milestoneId,
      userId,
      goalId,
      title: title.trim(),
      description: String(description).trim(),
      targetValue: Math.max(0, Number(targetValue) || 1),
      currentValue: Math.max(0, Number(currentValue) || 0),
      isCompleted: false,
      dueDate: dueDate || null,
      sortOrder: Math.max(1, Number(sortOrder) || 1),
      createdAt: nowIso,
      updatedAt: nowIso
    });

    const updatedGoal = await getGoalDetails(userId, goalId);
    res.status(201).json({ success: true, milestoneId, goal: updatedGoal });
  } catch (err) {
    console.error('[Goals API Error] Failed creating milestone:', err);
    res.status(500).json({ error: 'Failed to create milestone', details: err.message });
  }
});

/**
 * PUT /api/goals/:id/milestones/:milestoneId
 * Updates an existing milestone
 */
router.put('/:id/milestones/:milestoneId', async (req, res) => {
  try {
    const userId = req.user.id;
    const { id: goalId, milestoneId } = req.params;

    const [ms] = await db
      .select()
      .from(goalMilestones)
      .where(and(
        eq(goalMilestones.id, milestoneId),
        eq(goalMilestones.goalId, goalId),
        eq(goalMilestones.userId, userId)
      ))
      .limit(1);

    if (!ms) {
      return res.status(404).json({ error: 'Milestone not found' });
    }

    const {
      title,
      description,
      targetValue,
      currentValue,
      isCompleted,
      dueDate,
      sortOrder
    } = req.body;

    const updatePayload = { updatedAt: new Date().toISOString() };

    if (title !== undefined) {
      if (!title || typeof title !== 'string' || title.trim() === '') {
        return res.status(400).json({ error: 'Milestone title cannot be empty' });
      }
      updatePayload.title = title.trim();
    }

    if (description !== undefined) updatePayload.description = String(description).trim();
    if (targetValue !== undefined) updatePayload.targetValue = Math.max(0, Number(targetValue) || 1);
    if (currentValue !== undefined) updatePayload.currentValue = Math.max(0, Number(currentValue) || 0);

    if (isCompleted !== undefined) {
      const boolComp = Boolean(isCompleted);
      updatePayload.isCompleted = boolComp;
      updatePayload.completedAt = boolComp ? new Date().toISOString() : null;
    }

    if (dueDate !== undefined) updatePayload.dueDate = dueDate || null;
    if (sortOrder !== undefined) updatePayload.sortOrder = Math.max(1, Number(sortOrder) || 1);

    await db
      .update(goalMilestones)
      .set(updatePayload)
      .where(and(eq(goalMilestones.id, milestoneId), eq(goalMilestones.userId, userId)));

    const updatedGoal = await getGoalDetails(userId, goalId);
    res.json({ success: true, milestoneId, goal: updatedGoal });
  } catch (err) {
    console.error('[Goals API Error] Failed updating milestone:', err);
    res.status(500).json({ error: 'Failed to update milestone', details: err.message });
  }
});

/**
 * POST /api/goals/:id/milestones/:milestoneId/toggle
 * Quick toggles milestone completion
 */
router.post('/:id/milestones/:milestoneId/toggle', async (req, res) => {
  try {
    const userId = req.user.id;
    const { id: goalId, milestoneId } = req.params;

    const [ms] = await db
      .select()
      .from(goalMilestones)
      .where(and(
        eq(goalMilestones.id, milestoneId),
        eq(goalMilestones.goalId, goalId),
        eq(goalMilestones.userId, userId)
      ))
      .limit(1);

    if (!ms) {
      return res.status(404).json({ error: 'Milestone not found' });
    }

    const nextCompleted = !ms.isCompleted;
    const nowIso = new Date().toISOString();

    await db
      .update(goalMilestones)
      .set({
        isCompleted: nextCompleted,
        completedAt: nextCompleted ? nowIso : null,
        updatedAt: nowIso
      })
      .where(and(eq(goalMilestones.id, milestoneId), eq(goalMilestones.userId, userId)));

    const updatedGoal = await getGoalDetails(userId, goalId);
    res.json({ success: true, milestoneId, isCompleted: nextCompleted, goal: updatedGoal });
  } catch (err) {
    console.error('[Goals API Error] Failed toggling milestone:', err);
    res.status(500).json({ error: 'Failed to toggle milestone', details: err.message });
  }
});

/**
 * DELETE /api/goals/:id/milestones/:milestoneId
 * Deletes a milestone
 */
router.delete('/:id/milestones/:milestoneId', async (req, res) => {
  try {
    const userId = req.user.id;
    const { id: goalId, milestoneId } = req.params;

    const [ms] = await db
      .select()
      .from(goalMilestones)
      .where(and(
        eq(goalMilestones.id, milestoneId),
        eq(goalMilestones.goalId, goalId),
        eq(goalMilestones.userId, userId)
      ))
      .limit(1);

    if (!ms) {
      return res.status(404).json({ error: 'Milestone not found' });
    }

    await db
      .delete(goalMilestones)
      .where(and(eq(goalMilestones.id, milestoneId), eq(goalMilestones.userId, userId)));

    const updatedGoal = await getGoalDetails(userId, goalId);
    res.json({ success: true, deletedMilestoneId: milestoneId, goal: updatedGoal });
  } catch (err) {
    console.error('[Goals API Error] Failed deleting milestone:', err);
    res.status(500).json({ error: 'Failed to delete milestone', details: err.message });
  }
});

/**
 * POST /api/goals/:id/task-mappings
 * Maps a task key to a goal
 */
router.post('/:id/task-mappings', async (req, res) => {
  try {
    const userId = req.user.id;
    const goalId = req.params.id;

    const [goal] = await db
      .select()
      .from(goals)
      .where(and(eq(goals.id, goalId), eq(goals.userId, userId)))
      .limit(1);

    if (!goal) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    const { taskKey, milestoneId = null, category = null, weight = 1 } = req.body;

    if (!taskKey || typeof taskKey !== 'string' || taskKey.trim() === '') {
      return res.status(400).json({ error: 'taskKey is required' });
    }

    if (milestoneId) {
      const [ms] = await db
        .select()
        .from(goalMilestones)
        .where(and(
          eq(goalMilestones.id, milestoneId),
          eq(goalMilestones.goalId, goalId),
          eq(goalMilestones.userId, userId)
        ))
        .limit(1);

      if (!ms) {
        return res.status(400).json({ error: 'Milestone does not exist or belong to this goal' });
      }
    }

    const nowIso = new Date().toISOString();
    const mappingId = cryptoNative.randomUUID();

    await db.insert(goalTaskMappings).values({
      id: mappingId,
      userId,
      goalId,
      milestoneId: milestoneId || null,
      taskKey: taskKey.trim(),
      category: category || null,
      weight: Math.max(1, Number(weight) || 1),
      createdAt: nowIso
    });

    const updatedGoal = await getGoalDetails(userId, goalId);
    res.status(201).json({ success: true, mappingId, goal: updatedGoal });
  } catch (err) {
    console.error('[Goals API Error] Failed creating task mapping:', err);
    res.status(500).json({ error: 'Failed to create task mapping', details: err.message });
  }
});

/**
 * DELETE /api/goals/:id/task-mappings/:mappingId
 * Deletes a task mapping (Does NOT touch task_executions)
 */
router.delete('/:id/task-mappings/:mappingId', async (req, res) => {
  try {
    const userId = req.user.id;
    const { id: goalId, mappingId } = req.params;

    const [mapping] = await db
      .select()
      .from(goalTaskMappings)
      .where(and(
        eq(goalTaskMappings.id, mappingId),
        eq(goalTaskMappings.goalId, goalId),
        eq(goalTaskMappings.userId, userId)
      ))
      .limit(1);

    if (!mapping) {
      return res.status(404).json({ error: 'Task mapping not found' });
    }

    await db
      .delete(goalTaskMappings)
      .where(and(eq(goalTaskMappings.id, mappingId), eq(goalTaskMappings.userId, userId)));

    const updatedGoal = await getGoalDetails(userId, goalId);
    res.json({ success: true, deletedMappingId: mappingId, goal: updatedGoal });
  } catch (err) {
    console.error('[Goals API Error] Failed deleting task mapping:', err);
    res.status(500).json({ error: 'Failed to delete task mapping', details: err.message });
  }
});

export default router;
