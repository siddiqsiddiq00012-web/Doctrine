import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { db } from '../db/index.js';
import { cartItems, financialTransactions, resourceStock, resourceEvents } from '../db/schema.js';
import { eq, and, asc, desc } from 'drizzle-orm';
import { cryptoNative } from '../utils/crypto.js';
import { calculateFinancialState } from '../services/financialEngine.js';
import { cleanupCorruptedAutomatedCartItems } from '../services/purchaseIntelligenceService.js';
import { INITIAL_INVENTORY } from '../../src/data/doctrineData.js';

const router = Router();

/**
 * Validates strict YYYY-MM-DD calendar date string.
 * Rejects invalid format, non-existent months, or impossible days (e.g. 2026-02-30).
 */
export function isValidCalendarDate(dateStr) {
  if (typeof dateStr !== 'string') return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;

  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  if (isNaN(year) || isNaN(month) || isNaN(day)) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1) return false;

  const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
  const daysInMonths = [0, 31, isLeapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  return day <= daysInMonths[month];
}

/**
 * GET /api/financial/state
 * Exposes deterministic financial state for the authenticated user.
 * Optional query parameter: ?date=YYYY-MM-DD
 */
router.get('/state', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required. Please log in.'
      });
    }

    let targetDateStr = null;
    if (req.query.date !== undefined && req.query.date !== '') {
      const rawDate = String(req.query.date).trim();
      if (!isValidCalendarDate(rawDate)) {
        return res.status(400).json({
          error: 'Invalid date',
          message: 'date must use YYYY-MM-DD format'
        });
      }
      targetDateStr = rawDate;
    }

    // Call authoritative deterministic financial engine
    const state = await calculateFinancialState(db, userId, targetDateStr);

    return res.json({
      success: true,
      financialState: state
    });
  } catch (error) {
    console.error('[Financial API Error]:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to calculate financial state'
    });
  }
});

/**
 * GET /api/financial/cart
 * Returns only the authenticated user's independent Cart items.
 */
router.get('/cart', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    // Clean up corrupted automated cart entries on query
    await cleanupCorruptedAutomatedCartItems(db, userId);

    const items = await db
      .select()
      .from(cartItems)
      .where(eq(cartItems.userId, userId))
      .orderBy(asc(cartItems.priority), desc(cartItems.createdAt));

    const formattedItems = items.map((item) => {
      const qty = Number(item.quantity || 1);
      const estPrice = Number(item.estimatedPricePaise || 0);
      return {
        ...item,
        quantity: qty,
        estimatedPricePaise: estPrice,
        totalEstimatedPaise: Math.round(qty * estPrice)
      };
    });

    return res.json({
      success: true,
      items: formattedItems
    });
  } catch (error) {
    console.error('[Cart API GET Error]:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch cart items'
    });
  }
});

/**
 * POST /api/financial/cart
 * Create a new planned purchase intent item.
 */
router.post('/cart', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      itemName,
      quantity = 1,
      estimatedPricePaise,
      priority = 1,
      targetPurchaseDate,
      financialGoalId,
      resourceId,
      notes = ''
    } = req.body;

    // Server-side validation
    if (!itemName || typeof itemName !== 'string' || !itemName.trim()) {
      return res.status(400).json({
        error: 'Invalid input',
        message: 'itemName is required and cannot be empty'
      });
    }

    const numQty = Number(quantity);
    if (isNaN(numQty) || numQty <= 0) {
      return res.status(400).json({
        error: 'Invalid input',
        message: 'quantity must be a number greater than 0'
      });
    }

    const numPrice = Number(estimatedPricePaise);
    if (isNaN(numPrice) || !Number.isInteger(numPrice) || numPrice < 0) {
      return res.status(400).json({
        error: 'Invalid input',
        message: 'estimatedPricePaise must be an integer greater than or equal to 0'
      });
    }

    const numPriority = Number(priority);
    if (isNaN(numPriority) || !Number.isInteger(numPriority) || numPriority < 1) {
      return res.status(400).json({
        error: 'Invalid input',
        message: 'priority must be an integer greater than or equal to 1'
      });
    }

    if (targetPurchaseDate && !isValidCalendarDate(String(targetPurchaseDate).trim())) {
      return res.status(400).json({
        error: 'Invalid date',
        message: 'targetPurchaseDate must use YYYY-MM-DD format'
      });
    }

    const nowIso = new Date().toISOString();
    const newCartItem = {
      id: cryptoNative.randomUUID(),
      userId,
      itemName: itemName.trim(),
      quantity: numQty,
      estimatedPricePaise: numPrice,
      priority: numPriority,
      targetPurchaseDate: targetPurchaseDate ? String(targetPurchaseDate).trim() : null,
      financialGoalId: financialGoalId ? String(financialGoalId).trim() : null,
      resourceId: resourceId ? String(resourceId).trim() : null,
      status: 'PENDING',
      notes: typeof notes === 'string' ? notes.trim() : '',
      createdAt: nowIso,
      updatedAt: nowIso
    };

    await db.insert(cartItems).values(newCartItem);

    return res.status(201).json({
      success: true,
      item: {
        ...newCartItem,
        totalEstimatedPaise: Math.round(numQty * numPrice)
      }
    });
  } catch (error) {
    console.error('[Cart API POST Error]:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create cart item'
    });
  }
});

/**
 * PATCH /api/financial/cart/:id
 * Modify existing cart item (owned strictly by authenticated user).
 */
router.patch('/cart/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Invalid input', message: 'Cart item ID is required' });
    }

    // Verify ownership (IDOR check)
    const [existing] = await db
      .select()
      .from(cartItems)
      .where(and(eq(cartItems.id, id), eq(cartItems.userId, userId)))
      .limit(1);

    if (!existing) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Cart item not found'
      });
    }

    const {
      itemName,
      quantity,
      estimatedPricePaise,
      priority,
      targetPurchaseDate,
      financialGoalId,
      resourceId,
      notes,
      status
    } = req.body;

    const updateData = {};

    if (itemName !== undefined) {
      if (typeof itemName !== 'string' || !itemName.trim()) {
        return res.status(400).json({ error: 'Invalid input', message: 'itemName cannot be empty' });
      }
      updateData.itemName = itemName.trim();
    }

    if (quantity !== undefined) {
      const numQty = Number(quantity);
      if (isNaN(numQty) || numQty <= 0) {
        return res.status(400).json({ error: 'Invalid input', message: 'quantity must be > 0' });
      }
      updateData.quantity = numQty;
    }

    if (estimatedPricePaise !== undefined) {
      const numPrice = Number(estimatedPricePaise);
      if (isNaN(numPrice) || !Number.isInteger(numPrice) || numPrice < 0) {
        return res.status(400).json({ error: 'Invalid input', message: 'estimatedPricePaise must be an integer >= 0' });
      }
      updateData.estimatedPricePaise = numPrice;
    }

    if (priority !== undefined) {
      const numPri = Number(priority);
      if (isNaN(numPri) || !Number.isInteger(numPri) || numPri < 1) {
        return res.status(400).json({ error: 'Invalid input', message: 'priority must be an integer >= 1' });
      }
      updateData.priority = numPri;
    }

    if (targetPurchaseDate !== undefined) {
      if (targetPurchaseDate !== null && targetPurchaseDate !== '' && !isValidCalendarDate(String(targetPurchaseDate).trim())) {
        return res.status(400).json({ error: 'Invalid date', message: 'targetPurchaseDate must use YYYY-MM-DD format' });
      }
      updateData.targetPurchaseDate = targetPurchaseDate ? String(targetPurchaseDate).trim() : null;
    }

    if (financialGoalId !== undefined) {
      updateData.financialGoalId = financialGoalId ? String(financialGoalId).trim() : null;
    }

    if (resourceId !== undefined) {
      updateData.resourceId = resourceId ? String(resourceId).trim() : null;
    }

    if (notes !== undefined) {
      updateData.notes = typeof notes === 'string' ? notes.trim() : '';
    }

    if (status !== undefined) {
      if (status === 'PURCHASED') {
        return res.status(400).json({
          error: 'Invalid status transition',
          message: 'Actual purchase confirmation workflow required for PURCHASED status. Use POST /api/financial/cart/:id/purchase.'
        });
      }
      if (!['PENDING', 'APPROVED', 'DEFERRED', 'REJECTED'].includes(status)) {
        return res.status(400).json({
          error: 'Invalid status',
          message: 'status must be PENDING, APPROVED, DEFERRED, or REJECTED'
        });
      }
      updateData.status = status;
    }

    updateData.updatedAt = new Date().toISOString();

    await db
      .update(cartItems)
      .set(updateData)
      .where(and(eq(cartItems.id, id), eq(cartItems.userId, userId)));

    const [updatedItem] = await db
      .select()
      .from(cartItems)
      .where(and(eq(cartItems.id, id), eq(cartItems.userId, userId)))
      .limit(1);

    const qty = Number(updatedItem.quantity || 1);
    const estPrice = Number(updatedItem.estimatedPricePaise || 0);

    return res.json({
      success: true,
      item: {
        ...updatedItem,
        totalEstimatedPaise: Math.round(qty * estPrice)
      }
    });
  } catch (error) {
    console.error('[Cart API PATCH Error]:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update cart item'
    });
  }
});

/**
 * POST /api/financial/cart/:id/purchase
 * Confirms purchase of a planned cart item.
 * - Updates status to PURCHASED
 * - Sets actualPricePaise and purchasedAt
 * - Creates financial EXPENSE transaction in financial_transactions
 * - If linked to a resourceId, updates resource_stock (increments stock, sets inCart=false) and logs PURCHASE event in resource_events
 */
router.post('/cart/:id/purchase', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { actualPricePaise, date } = req.body || {};

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Invalid input', message: 'Cart item ID is required' });
    }

    const [cartItem] = await db
      .select()
      .from(cartItems)
      .where(and(eq(cartItems.id, id), eq(cartItems.userId, userId)))
      .limit(1);

    if (!cartItem) {
      return res.status(404).json({ error: 'Not found', message: 'Cart item not found' });
    }

    if (cartItem.status === 'PURCHASED') {
      return res.status(400).json({ error: 'Already purchased', message: 'This cart item has already been purchased' });
    }

    const nowIso = new Date().toISOString();
    const purchaseDate = date && isValidCalendarDate(String(date).trim()) ? String(date).trim() : nowIso.split('T')[0];

    const numQty = Number(cartItem.quantity || 1);
    let finalPricePaise = Number(actualPricePaise);
    if (isNaN(finalPricePaise) || !Number.isInteger(finalPricePaise) || finalPricePaise < 0) {
      finalPricePaise = Math.round(numQty * Number(cartItem.estimatedPricePaise || 0));
    }

    // Update cartItem record
    await db
      .update(cartItems)
      .set({
        status: 'PURCHASED',
        actualPricePaise: finalPricePaise,
        purchasedAt: purchaseDate,
        updatedAt: nowIso
      })
      .where(and(eq(cartItems.id, id), eq(cartItems.userId, userId)));

    // Create financial EXPENSE transaction
    const txId = `ft_purch_${cryptoNative.randomUUID()}`;
    await db.insert(financialTransactions).values({
      id: txId,
      userId,
      type: 'EXPENSE',
      amountPaise: finalPricePaise,
      category: cartItem.resourceId ? 'RESOURCE_PURCHASE' : 'GENERAL_EXPENSE',
      description: `Purchased: ${cartItem.itemName}`,
      date: purchaseDate,
      cartItemId: cartItem.id,
      createdAt: nowIso
    });

    // If linked to resourceId, update resource stock & record purchase event
    if (cartItem.resourceId) {
      const doctrineItem = INITIAL_INVENTORY.find((i) => i.id === cartItem.resourceId);
      const pkgQty = doctrineItem?.packageQty || 1;
      const addAmount = numQty * pkgQty;

      const [stockRec] = await db
        .select()
        .from(resourceStock)
        .where(and(eq(resourceStock.userId, userId), eq(resourceStock.resourceId, cartItem.resourceId)))
        .limit(1);

      const currentQty = stockRec ? stockRec.currentQty : (doctrineItem?.currentQty || 0);
      const nextQty = Math.round((currentQty + addAmount) * 100) / 100;

      if (stockRec) {
        await db
          .update(resourceStock)
          .set({
            currentQty: nextQty,
            inCart: false,
            lastPurchased: purchaseDate,
            updatedAt: nowIso
          })
          .where(eq(resourceStock.id, stockRec.id));
      } else {
        await db.insert(resourceStock).values({
          id: cryptoNative.randomUUID(),
          userId,
          resourceId: cartItem.resourceId,
          currentQty: nextQty,
          inCart: false,
          lastPurchased: purchaseDate,
          createdAt: nowIso,
          updatedAt: nowIso
        });
      }

      await db.insert(resourceEvents).values({
        id: cryptoNative.randomUUID(),
        userId,
        resourceId: cartItem.resourceId,
        resourceName: cartItem.itemName,
        eventType: 'PURCHASE',
        amount: addAmount,
        unit: doctrineItem?.unit || 'units',
        date: purchaseDate,
        notes: `Purchased via Cart (Item #${cartItem.id})`,
        createdAt: nowIso
      });
    }

    const [updatedItem] = await db
      .select()
      .from(cartItems)
      .where(and(eq(cartItems.id, id), eq(cartItems.userId, userId)))
      .limit(1);

    return res.json({
      success: true,
      cartItem: {
        ...updatedItem,
        quantity: numQty,
        estimatedPricePaise: Number(updatedItem.estimatedPricePaise || 0),
        totalEstimatedPaise: finalPricePaise
      }
    });
  } catch (error) {
    console.error('[Cart Purchase Error]:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: 'Failed to complete cart purchase' });
  }
});

/**
 * DELETE /api/financial/cart/:id
 * Removes cart intent item without modifying transactions, goals, or resources.
 */
router.delete('/cart/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Invalid input', message: 'Cart item ID is required' });
    }

    // Verify ownership (IDOR check)
    const [existing] = await db
      .select()
      .from(cartItems)
      .where(and(eq(cartItems.id, id), eq(cartItems.userId, userId)))
      .limit(1);

    if (!existing) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Cart item not found'
      });
    }

    await db
      .delete(cartItems)
      .where(and(eq(cartItems.id, id), eq(cartItems.userId, userId)));

    return res.json({
      success: true,
      message: 'Cart item removed'
    });
  } catch (error) {
    console.error('[Cart API DELETE Error]:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete cart item'
    });
  }
});

export default router;
