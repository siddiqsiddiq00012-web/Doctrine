import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { db } from '../db/index.js';
import { resourceStock, resourceEvents, cartItems, financialTransactions } from '../db/schema.js';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { cryptoNative } from '../utils/crypto.js';
import { INITIAL_INVENTORY } from '../../src/data/doctrineData.js';
import { calculateResourceForecasts } from '../services/resourceForecastService.js';

const router = Router();

// Helper to get or seed resource stock for a user
async function getUserResourceState(userId) {
  return await calculateResourceForecasts(db, userId);
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

// GET /api/resources/forecast — Fetch Resource Depletion Forecasts Only
router.get('/forecast', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const forecasts = await calculateResourceForecasts(db, userId);
    res.json({ success: true, ...forecasts });
  } catch (error) {
    console.error('[Resources API] Forecast fetch failed:', error);
    res.status(500).json({ error: 'Failed to calculate resource forecasts', details: error.message });
  }
});

// POST /api/resources/event — Record Resource Mutation (Purchase, Consumption, Adjustment)
router.post('/event', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { resourceId, eventType, amount, unit, date, notes } = req.body;

    if (!resourceId || !eventType || amount === undefined || amount === null) {
      return res.status(400).json({ error: 'Missing Required Fields', message: 'resourceId, eventType, and amount are required.' });
    }

    if (!['PURCHASE', 'CONSUMPTION', 'ADJUSTMENT'].includes(eventType)) {
      return res.status(400).json({ error: 'Invalid Event Type', message: 'eventType must be PURCHASE, CONSUMPTION, or ADJUSTMENT' });
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: 'Invalid Amount', message: 'amount must be a positive number greater than 0.' });
    }

    const doctrineItem = INITIAL_INVENTORY.find((i) => i.id === resourceId);
    if (!doctrineItem) {
      return res.status(400).json({ error: 'Invalid Resource', message: 'resourceId is not a valid Doctrine resource definition.' });
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

    // On PURCHASE, update any active cart items & record financial expense transaction
    if (eventType === 'PURCHASE') {
      const activeCartItems = await db
        .select()
        .from(cartItems)
        .where(
          and(
            eq(cartItems.userId, userId),
            eq(cartItems.resourceId, resourceId),
            inArray(cartItems.status, ['PENDING', 'APPROVED'])
          )
        );

      const purchasePricePaise = Math.round((Number(doctrineItem.estimatedPrice) || 0) * 100 * numAmount);

      for (const cartItem of activeCartItems) {
        await db
          .update(cartItems)
          .set({
            status: 'PURCHASED',
            actualPricePaise: purchasePricePaise > 0 ? purchasePricePaise : (cartItem.estimatedPricePaise * cartItem.quantity),
            purchasedAt: eventDate,
            updatedAt: nowIso
          })
          .where(eq(cartItems.id, cartItem.id));

        await db.insert(financialTransactions).values({
          id: `ft_purch_${cryptoNative.randomUUID()}`,
          userId,
          type: 'EXPENSE',
          amountPaise: purchasePricePaise > 0 ? purchasePricePaise : (cartItem.estimatedPricePaise * cartItem.quantity),
          category: 'RESOURCE_PURCHASE',
          description: `Purchased: ${doctrineItem.name}`,
          date: eventDate,
          cartItemId: cartItem.id,
          createdAt: nowIso
        });
      }
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

    // SYNCHRONIZE WITH ACTIVE CART_ITEMS TABLE
    if (nextInCart) {
      const activeCartItems = await db
        .select()
        .from(cartItems)
        .where(
          and(
            eq(cartItems.userId, userId),
            eq(cartItems.resourceId, resourceId),
            inArray(cartItems.status, ['PENDING', 'APPROVED'])
          )
        );

      if (activeCartItems.length === 0) {
        const estPricePaise = Math.round((Number(doctrineItem.estimatedPrice) || 0) * 100);
        await db.insert(cartItems).values({
          id: `cart_man_${cryptoNative.randomUUID()}`,
          userId,
          itemName: doctrineItem.name,
          resourceId,
          quantity: 1,
          estimatedPricePaise: estPricePaise,
          priority: 2,
          status: 'PENDING',
          notes: 'Manually added from Resources',
          createdAt: nowIso,
          updatedAt: nowIso,
        });
      }
    } else {
      await db
        .delete(cartItems)
        .where(
          and(
            eq(cartItems.userId, userId),
            eq(cartItems.resourceId, resourceId),
            inArray(cartItems.status, ['PENDING', 'APPROVED'])
          )
        );
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
