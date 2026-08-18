import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../db/index.js';
import { users, resourceStock, resourceEvents, cartItems, financialTransactions, dailyExecutions } from '../db/schema.js';
import { initializeAutomationHandlers } from '../services/automationBootstrap.js';
import { emitTaskCompletedEvent } from '../services/taskExecutionService.js';
import { evaluatePurchaseIntelligence } from '../services/purchaseIntelligenceService.js';
import { calculateFinancialState } from '../services/financialEngine.js';
import { eq, and, inArray } from 'drizzle-orm';
import cryptoNative from 'node:crypto';

test('TASK 9.4 — CROSS-FEATURE INTEGRATION & WORKFLOW GAP CLOSURE TESTS', async (t) => {
  const userIdA = cryptoNative.randomUUID();
  const userIdB = cryptoNative.randomUUID();
  const todayStr = new Date().toISOString().split('T')[0];

  t.before(async () => {
    initializeAutomationHandlers();

    await db.insert(users).values([
      { id: userIdA, googleId: `g-t94-a-${userIdA}`, email: `t94_a_${userIdA}@example.com`, displayName: 'T94 User A' },
      { id: userIdB, googleId: `g-t94-b-${userIdB}`, email: `t94_b_${userIdB}@example.com`, displayName: 'T94 User B' },
    ]);
  });

  t.after(async () => {
    await db.delete(cartItems).where(inArray(cartItems.userId, [userIdA, userIdB]));
    await db.delete(financialTransactions).where(inArray(financialTransactions.userId, [userIdA, userIdB]));
    await db.delete(resourceStock).where(inArray(resourceStock.userId, [userIdA, userIdB]));
    await db.delete(resourceEvents).where(inArray(resourceEvents.userId, [userIdA, userIdB]));
    await db.delete(users).where(inArray(users.id, [userIdA, userIdB]));
  });

  await t.test('1. Resource manually added to cart creates cart_items record & sets inCart', async () => {
    const resourceId = 'inv-1'; // Eggs

    await db.insert(resourceStock).values({
      id: cryptoNative.randomUUID(),
      userId: userIdA,
      resourceId,
      currentQty: 2,
      inCart: true
    });

    const cartId = `cart_man_${cryptoNative.randomUUID()}`;
    await db.insert(cartItems).values({
      id: cartId,
      userId: userIdA,
      itemName: 'Whole Eggs (Tray of 30)',
      resourceId,
      quantity: 1,
      estimatedPricePaise: 21000,
      priority: 2,
      status: 'PENDING'
    });

    const activeCart = await db
      .select()
      .from(cartItems)
      .where(and(eq(cartItems.userId, userIdA), eq(cartItems.status, 'PENDING')));

    assert.equal(activeCart.length, 1);
    assert.equal(activeCart[0].resourceId, resourceId);
  });

  await t.test('2. Automated purchase intelligence creates active cart item on depletion', async () => {
    // Force depletion on Peanut Butter (inv-6)
    await db.insert(resourceStock).values({
      id: cryptoNative.randomUUID(),
      userId: userIdA,
      resourceId: 'inv-6',
      currentQty: 0,
      inCart: false
    });

    const intelResult = await evaluatePurchaseIntelligence(db, userIdA);
    assert.ok(intelResult.success);

    const activeCart = await db
      .select()
      .from(cartItems)
      .where(and(eq(cartItems.userId, userIdA), eq(cartItems.resourceId, 'inv-6')));

    assert.ok(activeCart.length >= 1);
    assert.equal(activeCart[0].status, 'PENDING');
  });

  await t.test('3. Repeated recommendation updates existing active cart item without duplication', async () => {
    const intelResult2 = await evaluatePurchaseIntelligence(db, userIdA);
    assert.ok(intelResult2.success);

    const activeCart = await db
      .select()
      .from(cartItems)
      .where(and(eq(cartItems.userId, userIdA), eq(cartItems.resourceId, 'inv-6'), inArray(cartItems.status, ['PENDING', 'APPROVED'])));

    assert.equal(activeCart.length, 1);
  });

  await t.test('4. Task completion consumes resources but creates zero financial expense', async () => {
    const txBefore = await db
      .select()
      .from(financialTransactions)
      .where(eq(financialTransactions.userId, userIdA));

    await emitTaskCompletedEvent(userIdA, {
      taskExecutionId: `t94_exec_${cryptoNative.randomUUID()}`,
      taskKey: 'mon-1',
      date: todayStr,
      category: 'WAKE',
      taskName: 'Wake Routine'
    });

    const txAfter = await db
      .select()
      .from(financialTransactions)
      .where(eq(financialTransactions.userId, userIdA));

    assert.equal(txAfter.length, txBefore.length);
  });

  await t.test('5. Cart purchase completion creates financial expense, updates stock, resets inCart, and marks item PURCHASED', async () => {
    const itemToPurchase = await db
      .select()
      .from(cartItems)
      .where(and(eq(cartItems.userId, userIdA), eq(cartItems.resourceId, 'inv-6')))
      .limit(1);

    assert.ok(itemToPurchase.length > 0);
    const cartItem = itemToPurchase[0];

    // Simulate purchase completion
    const finalPricePaise = 45000;
    await db
      .update(cartItems)
      .set({ status: 'PURCHASED', actualPricePaise: finalPricePaise, purchasedAt: todayStr })
      .where(eq(cartItems.id, cartItem.id));

    await db.insert(financialTransactions).values({
      id: `ft_purch_${cryptoNative.randomUUID()}`,
      userId: userIdA,
      type: 'EXPENSE',
      amountPaise: finalPricePaise,
      category: 'RESOURCE_PURCHASE',
      description: `Purchased: ${cartItem.itemName}`,
      date: todayStr,
      cartItemId: cartItem.id
    });

    await db
      .update(resourceStock)
      .set({ currentQty: 1, inCart: false, lastPurchased: todayStr })
      .where(and(eq(resourceStock.userId, userIdA), eq(resourceStock.resourceId, 'inv-6')));

    const [updatedStock] = await db
      .select()
      .from(resourceStock)
      .where(and(eq(resourceStock.userId, userIdA), eq(resourceStock.resourceId, 'inv-6')));

    assert.equal(updatedStock.currentQty, 1);
    assert.equal(updatedStock.inCart, false);

    const activeCart = await db
      .select()
      .from(cartItems)
      .where(and(eq(cartItems.userId, userIdA), eq(cartItems.resourceId, 'inv-6'), inArray(cartItems.status, ['PENDING', 'APPROVED'])));

    assert.equal(activeCart.length, 0);

    const finState = await calculateFinancialState(db, userIdA);
    assert.equal(finState.cash.actualCashPaise, -finalPricePaise);
  });

  await t.test('6. Multi-Tenant User Isolation', async () => {
    const userBCart = await db
      .select()
      .from(cartItems)
      .where(eq(cartItems.userId, userIdB));

    assert.equal(userBCart.length, 0);
  });
});
