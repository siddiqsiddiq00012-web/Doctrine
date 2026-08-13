import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { db } from '../db/index.js';
import { weeklyReviews, progressPhotos, weeklySummaries } from '../db/schema.js';
import { eq, and, desc, lt } from 'drizzle-orm';
import { cryptoNative } from '../utils/crypto.js';
import { generateWeeklySummary, getWeeklyExecutionSnapshot } from '../services/weeklyAiService.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

// GET /api/weekly/reviews — Fetch All Saved Weekly Reviews for Authenticated User
router.get('/reviews', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const reviews = await db
      .select()
      .from(weeklyReviews)
      .where(eq(weeklyReviews.userId, userId))
      .orderBy(desc(weeklyReviews.weekStartDate));

    res.json({ success: true, reviews });
  } catch (error) {
    console.error('[Weekly API Error] Fetch all reviews failed:', error);
    res.status(500).json({ error: 'Failed to retrieve weekly reviews', details: error.message });
  }
});

// GET /api/weekly/reviews/:weekStartDate — Fetch Specific Week Review + Photos + AI Summary
router.get('/reviews/:weekStartDate', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { weekStartDate } = req.params;

    const snapshot = await getWeeklyExecutionSnapshot(userId, weekStartDate);
    const [summaryRecord] = await db
      .select()
      .from(weeklySummaries)
      .where(and(eq(weeklySummaries.userId, userId), eq(weeklySummaries.weekStartDate, weekStartDate)))
      .limit(1);

    const photos = snapshot.review
      ? await db.select().from(progressPhotos).where(eq(progressPhotos.weeklyReviewId, snapshot.review.id))
      : [];

    res.json({
      success: true,
      review: snapshot.review,
      prevReview: snapshot.prevReview,
      deltas: snapshot.deltas,
      photos,
      summaryRecord: summaryRecord || null
    });
  } catch (error) {
    console.error('[Weekly API Error] Fetch week review failed:', error);
    res.status(500).json({ error: 'Failed to retrieve week review', details: error.message });
  }
});

// POST /api/weekly/reviews — Create or Update Weekly Review Record
router.post('/reviews', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const body = req.body || {};
    const { weekStartDate, weekEndDate } = body;

    if (!weekStartDate || !weekEndDate) {
      return res.status(400).json({ error: 'Missing required week dates (weekStartDate, weekEndDate)' });
    }

    const [existing] = await db
      .select()
      .from(weeklyReviews)
      .where(and(eq(weeklyReviews.userId, userId), eq(weeklyReviews.weekStartDate, weekStartDate)))
      .limit(1);

    const nowIso = new Date().toISOString();
    const reviewData = {
      userId,
      weekStartDate,
      weekEndDate,
      bodyWeightKg: body.bodyWeightKg !== undefined ? Number(body.bodyWeightKg) : null,
      flexedBicepCm: body.flexedBicepCm !== undefined ? Number(body.flexedBicepCm) : null,
      chestCm: body.chestCm !== undefined ? Number(body.chestCm) : null,
      thighCm: body.thighCm !== undefined ? Number(body.thighCm) : null,
      morningHeightCm: body.morningHeightCm !== undefined ? Number(body.morningHeightCm) : null,
      workoutPerformance: body.workoutPerformance || 'STRONGER',
      complexion: body.complexion || 'BRIGHTER',
      activeBreakouts: body.activeBreakouts !== undefined ? Number(body.activeBreakouts) : 0,
      hairShedding: body.hairShedding || 'LESS',
      newBabyHairs: body.newBabyHairs !== undefined ? Boolean(body.newBabyHairs) : true,
      sleepQuality: body.sleepQuality || 'BETTER',
      digestion: body.digestion || 'BETTER',
      energyLevels: body.energyLevels || 'HIGHER',
      protocolCompliancePct: body.protocolCompliancePct !== undefined ? Number(body.protocolCompliancePct) : 100,
      verdict: body.verdict || 'ON_TRACK',
      refinementNotes: body.refinementNotes || '',
      financesSaved: body.financesSaved !== undefined ? Number(body.financesSaved) : 0,
      financesSpent: body.financesSpent !== undefined ? Number(body.financesSpent) : 0,
      financesWhatOn: body.financesWhatOn || '',
      financesWhy: body.financesWhy || '',
      updatedAt: nowIso
    };

    let reviewId = null;

    if (existing) {
      reviewId = existing.id;
      await db.update(weeklyReviews).set(reviewData).where(eq(weeklyReviews.id, existing.id));
    } else {
      reviewId = cryptoNative.randomUUID();
      await db.insert(weeklyReviews).values({
        id: reviewId,
        ...reviewData,
        createdAt: nowIso
      });
    }

    const [savedReview] = await db.select().from(weeklyReviews).where(eq(weeklyReviews.id, reviewId)).limit(1);

    res.json({
      success: true,
      review: savedReview
    });
  } catch (error) {
    console.error('[Weekly API Error] Save review failed:', error);
    res.status(500).json({ error: 'Failed to save weekly review', details: error.message });
  }
});

// POST /api/weekly/photos — Upload Progress Photo for Weekly Review
router.post('/photos', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { weekStartDate, category, photoData } = req.body || {};

    if (!weekStartDate || !category || !photoData) {
      return res.status(400).json({ error: 'Missing weekStartDate, category, or photoData' });
    }

    if (!['physique', 'face', 'hair'].includes(category)) {
      return res.status(400).json({ error: 'Invalid photo category. Must be physique, face, or hair.' });
    }

    // Ensure weekly review exists or create stub
    let [review] = await db
      .select()
      .from(weeklyReviews)
      .where(and(eq(weeklyReviews.userId, userId), eq(weeklyReviews.weekStartDate, weekStartDate)))
      .limit(1);

    if (!review) {
      const newReviewId = cryptoNative.randomUUID();
      const nowIso = new Date().toISOString();
      const weekEndDate = new Date(new Date(weekStartDate).getTime() + 6 * 84600000).toISOString().split('T')[0];

      await db.insert(weeklyReviews).values({
        id: newReviewId,
        userId,
        weekStartDate,
        weekEndDate,
        createdAt: nowIso,
        updatedAt: nowIso
      });

      [review] = await db.select().from(weeklyReviews).where(eq(weeklyReviews.id, newReviewId)).limit(1);
    }

    // Process Base64 Data URI
    const match = photoData.match(/^data:(image\/(jpeg|png|webp));base64,(.+)$/);
    if (!match) {
      return res.status(400).json({ error: 'Invalid Image Format', message: 'Data URI must be JPEG, PNG, or WebP.' });
    }

    const mimeType = match[1];
    const ext = match[2] === 'jpeg' ? 'jpg' : match[2];
    const base64Buffer = Buffer.from(match[3], 'base64');

    if (base64Buffer.length > 5 * 1024 * 1024) {
      return res.status(400).json({ error: 'File Too Large', message: 'Progress photo exceeds 5MB limit.' });
    }

    // Disk Path setup
    const photosDir = path.resolve(__dirname, '../../uploads/progress_photos');
    if (!fs.existsSync(photosDir)) {
      fs.mkdirSync(photosDir, { recursive: true });
    }

    const filename = `progress_${userId}_${category}_${Date.now()}.${ext}`;
    const fullDiskPath = path.join(photosDir, filename);
    const relativeUrl = `/uploads/progress_photos/${filename}`;

    fs.writeFileSync(fullDiskPath, base64Buffer);

    // Save or update in DB
    const [existingPhoto] = await db
      .select()
      .from(progressPhotos)
      .where(and(eq(progressPhotos.weeklyReviewId, review.id), eq(progressPhotos.category, category)))
      .limit(1);

    if (existingPhoto) {
      // Remove old file from disk if present
      if (existingPhoto.photoUrl && existingPhoto.photoUrl.startsWith('/uploads/')) {
        const oldPath = path.resolve(__dirname, '../../', existingPhoto.photoUrl.replace(/^\//, ''));
        if (fs.existsSync(oldPath)) {
          try { fs.unlinkSync(oldPath); } catch (e) {}
        }
      }
      await db
        .update(progressPhotos)
        .set({ photoUrl: relativeUrl, createdAt: new Date().toISOString() })
        .where(eq(progressPhotos.id, existingPhoto.id));
    } else {
      await db.insert(progressPhotos).values({
        id: cryptoNative.randomUUID(),
        userId,
        weeklyReviewId: review.id,
        weekStartDate,
        category,
        photoUrl: relativeUrl,
        createdAt: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      category,
      photoUrl: relativeUrl
    });
  } catch (error) {
    console.error('[Weekly API Error] Photo upload failed:', error);
    res.status(500).json({ error: 'Failed to upload progress photo', details: error.message });
  }
});

// POST /api/weekly/reviews/:weekStartDate/generate-summary — Generate Weekly AI Summary
router.post('/reviews/:weekStartDate/generate-summary', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { weekStartDate } = req.params;
    const { forceRegenerate } = req.body || {};

    const summaryRecord = await generateWeeklySummary(userId, weekStartDate, Boolean(forceRegenerate));

    res.json({
      success: true,
      summaryRecord
    });
  } catch (error) {
    console.error('[Weekly API Error] AI Summary generation failed:', error);
    res.status(500).json({
      success: false,
      error: 'Weekly AI summary generation failed',
      details: error.message || 'AI service error'
    });
  }
});

export default router;
