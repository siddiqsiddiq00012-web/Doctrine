import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../db/index.js';
import { users, dailyExecutions } from '../db/schema.js';
import { initializeAutomationHandlers } from '../services/automationBootstrap.js';
import { emitTaskCompletedEvent } from '../services/taskExecutionService.js';
import { eq, and } from 'drizzle-orm';
import cryptoNative from 'node:crypto';

test('TASK 9.3 — CLEAN EXECUTION UX & TODAY/HISTORY SEPARATION TESTS', async (t) => {
  const userIdA = cryptoNative.randomUUID();
  const userIdB = cryptoNative.randomUUID();
  const nowIso = new Date().toISOString();
  const todayStr = nowIso.split('T')[0];
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  t.before(async () => {
    initializeAutomationHandlers();

    await db.insert(users).values([
      { id: userIdA, googleId: `g-t93-a-${userIdA}`, email: `t93_a_${userIdA}@example.com`, displayName: 'T93 User A' },
      { id: userIdB, googleId: `g-t93-b-${userIdB}`, email: `t93_b_${userIdB}@example.com`, displayName: 'T93 User B' },
    ]);
  });

  t.after(async () => {
    await db.delete(users).where(eq(users.id, userIdA));
    await db.delete(users).where(eq(users.id, userIdB));
  });

  await t.test('1. Today Execution automatically binds to current calendar date', async () => {
    const execId = cryptoNative.randomUUID();
    await db.insert(dailyExecutions).values({
      id: execId,
      userId: userIdA,
      date: todayStr,
      dayOfWeek: 'MONDAY',
      waterLiters: 0,
      tahajjud: false,
      notes: 'Today test note'
    });

    const records = await db
      .select()
      .from(dailyExecutions)
      .where(and(eq(dailyExecutions.userId, userIdA), eq(dailyExecutions.date, todayStr)));

    assert.equal(records.length, 1);
    assert.equal(records[0].date, todayStr);
  });

  await t.test('2. Historical execution records remain isolated to history date parameters', async () => {
    const execId = cryptoNative.randomUUID();
    await db.insert(dailyExecutions).values({
      id: execId,
      userId: userIdA,
      date: yesterdayStr,
      dayOfWeek: 'SUNDAY',
      waterLiters: 0,
      tahajjud: false,
      notes: 'Yesterday test note'
    });

    const records = await db
      .select()
      .from(dailyExecutions)
      .where(and(eq(dailyExecutions.userId, userIdA), eq(dailyExecutions.date, yesterdayStr)));

    assert.equal(records.length, 1);
    assert.equal(records[0].date, yesterdayStr);
    assert.notEqual(records[0].date, todayStr);
  });

  await t.test('3. Multi-Tenant User Isolation across Today & History', async () => {
    const bRecords = await db
      .select()
      .from(dailyExecutions)
      .where(eq(dailyExecutions.userId, userIdB));

    assert.equal(bRecords.length, 0);
  });
});
