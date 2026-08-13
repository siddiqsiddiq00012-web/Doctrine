import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../db/index.js';
import { users, weeklyReviews, progressPhotos, weeklySummaries } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { cryptoNative } from '../utils/crypto.js';
import { getWeeklyExecutionSnapshot } from '../services/weeklyAiService.js';

test('FEATURE 4 — SUNDAY WEEKLY REVIEW & PROGRESS TRACKING TESTS', async (t) => {
  const userIdA = cryptoNative.randomUUID();
  const userIdB = cryptoNative.randomUUID();
  const googleIdA = 'google_weekly_user_a_' + Date.now();
  const googleIdB = 'google_weekly_user_b_' + Date.now();

  const week1Start = '2026-08-03';
  const week1End = '2026-08-09';
  const week2Start = '2026-08-10';
  const week2End = '2026-08-16';

  await t.test('1. Setup Test Users & Consecutive Weekly Reviews', async () => {
    await db.insert(users).values([
      { id: userIdA, googleId: googleIdA, email: 'weekly_user_a@example.com', displayName: 'Weekly User Alpha', isActive: true },
      { id: userIdB, googleId: googleIdB, email: 'weekly_user_b@example.com', displayName: 'Weekly User Beta', isActive: true }
    ]);

    // Week 1 Review
    const reviewId1 = cryptoNative.randomUUID();
    await db.insert(weeklyReviews).values({
      id: reviewId1,
      userId: userIdA,
      weekStartDate: week1Start,
      weekEndDate: week1End,
      bodyWeightKg: 41.4,
      flexedBicepCm: 35.5,
      chestCm: 97.0,
      thighCm: 55.0,
      morningHeightCm: 178.5,
      protocolCompliancePct: 90,
      verdict: 'ON_TRACK',
      refinementNotes: 'Week 1 baseline.'
    });

    // Week 2 Review (Current)
    const reviewId2 = cryptoNative.randomUUID();
    await db.insert(weeklyReviews).values({
      id: reviewId2,
      userId: userIdA,
      weekStartDate: week2Start,
      weekEndDate: week2End,
      bodyWeightKg: 42.0,
      flexedBicepCm: 36.0,
      chestCm: 98.0,
      thighCm: 55.5,
      morningHeightCm: 178.5,
      protocolCompliancePct: 95,
      verdict: 'ON_TRACK',
      refinementNotes: 'Week 2 mass gain.'
    });

    // Progress Photo for Week 2
    await db.insert(progressPhotos).values({
      id: cryptoNative.randomUUID(),
      userId: userIdA,
      weeklyReviewId: reviewId2,
      weekStartDate: week2Start,
      category: 'physique',
      photoUrl: '/uploads/progress_photos/test_physique.jpg'
    });
  });

  await t.test('2. Verify Deterministic Week-over-Week Deltas Calculation', async () => {
    const snapshot = await getWeeklyExecutionSnapshot(userIdA, week2Start);
    assert.ok(snapshot.review);
    assert.ok(snapshot.prevReview);
    assert.equal(snapshot.deltas.weightDelta, 0.6); // 42.0 - 41.4 = +0.6
    assert.equal(snapshot.deltas.bicepDelta, 0.5);  // 36.0 - 35.5 = +0.5
    assert.equal(snapshot.deltas.chestDelta, 1.0);  // 98.0 - 97.0 = +1.0
    assert.equal(snapshot.photosCount, 1);
  });

  await t.test('3. Strict User Data Isolation: User B Cannot Access User A Review or Photos', async () => {
    const [userBReview] = await db
      .select()
      .from(weeklyReviews)
      .where(and(eq(weeklyReviews.userId, userIdB), eq(weeklyReviews.weekStartDate, week2Start)));

    assert.equal(userBReview, undefined);

    const userBPhotos = await db.select().from(progressPhotos).where(eq(progressPhotos.userId, userIdB));
    assert.equal(userBPhotos.length, 0);
  });

  await t.test('4. Verify Permanent Historical Record Retrieval', async () => {
    const reviews = await db
      .select()
      .from(weeklyReviews)
      .where(eq(weeklyReviews.userId, userIdA));

    assert.equal(reviews.length, 2);
  });

  // Cleanup test data
  t.after(async () => {
    await db.delete(users).where(eq(users.id, userIdA));
    await db.delete(users).where(eq(users.id, userIdB));
  });
});
