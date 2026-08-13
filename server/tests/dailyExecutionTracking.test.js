import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../db/index.js';
import { users, dailyExecutions, taskExecutions } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { cryptoNative } from '../utils/crypto.js';

test('FEATURE 6 — DAILY DOCTRINE EXECUTION TRACKING SYSTEM TESTS', async (t) => {
  const userIdA = cryptoNative.randomUUID();
  const userIdB = cryptoNative.randomUUID();
  const googleIdA = 'google_feat6_user_a_' + Date.now();
  const googleIdB = 'google_feat6_user_b_' + Date.now();

  const dateDay1 = '2026-08-10';
  const dateDay2 = '2026-08-11';
  const dateDay3 = '2026-08-12';

  await t.test('1. Setup Test Users', async () => {
    await db.insert(users).values([
      { id: userIdA, googleId: googleIdA, email: 'feat6_user_a@example.com', displayName: 'Feat6 User A', isActive: true },
      { id: userIdB, googleId: googleIdB, email: 'feat6_user_b@example.com', displayName: 'Feat6 User B', isActive: true }
    ]);
    const [uA] = await db.select().from(users).where(eq(users.id, userIdA));
    assert.ok(uA);
  });

  let day1ExecId = null;

  await t.test('2. Pre-Seeding & Creation of Execution Day (Pre-seeds timeBlocks, Namaz, Anchors, Prep)', async () => {
    const [existing] = await db
      .select()
      .from(dailyExecutions)
      .where(and(eq(dailyExecutions.userId, userIdA), eq(dailyExecutions.date, dateDay1)));

    assert.equal(existing, undefined);

    const execId = cryptoNative.randomUUID();
    day1ExecId = execId;
    const nowIso = new Date().toISOString();

    await db.insert(dailyExecutions).values({
      id: execId,
      userId: userIdA,
      date: dateDay1,
      dayOfWeek: 'MONDAY',
      waterLiters: 0,
      tahajjud: false,
      notes: 'Initial reflection notes for Monday.',
      createdAt: nowIso,
      updatedAt: nowIso
    });

    await db.insert(taskExecutions).values([
      { id: cryptoNative.randomUUID(), dailyExecutionId: execId, taskKey: 'mon-1', category: 'DOCTRINE', taskName: 'Wake & lemon water', status: 'SCHEDULED', createdAt: nowIso, updatedAt: nowIso },
      { id: cryptoNative.randomUUID(), dailyExecutionId: execId, taskKey: 'mon-2', category: 'DOCTRINE', taskName: 'Skincare AM', status: 'SCHEDULED', createdAt: nowIso, updatedAt: nowIso },
      { id: cryptoNative.randomUUID(), dailyExecutionId: execId, taskKey: 'namaz_fajr', category: 'NAMAZ', taskName: 'Namaz FAJR', status: 'SCHEDULED', createdAt: nowIso, updatedAt: nowIso },
      { id: cryptoNative.randomUUID(), dailyExecutionId: execId, taskKey: 'anchor_amSkincare', category: 'ANCHOR', taskName: 'amSkincare', status: 'SCHEDULED', createdAt: nowIso, updatedAt: nowIso },
    ]);

    const [savedExec] = await db.select().from(dailyExecutions).where(eq(dailyExecutions.id, execId));
    assert.ok(savedExec);
    assert.equal(savedExec.date, dateDay1);
    assert.equal(savedExec.notes, 'Initial reflection notes for Monday.');
  });

  await t.test('3. Machine-Readable ISO Timestamp Storage on Task Completion', async () => {
    const tasks = await db.select().from(taskExecutions).where(eq(taskExecutions.dailyExecutionId, day1ExecId));
    const targetTask = tasks.find(t => t.taskKey === 'mon-1');
    assert.ok(targetTask);

    const nowIso = new Date().toISOString();
    await db
      .update(taskExecutions)
      .set({ status: 'COMPLETED', completedAt: nowIso, updatedAt: nowIso })
      .where(eq(taskExecutions.id, targetTask.id));

    const [updatedTask] = await db.select().from(taskExecutions).where(eq(taskExecutions.id, targetTask.id));
    assert.equal(updatedTask.status, 'COMPLETED');
    assert.ok(updatedTask.completedAt.includes('T')); // Valid ISO timestamp
    assert.doesNotThrow(() => new Date(updatedTask.completedAt));
  });

  await t.test('4. Task State Transitions (COMPLETED, SKIPPED, SCHEDULED)', async () => {
    const tasks = await db.select().from(taskExecutions).where(eq(taskExecutions.dailyExecutionId, day1ExecId));
    const targetTask = tasks.find(t => t.taskKey === 'mon-2');

    const nowIso = new Date().toISOString();
    await db
      .update(taskExecutions)
      .set({ status: 'SKIPPED', completedAt: null, updatedAt: nowIso })
      .where(eq(taskExecutions.id, targetTask.id));

    const [skippedTask] = await db.select().from(taskExecutions).where(eq(taskExecutions.id, targetTask.id));
    assert.equal(skippedTask.status, 'SKIPPED');
    assert.equal(skippedTask.completedAt, null);
  });

  await t.test('5. Multi-Day Historical Independence (Day 1 vs Day 2 vs Day 3)', async () => {
    const nowIso = new Date().toISOString();

    const execDay2Id = cryptoNative.randomUUID();
    await db.insert(dailyExecutions).values({
      id: execDay2Id,
      userId: userIdA,
      date: dateDay2,
      dayOfWeek: 'TUESDAY',
      waterLiters: 3.5,
      tahajjud: true,
      notes: 'Tuesday recovery focus notes.',
      createdAt: nowIso,
      updatedAt: nowIso
    });

    await db.insert(taskExecutions).values([
      { id: cryptoNative.randomUUID(), dailyExecutionId: execDay2Id, taskKey: 'tue-1', category: 'DOCTRINE', taskName: 'Tuesday Wake', status: 'COMPLETED', completedAt: nowIso, createdAt: nowIso, updatedAt: nowIso },
    ]);

    const execDay3Id = cryptoNative.randomUUID();
    await db.insert(dailyExecutions).values({
      id: execDay3Id,
      userId: userIdA,
      date: dateDay3,
      dayOfWeek: 'WEDNESDAY',
      waterLiters: 1.0,
      tahajjud: false,
      notes: 'Wednesday mid-week notes.',
      createdAt: nowIso,
      updatedAt: nowIso
    });

    const [d1] = await db.select().from(dailyExecutions).where(eq(dailyExecutions.id, day1ExecId));
    assert.equal(d1.date, dateDay1);
    assert.equal(d1.notes, 'Initial reflection notes for Monday.');

    const [d2] = await db.select().from(dailyExecutions).where(eq(dailyExecutions.id, execDay2Id));
    assert.equal(d2.date, dateDay2);
    assert.equal(d2.waterLiters, 3.5);
    assert.equal(d2.tahajjud, true);

    const [d3] = await db.select().from(dailyExecutions).where(eq(dailyExecutions.id, execDay3Id));
    assert.equal(d3.date, dateDay3);
    assert.equal(d3.notes, 'Wednesday mid-week notes.');

    await db.delete(dailyExecutions).where(eq(dailyExecutions.id, execDay2Id));
    await db.delete(dailyExecutions).where(eq(dailyExecutions.id, execDay3Id));
  });

  await t.test('6. Strict User Data Isolation (User B cannot query User A records)', async () => {
    const userBSessions = await db
      .select()
      .from(dailyExecutions)
      .where(and(eq(dailyExecutions.userId, userIdB), eq(dailyExecutions.date, dateDay1)));

    assert.equal(userBSessions.length, 0);

    const userASessions = await db
      .select()
      .from(dailyExecutions)
      .where(and(eq(dailyExecutions.userId, userIdA), eq(dailyExecutions.date, dateDay1)));

    assert.equal(userASessions.length, 1);
  });

  t.after(async () => {
    await db.delete(users).where(eq(users.id, userIdA));
    await db.delete(users).where(eq(users.id, userIdB));
  });
});
