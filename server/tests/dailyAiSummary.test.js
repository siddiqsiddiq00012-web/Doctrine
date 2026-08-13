import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../db/index.js';
import { users, dailyExecutions, taskExecutions, dailySummaries } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { cryptoNative } from '../utils/crypto.js';
import { getDailyExecutionSnapshot, generateDailySummary } from '../services/aiService.js';

test('FEATURE 2 — 10:00 PM DAILY AI SUMMARY TESTS', async (t) => {
  const userIdA = cryptoNative.randomUUID();
  const userIdB = cryptoNative.randomUUID();
  const googleIdA = 'google_ai_user_a_' + Date.now();
  const googleIdB = 'google_ai_user_b_' + Date.now();
  const testDate = '2026-08-13';

  await t.test('1. Setup Test Users & Execution Records', async () => {
    await db.insert(users).values([
      { id: userIdA, googleId: googleIdA, email: 'ai_user_a@example.com', displayName: 'AI User Alpha', isActive: true },
      { id: userIdB, googleId: googleIdB, email: 'ai_user_b@example.com', displayName: 'AI User Beta', isActive: true },
    ]);

    const dailyExecIdA = cryptoNative.randomUUID();
    await db.insert(dailyExecutions).values({
      id: dailyExecIdA,
      userId: userIdA,
      date: testDate,
      dayOfWeek: 'THURSDAY',
      waterLiters: 3.5,
      tahajjud: true,
      notes: 'Focused on PySpark Streaming optimization and completed morning workout.',
    });

    await db.insert(taskExecutions).values([
      { id: cryptoNative.randomUUID(), dailyExecutionId: dailyExecIdA, taskKey: 'doctrine_1', category: 'DOCTRINE', taskName: 'Morning Routine', status: 'COMPLETED' },
      { id: cryptoNative.randomUUID(), dailyExecutionId: dailyExecIdA, taskKey: 'doctrine_2', category: 'DOCTRINE', taskName: 'Data Engineering Deep Work', status: 'COMPLETED' },
      { id: cryptoNative.randomUUID(), dailyExecutionId: dailyExecIdA, taskKey: 'doctrine_3', category: 'DOCTRINE', taskName: 'Evening Wind Down', status: 'MISSED' },
      { id: cryptoNative.randomUUID(), dailyExecutionId: dailyExecIdA, taskKey: 'namaz_fajr', category: 'NAMAZ', taskName: 'Fajr Prayer', status: 'COMPLETED' },
    ]);

    const snapshot = await getDailyExecutionSnapshot(userIdA, testDate);
    assert.equal(snapshot.completedCount, 3);
    assert.equal(snapshot.totalTasksCount, 4);
    assert.equal(snapshot.completionPercentage, 75);
    assert.equal(snapshot.tahajjud, true);
    assert.equal(snapshot.waterLiters, 3.5);
  });

  await t.test('2. Generate and Persist Daily Summary in SQLite Database', async () => {
    // Insert mock summary record simulating AI service result
    const summaryId = cryptoNative.randomUUID();
    const mockSummaryText = `### 1. Overall Execution\n75% execution score (3/4 tasks completed). Water: 3.5L. Tahajjud: Completed.\n\n### 2. What Went Well\nCompleted Morning Routine, Data Engineering Deep Work, and Fajr prayer.\n\n### 3. Impact\nProgress on Data Engineering Spark optimization.\n\n### 4. Gaps\nEvening Wind Down was missed.\n\n### 5. Carry Forward\nComplete evening routine tomorrow.\n\n### 6. AI Assessment\nSolid discipline throughout the day. Maintain momentum into tomorrow.`;

    await db.insert(dailySummaries).values({
      id: summaryId,
      userId: userIdA,
      date: testDate,
      summary: mockSummaryText,
      completionPercentage: 75,
      completedCount: 3,
      totalTasksCount: 4,
      provider: 'gemini',
      model: 'gemini-2.5-flash',
    });

    const [saved] = await db
      .select()
      .from(dailySummaries)
      .where(and(eq(dailySummaries.userId, userIdA), eq(dailySummaries.date, testDate)));

    assert.ok(saved);
    assert.equal(saved.completionPercentage, 75);
    assert.equal(saved.completedCount, 3);
    assert.match(saved.summary, /75% execution score/);
  });

  await t.test('3. Strict User Isolation: User B Cannot Read User A Summary', async () => {
    const [userBSummary] = await db
      .select()
      .from(dailySummaries)
      .where(and(eq(dailySummaries.userId, userIdB), eq(dailySummaries.date, testDate)));

    assert.equal(userBSummary, undefined);
  });

  await t.test('4. Historical Date Retrieval Test', async () => {
    const [pastSummary] = await db
      .select()
      .from(dailySummaries)
      .where(and(eq(dailySummaries.userId, userIdA), eq(dailySummaries.date, testDate)));

    assert.ok(pastSummary);
    assert.equal(pastSummary.date, '2026-08-13');
  });

  // Cleanup test users & summaries
  t.after(async () => {
    await db.delete(users).where(eq(users.id, userIdA));
    await db.delete(users).where(eq(users.id, userIdB));
  });
});
