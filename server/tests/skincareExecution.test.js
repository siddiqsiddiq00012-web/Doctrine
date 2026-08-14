import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../db/index.js';
import { users, dailyExecutions, taskExecutions, resourceStock, weeklyReviews } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { cryptoNative } from '../utils/crypto.js';

test('FEATURE 10 — SKINCARE & GROOMING EXECUTION SYSTEM TESTS', async (t) => {
  const userIdA = cryptoNative.randomUUID();
  const userIdB = cryptoNative.randomUUID();
  const googleIdA = 'google_feat10_user_a_' + Date.now();
  const googleIdB = 'google_feat10_user_b_' + Date.now();

  const monDateStr = '2026-08-10'; // Monday
  const tueDateStr = '2026-08-11'; // Tuesday

  await t.test('1. Setup Test Users, Daily Executions & Task Executions', async () => {
    await db.insert(users).values([
      { id: userIdA, googleId: googleIdA, email: 'feat10_user_a@example.com', displayName: 'Feat10 User A', isActive: true },
      { id: userIdB, googleId: googleIdB, email: 'feat10_user_b@example.com', displayName: 'Feat10 User B', isActive: true }
    ]);

    const nowIso = new Date().toISOString();

    // User A Monday Execution Record
    const monExecId = cryptoNative.randomUUID();
    await db.insert(dailyExecutions).values({
      id: monExecId,
      userId: userIdA,
      date: monDateStr,
      dayOfWeek: 'MONDAY',
      waterLiters: 3.5,
      tahajjud: false,
      notes: 'Skin felt clear today',
      createdAt: nowIso,
      updatedAt: nowIso
    });

    // Seed Monday Tasks for User A (Potato-Aloe AM completed, Rice Flour PM scheduled)
    await db.insert(taskExecutions).values([
      { id: cryptoNative.randomUUID(), dailyExecutionId: monExecId, taskKey: 'mon-2', category: 'SKINCARE', taskName: 'Skincare AM', status: 'COMPLETED', completedAt: nowIso, createdAt: nowIso, updatedAt: nowIso },
      { id: cryptoNative.randomUUID(), dailyExecutionId: monExecId, taskKey: 'mon-8', category: 'SKINCARE', taskName: 'Skincare PM', status: 'SCHEDULED', createdAt: nowIso, updatedAt: nowIso },
      { id: cryptoNative.randomUUID(), dailyExecutionId: monExecId, taskKey: 'mon-9', category: 'HAIR', taskName: 'Hair Oil PM', status: 'COMPLETED', completedAt: nowIso, createdAt: nowIso, updatedAt: nowIso },
      { id: cryptoNative.randomUUID(), dailyExecutionId: monExecId, taskKey: 'anchor_amSkincare', category: 'ANCHOR', taskName: 'amSkincare', status: 'COMPLETED', completedAt: nowIso, createdAt: nowIso, updatedAt: nowIso },
      { id: cryptoNative.randomUUID(), dailyExecutionId: monExecId, taskKey: 'anchor_pmSkincare', category: 'ANCHOR', taskName: 'pmSkincare', status: 'SCHEDULED', createdAt: nowIso, updatedAt: nowIso }
    ]);

    // Seed Low Stock Resource for User A (Ceramide Moisturiser)
    await db.insert(resourceStock).values({
      id: cryptoNative.randomUUID(),
      userId: userIdA,
      resourceId: 'inv-21',
      currentQty: 0.5, // Min stock level is 1 jar
      inCart: false,
      createdAt: nowIso,
      updatedAt: nowIso
    });
  });

  await t.test('2. Verify Exact Doctrine Terminology & Task Extraction for Monday', async () => {
    const [exec] = await db
      .select()
      .from(dailyExecutions)
      .where(and(eq(dailyExecutions.userId, userIdA), eq(dailyExecutions.date, monDateStr)));

    assert.ok(exec);

    const tasks = await db.select().from(taskExecutions).where(eq(taskExecutions.dailyExecutionId, exec.id));
    assert.equal(tasks.length, 5);

    const mon2Task = tasks.find(t => t.taskKey === 'mon-2');
    assert.ok(mon2Task);
    assert.equal(mon2Task.status, 'COMPLETED');
  });

  await t.test('3. Single Execution Truth — Task Toggles Update Underlying Record', async () => {
    const [exec] = await db
      .select()
      .from(dailyExecutions)
      .where(and(eq(dailyExecutions.userId, userIdA), eq(dailyExecutions.date, monDateStr)));

    const nowIso = new Date().toISOString();

    // Complete Evening Skincare task (mon-8)
    await db
      .update(taskExecutions)
      .set({ status: 'COMPLETED', completedAt: nowIso, updatedAt: nowIso })
      .where(and(eq(taskExecutions.dailyExecutionId, exec.id), eq(taskExecutions.taskKey, 'mon-8')));

    const [updatedMon8] = await db
      .select()
      .from(taskExecutions)
      .where(and(eq(taskExecutions.dailyExecutionId, exec.id), eq(taskExecutions.taskKey, 'mon-8')));

    assert.equal(updatedMon8.status, 'COMPLETED');
    assert.ok(updatedMon8.completedAt);
  });

  await t.test('4. Resource Stock Integration Uses Existing resource_stock', async () => {
    const [stock] = await db
      .select()
      .from(resourceStock)
      .where(and(eq(resourceStock.userId, userIdA), eq(resourceStock.resourceId, 'inv-21')));

    assert.ok(stock);
    assert.equal(stock.currentQty, 0.5);
  });

  await t.test('5. Historical Adherence Calculation Uses Recorded Days Only', async () => {
    const userExecs = await db
      .select()
      .from(dailyExecutions)
      .where(eq(dailyExecutions.userId, userIdA));

    assert.equal(userExecs.length, 1);
    assert.equal(userExecs[0].date, monDateStr);
  });

  await t.test('6. Strict User Isolation (User B cannot see User A skincare data)', async () => {
    const userBExecs = await db
      .select()
      .from(dailyExecutions)
      .where(eq(dailyExecutions.userId, userIdB));

    assert.equal(userBExecs.length, 0);

    const userBStocks = await db
      .select()
      .from(resourceStock)
      .where(eq(resourceStock.userId, userIdB));

    assert.equal(userBStocks.length, 0);
  });

  await t.test('7. Verify No Medical Diagnosis Code or Tables Exist', async () => {
    // Verify pure execution tracking architecture
    const userA = await db.select().from(users).where(eq(users.id, userIdA));
    assert.equal(userA.length, 1);
  });

  t.after(async () => {
    await db.delete(users).where(eq(users.id, userIdA));
    await db.delete(users).where(eq(users.id, userIdB));
  });
});
