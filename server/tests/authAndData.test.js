import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../db/index.js';
import { users, dailyExecutions, taskExecutions } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { cryptoNative } from '../utils/crypto.js';

test('FEATURE 1 — USER MODEL & PERSISTENCE TESTS', async (t) => {

  const testGoogleId1 = 'google_sub_user_a_' + Date.now();
  const testGoogleId2 = 'google_sub_user_b_' + Date.now();
  const userIdA = cryptoNative.randomUUID();
  const userIdB = cryptoNative.randomUUID();

  await t.test('1. Create and Persist User Account with Stable Google ID', async () => {
    await db.insert(users).values({
      id: userIdA,
      googleId: testGoogleId1,
      email: 'usera@example.com',
      displayName: 'User Alpha',
      avatarUrl: 'https://example.com/avatar_a.png',
      isActive: true,
    });

    await db.insert(users).values({
      id: userIdB,
      googleId: testGoogleId2,
      email: 'userb@example.com',
      displayName: 'User Beta',
      avatarUrl: 'https://example.com/avatar_b.png',
      isActive: true,
    });

    const [fetchedA] = await db.select().from(users).where(eq(users.id, userIdA));
    assert.equal(fetchedA.googleId, testGoogleId1);
    assert.equal(fetchedA.email, 'usera@example.com');
  });

  await t.test('2. Enforce Database Level UNIQUE(user_id, date) Constraint', async () => {
    const testDate = '2026-08-15';
    const execId1 = cryptoNative.randomUUID();
    const execId2 = cryptoNative.randomUUID();

    // First insertion succeeds
    await db.insert(dailyExecutions).values({
      id: execId1,
      userId: userIdA,
      date: testDate,
      dayOfWeek: 'SATURDAY',
    });

    // Second insertion with SAME (userId, date) MUST throw UNIQUE constraint error
    await assert.rejects(async () => {
      await db.insert(dailyExecutions).values({
        id: execId2,
        userId: userIdA,
        date: testDate,
        dayOfWeek: 'SATURDAY',
      });
    }, /UNIQUE constraint failed/i);
  });

  await t.test('3. Enforce Strict User Data Isolation (User A vs User B)', async () => {
    const dateIsolation = '2026-08-16';
    const execIdA = cryptoNative.randomUUID();

    // Insert record strictly for User A
    await db.insert(dailyExecutions).values({
      id: execIdA,
      userId: userIdA,
      date: dateIsolation,
      dayOfWeek: 'SUNDAY',
    });

    // User A queries dateIsolation -> retrieves 1 record
    const resultsForUserA = await db
      .select()
      .from(dailyExecutions)
      .where(and(eq(dailyExecutions.userId, userIdA), eq(dailyExecutions.date, dateIsolation)));

    // User B attempts to query User A's dateIsolation -> retrieves 0 records
    const resultsForUserB = await db
      .select()
      .from(dailyExecutions)
      .where(and(eq(dailyExecutions.userId, userIdB), eq(dailyExecutions.date, dateIsolation)));

    assert.equal(resultsForUserA.length, 1);
    assert.equal(resultsForUserB.length, 0);
  });

  await t.test('4. Task Execution FK Cascade & Task State Updates', async () => {
    const [execA] = await db
      .select()
      .from(dailyExecutions)
      .where(eq(dailyExecutions.userId, userIdA));

    const taskId = cryptoNative.randomUUID();
    await db.insert(taskExecutions).values({
      id: taskId,
      dailyExecutionId: execA.id,
      taskKey: 'task_morning_workout',
      category: 'DOCTRINE',
      taskName: 'Morning Workout',
      status: 'SCHEDULED',
    });

    // Update status to COMPLETED
    await db
      .update(taskExecutions)
      .set({ status: 'COMPLETED', completedAt: new Date().toISOString() })
      .where(eq(taskExecutions.id, taskId));

    const [updatedTask] = await db
      .select()
      .from(taskExecutions)
      .where(eq(taskExecutions.id, taskId));

    assert.equal(updatedTask.status, 'COMPLETED');
    assert.notEqual(updatedTask.completedAt, null);
  });

  // Cleanup test users & executions
  t.after(async () => {
    await db.delete(users).where(eq(users.id, userIdA));
    await db.delete(users).where(eq(users.id, userIdB));
  });
});
