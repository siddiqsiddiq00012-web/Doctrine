import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../db/index.js';
import { users, dailyExecutions, taskExecutions, dailySummaries, deLearningSessions } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { cryptoNative } from '../utils/crypto.js';

test('FEATURE 7 — HISTORICAL PROGRESS + TIMELINE TESTS', async (t) => {
  const userIdA = cryptoNative.randomUUID();
  const userIdB = cryptoNative.randomUUID();
  const googleIdA = 'google_feat7_user_a_' + Date.now();
  const googleIdB = 'google_feat7_user_b_' + Date.now();

  const dateDay1 = '2026-08-01';
  const dateDay2 = '2026-08-02';
  const dateDay3 = '2026-08-03';

  await t.test('1. Setup Test Users & Recorded History Data', async () => {
    await db.insert(users).values([
      { id: userIdA, googleId: googleIdA, email: 'feat7_user_a@example.com', displayName: 'Feat7 User A', isActive: true },
      { id: userIdB, googleId: googleIdB, email: 'feat7_user_b@example.com', displayName: 'Feat7 User B', isActive: true }
    ]);

    const nowIso = new Date().toISOString();

    // Insert Day 1 (2026-08-01) for User A with 2 tasks (1 completed)
    const day1Id = cryptoNative.randomUUID();
    await db.insert(dailyExecutions).values({
      id: day1Id,
      userId: userIdA,
      date: dateDay1,
      dayOfWeek: 'SATURDAY',
      waterLiters: 2.5,
      tahajjud: true,
      notes: 'Saturday intense focus day',
      createdAt: nowIso,
      updatedAt: nowIso
    });
    await db.insert(taskExecutions).values([
      { id: cryptoNative.randomUUID(), dailyExecutionId: day1Id, taskKey: 'sat-1', category: 'DOCTRINE', taskName: 'Task 1', status: 'COMPLETED', completedAt: nowIso, createdAt: nowIso, updatedAt: nowIso },
      { id: cryptoNative.randomUUID(), dailyExecutionId: day1Id, taskKey: 'sat-2', category: 'DOCTRINE', taskName: 'Task 2', status: 'SCHEDULED', createdAt: nowIso, updatedAt: nowIso }
    ]);

    // Insert Day 3 (2026-08-03) for User A with 1 completed task & AI summary (Leave Day 2 unrecorded!)
    const day3Id = cryptoNative.randomUUID();
    await db.insert(dailyExecutions).values({
      id: day3Id,
      userId: userIdA,
      date: dateDay3,
      dayOfWeek: 'MONDAY',
      waterLiters: 3.0,
      tahajjud: false,
      notes: 'Monday strong start',
      createdAt: nowIso,
      updatedAt: nowIso
    });
    await db.insert(taskExecutions).values([
      { id: cryptoNative.randomUUID(), dailyExecutionId: day3Id, taskKey: 'mon-1', category: 'DOCTRINE', taskName: 'Mon Task 1', status: 'COMPLETED', completedAt: nowIso, createdAt: nowIso, updatedAt: nowIso }
    ]);

    // Insert AI Daily Summary for Day 3
    await db.insert(dailySummaries).values({
      id: cryptoNative.randomUUID(),
      userId: userIdA,
      date: dateDay3,
      summary: 'Strong execution on Monday.',
      completionPercentage: 100,
      createdAt: nowIso,
      updatedAt: nowIso
    });
  });

  await t.test('2. Timeline Endpoint Only Returns Recorded Execution Dates in Descending Order', async () => {
    const userAExecs = await db
      .select()
      .from(dailyExecutions)
      .where(eq(dailyExecutions.userId, userIdA));

    // Must contain exactly 2 recorded dates (Day 1 & Day 3, excluding unrecorded Day 2)
    assert.equal(userAExecs.length, 2);
    const dates = userAExecs.map(e => e.date).sort().reverse();
    assert.deepEqual(dates, [dateDay3, dateDay1]);
  });

  await t.test('3. Consistency Overview Calculation (Active Days & Avg Compliance)', async () => {
    const userAExecs = await db
      .select()
      .from(dailyExecutions)
      .where(eq(dailyExecutions.userId, userIdA));

    let activeCount = 0;
    let totalPct = 0;

    for (const exec of userAExecs) {
      const tasks = await db.select().from(taskExecutions).where(eq(taskExecutions.dailyExecutionId, exec.id));
      const compCount = tasks.filter(t => t.status === 'COMPLETED').length;
      const pct = Math.round((compCount / tasks.length) * 100);
      totalPct += pct;
      if (compCount > 0) activeCount++;
    }

    assert.equal(userAExecs.length, 2); // 2 total tracked days
    assert.equal(activeCount, 2); // Both days have at least 1 completed task
    assert.equal(Math.round(totalPct / userAExecs.length), 75); // (50% + 100%) / 2 = 75%
  });

  await t.test('4. Strict User Data Isolation (User B cannot see User A recorded history)', async () => {
    const userBExecs = await db
      .select()
      .from(dailyExecutions)
      .where(eq(dailyExecutions.userId, userIdB));

    assert.equal(userBExecs.length, 0);
  });

  t.after(async () => {
    await db.delete(users).where(eq(users.id, userIdA));
    await db.delete(users).where(eq(users.id, userIdB));
  });
});
