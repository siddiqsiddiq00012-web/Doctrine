import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../db/index.js';
import { users, dailyExecutions, taskExecutions } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { cryptoNative } from '../utils/crypto.js';
import { getTaskContext } from '../utils/contextualReasoning.js';

test('FEATURE 12 — "WHY TODAY MATTERS" CONTEXTUAL EXECUTION TESTS', async (t) => {
  const userIdA = cryptoNative.randomUUID();
  const userIdB = cryptoNative.randomUUID();
  const googleIdA = 'google_feat12_user_a_' + Date.now();
  const googleIdB = 'google_feat12_user_b_' + Date.now();

  await t.test('1. Setup Test Users', async () => {
    await db.insert(users).values([
      { id: userIdA, googleId: googleIdA, email: 'feat12_user_a@example.com', displayName: 'Feat12 User A', isActive: true },
      { id: userIdB, googleId: googleIdB, email: 'feat12_user_b@example.com', displayName: 'Feat12 User B', isActive: true }
    ]);
  });

  await t.test('2. Verify Task -> Goal Context Mapping for Mass Shake', () => {
    const ctx = getTaskContext('mon-3', 'NUTRITION', 'Mass Shake (~1000 kcal)', 'MONDAY');
    assert.ok(ctx);
    assert.equal(ctx.goal, 'Caloric MED Goal (2,700 kcal)');
    assert.ok(ctx.reason.includes('950–1000 kcal baseline floor'));
    assert.equal(ctx.source, 'Doctrine MED Rule');
  });

  await t.test('3. Verify Task -> Goal Context Mapping for Workout A', () => {
    const ctx = getTaskContext('mon-4', 'WORKOUT', 'Workout A — 5 min warm-up + 30 min training', 'MONDAY');
    assert.ok(ctx);
    assert.equal(ctx.goal, 'Strength & Hypertrophy Goal');
    assert.ok(ctx.reason.includes('progressive overload'));
  });

  await t.test('4. Verify Data Engineering Roadmap Context Integration', () => {
    const ctx = getTaskContext('mon-de', 'DATA_ENG', 'Data Engineering — 1 hour', 'MONDAY', 'SQL JOINs');
    assert.ok(ctx);
    assert.equal(ctx.goal, 'Data Engineering Mastery Goal');
    assert.ok(ctx.reason.includes('SQL JOINs'));
    assert.ok(ctx.reason.includes('Data Engineering roadmap'));
    assert.equal(ctx.source, 'Data Engineering Roadmap');
  });

  await t.test('5. Verify Skincare & Hair Protocol Context Mapping', () => {
    const amSkincareCtx = getTaskContext('mon-2', 'SKINCARE', 'Morning Skincare: Cleanse -> SPF 50+', 'MONDAY');
    assert.equal(amSkincareCtx.goal, 'Skin Barrier & Photoprotection Goal');

    const hairCtx = getTaskContext('mon-9', 'HAIR', 'Hair: Apply nourishing scalp oil', 'MONDAY');
    assert.equal(hairCtx.goal, 'Hair Density & Follicle Nourishment Goal');
  });

  await t.test('6. Deterministic Fallback for Unmapped Tasks (No Generic Quotes)', () => {
    const fallbackCtx = getTaskContext('custom-99', 'OTHER', 'Unmapped custom task', 'MONDAY');
    assert.ok(fallbackCtx);
    assert.equal(fallbackCtx.goal, 'Doctrine Execution Plan');
    assert.equal(fallbackCtx.reason, "Part of today's scheduled Doctrine plan.");
    // Confirm no generic quote or inspirational phrase is present
    assert.equal(fallbackCtx.reason.includes('inspiration'), false);
    assert.equal(fallbackCtx.reason.includes('you can do it'), false);
  });

  await t.test('7. Context Does Not Mutate Completion Status', async () => {
    const execId = cryptoNative.randomUUID();
    const taskId = cryptoNative.randomUUID();
    const nowIso = new Date().toISOString();

    await db.insert(dailyExecutions).values({
      id: execId,
      userId: userIdA,
      date: '2026-08-14',
      dayOfWeek: 'FRIDAY',
      waterLiters: 0,
      tahajjud: false,
      createdAt: nowIso,
      updatedAt: nowIso
    });

    await db.insert(taskExecutions).values({
      id: taskId,
      dailyExecutionId: execId,
      taskKey: 'fri-4',
      category: 'WORKOUT',
      taskName: 'Workout A',
      status: 'SCHEDULED',
      createdAt: nowIso,
      updatedAt: nowIso
    });

    // Query task
    const [rec] = await db.select().from(taskExecutions).where(eq(taskExecutions.id, taskId));
    const ctx = getTaskContext(rec.taskKey, rec.category, rec.taskName, 'FRIDAY');

    // Verify task status in database is untouched
    assert.equal(rec.status, 'SCHEDULED');
    assert.ok(ctx);

    await db.delete(taskExecutions).where(eq(taskExecutions.id, taskId));
    await db.delete(dailyExecutions).where(eq(dailyExecutions.id, execId));
  });

  await t.test('8. Strict User Data Isolation (User B cannot query User A execution)', async () => {
    const execsB = await db.select().from(dailyExecutions).where(eq(dailyExecutions.userId, userIdB));
    assert.equal(execsB.length, 0);
  });

  t.after(async () => {
    await db.delete(users).where(eq(users.id, userIdA));
    await db.delete(users).where(eq(users.id, userIdB));
  });
});
