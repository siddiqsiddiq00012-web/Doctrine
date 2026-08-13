import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { db } from '../db/index.js';
import { resourceStock, resourceEvents } from '../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { cryptoNative } from '../utils/crypto.js';
import { INITIAL_INVENTORY } from '../../src/data/doctrineData.js';

const router = Router();

// Helper to get or seed resource stock for a user
async function getUserResourceState(userId) {
  // Fetch existing stock records for user
  const dbStocks = await db
    .select()
    .from(resourceStock)
    .where(eq(resourceStock.userId, userId));

  const stockMap = new Map(dbStocks.map((s) => [s.resourceId, s]));

  // Ensure every Doctrine item has a stock record in DB
  const missingValues = [];
  const nowIso = new Date().toISOString();

  INITIAL_INVENTORY.forEach((item) => {
    if (!stockMap.has(item.id)) {
      const newId = cryptoNative.randomUUID();
      missingValues.push({
        id: newId,
        userId,
        resourceId: item.id,
        currentQty: item.currentQty,
        inCart: false,
        lastPurchased: null,
        createdAt: nowIso,
        updatedAt: nowIso,
      });
      stockMap.set(item.id, {
        id: newId,
        userId,
        resourceId: item.id,
        currentQty: item.currentQty,
        inCart: false,
        lastPurchased: null,
      });
    }
  });

  if (missingValues.length > 0) {
    await db.insert(resourceStock).values(missingValues);
  }

  // Fetch past event logs for user
  const events = await db
    .select()
    .from(resourceEvents)
    .where(eq(resourceEvents.userId, userId))
    .orderBy(desc(resourceEvents.createdAt));

  // Compute calculated state for each item
  let fullyStockedCount = 0;
  let needsPurchaseCount = 0;
  let totalEstimatedCost = 0;

  const resources = INITIAL_INVENTORY.map((item) => {
    const stockRec = stockMap.get(item.id);
    const currentQty = stockRec ? stockRec.currentQty : item.currentQty;
    const inCart = stockRec ? stockRec.inCart : false;
    const required = item.purchaseQty || (item.minStockLevel ? item.minStockLevel * 2 : 1);

    const needed = Math.max(0, required - currentQty);
    const surplus = Math.max(0, currentQty - required);
    const progressPct = required > 0 ? Math.min(100, Math.round((currentQty / required) * 100)) : 100;

    let status = 'STOCKED';
    if (currentQty <= 0) {
      status = 'NOT STARTED';
      needsPurchaseCount++;
    } else if (currentQty <= item.minStockLevel || needed > 0) {
      status = 'NEEDS PURCHASE';
      needsPurchaseCount++;
    } else if (currentQty > required) {
      status = 'SURPLUS';
      fullyStockedCount++;
    } else if (currentQty === required) {
      status = 'FULLY STOCKED';
      fullyStockedCount++;
    } else {
      status = 'PARTIALLY STOCKED';
    }

    if (item.estimatedPrice && needed > 0) {
      totalEstimatedCost += item.estimatedPrice;
    }

    return {
      ...item,
      required,
      currentQty,
      needed,
      surplus,
      progressPct,
      status,
      inCart,
      lastPurchased: stockRec?.lastPurchased || null,
    };
  });

  // Auto-derived purchase plan
  const purchasePlanItems = resources.filter((item) => item.needed > 0 || item.currentQty <= item.minStockLevel);
  const purchasePlan = {
    FOOD: purchasePlanItems.filter((i) => i.category === 'FOOD'),
    SUPPLEMENTS: purchasePlanItems.filter((i) => i.category === 'SUPPLEMENTS'),
    SKINCARE: purchasePlanItems.filter((i) => i.category === 'SKINCARE'),
    HAIR: purchasePlanItems.filter((i) => i.category === 'HAIR'),
  };

  return {
    resources,
    purchasePlan,
    summary: {
      totalResources: INITIAL_INVENTORY.length,
      fullyStockedCount,
      needsPurchaseCount,
      totalEstimatedCost,
    },
    events,
  };
}

// GET /api/resources — Fetch Resource Intelligence & Event State
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const state = await getUserResourceState(userId);
    res.json({ success: true, ...state });
  } catch (error) {
    console.error('[Resources API] Fetch failed:', error);
    res.status(500).json({ error: 'Failed to retrieve resource state', details: error.message });
  }
});

// POST /api/resources/event — Record Purchase, Consumption, or Adjustment Event
router.post('/event', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { resourceId, eventType, amount, unit, date, notes } = req.body;

    // 1. Verify resource exists in Doctrine definition
    const doctrineItem = INITIAL_INVENTORY.find((i) => i.id === resourceId);
    if (!doctrineItem) {
      return res.status(400).json({
        error: 'Invalid Resource',
        message: 'Resource ID is not defined in Doctrine. Creation of custom resources is prohibited by Doctrine.',
      });
    }

    // 2. Validate eventType
    if (!['PURCHASE', 'CONSUMPTION', 'ADJUSTMENT'].includes(eventType)) {
      return res.status(400).json({
        error: 'Invalid Event Type',
        message: 'Event type must be PURCHASE, CONSUMPTION, or ADJUSTMENT.',
      });
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({
        error: 'Invalid Amount',
        message: 'Event amount must be a positive number.',
      });
    }

    // Fetch current stock record
    const [stockRec] = await db
      .select()
      .from(resourceStock)
      .where(and(eq(resourceStock.userId, userId), eq(resourceStock.resourceId, resourceId)))
      .limit(1);

    const currentQty = stockRec ? stockRec.currentQty : doctrineItem.currentQty;
    let nextQty = currentQty;

    if (eventType === 'PURCHASE') {
      nextQty = currentQty + numAmount;
    } else if (eventType === 'CONSUMPTION') {
      if (currentQty - numAmount < 0) {
        return res.status(400).json({
          error: 'Validation Error',
          message: `Consumption amount (${numAmount} ${unit || doctrineItem.unit}) exceeds available stock (${currentQty} ${doctrineItem.unit}). Negative inventory is prohibited.`,
        });
      }
      nextQty = currentQty - numAmount;
    } else if (eventType === 'ADJUSTMENT') {
      nextQty = numAmount;
    }

    nextQty = Math.round(nextQty * 100) / 100;
    const nowIso = new Date().toISOString();
    const eventDate = date || nowIso.split('T')[0];

    // Insert permanent event log
    await db.insert(resourceEvents).values({
      id: cryptoNative.randomUUID(),
      userId,
      resourceId,
      resourceName: doctrineItem.name,
      eventType,
      amount: numAmount,
      unit: unit || doctrineItem.unit,
      date: eventDate,
      notes: notes || '',
      createdAt: nowIso,
    });

    // Update or insert stock record
    if (stockRec) {
      const updateObj = { currentQty: nextQty, updatedAt: nowIso };
      if (eventType === 'PURCHASE') {
        updateObj.lastPurchased = eventDate;
        updateObj.inCart = false;
      }
      await db
        .update(resourceStock)
        .set(updateObj)
        .where(eq(resourceStock.id, stockRec.id));
    } else {
      await db.insert(resourceStock).values({
        id: cryptoNative.randomUUID(),
        userId,
        resourceId,
        currentQty: nextQty,
        inCart: false,
        lastPurchased: eventType === 'PURCHASE' ? eventDate : null,
        createdAt: nowIso,
        updatedAt: nowIso,
      });
    }

    const state = await getUserResourceState(userId);
    res.json({ success: true, ...state });
  } catch (error) {
    console.error('[Resources API] Event record failed:', error);
    res.status(500).json({ error: 'Failed to record resource event', details: error.message });
  }
});

// POST /api/resources/toggle-cart — Toggle Shopping Cart Status
router.post('/toggle-cart', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { resourceId } = req.body;

    const doctrineItem = INITIAL_INVENTORY.find((i) => i.id === resourceId);
    if (!doctrineItem) {
      return res.status(400).json({ error: 'Invalid Resource' });
    }

    const [stockRec] = await db
      .select()
      .from(resourceStock)
      .where(and(eq(resourceStock.userId, userId), eq(resourceStock.resourceId, resourceId)))
      .limit(1);

    const nowIso = new Date().toISOString();
    const nextInCart = stockRec ? !stockRec.inCart : true;

    if (stockRec) {
      await db
        .update(resourceStock)
        .set({ inCart: nextInCart, updatedAt: nowIso })
        .where(eq(resourceStock.id, stockRec.id));
    } else {
      await db.insert(resourceStock).values({
        id: cryptoNative.randomUUID(),
        userId,
        resourceId,
        currentQty: doctrineItem.currentQty,
        inCart: true,
        createdAt: nowIso,
        updatedAt: nowIso,
      });
    }

    const state = await getUserResourceState(userId);
    res.json({ success: true, ...state });
  } catch (error) {
    console.error('[Resources API] Toggle cart failed:', error);
    res.status(500).json({ error: 'Failed to toggle cart status' });
  }
});

// Reject attempts to mutate Doctrine resource definitions
router.post('/create', requireAuth, (req, res) => {
  res.status(403).json({ error: 'Forbidden', message: 'Doctrine resource definitions are immutable. Creation of custom resources is strictly prohibited.' });
});

router.delete('/:id', requireAuth, (req, res) => {
  res.status(403).json({ error: 'Forbidden', message: 'Doctrine resource definitions are immutable. Deletion of resources is strictly prohibited.' });
});

router.put('/:id/requirement', requireAuth, (req, res) => {
  res.status(403).json({ error: 'Forbidden', message: 'Doctrine resource requirements are immutable. Modification of requirements is strictly prohibited.' });
});

export default router;
