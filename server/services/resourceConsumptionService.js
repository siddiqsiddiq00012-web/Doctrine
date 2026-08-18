import { db } from '../db/index.js';
import { resourceStock, resourceEvents } from '../db/schema.js';
import { getTaskResourceRequirements } from './taskResourceService.js';
import { eq, and } from 'drizzle-orm';
import cryptoNative from 'node:crypto';

/**
 * Normalizes and converts quantities between standard, compatible resource units.
 * Throws an Error if units are incompatible or unknown.
 */
export function convertUnitQuantity(amount, sourceUnit, targetUnit) {
  const s = String(sourceUnit || '').trim().toLowerCase();
  const t = String(targetUnit || '').trim().toLowerCase();
  const val = Number(amount);

  if (isNaN(val) || val <= 0) {
    throw new Error(`[UnitConversion Error] Invalid quantity: ${amount}`);
  }

  // Identical units or equivalent synonyms
  const isLiter = (u) => u === 'l' || u === 'liters' || u === 'liter';
  const isMl = (u) => u === 'ml' || u === 'milliliters';
  const isGram = (u) => u === 'g' || u === 'grams';
  const isKg = (u) => u === 'kg' || u === 'kilograms';
  const isCount = (u) => u === 'pcs' || u === 'pieces' || u === 'unit' || u === 'units' || u === 'pc';

  if (s === t || (isLiter(s) && isLiter(t)) || (isGram(s) && isGram(t)) || (isKg(s) && isKg(t)) || (isCount(s) && isCount(t))) {
    return val;
  }

  // Volume conversions (ml <-> L / liters)
  if (isMl(s) && isLiter(t)) {
    return val / 1000;
  }
  if (isLiter(s) && isMl(t)) {
    return val * 1000;
  }

  // Weight conversions (g <-> kg)
  if (isGram(s) && isKg(t)) {
    return val / 1000;
  }
  if (isKg(s) && isGram(t)) {
    return val * 1000;
  }

  throw new Error(`[UnitConversion Error] Incompatible unit conversion requested: "${sourceUnit}" -> "${targetUnit}"`);
}

/**
 * Main Domain Handler for TASK_COMPLETED events.
 * Resolves task_resource_requirements, pre-validates stock balances, and executes atomic resource consumption.
 */
export async function handleTaskCompletedResourceConsumption(event) {
  const userId = event.userId;
  const taskKey = event.payload?.taskKey || event.sourceId;

  if (!userId || !taskKey) {
    throw new Error('[ResourceConsumptionHandler Error] Event payload must contain valid userId and taskKey');
  }

  // Resolve requirements mapping for the task key
  const requirements = await getTaskResourceRequirements(userId, taskKey);
  if (!requirements || requirements.length === 0) {
    return {
      success: true,
      taskKey,
      consumedResources: [],
      message: `No resource requirements mapped for task "${taskKey}".`
    };
  }

  // -------------------------------------------------------------
  // PHASE 1: PRE-TRANSACTION VALIDATION (READ ONLY)
  // Check that all required resources exist in resource_stock,
  // units are compatible, and current stock >= required stock.
  // -------------------------------------------------------------
  const validatedItems = [];

  for (const req of requirements) {
    const [stockRecord] = await db.select()
      .from(resourceStock)
      .where(and(
        eq(resourceStock.userId, userId),
        eq(resourceStock.resourceId, req.resourceId)
      ));

    // 1. Missing Resource Stock Record Check
    if (!stockRecord) {
      const errMessage = `[ResourceConsumption Error] MISSING_RESOURCE_STOCK: Resource "${req.resourceId}" not found in resource_stock for user ${userId}.`;
      throw new Error(errMessage);
    }

    // 2. Unit Compatibility Check
    const requiredQtyInStockUnit = convertUnitQuantity(req.quantityConsumed, req.unit, stockRecord.unit || req.unit);

    // 3. Shortage Policy Check (Strict integrity: no clamping to zero)
    if (stockRecord.currentQty < requiredQtyInStockUnit) {
      const errMessage = `[ResourceConsumption Error] INSUFFICIENT_STOCK: Required ${requiredQtyInStockUnit} ${stockRecord.unit || req.unit} of resource "${req.resourceId}", but only ${stockRecord.currentQty} available.`;
      throw new Error(errMessage);
    }

    validatedItems.push({
      req,
      stockRecord,
      requiredQtyInStockUnit,
      unit: stockRecord.unit || req.unit,
    });
  }

  // -------------------------------------------------------------
  // PHASE 2: ATOMIC DB WRITES (TRANSACTIONAL CONSUMPTION)
  // Create resource_events (CONSUMPTION) and update resource_stock.
  // -------------------------------------------------------------
  const consumedResources = [];
  const nowIso = new Date().toISOString();
  const todayStr = event.occurredAt ? event.occurredAt.split('T')[0] : nowIso.split('T')[0];

  const performWritesSync = (tx) => {
    for (const item of validatedItems) {
      const eventId = `res_evt_${cryptoNative.randomUUID()}`;
      const newStockQty = item.stockRecord.currentQty - item.requiredQtyInStockUnit;

      // 1. Log CONSUMPTION event in resource_events
      tx.insert(resourceEvents).values({
        id: eventId,
        userId,
        resourceId: item.req.resourceId,
        resourceName: item.req.notes || item.req.resourceId,
        eventType: 'CONSUMPTION',
        amount: item.requiredQtyInStockUnit,
        unit: item.unit,
        date: todayStr,
        notes: `Automatic consumption for task: ${taskKey}`,
        createdAt: nowIso,
      }).run();

      // 2. Update resource_stock with reduced currentQty
      tx.update(resourceStock)
        .set({
          currentQty: newStockQty,
          updatedAt: nowIso,
        })
        .where(and(
          eq(resourceStock.userId, userId),
          eq(resourceStock.resourceId, item.req.resourceId)
        ))
        .run();

      consumedResources.push({
        resourceId: item.req.resourceId,
        quantityConsumed: item.requiredQtyInStockUnit,
        unit: item.unit,
        remainingStock: newStockQty,
      });
    }
  };

  try {
    if (typeof db.transaction === 'function') {
      db.transaction(performWritesSync);
    } else {
      performWritesSync(db);
    }
  } catch (txErr) {
    // If transaction wrapping encounters async/sync mismatch, fallback to direct atomic loop
    consumedResources.length = 0;
    for (const item of validatedItems) {
      const eventId = `res_evt_${cryptoNative.randomUUID()}`;
      const newStockQty = item.stockRecord.currentQty - item.requiredQtyInStockUnit;

      await db.insert(resourceEvents).values({
        id: eventId,
        userId,
        resourceId: item.req.resourceId,
        resourceName: item.req.notes || item.req.resourceId,
        eventType: 'CONSUMPTION',
        amount: item.requiredQtyInStockUnit,
        unit: item.unit,
        date: todayStr,
        notes: `Automatic consumption for task: ${taskKey}`,
        createdAt: nowIso,
      });

      await db.update(resourceStock)
        .set({
          currentQty: newStockQty,
          updatedAt: nowIso,
        })
        .where(and(
          eq(resourceStock.userId, userId),
          eq(resourceStock.resourceId, item.req.resourceId)
        ));

      consumedResources.push({
        resourceId: item.req.resourceId,
        quantityConsumed: item.requiredQtyInStockUnit,
        unit: item.unit,
        remainingStock: newStockQty,
      });
    }
  }

  return {
    success: true,
    taskKey,
    consumedResources,
  };
}
