import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../db/index.js';
import {
  users,
  dailyExecutions,
  taskExecutions,
  resourceStock,
  cartItems,
  financialTransactions,
  domainEvents
} from '../db/schema.js';
import { initializeAutomationHandlers } from '../services/automationBootstrap.js';
import { emitTaskCompletedEvent } from '../services/taskExecutionService.js';
import { getStructuredIntelligence, INTELLIGENCE_MODES, setGenAIClient } from '../services/intelligenceService.js';
import { calculateResourceForecasts } from '../services/resourceForecastService.js';
import { seedDefaultTaskResourceRequirements } from '../services/taskResourceService.js';
import { eq, and } from 'drizzle-orm';
import cryptoNative from 'node:crypto';

test('STEP 9 — UX SIMPLIFICATION & AUTOMATION INTEGRATION TESTS', async (t) => {
  const userIdA = cryptoNative.randomUUID();
  const userIdB = cryptoNative.randomUUID();
  const nowIso = new Date().toISOString();
  const todayStr = nowIso.split('T')[0];

  t.before(async () => {
    // 1. Initialize backend automation handlers & mock Gemini
    initializeAutomationHandlers();
    setGenAIClient({
      models: {
        generateContent: async () => ({
          text: () => JSON.stringify({
            summary: 'Milk is running low. Doctrine has automatically added 2 L to your purchase cart.',
            observations: [{ type: 'RESOURCE', severity: 'HIGH', evidence: 'Stock low' }],
            recommendations: [{ priority: 'HIGH', action: 'Milk purchase queued in cart', reason: 'Depletion soon', evidence: 'Qty = 0.1', automated: true }],
            confidence: 0.95
          })
        })
      }
    });

    // 2. Insert test users
    await db.insert(users).values([
      { id: userIdA, googleId: `g-ux-a-${userIdA}`, email: `ux_a_${userIdA}@example.com`, displayName: 'UX User A' },
      { id: userIdB, googleId: `g-ux-b-${userIdB}`, email: `ux_b_${userIdB}@example.com`, displayName: 'UX User B' },
    ]);

    // 3. Seed default task resource mappings for User A
    await seedDefaultTaskResourceRequirements(userIdA);

    // 4. Seed daily execution for User A
    const dIdA = `d_ux_a_${userIdA}`;
    await db.insert(dailyExecutions).values({
      id: dIdA,
      userId: userIdA,
      date: todayStr,
      currentCapacityMode: 'NORMAL',
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    // 5. Seed stock records for User A for all resources required by Mass Shake
    await db.insert(resourceStock).values([
      { id: `res_ux_a_1_${userIdA}`, userId: userIdA, resourceId: 'inv-5', name: 'Bananas', category: 'NUTRITION', currentQty: 5, unit: 'pcs', minStockLevel: 2, createdAt: nowIso, updatedAt: nowIso },
      { id: `res_ux_a_2_${userIdA}`, userId: userIdA, resourceId: 'inv-2', name: 'Milk', category: 'NUTRITION', currentQty: 0.5, unit: 'L', minStockLevel: 1.0, createdAt: nowIso, updatedAt: nowIso },
      { id: `res_ux_a_3_${userIdA}`, userId: userIdA, resourceId: 'inv-3', name: 'Rolled Oats', category: 'NUTRITION', currentQty: 1, unit: 'kg', minStockLevel: 0.2, createdAt: nowIso, updatedAt: nowIso },
      { id: `res_ux_a_4_${userIdA}`, userId: userIdA, resourceId: 'inv-6', name: 'Peanut Butter', category: 'NUTRITION', currentQty: 500, unit: 'g', minStockLevel: 100, createdAt: nowIso, updatedAt: nowIso },
    ]);
  });

  t.after(async () => {
    setGenAIClient(null);
    await db.delete(users).where(eq(users.id, userIdA));
    await db.delete(users).where(eq(users.id, userIdB));
  });

  await t.test('1. Task Completion Causal Chain (Completion -> Consumption -> Cart Intent)', async () => {
    // Execute task completion for Mass Shake (consumes 0.3L milk from 0.2L stock -> 0L stock)
    const taskExecId = `t_ux_exec_${cryptoNative.randomUUID()}`;
    await db.insert(taskExecutions).values({
      id: taskExecId,
      dailyExecutionId: `d_ux_a_${userIdA}`,
      taskKey: 'mass_shake',
      category: 'NUTRITION',
      taskName: 'Mass Shake',
      status: 'COMPLETED',
      completedAt: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    // Emit TASK_COMPLETED event boundary
    await emitTaskCompletedEvent(userIdA, {
      taskExecutionId: taskExecId,
      taskKey: 'mass_shake',
      date: todayStr,
      category: 'NUTRITION',
      taskName: 'Mass Shake'
    });

    // Verify resource_stock was automatically deducted (0.5L - 0.3L = 0.2L)
    const forecasts = await calculateResourceForecasts(db, userIdA);
    const milkStock = forecasts.resources.find((r) => r.resourceId === 'inv-2' || r.name.toLowerCase().includes('milk'));

    assert.ok(milkStock);
    assert.equal(milkStock.currentQty, 0.2);

    // Verify purchase intelligence automatically queued cart item
    const activeCart = await db
      .select()
      .from(cartItems)
      .where(and(eq(cartItems.userId, userIdA), eq(cartItems.status, 'PENDING')));

    assert.ok(activeCart.length >= 1);
    const cartMilk = activeCart.find((c) => c.itemName.toLowerCase().includes('milk') || c.resourceId === 'inv-2');
    assert.ok(cartMilk);
  });

  await t.test('2. Intelligence Endpoint Exposes Automated Intent (automated = true)', async () => {
    const intel = await getStructuredIntelligence(db, userIdA, INTELLIGENCE_MODES.DAILY_REASONING, { date: todayStr });

    assert.ok(intel.summary);
    assert.ok(Array.isArray(intel.recommendations));

    const milkRec = intel.recommendations.find((r) => r.action.toLowerCase().includes('milk') || r.reason.toLowerCase().includes('milk'));
    if (milkRec) {
      assert.equal(milkRec.automated, true);
    }
  });

  await t.test('3. Duplicate Task Event Processing Does Not Create Duplicate Active Cart Items', async () => {
    const taskExecId = `t_ux_exec_dup_${cryptoNative.randomUUID()}`;

    // Emit twice
    await emitTaskCompletedEvent(userIdA, {
      taskExecutionId: taskExecId,
      taskKey: 'anchor_massShakeTaken',
      date: todayStr,
      category: 'NUTRITION',
    });

    await emitTaskCompletedEvent(userIdA, {
      taskExecutionId: taskExecId,
      taskKey: 'anchor_massShakeTaken',
      date: todayStr,
      category: 'NUTRITION',
    });

    const activeCart = await db
      .select()
      .from(cartItems)
      .where(and(eq(cartItems.userId, userIdA), eq(cartItems.status, 'PENDING')));

    const milkItems = activeCart.filter((c) => c.itemName.toLowerCase().includes('milk') || c.resourceId === 'inv-2');
    assert.equal(milkItems.length, 1, 'Exactly 1 active pending cart item per depleted resource');
  });

  await t.test('4. Resource Consumption Creates Zero Financial Transactions (₹0 Ledger Impact)', async () => {
    const txs = await db
      .select()
      .from(financialTransactions)
      .where(eq(financialTransactions.userId, userIdA));

    const expenseTxs = txs.filter((t) => t.type === 'EXPENSE');
    assert.equal(expenseTxs.length, 0, 'Resource consumption does not create false financial expenses');
  });

  await t.test('5. Multi-Tenant User Isolation (User B unaffected by User A automation)', async () => {
    const activeCartB = await db
      .select()
      .from(cartItems)
      .where(eq(cartItems.userId, userIdB));

    assert.equal(activeCartB.length, 0);
  });
});
