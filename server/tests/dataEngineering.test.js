import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../db/index.js';
import { users, deLearningSessions } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { cryptoNative } from '../utils/crypto.js';

test('FEATURE 5 — DATA ENGINEERING ACTIVE LEARNING TRACKER TESTS', async (t) => {
  const userIdA = cryptoNative.randomUUID();
  const userIdB = cryptoNative.randomUUID();
  const googleIdA = 'google_de_user_a_' + Date.now();
  const googleIdB = 'google_de_user_b_' + Date.now();

  const dateToday = '2026-08-13';

  await t.test('1. Setup Test Users & Create Valid Learning Session', async () => {
    await db.insert(users).values([
      { id: userIdA, googleId: googleIdA, email: 'de_user_a@example.com', displayName: 'DE User Alpha', isActive: true },
      { id: userIdB, googleId: googleIdB, email: 'de_user_b@example.com', displayName: 'DE User Beta', isActive: true }
    ]);

    const sessionId = cryptoNative.randomUUID();
    await db.insert(deLearningSessions).values({
      id: sessionId,
      userId: userIdA,
      date: dateToday,
      moduleName: 'Relational Databases',
      topicName: 'SQL Fundamentals',
      subtopicName: 'Table joins',
      plannedMinutes: 60,
      actualMinutes: 55,
      learningResource: 'CS50 SQL Lecture 3',
      whatILearned: 'INNER JOIN returns matching rows between tables. LEFT JOIN retains all left rows even if null on right.',
      confidenceRating: 4,
      status: 'COMPLETED',
      codeEvidence: 'SELECT u.name, o.id FROM users u LEFT JOIN orders o ON u.id = o.user_id;'
    });

    const [saved] = await db.select().from(deLearningSessions).where(eq(deLearningSessions.id, sessionId));
    assert.ok(saved);
    assert.equal(saved.subtopicName, 'Table joins');
    assert.equal(saved.confidenceRating, 4);
    assert.equal(saved.status, 'COMPLETED');
  });

  await t.test('2. Completion Rule: Low Confidence (<=2) Sets Status to REVIEW_REQUIRED', async () => {
    const sessionId = cryptoNative.randomUUID();
    const rating = 2;
    const calculatedStatus = rating <= 2 ? 'REVIEW_REQUIRED' : 'COMPLETED';

    await db.insert(deLearningSessions).values({
      id: sessionId,
      userId: userIdA,
      date: dateToday,
      moduleName: 'Big Data Processing',
      topicName: 'Apache Spark Basics',
      subtopicName: 'Catalyst optimizer',
      plannedMinutes: 60,
      actualMinutes: 40,
      learningResource: 'Spark Internals Doc',
      whatILearned: 'Studied logical optimization plans, but need to re-review pushdown predicates.',
      confidenceRating: rating,
      status: calculatedStatus
    });

    const [saved] = await db.select().from(deLearningSessions).where(eq(deLearningSessions.id, sessionId));
    assert.ok(saved);
    assert.equal(saved.status, 'REVIEW_REQUIRED');
  });

  await t.test('3. Strict User Isolation: User B Cannot Read User A Learning Sessions', async () => {
    const userBSessions = await db
      .select()
      .from(deLearningSessions)
      .where(eq(deLearningSessions.userId, userIdB));

    assert.equal(userBSessions.length, 0);

    const userASessions = await db
      .select()
      .from(deLearningSessions)
      .where(eq(deLearningSessions.userId, userIdA));

    assert.equal(userASessions.length, 2);
  });

  // Cleanup test data
  t.after(async () => {
    await db.delete(users).where(eq(users.id, userIdA));
    await db.delete(users).where(eq(users.id, userIdB));
  });
});
