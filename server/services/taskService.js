import { db } from '../db/index.js';
import { tasks } from '../db/schema.js';
import { eq, and, asc } from 'drizzle-orm';
import { cryptoNative } from '../utils/crypto.js';

/**
 * Creates a new task definition for a user.
 * Enforces taskKey uniqueness per user.
 */
export async function createTask({
  userId,
  taskKey,
  title,
  description = '',
  category,
  defaultPriority = 1,
  defaultDurationMinutes = 30
}) {
  if (!userId || typeof userId !== 'string') {
    throw new Error('[TaskService] Invalid or missing userId');
  }
  if (!taskKey || typeof taskKey !== 'string' || !taskKey.trim()) {
    throw new Error('[TaskService] Invalid or missing taskKey');
  }
  if (!title || typeof title !== 'string' || !title.trim()) {
    throw new Error('[TaskService] Invalid or missing title');
  }
  if (!category || typeof category !== 'string' || !category.trim()) {
    throw new Error('[TaskService] Invalid or missing category');
  }

  const cleanTaskKey = taskKey.trim();
  const cleanTitle = title.trim();
  const cleanCategory = category.trim();

  // Check for existing task with same key for this user
  const [existing] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.userId, userId), eq(tasks.taskKey, cleanTaskKey)))
    .limit(1);

  if (existing) {
    throw new Error(`[TaskService] Task key "${cleanTaskKey}" already exists for user ${userId}`);
  }

  const newTaskId = cryptoNative.randomUUID();
  const nowIso = new Date().toISOString();

  await db.insert(tasks).values({
    id: newTaskId,
    userId,
    taskKey: cleanTaskKey,
    title: cleanTitle,
    description: description ? description.trim() : '',
    category: cleanCategory,
    defaultPriority: Number(defaultPriority) || 1,
    defaultDurationMinutes: Number(defaultDurationMinutes) || 30,
    createdAt: nowIso,
    updatedAt: nowIso
  });

  const [created] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, newTaskId), eq(tasks.userId, userId)))
    .limit(1);

  return created;
}

/**
 * Retrieves a single task definition by ID, scoped to user.
 */
export async function getTaskById(userId, taskId) {
  if (!userId || !taskId) return null;
  const [task] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
    .limit(1);
  return task || null;
}

/**
 * Retrieves a single task definition by key, scoped to user.
 */
export async function getTaskByKey(userId, taskKey) {
  if (!userId || !taskKey) return null;
  const [task] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.taskKey, taskKey), eq(tasks.userId, userId)))
    .limit(1);
  return task || null;
}

/**
 * Retrieves all task definitions for a user.
 */
export async function getTasksByUser(userId) {
  if (!userId) return [];
  return await db
    .select()
    .from(tasks)
    .where(eq(tasks.userId, userId))
    .orderBy(asc(tasks.taskKey));
}

/**
 * Updates an existing task definition.
 */
export async function updateTask(userId, taskId, updates = {}) {
  if (!userId || !taskId) {
    throw new Error('[TaskService] Invalid userId or taskId');
  }

  const existing = await getTaskById(userId, taskId);
  if (!existing) {
    throw new Error(`[TaskService] Task not found: ${taskId}`);
  }

  const fieldsToUpdate = {};
  if (updates.title !== undefined && typeof updates.title === 'string' && updates.title.trim()) {
    fieldsToUpdate.title = updates.title.trim();
  }
  if (updates.description !== undefined && typeof updates.description === 'string') {
    fieldsToUpdate.description = updates.description.trim();
  }
  if (updates.category !== undefined && typeof updates.category === 'string' && updates.category.trim()) {
    fieldsToUpdate.category = updates.category.trim();
  }
  if (updates.defaultPriority !== undefined) {
    fieldsToUpdate.defaultPriority = Number(updates.defaultPriority) || existing.defaultPriority;
  }
  if (updates.defaultDurationMinutes !== undefined) {
    fieldsToUpdate.defaultDurationMinutes = Number(updates.defaultDurationMinutes) || existing.defaultDurationMinutes;
  }

  if (Object.keys(fieldsToUpdate).length === 0) {
    return existing;
  }

  fieldsToUpdate.updatedAt = new Date().toISOString();

  await db
    .update(tasks)
    .set(fieldsToUpdate)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));

  return await getTaskById(userId, taskId);
}

/**
 * Deletes a task definition for a user.
 * Cascades deletion to schedule_entries and sets task_executions.taskId = NULL.
 */
export async function deleteTask(userId, taskId) {
  if (!userId || !taskId) {
    throw new Error('[TaskService] Invalid userId or taskId');
  }

  const existing = await getTaskById(userId, taskId);
  if (!existing) {
    throw new Error(`[TaskService] Task not found: ${taskId}`);
  }

  await db
    .delete(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));

  return { success: true, deletedTaskId: taskId };
}
