import { db } from '../db/index.js';
import { schedules, scheduleEntries, tasks } from '../db/schema.js';
import { eq, and, asc, desc } from 'drizzle-orm';
import { cryptoNative } from '../utils/crypto.js';
import { getTaskById } from './taskService.js';

const VALID_TIMING_TYPES = ['FIXED', 'FLEXIBLE'];
const VALID_RECURRENCE_PATTERNS = ['DAILY', 'WEEKLY', 'DATE_RANGE'];
const VALID_DAYS_OF_WEEK = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

/**
 * Creates a new schedule for a user.
 */
export async function createSchedule({
  userId,
  name,
  isDefault = false,
  activeFromDate = null,
  activeToDate = null
}) {
  if (!userId || typeof userId !== 'string') {
    throw new Error('[ScheduleService] Invalid or missing userId');
  }
  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new Error('[ScheduleService] Invalid or missing schedule name');
  }

  const newScheduleId = cryptoNative.randomUUID();
  const nowIso = new Date().toISOString();
  const defaultBool = Boolean(isDefault);

  // If new schedule is set as default, unset default flag on other schedules for this user
  if (defaultBool) {
    await db
      .update(schedules)
      .set({ isDefault: false, updatedAt: nowIso })
      .where(eq(schedules.userId, userId));
  }

  await db.insert(schedules).values({
    id: newScheduleId,
    userId,
    name: name.trim(),
    isDefault: defaultBool,
    activeFromDate: activeFromDate ? activeFromDate.trim() : null,
    activeToDate: activeToDate ? activeToDate.trim() : null,
    createdAt: nowIso,
    updatedAt: nowIso
  });

  const [created] = await db
    .select()
    .from(schedules)
    .where(and(eq(schedules.id, newScheduleId), eq(schedules.userId, userId)))
    .limit(1);

  return created;
}

/**
 * Retrieves a schedule by ID scoped to user.
 */
export async function getScheduleById(userId, scheduleId) {
  if (!userId || !scheduleId) return null;
  const [sched] = await db
    .select()
    .from(schedules)
    .where(and(eq(schedules.id, scheduleId), eq(schedules.userId, userId)))
    .limit(1);
  return sched || null;
}

/**
 * Retrieves all schedules for a user.
 */
export async function getSchedulesByUser(userId) {
  if (!userId) return [];
  return await db
    .select()
    .from(schedules)
    .where(eq(schedules.userId, userId))
    .orderBy(desc(schedules.isDefault), desc(schedules.createdAt));
}

/**
 * Retrieves default schedule for a user.
 */
export async function getDefaultSchedule(userId) {
  if (!userId) return null;
  const [sched] = await db
    .select()
    .from(schedules)
    .where(and(eq(schedules.userId, userId), eq(schedules.isDefault, true)))
    .limit(1);
  return sched || null;
}

/**
 * Updates an existing schedule metadata.
 */
export async function updateSchedule(userId, scheduleId, updates = {}) {
  if (!userId || !scheduleId) {
    throw new Error('[ScheduleService] Invalid userId or scheduleId');
  }

  const existing = await getScheduleById(userId, scheduleId);
  if (!existing) {
    throw new Error(`[ScheduleService] Schedule not found: ${scheduleId}`);
  }

  const fieldsToUpdate = {};
  const nowIso = new Date().toISOString();

  if (updates.name !== undefined && typeof updates.name === 'string' && updates.name.trim()) {
    fieldsToUpdate.name = updates.name.trim();
  }
  if (updates.activeFromDate !== undefined) {
    fieldsToUpdate.activeFromDate = updates.activeFromDate ? String(updates.activeFromDate).trim() : null;
  }
  if (updates.activeToDate !== undefined) {
    fieldsToUpdate.activeToDate = updates.activeToDate ? String(updates.activeToDate).trim() : null;
  }
  if (updates.isDefault !== undefined) {
    const shouldBeDefault = Boolean(updates.isDefault);
    if (shouldBeDefault && !existing.isDefault) {
      // Unset previous default schedules for user
      await db
        .update(schedules)
        .set({ isDefault: false, updatedAt: nowIso })
        .where(eq(schedules.userId, userId));
    }
    fieldsToUpdate.isDefault = shouldBeDefault;
  }

  if (Object.keys(fieldsToUpdate).length === 0) {
    return existing;
  }

  fieldsToUpdate.updatedAt = nowIso;

  await db
    .update(schedules)
    .set(fieldsToUpdate)
    .where(and(eq(schedules.id, scheduleId), eq(schedules.userId, userId)));

  return await getScheduleById(userId, scheduleId);
}

/**
 * Deletes a schedule. Cascades to schedule_entries and sets task_executions.scheduleEntryId = NULL.
 */
export async function deleteSchedule(userId, scheduleId) {
  if (!userId || !scheduleId) {
    throw new Error('[ScheduleService] Invalid userId or scheduleId');
  }

  const existing = await getScheduleById(userId, scheduleId);
  if (!existing) {
    throw new Error(`[ScheduleService] Schedule not found: ${scheduleId}`);
  }

  await db
    .delete(schedules)
    .where(and(eq(schedules.id, scheduleId), eq(schedules.userId, userId)));

  return { success: true, deletedScheduleId: scheduleId };
}

/**
 * Adds a new entry to a schedule.
 */
export async function addScheduleEntry({
  userId,
  scheduleId,
  taskId,
  timingType = 'FIXED',
  recurrencePattern = 'WEEKLY',
  dayOfWeek = null,
  activeDate = null,
  startMinutes = null,
  endMinutes = null,
  sortOrder = 0
}) {
  if (!userId || !scheduleId || !taskId) {
    throw new Error('[ScheduleService] Missing required identifiers (userId, scheduleId, taskId)');
  }

  const sched = await getScheduleById(userId, scheduleId);
  if (!sched) {
    throw new Error(`[ScheduleService] Schedule not found: ${scheduleId}`);
  }

  const taskInst = await getTaskById(userId, taskId);
  if (!taskInst) {
    throw new Error(`[ScheduleService] Task not found: ${taskId}`);
  }

  const cleanTimingType = String(timingType).toUpperCase();
  if (!VALID_TIMING_TYPES.includes(cleanTimingType)) {
    throw new Error(`[ScheduleService] Invalid timingType: ${timingType}. Must be FIXED or FLEXIBLE.`);
  }

  const cleanRecurrence = String(recurrencePattern).toUpperCase();
  if (!VALID_RECURRENCE_PATTERNS.includes(cleanRecurrence)) {
    throw new Error(`[ScheduleService] Invalid recurrencePattern: ${recurrencePattern}. Must be DAILY, WEEKLY, or DATE_RANGE.`);
  }

  let cleanDayOfWeek = dayOfWeek ? String(dayOfWeek).toUpperCase() : null;
  if (cleanDayOfWeek && !VALID_DAYS_OF_WEEK.includes(cleanDayOfWeek)) {
    throw new Error(`[ScheduleService] Invalid dayOfWeek: ${dayOfWeek}`);
  }

  const entryId = cryptoNative.randomUUID();
  const nowIso = new Date().toISOString();

  await db.insert(scheduleEntries).values({
    id: entryId,
    scheduleId,
    taskId,
    timingType: cleanTimingType,
    recurrencePattern: cleanRecurrence,
    dayOfWeek: cleanDayOfWeek,
    activeDate: activeDate ? String(activeDate).trim() : null,
    startMinutes: startMinutes !== null && startMinutes !== undefined ? Number(startMinutes) : null,
    endMinutes: endMinutes !== null && endMinutes !== undefined ? Number(endMinutes) : null,
    sortOrder: Number(sortOrder) || 0,
    createdAt: nowIso,
    updatedAt: nowIso
  });

  const [created] = await db
    .select()
    .from(scheduleEntries)
    .where(eq(scheduleEntries.id, entryId))
    .limit(1);

  return created;
}

/**
 * Updates an existing schedule entry.
 */
export async function updateScheduleEntry(userId, entryId, updates = {}) {
  if (!userId || !entryId) {
    throw new Error('[ScheduleService] Invalid userId or entryId');
  }

  const [existing] = await db
    .select()
    .from(scheduleEntries)
    .where(eq(scheduleEntries.id, entryId))
    .limit(1);

  if (!existing) {
    throw new Error(`[ScheduleService] Schedule entry not found: ${entryId}`);
  }

  // Check schedule ownership
  const sched = await getScheduleById(userId, existing.scheduleId);
  if (!sched) {
    throw new Error(`[ScheduleService] Unauthorized schedule entry update for entry ${entryId}`);
  }

  const fieldsToUpdate = {};
  if (updates.timingType !== undefined) {
    const cleanTiming = String(updates.timingType).toUpperCase();
    if (!VALID_TIMING_TYPES.includes(cleanTiming)) throw new Error(`Invalid timingType: ${updates.timingType}`);
    fieldsToUpdate.timingType = cleanTiming;
  }
  if (updates.recurrencePattern !== undefined) {
    const cleanRec = String(updates.recurrencePattern).toUpperCase();
    if (!VALID_RECURRENCE_PATTERNS.includes(cleanRec)) throw new Error(`Invalid recurrencePattern: ${updates.recurrencePattern}`);
    fieldsToUpdate.recurrencePattern = cleanRec;
  }
  if (updates.dayOfWeek !== undefined) {
    const cleanDay = updates.dayOfWeek ? String(updates.dayOfWeek).toUpperCase() : null;
    if (cleanDay && !VALID_DAYS_OF_WEEK.includes(cleanDay)) throw new Error(`Invalid dayOfWeek: ${updates.dayOfWeek}`);
    fieldsToUpdate.dayOfWeek = cleanDay;
  }
  if (updates.activeDate !== undefined) {
    fieldsToUpdate.activeDate = updates.activeDate ? String(updates.activeDate).trim() : null;
  }
  if (updates.startMinutes !== undefined) {
    fieldsToUpdate.startMinutes = updates.startMinutes !== null ? Number(updates.startMinutes) : null;
  }
  if (updates.endMinutes !== undefined) {
    fieldsToUpdate.endMinutes = updates.endMinutes !== null ? Number(updates.endMinutes) : null;
  }
  if (updates.sortOrder !== undefined) {
    fieldsToUpdate.sortOrder = Number(updates.sortOrder) || 0;
  }

  if (Object.keys(fieldsToUpdate).length === 0) {
    return existing;
  }

  fieldsToUpdate.updatedAt = new Date().toISOString();

  await db
    .update(scheduleEntries)
    .set(fieldsToUpdate)
    .where(eq(scheduleEntries.id, entryId));

  const [updated] = await db
    .select()
    .from(scheduleEntries)
    .where(eq(scheduleEntries.id, entryId))
    .limit(1);

  return updated;
}

/**
 * Deletes a schedule entry. Sets task_executions.scheduleEntryId = NULL.
 */
export async function deleteScheduleEntry(userId, entryId) {
  if (!userId || !entryId) {
    throw new Error('[ScheduleService] Invalid userId or entryId');
  }

  const [existing] = await db
    .select()
    .from(scheduleEntries)
    .where(eq(scheduleEntries.id, entryId))
    .limit(1);

  if (!existing) {
    throw new Error(`[ScheduleService] Schedule entry not found: ${entryId}`);
  }

  const sched = await getScheduleById(userId, existing.scheduleId);
  if (!sched) {
    throw new Error(`[ScheduleService] Unauthorized schedule entry deletion for entry ${entryId}`);
  }

  await db.delete(scheduleEntries).where(eq(scheduleEntries.id, entryId));
  return { success: true, deletedEntryId: entryId };
}

/**
 * Retrieves a full schedule joined with its entries and task definitions.
 */
export async function getScheduleWithEntries(userId, scheduleId) {
  const sched = await getScheduleById(userId, scheduleId);
  if (!sched) return null;

  const entries = await db
    .select({
      id: scheduleEntries.id,
      scheduleId: scheduleEntries.scheduleId,
      taskId: scheduleEntries.taskId,
      timingType: scheduleEntries.timingType,
      recurrencePattern: scheduleEntries.recurrencePattern,
      dayOfWeek: scheduleEntries.dayOfWeek,
      activeDate: scheduleEntries.activeDate,
      startMinutes: scheduleEntries.startMinutes,
      endMinutes: scheduleEntries.endMinutes,
      sortOrder: scheduleEntries.sortOrder,
      createdAt: scheduleEntries.createdAt,
      updatedAt: scheduleEntries.updatedAt,
      taskKey: tasks.taskKey,
      taskTitle: tasks.title,
      taskCategory: tasks.category,
      taskDefaultPriority: tasks.defaultPriority,
      taskDefaultDurationMinutes: tasks.defaultDurationMinutes
    })
    .from(scheduleEntries)
    .innerJoin(tasks, eq(scheduleEntries.taskId, tasks.id))
    .where(eq(scheduleEntries.scheduleId, scheduleId))
    .orderBy(asc(scheduleEntries.sortOrder), asc(scheduleEntries.startMinutes));

  return {
    ...sched,
    entries
  };
}
