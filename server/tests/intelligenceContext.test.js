import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../db/index.js';
import { users, dailyExecutions, taskExecutions, resourceStock, cartItems, goals } from '../db/schema.js';
import { buildIntelligenceContext } from '../services/intelligenceContextService.js';
import { eq } from 'drizzle-orm';
import cryptoNative from 'node:crypto';

test('STEP 8 — INTELLIGENCE CONTEXT SERVICE TESTS', async (t) => {
  const userIdA = cryptoNative.randomUUID();
  const userIdB = cryptoNative.randomUUID();
  const nowIso = new Date().toISOString();
  const todayStr = nowIso.split('T')[0];

  t.before(async () => {
    // Insert test users
    await db.insert(users).values([
      { id: userIdA, googleId: `g-ctx-a-${userIdA}`, email: `ctx_a_${userIdA}@example.com`, displayName: 'Context User A' },
      { id: userIdB, googleId: `g-ctx-b-${userIdB}`, email: `ctx_b_${userIdB}@example.com`, displayName: 'Context User B' },
    ]);

    // Seed execution data for User A
    const dIdA = `d_ctx_a_${userIdA}`;
    await db.insert(dailyExecutions).values({
      id: dIdA,
      userId: userIdA,
      date: todayStr,
      currentCapacityMode: 'NORMAL',
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    await db.insert(taskExecutions).values([
      { id: `t_ctx_1`, dailyExecutionId: dIdA, taskKey: 'namaz_fajr', category: 'NAMAZ', status: 'COMPLETED' },
      { id: `t_ctx_2`, dailyExecutionId: dIdA, taskKey: 'mass_shake', category: 'NUTRITION', status: 'COMPLETED' },
    ]);

    // Seed constrained stock & cart item for User A
    const resIdA = `res_ctx_a_${userIdA}`;
    await db.insert(resourceStock).values({
      id: resIdA,
      userId: userIdA,
      resourceId: 'inv-2',
      name: 'Milk',
      category: 'NUTRITION',
      currentQty: 0.2,
      unit: 'L',
      minStockLevel: 1.0,
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    await db.insert(cartItems).values({
      id: `cart_ctx_a_${userIdA}`,
      userId: userIdA,
      resourceId: 'inv-2',
      itemName: 'Milk',
      quantity: 2,
      estimatedPricePaise: 12000,
      status: 'PENDING',
      createdAt: nowIso,
      updatedAt: nowIso,
    });
  });

  t.after(async () => {
    await db.delete(users).where(eq(users.id, userIdA));
    await db.delete(users).where(eq(users.id, userIdB));
  });

  await t.test('1. Correct Context Structure', async () => {
    const context = await buildIntelligenceContext(db, userIdA, { date: todayStr });

    assert.equal(context.userId, userIdA);
    assert.ok(context.execution);
    assert.ok(context.adherence);
    assert.ok(context.streaks);
    assert.ok(context.lifeAreas);
    assert.ok(context.taskReliability);
    assert.ok(context.goals);
    assert.ok(context.resources);
    assert.ok(context.finances);
    assert.ok(context.failures);
    assert.ok(context.capacity);
  });

  await t.test('2. Multi-Tenant Isolation', async () => {
    const contextA = await buildIntelligenceContext(db, userIdA, { date: todayStr });
    const contextB = await buildIntelligenceContext(db, userIdB, { date: todayStr });

    assert.equal(contextA.userId, userIdA);
    assert.equal(contextB.userId, userIdB);
    assert.equal(contextA.resources.activeCartCount, 1);
    assert.equal(contextB.resources.activeCartCount, 0);
  });

  await t.test('3. No Secrets or Credentials in Context', async () => {
    const context = await buildIntelligenceContext(db, userIdA, { date: todayStr });
    const jsonString = JSON.stringify(context);

    assert.ok(!jsonString.includes('password'));
    assert.ok(!jsonString.includes('apiKey'));
    assert.ok(!jsonString.includes('sessionSecret'));
    assert.ok(!jsonString.includes('googleId'));
  });

  await t.test('4. Adherence Integration', async () => {
    const context = await buildIntelligenceContext(db, userIdA, { date: todayStr });

    assert.ok(context.adherence.days7);
    assert.ok(context.adherence.days30);
    assert.ok(context.adherence.days90);
    assert.ok(context.adherence.trend);
  });

  await t.test('5. Resource Forecast Integration', async () => {
    const context = await buildIntelligenceContext(db, userIdA, { date: todayStr });

    assert.ok(context.resources.constrainedResources);
    const milk = context.resources.constrainedResources.find((r) => r.name.toLowerCase().includes('milk'));
    assert.ok(milk);
    assert.equal(milk.inCart, true);
  });

  await t.test('6. Financial Integration', async () => {
    const context = await buildIntelligenceContext(db, userIdA, { date: todayStr });

    assert.ok(typeof context.finances.spendableCashPaise === 'number');
    assert.ok(typeof context.finances.activeCartCostPaise === 'number');
    assert.equal(context.finances.activeCartCostPaise, 12000);
  });

  await t.test('7. Goal Engine Integration', async () => {
    const context = await buildIntelligenceContext(db, userIdA, { date: todayStr });

    assert.ok(context.goals);
    assert.ok(Array.isArray(context.goals.goals));
  });

  await t.test('8. Failure-Pattern Integration', async () => {
    const context = await buildIntelligenceContext(db, userIdA, { date: todayStr });

    assert.ok(context.failures);
    assert.ok(typeof context.failures.totalFailures === 'number');
  });
});
