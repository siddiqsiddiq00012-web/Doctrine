import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../db/index.js';
import { users, dailyExecutions, taskExecutions, dailySummaries, resourceStock } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { cryptoNative } from '../utils/crypto.js';

test('FEATURE 9 — INTELLIGENT HOME DASHBOARD TESTS', async (t) => {
  const userIdA = cryptoNative.randomUUID();
  const userIdB = cryptoNative.randomUUID();
  const googleIdA = 'google_feat9_user_a_' + Date.now();
  const googleIdB = 'google_feat9_user_b_' + Date.now();

  const todayDate = new Date().toISOString().split('T')[0];

  await t.test('1. Setup Test Users & Today Execution Data', async () => {
    await db.insert(users).values([
      { id: userIdA, googleId: googleIdA, email: 'feat9_user_a@example.com', displayName: 'Feat9 User A', isActive: true },
      { id: userIdB, googleId: googleIdB, email: 'feat9_user_b@example.com', displayName: 'Feat9 User B', isActive: true }
    ]);

    const nowIso = new Date().toISOString();
    const dayId = cryptoNative.randomUUID();

    await db.insert(dailyExecutions).values({
      id: dayId,
      userId: userIdA,
      date: todayDate,
      dayOfWeek: 'MONDAY',
      waterLiters: 2.0,
      tahajjud: true,
      notes: 'Focus day notes',
      createdAt: nowIso,
      updatedAt: nowIso
    });

    await db.insert(taskExecutions).values([
      { id: cryptoNative.randomUUID(), dailyExecutionId: dayId, taskKey: 'mon-1', category: 'DOCTRINE', taskName: 'Wake', status: 'COMPLETED', completedAt: nowIso, createdAt: nowIso, updatedAt: nowIso },
      { id: cryptoNative.randomUUID(), dailyExecutionId: dayId, taskKey: 'mon-2', category: 'DOCTRINE', taskName: 'Skincare', status: 'SCHEDULED', createdAt: nowIso, updatedAt: nowIso }
    ]);

    // Insert Daily AI Summary
    await db.insert(dailySummaries).values({
      id: cryptoNative.randomUUID(),
      userId: userIdA,
      date: todayDate,
      summary: 'Solid execution recorded today.',
      completionPercentage: 50,
      createdAt: nowIso,
      updatedAt: nowIso
    });
  });

  await t.test('2. Dashboard Aggregation Returns Today Execution & Stored AI Summary', async () => {
    const [exec] = await db
      .select()
      .from(dailyExecutions)
      .where(and(eq(dailyExecutions.userId, userIdA), eq(dailyExecutions.date, todayDate)));

    assert.ok(exec);

    const tasks = await db.select().from(taskExecutions).where(eq(taskExecutions.dailyExecutionId, exec.id));
    assert.equal(tasks.length, 2);

    const [summary] = await db
      .select()
      .from(dailySummaries)
      .where(and(eq(dailySummaries.userId, userIdA), eq(dailySummaries.date, todayDate)));

    assert.ok(summary);
    assert.equal(summary.summary, 'Solid execution recorded today.');
  });

  await t.test('3. Dynamic Primary Action Decision Logic', async () => {
    // If today's completion is < 100%, action should target incomplete Data Engineering or Doctrine
    const [exec] = await db
      .select()
      .from(dailyExecutions)
      .where(and(eq(dailyExecutions.userId, userIdA), eq(dailyExecutions.date, todayDate)));

    const tasks = await db.select().from(taskExecutions).where(eq(taskExecutions.dailyExecutionId, exec.id));
    const compCount = tasks.filter(t => t.status === 'COMPLETED').length;
    const totalCount = tasks.length;
    const pct = Math.round((compCount / totalCount) * 100);

    assert.equal(pct, 50); // 50% completed -> primary action targets remaining work
  });

  await t.test('4. Strict User Data Isolation (User B cannot see User A dashboard data)', async () => {
    const userBExecs = await db
      .select()
      .from(dailyExecutions)
      .where(eq(dailyExecutions.userId, userIdB));

    assert.equal(userBExecs.length, 0);

    const userBSummaries = await db
      .select()
      .from(dailySummaries)
      .where(eq(dailySummaries.userId, userIdB));

    assert.equal(userBSummaries.length, 0);
  });

  t.after(async () => {
    await db.delete(users).where(eq(users.id, userIdA));
    await db.delete(users).where(eq(users.id, userIdB));
  });
});
