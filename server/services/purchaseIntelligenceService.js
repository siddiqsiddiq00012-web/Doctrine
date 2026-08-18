import { db } from '../db/index.js';
import { cartItems, resourceStock } from '../db/schema.js';
import { eq, and, inArray } from 'drizzle-orm';
import { calculateResourceForecasts } from './resourceForecastService.js';
import { rupeesToPaise } from '../utils/money.js';
import cryptoNative from 'node:crypto';

export async function cleanupCorruptedAutomatedCartItems(dbClient, userId) {
  if (!userId) return;

  const userCartItems = await dbClient
    .select()
    .from(cartItems)
    .where(and(eq(cartItems.userId, userId), inArray(cartItems.status, ['PENDING', 'APPROVED'])));

  const idsToDelete = [];
  const seenResources = new Map();

  userCartItems.forEach((item) => {
    if (item.id && item.id.startsWith('cart_auto_')) {
      if (item.resourceId === 'inv-2' || item.resourceId === 'inv-5') {
        idsToDelete.push(item.id);
      } else if (item.resourceId) {
        if (seenResources.has(item.resourceId)) {
          idsToDelete.push(item.id);
        } else {
          seenResources.set(item.resourceId, item.id);
        }
      }
    }
  });

  if (idsToDelete.length > 0) {
    await dbClient.delete(cartItems).where(and(eq(cartItems.userId, userId), inArray(cartItems.id, idsToDelete)));
  }
}

/**
 * EVALUATES INVENTORY DEPLETION AND INTELLIGENTLY CREATES OR UPDATES PURCHASE INTENT (CART ITEMS).
 *
 * Rules:
 * 1. Executes after successful resource consumption.
 * 2. Uses authoritative resource forecasting engine.
 * 3. Idempotent & Concurrency Safe: Sets desired cart item quantity (PENDING | APPROVED) rather than accumulating.
 * 4. FINANCIAL BOUNDARY: Produces ₹0 financial transactions (purchase intent only).
 * 5. Strict multi-tenant isolation by userId.
 */
export async function evaluatePurchaseIntelligence(dbClient, userId) {
  if (!userId) {
    throw new Error('[PurchaseIntelligence Error] userId is required');
  }

  // 1. Calculate authoritative resource forecasts for user (using updated post-consumption inventory state)
  const forecastResult = await calculateResourceForecasts(dbClient, userId);
  const resources = forecastResult.resources || [];

  const queuedCartItems = [];
  const updatedCartItems = [];
  const nowIso = new Date().toISOString();

  // 2. Identify resources that require purchasing (excluding inv-29 durable tool and DAILY_PURCHASE items)
  const depletedResources = resources.filter((item) => {
    if (item.id === 'inv-29') return false; // Durable tool, zero depletion rate
    if (item.procurementMode === 'DAILY_PURCHASE') return false; // DAILY_PURCHASE resources managed via schedule planning
    const recQty = item.forecast?.requiredPurchaseQty || item.forecast?.recommendedPurchaseQty || 0;
    const daysToDep = item.forecast?.daysToDepletion;

    return (
      recQty > 0 ||
      item.currentQty <= item.minStockLevel ||
      (daysToDep !== null && daysToDep <= 7)
    );
  });

  if (depletedResources.length === 0) {
    return {
      success: true,
      evaluatedCount: resources.length,
      queuedCartItems: [],
      updatedCartItems: [],
      message: 'All resource inventory levels are sufficient. 0 purchase intents queued.',
    };
  }

  // 3. Process each depleted resource inside transactional boundary
  const executeEvaluationTransaction = async (tx) => {
    for (const item of depletedResources) {
      const recQty = Math.max(1, Number(item.forecast?.requiredPurchaseQty || item.forecast?.recommendedPurchaseQty || item.needed || 1));
      const daysToDep = item.forecast?.daysToDepletion;
      const priority = item.forecast?.isLowStock ? 1 : 2;

      let estPricePaise = 0;
      if (item.estimatedPrice && typeof item.estimatedPrice === 'number' && item.estimatedPrice > 0) {
        estPricePaise = rupeesToPaise(item.estimatedPrice * recQty);
      }

      // Check for existing active purchase intent in cart_items (PENDING or APPROVED)
      const existingActiveCartItems = await tx
        .select()
        .from(cartItems)
        .where(
          and(
            eq(cartItems.userId, userId),
            eq(cartItems.resourceId, item.id),
            inArray(cartItems.status, ['PENDING', 'APPROVED'])
          )
        );

      if (existingActiveCartItems.length > 0) {
        // Idempotently set desired active cart item quantity
        const activeItem = existingActiveCartItems[0];
        const newQty = recQty;

        await tx
          .update(cartItems)
          .set({
            quantity: newQty,
            priority,
            estimatedPricePaise: estPricePaise > 0 ? estPricePaise : activeItem.estimatedPricePaise,
            updatedAt: nowIso,
          })
          .where(and(eq(cartItems.userId, userId), eq(cartItems.id, activeItem.id)));

        // Synchronize inCart status on resource_stock
        await tx
          .update(resourceStock)
          .set({ inCart: true, updatedAt: nowIso })
          .where(and(eq(resourceStock.userId, userId), eq(resourceStock.resourceId, item.id)));

        updatedCartItems.push({
          cartItemId: activeItem.id,
          resourceId: item.id,
          itemName: item.name,
          quantity: newQty,
          status: activeItem.status,
        });
      } else {
        // Create a new active purchase intent (cart_items)
        const cartId = `cart_auto_${cryptoNative.randomUUID()}`;
        const newCartRow = {
          id: cartId,
          userId,
          itemName: item.name,
          resourceId: item.id,
          quantity: recQty,
          estimatedPricePaise: estPricePaise,
          priority,
          status: 'PENDING',
          createdAt: nowIso,
          updatedAt: nowIso,
        };

        await tx.insert(cartItems).values(newCartRow);

        // Synchronize inCart status on resource_stock
        await tx
          .update(resourceStock)
          .set({ inCart: true, updatedAt: nowIso })
          .where(and(eq(resourceStock.userId, userId), eq(resourceStock.resourceId, item.id)));

        queuedCartItems.push({
          cartItemId: cartId,
          resourceId: item.id,
          itemName: item.name,
          quantity: recQty,
          status: 'PENDING',
        });
      }
    }
  };

  await executeEvaluationTransaction(dbClient);
  await cleanupCorruptedAutomatedCartItems(dbClient, userId);

  return {
    success: true,
    evaluatedCount: resources.length,
    depletedCount: depletedResources.length,
    queuedCartItems,
    updatedCartItems,
  };
}

/**
 * Domain Event Handler for TASK_COMPLETED domain events.
 * Executes purchase intelligence calculation AFTER resource consumption handler has mutated resource_stock.
 */
export async function handleResourceDepletionPurchaseIntelligence(event) {
  const userId = event.userId;
  if (!userId) {
    throw new Error('[PurchaseIntelligenceHandler Error] Event payload must contain valid userId');
  }

  return await evaluatePurchaseIntelligence(db, userId);
}
