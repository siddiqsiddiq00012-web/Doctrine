import { db } from '../db/index.js';
import { taskResourceRequirements } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import cryptoNative from 'node:crypto';

/**
 * Baseline Doctrine Task-to-Resource Mappings.
 * Maps standard task keys to exact resource consumption quantities from INITIAL_INVENTORY.
 */
export const DEFAULT_DOCTRINE_RESOURCE_MAPPINGS = [
  // Mass Shake (~1000 kcal)
  { taskKey: 'mon-3', resourceId: 'inv-5', quantityConsumed: 1, unit: 'pcs', notes: '1 banana' },
  { taskKey: 'mon-3', resourceId: 'inv-2', quantityConsumed: 0.3, unit: 'liters', notes: '300 ml milk' },
  { taskKey: 'mon-3', resourceId: 'inv-3', quantityConsumed: 0.04, unit: 'kg', notes: '40 g oats' },
  { taskKey: 'mon-3', resourceId: 'inv-6', quantityConsumed: 20, unit: 'g', notes: '20 g peanut butter' },

  { taskKey: 'mass_shake', resourceId: 'inv-5', quantityConsumed: 1, unit: 'pcs', notes: '1 banana' },
  { taskKey: 'mass_shake', resourceId: 'inv-2', quantityConsumed: 0.3, unit: 'liters', notes: '300 ml milk' },
  { taskKey: 'mass_shake', resourceId: 'inv-3', quantityConsumed: 0.04, unit: 'kg', notes: '40 g oats' },
  { taskKey: 'mass_shake', resourceId: 'inv-6', quantityConsumed: 20, unit: 'g', notes: '20 g peanut butter' },

  // AM Skincare Routine
  { taskKey: 'mon-2', resourceId: 'inv-19', quantityConsumed: 0.033, unit: 'bottle', notes: 'Morning cleanser' },
  { taskKey: 'mon-2', resourceId: 'inv-20', quantityConsumed: 0.033, unit: 'tube', notes: 'SPF 50+ sunscreen' },
  { taskKey: 'mon-2', resourceId: 'inv-21', quantityConsumed: 0.033, unit: 'jar', notes: 'Ceramide moisturiser' },

  { taskKey: 'am_skincare', resourceId: 'inv-19', quantityConsumed: 0.033, unit: 'bottle', notes: 'Morning cleanser' },
  { taskKey: 'am_skincare', resourceId: 'inv-20', quantityConsumed: 0.033, unit: 'tube', notes: 'SPF 50+ sunscreen' },
  { taskKey: 'am_skincare', resourceId: 'inv-21', quantityConsumed: 0.033, unit: 'jar', notes: 'Ceramide moisturiser' },

  // Post-workout Nutrition
  { taskKey: 'mon-5', resourceId: 'inv-2', quantityConsumed: 0.2, unit: 'liters', notes: '200 ml warm milk' },
  { taskKey: 'mon-5', resourceId: 'inv-10', quantityConsumed: 5, unit: 'g', notes: '1 tsp flaxseed' },

  { taskKey: 'post_workout', resourceId: 'inv-2', quantityConsumed: 0.2, unit: 'liters', notes: '200 ml warm milk' },
  { taskKey: 'post_workout', resourceId: 'inv-10', quantityConsumed: 5, unit: 'g', notes: '1 tsp flaxseed' },

  // Glow Shake
  { taskKey: 'mon-6', resourceId: 'inv-12', quantityConsumed: 0.107, unit: 'kg', notes: 'Carrot & Beet Glow Shake' },
  { taskKey: 'glow_shake', resourceId: 'inv-12', quantityConsumed: 0.107, unit: 'kg', notes: 'Carrot & Beet Glow Shake' },

  // Morning Supplements
  { taskKey: 'supplements_am', resourceId: 'inv-14', quantityConsumed: 1, unit: 'capsules', notes: 'Biotin 2,500-5,000 mcg' },
  { taskKey: 'supplements_am', resourceId: 'inv-15', quantityConsumed: 1, unit: 'tablets', notes: 'MSM 500 mg AM' },
  { taskKey: 'supplements_am', resourceId: 'inv-18', quantityConsumed: 5, unit: 'g', notes: '1 tsp Amla powder' },
];

/**
 * Fetch all resource requirement mappings for a given user and taskKey.
 */
export async function getTaskResourceRequirements(userId, taskKey) {
  if (!userId || !taskKey) return [];
  return await db.select()
    .from(taskResourceRequirements)
    .where(and(
      eq(taskResourceRequirements.userId, userId),
      eq(taskResourceRequirements.taskKey, taskKey)
    ));
}

/**
 * Fetch all task resource requirement mappings for a user across all tasks.
 */
export async function getAllTaskResourceRequirementsForUser(userId) {
  if (!userId) return [];
  return await db.select()
    .from(taskResourceRequirements)
    .where(eq(taskResourceRequirements.userId, userId));
}

/**
 * Add or update a task-resource requirement mapping for a user.
 */
export async function addTaskResourceRequirement(userId, data) {
  if (!userId) throw new Error('[TaskResourceService] userId is required');
  if (!data.taskKey) throw new Error('[TaskResourceService] taskKey is required');
  if (!data.resourceId) throw new Error('[TaskResourceService] resourceId is required');
  if (data.quantityConsumed === undefined || data.quantityConsumed === null || data.quantityConsumed <= 0) {
    throw new Error('[TaskResourceService] quantityConsumed must be a positive number');
  }
  if (!data.unit) throw new Error('[TaskResourceService] unit is required');

  const existing = await db.select()
    .from(taskResourceRequirements)
    .where(and(
      eq(taskResourceRequirements.userId, userId),
      eq(taskResourceRequirements.taskKey, data.taskKey),
      eq(taskResourceRequirements.resourceId, data.resourceId)
    ));

  if (existing.length > 0) {
    const recordId = existing[0].id;
    await db.update(taskResourceRequirements)
      .set({
        taskId: data.taskId ?? existing[0].taskId,
        quantityConsumed: Number(data.quantityConsumed),
        unit: data.unit,
        isOptional: data.isOptional !== undefined ? Boolean(data.isOptional) : existing[0].isOptional,
        notes: data.notes ?? existing[0].notes,
        updatedAt: new Date().toISOString(),
      })
      .where(and(
        eq(taskResourceRequirements.id, recordId),
        eq(taskResourceRequirements.userId, userId)
      ));

    const updated = await db.select()
      .from(taskResourceRequirements)
      .where(eq(taskResourceRequirements.id, recordId));
    return { created: false, record: updated[0] };
  } else {
    const recordId = `trr_${cryptoNative.randomUUID()}`;
    const newRecord = {
      id: recordId,
      userId,
      taskKey: data.taskKey,
      taskId: data.taskId || null,
      resourceId: data.resourceId,
      quantityConsumed: Number(data.quantityConsumed),
      unit: data.unit,
      isOptional: Boolean(data.isOptional),
      notes: data.notes || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.insert(taskResourceRequirements).values(newRecord);
    return { created: true, record: newRecord };
  }
}

/**
 * Update an existing task-resource requirement mapping.
 */
export async function updateTaskResourceRequirement(userId, requirementId, updates) {
  if (!userId || !requirementId) throw new Error('[TaskResourceService] userId and requirementId are required');

  const existing = await db.select()
    .from(taskResourceRequirements)
    .where(and(
      eq(taskResourceRequirements.id, requirementId),
      eq(taskResourceRequirements.userId, userId)
    ));

  if (existing.length === 0) {
    throw new Error('[TaskResourceService] Requirement mapping not found');
  }

  const newQty = updates.quantityConsumed !== undefined ? Number(updates.quantityConsumed) : existing[0].quantityConsumed;
  if (newQty <= 0) {
    throw new Error('[TaskResourceService] quantityConsumed must be a positive number');
  }

  await db.update(taskResourceRequirements)
    .set({
      quantityConsumed: newQty,
      unit: updates.unit ?? existing[0].unit,
      isOptional: updates.isOptional !== undefined ? Boolean(updates.isOptional) : existing[0].isOptional,
      notes: updates.notes ?? existing[0].notes,
      updatedAt: new Date().toISOString(),
    })
    .where(and(
      eq(taskResourceRequirements.id, requirementId),
      eq(taskResourceRequirements.userId, userId)
    ));

  const updated = await db.select()
    .from(taskResourceRequirements)
    .where(eq(taskResourceRequirements.id, requirementId));
  return updated[0];
}

/**
 * Delete a task-resource requirement mapping.
 */
export async function deleteTaskResourceRequirement(userId, requirementId) {
  if (!userId || !requirementId) throw new Error('[TaskResourceService] userId and requirementId are required');

  const existing = await db.select()
    .from(taskResourceRequirements)
    .where(and(
      eq(taskResourceRequirements.id, requirementId),
      eq(taskResourceRequirements.userId, userId)
    ));

  if (existing.length === 0) return { deleted: false };

  await db.delete(taskResourceRequirements)
    .where(and(
      eq(taskResourceRequirements.id, requirementId),
      eq(taskResourceRequirements.userId, userId)
    ));

  return { deleted: true };
}

/**
 * Idempotently seed default task-resource requirement mappings for a user.
 */
export async function seedDefaultTaskResourceRequirements(userId) {
  if (!userId) throw new Error('[TaskResourceService] userId is required');

  let addedCount = 0;
  for (const mapping of DEFAULT_DOCTRINE_RESOURCE_MAPPINGS) {
    const res = await addTaskResourceRequirement(userId, mapping);
    if (res.created) addedCount++;
  }

  return { seeded: true, addedCount };
}
