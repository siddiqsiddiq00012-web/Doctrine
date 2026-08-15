import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../db/index.js';
import { users, dailyExecutions, taskExecutions, taskFailureReasons } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { cryptoNative } from '../utils/crypto.js';
import { calculateFailurePatterns, VALID_FAILURE_REASONS } from '../services/failurePatternService.js';

test('FEATURE 14 — PERSONAL FAILURE PATTERN LOG SYSTEM TESTS', async (t) => {
  const userIdA = cryptoNative.randomUUID();
  const userIdB = cryptoNative.randomUUID();
  const googleIdA = 'google_feat14_user_a_' + Date.now();
  const googleIdB = 'google_feat14_user_b_' + Date.now();

  const todayStr = new Date().toISOString().split('T')[0];
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const date3Str = new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0];
  const date4Str = new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0];
  const date5Str = new Date(Date.now() - 4 * 86400000).toISOString().split('T')[0];

  await t.test('1. Setup Test Users & Daily Executions', async () => {
    const nowIso = new Date().toISOString();
    await db.insert(users).values([
      { id: userIdA, googleId: googleIdA, email: 'feat14_user_a@example.com', displayName: 'Feat14 User A', isActive: true },
      { id: userIdB, googleId: googleIdB, email: 'feat14_user_b@example.com', displayName: 'Feat14 User B', isActive: true }
    ]);
  });

  await t.test('2. Failure Reason Recording & Permanence', async () => {
    const nowIso = new Date().toISOString();
    const execId = cryptoNative.randomUUID();
    const taskId = cryptoNative.randomUUID();

    await db.insert(dailyExecutions).values({
      id: execId,
      userId: userIdA,
      date: todayStr,
      dayOfWeek: 'MONDAY',
      createdAt: nowIso,
      updatedAt: nowIso
    });

    await db.insert(taskExecutions).values({
      id: taskId,
      dailyExecutionId: execId,
      taskKey: '08:00_workout',
      category: 'DOCTRINE',
      taskName: 'Morning Workout A',
      status: 'SKIPPED',
      createdAt: nowIso,
      updatedAt: nowIso
    });

    const failureId = cryptoNative.randomUUID();
    await db.insert(taskFailureReasons).values({
      id: failureId,
      userId: userIdA,
      taskExecutionId: taskId,
      date: todayStr,
      taskKey: '08:00_workout',
      taskName: 'Morning Workout A',
      category: 'DOCTRINE',
      reason: 'Too tired',
      userNote: 'Slept late night before.',
      createdAt: nowIso,
      updatedAt: nowIso
    });

    const [savedRecord] = await db
      .select()
      .from(taskFailureReasons)
      .where(eq(taskFailureReasons.id, failureId));

    assert.ok(savedRecord);
    assert.equal(savedRecord.userId, userIdA);
    assert.equal(savedRecord.reason, 'Too tired');
    assert.equal(savedRecord.userNote, 'Slept late night before.');
  });

  await t.test('3. Reason Taxonomy Validation', async () => {
    assert.ok(VALID_FAILURE_REASONS.includes('Lack of time'));
    assert.ok(VALID_FAILURE_REASONS.includes('Forgot'));
    assert.ok(VALID_FAILURE_REASONS.includes('No resources'));
    assert.ok(VALID_FAILURE_REASONS.includes('Too tired'));
    assert.ok(VALID_FAILURE_REASONS.includes('Work/college conflict'));
    assert.ok(VALID_FAILURE_REASONS.includes('Started too late'));
    assert.ok(VALID_FAILURE_REASONS.includes('Screen distraction'));
    assert.ok(VALID_FAILURE_REASONS.includes('Meal preparation failure'));
    assert.ok(VALID_FAILURE_REASONS.includes('Other'));
  });

  await t.test('4. Analytics Safety — Scarcity of Data (< 5 failures)', async () => {
    const analysis = await calculateFailurePatterns(userIdA, 4);
    assert.ok(analysis);
    assert.equal(analysis.totalFailures, 1);
    assert.equal(analysis.hasStrongPattern, false);
    assert.ok(analysis.patternSummary.includes('1 recent failure(s) recorded as Too tired'));
  });

  await t.test('5. Deterministic Frequency Calculation (>= 5 failures)', async () => {
    const nowIso = new Date().toISOString();

    const insertReason = async (date, taskKey, reason, note = '') => {
      await db.insert(taskFailureReasons).values({
        id: cryptoNative.randomUUID(),
        userId: userIdA,
        date,
        taskKey,
        taskName: taskKey,
        category: 'DOCTRINE',
        reason,
        userNote: note,
        createdAt: nowIso,
        updatedAt: nowIso
      });
    };

    // Insert 4 more failures (Total = 5: 3 "Too tired", 1 "Started too late", 1 "Lack of time")
    await insertReason(yesterdayStr, '09:30_de_session', 'Too tired');
    await insertReason(date3Str, 'namaz_fajr', 'Too tired');
    await insertReason(date4Str, '20:00_pm_skincare', 'Started too late');
    await insertReason(date5Str, 'anchor_medKcalReached', 'Lack of time');

    const analysis = await calculateFailurePatterns(userIdA, 4);
    assert.ok(analysis);
    assert.equal(analysis.totalFailures, 5);
    assert.equal(analysis.hasStrongPattern, true);
    assert.equal(analysis.primaryPattern.reason, 'Too tired');
    assert.equal(analysis.primaryPattern.count, 3);
    assert.equal(analysis.primaryPattern.percentage, 60);
    assert.ok(analysis.patternSummary.includes('Too tired is the primary execution bottleneck'));
  });

  await t.test('6. Strict User Isolation (User B cannot see User A failure records or patterns)', async () => {
    const userBRecords = await db
      .select()
      .from(taskFailureReasons)
      .where(eq(taskFailureReasons.userId, userIdB));

    assert.equal(userBRecords.length, 0);

    const userBAnalysis = await calculateFailurePatterns(userIdB, 4);
    assert.equal(userBAnalysis.totalFailures, 0);
    assert.equal(userBAnalysis.hasStrongPattern, false);
  });

  await t.test('7. Custom Note Preservation for "Other" Category', async () => {
    const nowIso = new Date().toISOString();
    const otherId = cryptoNative.randomUUID();

    await db.insert(taskFailureReasons).values({
      id: otherId,
      userId: userIdA,
      date: todayStr,
      taskKey: 'custom_task',
      taskName: 'Custom Task',
      category: 'DOCTRINE',
      reason: 'Other',
      userNote: 'Unexpected family obligation',
      createdAt: nowIso,
      updatedAt: nowIso
    });

    const [savedOther] = await db
      .select()
      .from(taskFailureReasons)
      .where(eq(taskFailureReasons.id, otherId));

    assert.ok(savedOther);
    assert.equal(savedOther.reason, 'Other');
    assert.equal(savedOther.userNote, 'Unexpected family obligation');
  });

  await t.test('8. Failure Pattern AI Service Model Identifier Verification', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const { fileURLToPath } = await import('node:url');

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const servicePath = path.resolve(__dirname, '../services/failurePatternService.js');

    const sourceCode = fs.readFileSync(servicePath, 'utf8');

    assert.equal(sourceCode.includes('gemini-2.0-flash'), false, 'Deprecated model gemini-2.0-flash must not be used');
    assert.equal(sourceCode.includes('gemini-2.5-flash'), true, 'Supported model gemini-2.5-flash must be used');
  });

  t.after(async () => {
    await db.delete(taskFailureReasons).where(eq(taskFailureReasons.userId, userIdA));
    await db.delete(taskFailureReasons).where(eq(taskFailureReasons.userId, userIdB));
    await db.delete(taskExecutions).where(eq(taskExecutions.dailyExecutionId, userIdA));
    await db.delete(dailyExecutions).where(eq(dailyExecutions.userId, userIdA));
    await db.delete(users).where(eq(users.id, userIdA));
    await db.delete(users).where(eq(users.id, userIdB));
  });
});
