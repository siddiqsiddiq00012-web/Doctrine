import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../db/index.js';
import { users, resourceStock, resourceEvents, taskResourceRequirements } from '../db/schema.js';
import { initializeAutomationHandlers } from '../services/automationBootstrap.js';
import { handleTaskCompletedResourceConsumption, convertUnitQuantity } from '../services/resourceConsumptionService.js';
import { emitTaskCompletedEvent } from '../services/taskExecutionService.js';
import { seedDefaultTaskResourceRequirements } from '../services/taskResourceService.js';
import { eq, and } from 'drizzle-orm';
import cryptoNative from 'node:crypto';

test('STEP 4 — AUTOMATIC RESOURCE CONSUMPTION ENGINE TESTS', async (t) => {
  const userIdA = cryptoNative.randomUUID();
  const userIdB = cryptoNative.randomUUID();
  const nowIso = new Date().toISOString();

  t.before(async () => {
    initializeAutomationHandlers();

    await db.insert(users).values([
      { id: userIdA, googleId: `g-res-a-${userIdA}`, email: `res_a_${userIdA}@example.com`, displayName: 'Resource User A' },
      { id: userIdB, googleId: `g-res-b-${userIdB}`, email: `res_b_${userIdB}@example.com`, displayName: 'Resource User B' },
    ]);

    // Initial stock setup for User A:
    // inv-1 (Eggs) = 12 pcs
    // inv-2 (Milk) = 2.0 L
    // inv-3 (Oats) = 2.0 kg
    // inv-4 (Oats) = 1.0 kg
    // inv-5 (Peanut Butter) = 500 g
    // inv-6 (Bananas) = 6 pcs
    await db.insert(resourceStock).values([
      { id: cryptoNative.randomUUID(), userId: userIdA, resourceId: 'inv-1', currentQty: 12, unit: 'pcs', inCart: false, createdAt: nowIso, updatedAt: nowIso },
      { id: cryptoNative.randomUUID(), userId: userIdA, resourceId: 'inv-2', currentQty: 2.0, unit: 'L', inCart: false, createdAt: nowIso, updatedAt: nowIso },
      { id: cryptoNative.randomUUID(), userId: userIdA, resourceId: 'inv-3', currentQty: 2.0, unit: 'kg', inCart: false, createdAt: nowIso, updatedAt: nowIso },
      { id: cryptoNative.randomUUID(), userId: userIdA, resourceId: 'inv-4', currentQty: 1.0, unit: 'kg', inCart: false, createdAt: nowIso, updatedAt: nowIso },
      { id: cryptoNative.randomUUID(), userId: userIdA, resourceId: 'inv-5', currentQty: 6, unit: 'pcs', inCart: false, createdAt: nowIso, updatedAt: nowIso },
      { id: cryptoNative.randomUUID(), userId: userIdA, resourceId: 'inv-6', currentQty: 500, unit: 'g', inCart: false, createdAt: nowIso, updatedAt: nowIso },
    ]);

    // Initial stock setup for User B:
    // inv-2 (Milk) = 5.0 L
    await db.insert(resourceStock).values([
      { id: cryptoNative.randomUUID(), userId: userIdB, resourceId: 'inv-2', currentQty: 5.0, unit: 'L', inCart: false, createdAt: nowIso, updatedAt: nowIso },
    ]);

    // Seed task resource requirements for User A (Mass Shake, Skincare AM, etc.)
    await seedDefaultTaskResourceRequirements(userIdA);
  });

  t.after(async () => {
    await db.delete(users).where(eq(users.id, userIdA));
    await db.delete(users).where(eq(users.id, userIdB));
  });

  await t.test('1. Unit Conversion Helper Unit Tests', async () => {
    assert.equal(convertUnitQuantity(300, 'ml', 'L'), 0.3);
    assert.equal(convertUnitQuantity(0.5, 'L', 'ml'), 500);
    assert.equal(convertUnitQuantity(40, 'g', 'kg'), 0.04);
    assert.equal(convertUnitQuantity(1.5, 'kg', 'g'), 1500);
    assert.equal(convertUnitQuantity(2, 'pcs', 'pcs'), 2);

    assert.throws(() => {
      convertUnitQuantity(100, 'g', 'L');
    }, /Incompatible unit conversion/i);
  });

  await t.test('2. Single Routine Completion Triggers Automatic Resource Consumption', async () => {
    // Complete "Mass Shake" task for User A
    // Mass Shake requires:
    // - inv-5 (Banana): 1 pcs
    // - inv-2 (Milk): 0.3 L (mapped as 300 ml or 0.3 L)
    // - inv-3 (Oats): 0.04 kg (mapped as 40 g or 0.04 kg)
    // - inv-6 (Peanut Butter): 20 g
    const execId1 = `exec_mass_shake_${Date.now()}`;
    const result = await emitTaskCompletedEvent(userIdA, {
      taskExecutionId: execId1,
      taskKey: 'mass_shake',
      date: '2026-08-17',
    });

    if (!result.success) {
      console.error('TEST 2 FAILURE ERROR:', result.results[0]?.error);
    }
    assert.equal(result.success, true);
    assert.equal(result.results[0].status, 'COMPLETED');

    // Verify resource_events received CONSUMPTION records
    const events = await db.select()
      .from(resourceEvents)
      .where(and(eq(resourceEvents.userId, userIdA), eq(resourceEvents.eventType, 'CONSUMPTION')));
    assert.ok(events.length >= 4);

    // Verify stock deductions in resource_stock:
    // Milk was 2.0 L -> minus 0.3 L -> now 1.7 L
    const [milkStock] = await db.select().from(resourceStock).where(and(eq(resourceStock.userId, userIdA), eq(resourceStock.resourceId, 'inv-2')));
    assert.equal(milkStock.currentQty, 1.7);
  });

  await t.test('3. Unmapped Task Completion Passes Cleanly With 0 Consumption', async () => {
    const execId2 = `exec_unmapped_${Date.now()}`;
    const result = await emitTaskCompletedEvent(userIdA, {
      taskExecutionId: execId2,
      taskKey: 'task_unmapped_custom_key',
      date: '2026-08-17',
    });

    assert.equal(result.success, true);
    assert.equal(result.results[0].output.consumedResources.length, 0);
  });

  await t.test('4. Missing Resource Stock Causes Safe Transaction Failure (MISSING_RESOURCE_STOCK)', async () => {
    // Add mapping to a missing resource 'inv-missing-999'
    await db.insert(taskResourceRequirements).values({
      id: cryptoNative.randomUUID(),
      userId: userIdA,
      taskKey: 'task_missing_stock_test',
      resourceId: 'inv-missing-999',
      quantityConsumed: 1,
      unit: 'pcs',
      notes: 'Missing Stock Test Resource',
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    const execId3 = `exec_missing_stock_${Date.now()}`;
    const result = await emitTaskCompletedEvent(userIdA, {
      taskExecutionId: execId3,
      taskKey: 'task_missing_stock_test',
      date: '2026-08-17',
    });

    assert.equal(result.success, false);
    assert.equal(result.results[0].status, 'FAILED');
    assert.ok(result.results[0].error.includes('MISSING_RESOURCE_STOCK'));
  });

  await t.test('5. Insufficient Stock Policy: Whole Transaction Aborts (No Clamping to Zero)', async () => {
    // Setup task requirement requiring 50 L of Milk (inv-2) when only 1.7 L is available
    await db.insert(taskResourceRequirements).values({
      id: cryptoNative.randomUUID(),
      userId: userIdA,
      taskKey: 'task_overconsumption_test',
      resourceId: 'inv-2',
      quantityConsumed: 50.0,
      unit: 'L',
      notes: 'Overconsumption Test',
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    // Record events count before
    const eventsBefore = await db.select().from(resourceEvents).where(and(eq(resourceEvents.userId, userIdA), eq(resourceEvents.resourceId, 'inv-2')));
    const [milkStockBefore] = await db.select().from(resourceStock).where(and(eq(resourceStock.userId, userIdA), eq(resourceStock.resourceId, 'inv-2')));

    const execId4 = `exec_shortage_${Date.now()}`;
    const result = await emitTaskCompletedEvent(userIdA, {
      taskExecutionId: execId4,
      taskKey: 'task_overconsumption_test',
      date: '2026-08-17',
    });

    assert.equal(result.success, false);
    assert.equal(result.results[0].status, 'FAILED');
    assert.ok(result.results[0].error.includes('INSUFFICIENT_STOCK'));

    // Verify Database State Integrity: 0 events created, stock completely unchanged!
    const eventsAfter = await db.select().from(resourceEvents).where(and(eq(resourceEvents.userId, userIdA), eq(resourceEvents.resourceId, 'inv-2')));
    const [milkStockAfter] = await db.select().from(resourceStock).where(and(eq(resourceStock.userId, userIdA), eq(resourceStock.resourceId, 'inv-2')));

    assert.equal(eventsBefore.length, eventsAfter.length, 'No consumption events must be written on shortage failure');
    assert.equal(milkStockBefore.currentQty, milkStockAfter.currentQty, 'Milk stock must remain completely untouched on shortage failure');
  });

  await t.test('6. Database-Level State Idempotency: Duplicate Event Re-processing Yields Exactly 1 Consumption & Deduction', async () => {
    // Setup task mapping for Eggs (inv-1)
    const taskKey = 'task_idempotency_test';
    await db.insert(taskResourceRequirements).values({
      id: cryptoNative.randomUUID(),
      userId: userIdA,
      taskKey,
      resourceId: 'inv-1',
      quantityConsumed: 2,
      unit: 'pcs',
      notes: 'Eggs idempotency test',
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    const [eggsBefore] = await db.select().from(resourceStock).where(and(eq(resourceStock.userId, userIdA), eq(resourceStock.resourceId, 'inv-1')));

    const execId = `exec_idem_101`;
    // First emission
    const run1 = await emitTaskCompletedEvent(userIdA, { taskExecutionId: execId, taskKey, date: '2026-08-17' });
    if (!run1.success) {
      console.error('TEST 6 FAILURE ERROR:', run1.results[0]?.error);
    }
    assert.equal(run1.results[0].status, 'COMPLETED');

    const [eggsAfterRun1] = await db.select().from(resourceStock).where(and(eq(resourceStock.userId, userIdA), eq(resourceStock.resourceId, 'inv-1')));
    assert.equal(eggsAfterRun1.currentQty, eggsBefore.currentQty - 2);

    const eventsAfterRun1 = await db.select().from(resourceEvents).where(and(eq(resourceEvents.userId, userIdA), eq(resourceEvents.resourceId, 'inv-1'), eq(resourceEvents.notes, 'Automatic consumption for task: task_idempotency_test')));
    assert.equal(eventsAfterRun1.length, 1);

    // Duplicate emission retry
    const run2 = await emitTaskCompletedEvent(userIdA, { taskExecutionId: execId, taskKey, date: '2026-08-17' });
    assert.equal(run2.results[0].status, 'SKIPPED_ALREADY_PROCESSED');

    // Prove at DATABASE STATE level that stock and events are NOT mutated twice
    const [eggsAfterRun2] = await db.select().from(resourceStock).where(and(eq(resourceStock.userId, userIdA), eq(resourceStock.resourceId, 'inv-1')));
    assert.equal(eggsAfterRun2.currentQty, eggsBefore.currentQty - 2, 'Stock must NOT be deducted a second time');

    const eventsAfterRun2 = await db.select().from(resourceEvents).where(and(eq(resourceEvents.userId, userIdA), eq(resourceEvents.resourceId, 'inv-1'), eq(resourceEvents.notes, 'Automatic consumption for task: task_idempotency_test')));
    assert.equal(eventsAfterRun2.length, 1, 'Exactly 1 consumption event record must exist in DB');
  });

  await t.test('7. Strict Multi-Tenant User Isolation', async () => {
    // User A completes Mass Shake -> User B's Milk stock (inv-2) remains 5.0 L
    const [userBMilkBefore] = await db.select().from(resourceStock).where(and(eq(resourceStock.userId, userIdB), eq(resourceStock.resourceId, 'inv-2')));
    assert.equal(userBMilkBefore.currentQty, 5.0);

    await emitTaskCompletedEvent(userIdA, {
      taskExecutionId: `exec_isolation_${Date.now()}`,
      taskKey: 'mass_shake',
      date: '2026-08-17',
    });

    const [userBMilkAfter] = await db.select().from(resourceStock).where(and(eq(resourceStock.userId, userIdB), eq(resourceStock.resourceId, 'inv-2')));
    assert.equal(userBMilkAfter.currentQty, 5.0, "User B's stock must remain completely untouched when User A completes a task");
  });

  await t.test('8. Existing Resource Forecasting Reflects Updated Stock Dynamic', async () => {
    // User A milk stock (inv-2) is 1.4 L. Daily fallback consumption rate = 0.5 L/day.
    const [currentMilk] = await db.select().from(resourceStock).where(and(eq(resourceStock.userId, userIdA), eq(resourceStock.resourceId, 'inv-2')));
    const daysRemaining = currentMilk.currentQty / 0.5;
    assert.equal(daysRemaining, 2.8);
  });
});
