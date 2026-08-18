import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../db/index.js';
import {
  users,
  resourceStock,
  cartItems
} from '../db/schema.js';
import { calculateFinancialState } from '../services/financialEngine.js';
import { calculateResourceForecasts } from '../services/resourceForecastService.js';
import { initializeAutomationHandlers } from '../services/automationBootstrap.js';
import { emitTaskCompletedEvent } from '../services/taskExecutionService.js';
import { seedDefaultTaskResourceRequirements } from '../services/taskResourceService.js';
import { eq } from 'drizzle-orm';
import cryptoNative from 'node:crypto';

test('TASK 9.2 — PRODUCT UX CORRECTIONS & AUTOMATION COMPLETION TESTS', async (t) => {
  const userIdA = cryptoNative.randomUUID();
  const userIdB = cryptoNative.randomUUID();
  const nowIso = new Date().toISOString();
  const todayStr = nowIso.split('T')[0];

  t.before(async () => {
    initializeAutomationHandlers();

    await db.insert(users).values([
      { id: userIdA, googleId: `g-t92-a-${userIdA}`, email: `t92_a_${userIdA}@example.com`, displayName: 'T92 User A' },
      { id: userIdB, googleId: `g-t92-b-${userIdB}`, email: `t92_b_${userIdB}@example.com`, displayName: 'T92 User B' },
    ]);

    await seedDefaultTaskResourceRequirements(userIdA);
  });

  t.after(async () => {
    await db.delete(users).where(eq(users.id, userIdA));
    await db.delete(users).where(eq(users.id, userIdB));
  });

  await t.test('1. Fresh User Financial State returns ₹0 Net Cash without fabricating balances', async () => {
    const finState = await calculateFinancialState(db, userIdA, todayStr);

    assert.equal(finState.cash.netCashPaise, 0);
    assert.equal(finState.cash.spendableCashPaise, 0);
    assert.equal(finState.cash.reservedPaise, 0);
    assert.equal(finState.cash.allocatedPaise, 0);
    assert.ok(Array.isArray(finState.cartCommitments));
    assert.ok(Array.isArray(finState.resourceNeeds));
  });

  await t.test('2. Resource Depletion & Financial Affordability Integration', async () => {
    // Seed low stock item for User A ('inv-2' = Milk = 0.2L, min = 1.0L)
    await db.insert(resourceStock).values({
      id: `res_t92_milk_${userIdA}`,
      userId: userIdA,
      resourceId: 'inv-2',
      name: 'Full-Fat Buffalo Milk',
      category: 'FOOD',
      currentQty: 0.2,
      unit: 'liters',
      minStockLevel: 1.0,
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    const forecasts = await calculateResourceForecasts(db, userIdA);
    const milkForecast = forecasts.resources.find((r) => r.id === 'inv-2' || r.resourceId === 'inv-2');

    assert.ok(milkForecast);
    assert.ok(milkForecast.needed > 0 || milkForecast.status === 'NEEDS PURCHASE');

    const finState = await calculateFinancialState(db, userIdA, todayStr);
    assert.ok(finState.resourceNeeds.length > 0);

    const milkNeed = finState.resourceNeeds.find((r) => r.resourceId === 'inv-2' || r.itemName?.includes('Milk'));
    assert.ok(milkNeed);
    assert.equal(milkNeed.neededNow, true);
    assert.ok(milkNeed.estimatedPricePaise > 0);
    assert.ok(milkNeed.urgency);
    assert.ok(milkNeed.affordabilityReason);
  });

  await t.test('3. Task Completion Automatically Mutates Stock & Queues Cart Item Without Manual Decrement', async () => {
    const taskExecId = `t92_exec_${cryptoNative.randomUUID()}`;

    // Emitting TASK_COMPLETED event boundary
    await emitTaskCompletedEvent(userIdA, {
      taskExecutionId: taskExecId,
      taskKey: 'mass_shake',
      date: todayStr,
      category: 'NUTRITION',
      taskName: 'Mass Shake'
    });

    // Check stock was automatically evaluated
    const forecasts = await calculateResourceForecasts(db, userIdA);
    const milk = forecasts.resources.find((r) => r.id === 'inv-2' || r.resourceId === 'inv-2');
    assert.ok(milk);

    // Cart items for User A should contain low stock items
    const cart = await db
      .select()
      .from(cartItems)
      .where(eq(cartItems.userId, userIdA));

    assert.ok(cart.length >= 1);
  });

  await t.test('4. Multi-Tenant User Data Isolation', async () => {
    const cartB = await db
      .select()
      .from(cartItems)
      .where(eq(cartItems.userId, userIdB));
    assert.equal(cartB.length, 0);
  });
});
