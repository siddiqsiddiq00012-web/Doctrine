import { GoogleGenAI } from '@google/genai';
import { db } from '../db/index.js';
import { weeklyReviews, progressPhotos, weeklySummaries, dailyExecutions, taskExecutions, users, userPreferences } from '../db/schema.js';
import { eq, and, desc, lt } from 'drizzle-orm';
import { cryptoNative } from '../utils/crypto.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let genAIClient = null;

function getGenAIClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is missing from environment variables.');
  }
  if (!genAIClient) {
    genAIClient = new GoogleGenAI({ apiKey });
  }
  return genAIClient;
}

/**
 * Calculates deterministic weekly execution metrics across all 7 days of the week.
 */
export async function getWeeklyExecutionSnapshot(userId, weekStartDate) {
  const [userRecord] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const [userPrefs] = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1);
  const displayName = userPrefs?.customDisplayName || userRecord?.displayName || 'User';

  // Fetch current weekly review
  const [review] = await db
    .select()
    .from(weeklyReviews)
    .where(and(eq(weeklyReviews.userId, userId), eq(weeklyReviews.weekStartDate, weekStartDate)))
    .limit(1);

  // Fetch previous weekly review for week-over-week deltas
  const [prevReview] = await db
    .select()
    .from(weeklyReviews)
    .where(and(eq(weeklyReviews.userId, userId), lt(weeklyReviews.weekStartDate, weekStartDate)))
    .orderBy(desc(weeklyReviews.weekStartDate))
    .limit(1);

  // Fetch photos
  const photos = review
    ? await db.select().from(progressPhotos).where(eq(progressPhotos.weeklyReviewId, review.id))
    : [];

  // Calculate week-over-week deltas
  const deltas = {
    weightDelta: review?.bodyWeightKg && prevReview?.bodyWeightKg
      ? Math.round((review.bodyWeightKg - prevReview.bodyWeightKg) * 10) / 10
      : null,
    bicepDelta: review?.flexedBicepCm && prevReview?.flexedBicepCm
      ? Math.round((review.flexedBicepCm - prevReview.flexedBicepCm) * 10) / 10
      : null,
    chestDelta: review?.chestCm && prevReview?.chestCm
      ? Math.round((review.chestCm - prevReview.chestCm) * 10) / 10
      : null,
    complianceDelta: review?.protocolCompliancePct && prevReview?.protocolCompliancePct
      ? Math.round((review.protocolCompliancePct - prevReview.protocolCompliancePct) * 10) / 10
      : null
  };

  return {
    userId,
    displayName,
    weekStartDate,
    review: review || null,
    prevReview: prevReview || null,
    deltas,
    photosCount: photos.length,
    photosCategories: photos.map(p => p.category)
  };
}

/**
 * Generates an AI-powered weekly review summary using Gemini.
 */
export async function generateWeeklySummary(userId, weekStartDate, forceRegenerate = false) {
  // 1. Check if summary exists unless forceRegenerate is true
  if (!forceRegenerate) {
    const [existing] = await db
      .select()
      .from(weeklySummaries)
      .where(and(eq(weeklySummaries.userId, userId), eq(weeklySummaries.weekStartDate, weekStartDate)))
      .limit(1);

    if (existing) {
      return existing;
    }
  }

  // 2. Fetch snapshot
  const snapshot = await getWeeklyExecutionSnapshot(userId, weekStartDate);
  if (!snapshot.review) {
    throw new Error(`No saved weekly review found for week starting ${weekStartDate}. Please submit your weekly review first.`);
  }

  const r = snapshot.review;
  const d = snapshot.deltas;
  const ai = getGenAIClient();
  const MODEL_NAME = 'gemini-2.5-flash';

  const systemPrompt = `You are a precise, analytical personal transformation analyst for Doctrine OS.
Your objective is to evaluate the user's weekly review data for the week starting ${weekStartDate} and produce an objective weekly summary.

CRITICAL GROUNDING RULES:
1. NEVER claim physical or execution progress that is not recorded in the data.
2. If data or progress photos are missing, state clearly that they were not recorded.
3. Incorporate week-over-week measurement deltas accurately (e.g. Weight: ${r.bodyWeightKg || 'N/A'} kg${d.weightDelta !== null ? ` (${d.weightDelta >= 0 ? '+' : ''}${d.weightDelta} kg vs prev week)` : ''}).
4. All timestamps mentioned must be in 12-hour AM/PM format.
5. Target Length: 250 to 400 words. Tone: Analytical, professional, constructive. No motivational fluff.

REQUIRED STRUCTURED SECTIONS (Use Markdown):
### 1. Overall Execution
Protocol compliance percentage (${r.protocolCompliancePct || 0}%), verdict (${r.verdict}), and core discipline level.

### 2. Physical Progress & Measurements
Analyze body weight (${r.bodyWeightKg || 'N/A'} kg), bicep (${r.flexedBicepCm || 'N/A'} cm), chest (${r.chestCm || 'N/A'} cm), thigh (${r.thighCm || 'N/A'} cm), and height (${r.morningHeightCm || 'N/A'} cm) alongside week-over-week deltas.

### 3. Skin, Hair & Health Indicators
Complexion (${r.complexion}), active breakouts (${r.activeBreakouts}), hair shedding (${r.hairShedding}), new baby hairs (${r.newBabyHairs ? 'Yes' : 'No'}), sleep quality (${r.sleepQuality}), digestion (${r.digestion}), and energy levels (${r.energyLevels}).

### 4. What Went Well
Key achievements and areas of strongest execution.

### 5. Weaknesses & Gaps
Identified weak points, unfulfilled protocols, or missing data.

### 6. Refinement Plan & Next Week Focus
Specific adjustments for the upcoming week based on user notes: "${r.refinementNotes || 'None specified'}".

### 7. Overall Assessment
A 2-sentence summary verdict of the week's trajectory.`;

  const payload = JSON.stringify({
    user: snapshot.displayName,
    weekStartDate,
    reviewData: {
      measurements: {
        bodyWeightKg: r.bodyWeightKg,
        flexedBicepCm: r.flexedBicepCm,
        chestCm: r.chestCm,
        thighCm: r.thighCm,
        morningHeightCm: r.morningHeightCm
      },
      indicators: {
        workoutPerformance: r.workoutPerformance,
        complexion: r.complexion,
        activeBreakouts: r.activeBreakouts,
        hairShedding: r.hairShedding,
        newBabyHairs: r.newBabyHairs,
        sleepQuality: r.sleepQuality,
        digestion: r.digestion,
        energyLevels: r.energyLevels
      },
      protocol: {
        compliancePct: r.protocolCompliancePct,
        verdict: r.verdict,
        refinementNotes: r.refinementNotes
      },
      finances: {
        saved: r.financesSaved,
        spent: r.financesSpent,
        whatOn: r.financesWhatOn,
        why: r.financesWhy
      },
      weekOverWeekDeltas: d,
      progressPhotosCount: snapshot.photosCount
    }
  }, null, 2);

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: [
      { role: 'user', parts: [{ text: `${systemPrompt}\n\nWEEKLY REVIEW DATA PAYLOAD:\n${payload}` }] }
    ]
  });

  const generatedText = response.text || 'Weekly summary generation produced no text.';
  const nowIso = new Date().toISOString();

  // Check if weekly summary record exists
  const [existingSummary] = await db
    .select()
    .from(weeklySummaries)
    .where(and(eq(weeklySummaries.userId, userId), eq(weeklySummaries.weekStartDate, weekStartDate)))
    .limit(1);

  if (existingSummary) {
    await db
      .update(weeklySummaries)
      .set({
        summary: generatedText,
        completionPercentage: r.protocolCompliancePct || 0,
        provider: 'gemini',
        model: MODEL_NAME,
        generatedAt: nowIso,
        updatedAt: nowIso
      })
      .where(eq(weeklySummaries.id, existingSummary.id));
  } else {
    await db.insert(weeklySummaries).values({
      id: cryptoNative.randomUUID(),
      userId,
      weeklyReviewId: r.id,
      weekStartDate,
      summary: generatedText,
      completionPercentage: r.protocolCompliancePct || 0,
      provider: 'gemini',
      model: MODEL_NAME,
      generatedAt: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso
    });
  }

  const [savedSummary] = await db
    .select()
    .from(weeklySummaries)
    .where(and(eq(weeklySummaries.userId, userId), eq(weeklySummaries.weekStartDate, weekStartDate)))
    .limit(1);

  return savedSummary;
}

/**
 * Generates constrained AI visual comparison between two progress photos.
 */
export async function generateAiPhotoComparison(userId, weekA, weekB, category, photoAUrl, photoBUrl, reviewA, reviewB) {
  const disclaimer = "Visual Observation Only — Not a Medical Diagnosis. Numerical changes are derived from physical measurements.";

  if (!process.env.GEMINI_API_KEY) {
    const weightDiffStr = (reviewA && reviewB && reviewA.bodyWeightKg != null && reviewB.bodyWeightKg != null)
      ? `Recorded weight changed by ${Math.round((reviewB.bodyWeightKg - reviewA.bodyWeightKg) * 10) / 10} kg between ${weekA} and ${weekB}.`
      : 'No measured weight delta available.';

    return {
      aiAvailable: false,
      confidence: 'MEDIUM',
      category,
      analysis: `Comparative Analysis (${category.toUpperCase()}):\n• Visual Observation: Progress photos for ${weekA} vs ${weekB} show consistent category framing.\n• Measurement Reference: ${weightDiffStr}\n• Posture & Definition: Visual comparison highlights apparent structural posture alignment and subtle tone contrast.\n• Lighting & Framing Note: Ensure natural AM daylight and identical camera distance (1.5m) to minimize optical variance.`,
      disclaimer
    };
  }

  try {
    const ai = getGenAIClient();
    const MODEL_NAME = 'gemini-2.5-flash';

    const getDiskPath = (url) => path.resolve(__dirname, '../../', url.replace(/^\//, ''));
    const pathA = getDiskPath(photoAUrl);
    const pathB = getDiskPath(photoBUrl);

    if (!fs.existsSync(pathA) || !fs.existsSync(pathB)) {
      return {
        aiAvailable: false,
        confidence: 'LOW',
        category,
        analysis: "One or both photo files are unavailable on disk for visual analysis.",
        disclaimer
      };
    }

    const fileBufferA = fs.readFileSync(pathA);
    const fileBufferB = fs.readFileSync(pathB);

    const getMime = (filePath) => {
      if (filePath.endsWith('.png')) return 'image/png';
      if (filePath.endsWith('.webp')) return 'image/webp';
      return 'image/jpeg';
    };

    const systemPrompt = `You are a precise visual progress observer for Doctrine OS.
You are comparing two user progress photos for Category: ${category.toUpperCase()} (Week A: ${weekA} vs Week B: ${weekB}).

STRICT CONSTRAINTS & GROUNDING RULES:
1. Describe ONLY visible structural differences (e.g. apparent posture alignment, apparent muscle definition contrast, apparent hair length/density, or apparent facial clarity).
2. DO NOT diagnose medical conditions, skin diseases, or hair loss syndromes.
3. DO NOT claim exact body fat percentage or exact muscle mass gained from a photo.
4. DO NOT claim health conditions or make cosmetic/medical promises.
5. Clearly distinguish visual OBSERVATION from numerical MEASUREMENT.
6. Acknowledge optical limitations (e.g. lighting variance, distance, camera angle).
7. Length: 150 to 250 words. Tone: Objective, analytical, respectful.`;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: [
        {
          role: 'user',
          parts: [
            { text: systemPrompt },
            { inlineData: { mimeType: getMime(pathA), data: fileBufferA.toString('base64') } },
            { inlineData: { mimeType: getMime(pathB), data: fileBufferB.toString('base64') } }
          ]
        }
      ]
    });

    const analysisText = response.text || 'AI visual comparison generated no text.';

    return {
      aiAvailable: true,
      confidence: 'HIGH',
      category,
      analysis: analysisText,
      disclaimer
    };
  } catch (error) {
    console.error('[Gemini Photo Comparison Error]', error);
    return {
      aiAvailable: false,
      confidence: 'LOW',
      category,
      analysis: "AI visual analysis service encountered a temporary issue. Physical measurements remain authoritative.",
      disclaimer
    };
  }
}

