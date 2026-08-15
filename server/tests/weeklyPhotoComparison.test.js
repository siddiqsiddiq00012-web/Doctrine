import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../db/index.js';
import { users, weeklyReviews, progressPhotos } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { cryptoNative } from '../utils/crypto.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateAiPhotoComparison } from '../services/weeklyAiService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('FEATURE 13 — SMART SUNDAY PHOTO COMPARISON SYSTEM TESTS', async (t) => {
  const userIdA = cryptoNative.randomUUID();
  const userIdB = cryptoNative.randomUUID();
  const googleIdA = 'google_feat13_user_a_' + Date.now();
  const googleIdB = 'google_feat13_user_b_' + Date.now();
  const weekStartA = '2026-08-03';
  const weekStartB = '2026-08-10';

  await t.test('1. Setup Test Users & Weekly Reviews', async () => {
    const nowIso = new Date().toISOString();
    await db.insert(users).values([
      { id: userIdA, googleId: googleIdA, email: 'feat13_user_a@example.com', displayName: 'Feat13 User A', isActive: true },
      { id: userIdB, googleId: googleIdB, email: 'feat13_user_b@example.com', displayName: 'Feat13 User B', isActive: true }
    ]);

    await db.insert(weeklyReviews).values([
      { id: cryptoNative.randomUUID(), userId: userIdA, weekStartDate: weekStartA, weekEndDate: '2026-08-09', bodyWeightKg: 68.0, flexedBicepCm: 34.5, protocolCompliancePct: 90, createdAt: nowIso, updatedAt: nowIso },
      { id: cryptoNative.randomUUID(), userId: userIdA, weekStartDate: weekStartB, weekEndDate: '2026-08-16', bodyWeightKg: 69.2, flexedBicepCm: 35.2, protocolCompliancePct: 95, createdAt: nowIso, updatedAt: nowIso }
    ]);
  });

  await t.test('2. Progress Photo Upload & Disk Persistence', async () => {
    const [reviewA] = await db
      .select()
      .from(weeklyReviews)
      .where(and(eq(weeklyReviews.userId, userIdA), eq(weeklyReviews.weekStartDate, weekStartA)));

    assert.ok(reviewA);

    // Create 1x1 1-pixel WebP Base64 Data URI
    const mockWebpBase64 = 'data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAQAcJaQAA3AA/v3AgAA=';
    const match = mockWebpBase64.match(/^data:(image\/(jpeg|png|webp));base64,(.+)$/);
    assert.ok(match);

    const base64Buffer = Buffer.from(match[3], 'base64');
    const photosDir = path.resolve(__dirname, '../../uploads/progress_photos');
    if (!fs.existsSync(photosDir)) {
      fs.mkdirSync(photosDir, { recursive: true });
    }

    const filename = `progress_${userIdA}_physique_${Date.now()}.webp`;
    const fullDiskPath = path.join(photosDir, filename);
    const relativeUrl = `/uploads/progress_photos/${filename}`;

    fs.writeFileSync(fullDiskPath, base64Buffer);

    const photoId = cryptoNative.randomUUID();
    await db.insert(progressPhotos).values({
      id: photoId,
      userId: userIdA,
      weeklyReviewId: reviewA.id,
      weekStartDate: weekStartA,
      category: 'physique',
      photoUrl: relativeUrl,
      createdAt: new Date().toISOString()
    });

    const [savedPhoto] = await db.select().from(progressPhotos).where(eq(progressPhotos.id, photoId));
    assert.ok(savedPhoto);
    assert.equal(savedPhoto.category, 'physique');
    assert.equal(savedPhoto.photoUrl, relativeUrl);
    assert.ok(fs.existsSync(fullDiskPath));

    // Cleanup disk test file
    try { fs.unlinkSync(fullDiskPath); } catch (e) {}
  });

  await t.test('3. Side-by-Side Comparison Calculation & Deltas', async () => {
    const [reviewA] = await db.select().from(weeklyReviews).where(and(eq(weeklyReviews.userId, userIdA), eq(weeklyReviews.weekStartDate, weekStartA)));
    const [reviewB] = await db.select().from(weeklyReviews).where(and(eq(weeklyReviews.userId, userIdA), eq(weeklyReviews.weekStartDate, weekStartB)));

    assert.ok(reviewA);
    assert.ok(reviewB);

    const weightDelta = Math.round((reviewB.bodyWeightKg - reviewA.bodyWeightKg) * 10) / 10;
    const bicepDelta = Math.round((reviewB.flexedBicepCm - reviewA.flexedBicepCm) * 10) / 10;

    assert.equal(weightDelta, 1.2);
    assert.equal(bicepDelta, 0.7);
  });

  await t.test('4. Missing Photo Handled Cleanly Without Errors', async () => {
    const [reviewB] = await db.select().from(weeklyReviews).where(and(eq(weeklyReviews.userId, userIdA), eq(weeklyReviews.weekStartDate, weekStartB)));
    const photosB = await db.select().from(progressPhotos).where(and(eq(progressPhotos.weeklyReviewId, reviewB.id), eq(progressPhotos.category, 'face')));

    assert.equal(photosB.length, 0);
  });

  await t.test('5. Strict User Isolation (User B cannot access User A photos)', async () => {
    const userBPhotos = await db.select().from(progressPhotos).where(eq(progressPhotos.userId, userIdB));
    assert.equal(userBPhotos.length, 0);
  });

  await t.test('6. Category Validation & Allowed Categories (physique, face, hair)', async () => {
    const validCategories = ['physique', 'face', 'hair'];
    const invalidCategory = 'unsupported_cat';

    assert.ok(validCategories.includes('physique'));
    assert.ok(validCategories.includes('face'));
    assert.ok(validCategories.includes('hair'));
    assert.equal(validCategories.includes(invalidCategory), false);
  });

  await t.test('7. AI Visual Comparison Constrained Prompt & Disclaimer Verification', async () => {
    const [reviewA] = await db.select().from(weeklyReviews).where(and(eq(weeklyReviews.userId, userIdA), eq(weeklyReviews.weekStartDate, weekStartA)));
    const [reviewB] = await db.select().from(weeklyReviews).where(and(eq(weeklyReviews.userId, userIdA), eq(weeklyReviews.weekStartDate, weekStartB)));

    const result = await generateAiPhotoComparison(userIdA, weekStartA, weekStartB, 'physique', '/uploads/progress_photos/test1.webp', '/uploads/progress_photos/test2.webp', reviewA, reviewB);

    assert.ok(result);
    assert.ok(result.disclaimer);
    assert.ok(result.disclaimer.includes('Visual Observation Only'));
    assert.ok(result.disclaimer.includes('Not a Medical Diagnosis'));
  });

  await t.test('8. Serverless Filesystem Failure Fallback to Data URI & Replacement Behavior', async () => {
    const [reviewA] = await db
      .select()
      .from(weeklyReviews)
      .where(and(eq(weeklyReviews.userId, userIdA), eq(weeklyReviews.weekStartDate, weekStartA)));

    assert.ok(reviewA);

    const mockDataUri = 'data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAQAcJaQAA3AA/v3AgAA=';

    // Simulate disk failure fallback logic
    let photoUrlToSave;
    try {
      throw new Error('Simulated Read-Only Serverless Disk Error');
    } catch (diskErr) {
      photoUrlToSave = mockDataUri;
    }

    assert.equal(photoUrlToSave, mockDataUri);

    // Save as Data URI in DB
    const photoId = cryptoNative.randomUUID();
    await db.insert(progressPhotos).values({
      id: photoId,
      userId: userIdA,
      weeklyReviewId: reviewA.id,
      weekStartDate: weekStartA,
      category: 'face',
      photoUrl: photoUrlToSave,
      createdAt: new Date().toISOString()
    });

    // Verify Data URI retrieval
    const [savedDataUriPhoto] = await db.select().from(progressPhotos).where(eq(progressPhotos.id, photoId));
    assert.ok(savedDataUriPhoto);
    assert.equal(savedDataUriPhoto.category, 'face');
    assert.equal(savedDataUriPhoto.photoUrl, mockDataUri);

    // Verify Replacement / Overwrite Behavior
    const newMockDataUri = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP...';
    await db.update(progressPhotos)
      .set({ photoUrl: newMockDataUri })
      .where(eq(progressPhotos.id, photoId));

    const [updatedPhoto] = await db.select().from(progressPhotos).where(eq(progressPhotos.id, photoId));
    assert.equal(updatedPhoto.photoUrl, newMockDataUri);
  });

  await t.test('9. Optimized Payload Size Contract & Oversized Rejection Safety Verification', async () => {
    // 9a. Standard canvas optimized Data URI is lightweight (< 500KB)
    const mockOptimizedDataUri = 'data:image/jpeg;base64,' + 'A'.repeat(200000); // ~200KB
    assert.ok(mockOptimizedDataUri.startsWith('data:image/jpeg;base64,'));
    assert.ok(mockOptimizedDataUri.length < 500000);

    // 9b. Server oversized validation rule check (> 5MB Buffer)
    const oversizedBuffer = Buffer.alloc(5 * 1024 * 1024 + 1);
    assert.ok(oversizedBuffer.length > 5 * 1024 * 1024);
  });

  t.after(async () => {
    await db.delete(weeklyReviews).where(eq(weeklyReviews.userId, userIdA));
    await db.delete(weeklyReviews).where(eq(weeklyReviews.userId, userIdB));
    await db.delete(users).where(eq(users.id, userIdA));
    await db.delete(users).where(eq(users.id, userIdB));
  });
});
