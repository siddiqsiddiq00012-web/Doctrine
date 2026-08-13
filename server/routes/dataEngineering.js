import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { db } from '../db/index.js';
import { deLearningSessions } from '../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { cryptoNative } from '../utils/crypto.js';
import { GoogleGenAI } from '@google/genai';

const router = Router();

// GET /api/de/sessions — Fetch All Learning Sessions for Authenticated User
router.get('/sessions', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const sessions = await db
      .select()
      .from(deLearningSessions)
      .where(eq(deLearningSessions.userId, userId))
      .orderBy(desc(deLearningSessions.createdAt));

    res.json({ success: true, sessions });
  } catch (error) {
    console.error('[DE API Error] Fetch sessions failed:', error);
    res.status(500).json({ error: 'Failed to retrieve learning sessions', details: error.message });
  }
});

// POST /api/de/sessions — Create or Update Learning Session with Required Evidence
router.post('/sessions', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const body = req.body || {};
    const {
      date,
      moduleName,
      topicName,
      subtopicName,
      plannedMinutes,
      actualMinutes,
      learningResource,
      whatILearned,
      confidenceRating,
      status,
      activeRecallText,
      codeEvidence
    } = body;

    // Completion Rule: Mandatory "What I learned" explanation
    if (!subtopicName || !whatILearned || whatILearned.trim().length < 5) {
      return res.status(400).json({
        error: 'Missing Learning Evidence',
        message: 'A subtopic cannot be completed without providing your own written explanation of "What I Learned".'
      });
    }

    const nowIso = new Date().toISOString();
    const confidenceNum = Number(confidenceRating) || 3;
    const calculatedStatus = status || (confidenceNum <= 2 ? 'REVIEW_REQUIRED' : 'COMPLETED');

    // Check if session exists for (userId, subtopicName, date)
    const [existing] = await db
      .select()
      .from(deLearningSessions)
      .where(and(
        eq(deLearningSessions.userId, userId),
        eq(deLearningSessions.subtopicName, subtopicName),
        eq(deLearningSessions.date, date || nowIso.split('T')[0])
      ))
      .limit(1);

    const sessionPayload = {
      userId,
      date: date || nowIso.split('T')[0],
      moduleName: moduleName || 'Data Engineering Mastery',
      topicName: topicName || 'General Topic',
      subtopicName,
      plannedMinutes: Number(plannedMinutes) || 60,
      actualMinutes: Number(actualMinutes) || 0,
      learningResource: learningResource || '',
      whatILearned: whatILearned.trim(),
      confidenceRating: confidenceNum,
      status: calculatedStatus,
      activeRecallText: activeRecallText ? activeRecallText.trim() : '',
      codeEvidence: codeEvidence ? codeEvidence.trim() : '',
      updatedAt: nowIso
    };

    let sessionId = null;

    if (existing) {
      sessionId = existing.id;
      await db.update(deLearningSessions).set(sessionPayload).where(eq(deLearningSessions.id, existing.id));
    } else {
      sessionId = cryptoNative.randomUUID();
      await db.insert(deLearningSessions).values({
        id: sessionId,
        ...sessionPayload,
        createdAt: nowIso
      });
    }

    const [savedSession] = await db
      .select()
      .from(deLearningSessions)
      .where(eq(deLearningSessions.id, sessionId))
      .limit(1);

    res.json({ success: true, session: savedSession });
  } catch (error) {
    console.error('[DE API Error] Save learning session failed:', error);
    res.status(500).json({ error: 'Failed to save learning session', details: error.message });
  }
});

// POST /api/de/ai-evaluate — Optional Gemini AI Understanding Evaluation
router.post('/ai-evaluate', requireAuth, async (req, res) => {
  try {
    const { moduleName, topicName, subtopicName, whatILearned, codeEvidence } = req.body || {};

    if (!whatILearned || whatILearned.trim().length < 5) {
      return res.status(400).json({ error: 'Missing explanation text for AI evaluation.' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ error: 'AI Service Unavailable', message: 'GEMINI_API_KEY is not configured.' });
    }

    const ai = new GoogleGenAI({ apiKey });
    const prompt = `You are an expert Data Engineering mentor evaluating a student's self-written learning explanation.

TOPIC: ${moduleName} -> ${topicName} -> ${subtopicName}
STUDENT'S WRITTEN EXPLANATION:
"${whatILearned}"

${codeEvidence ? `PRACTICE / CODE WRITTEN:\n${codeEvidence}` : ''}

INSTRUCTIONS:
1. Provide a concise 2-3 sentence evaluation.
2. Confirm what parts are accurate.
3. Highlight any subtle misunderstanding or key gap to be aware of.
4. Suggest one quick practice tip or follow-up question to test mastery.
5. Tone: Encouraging, precise, technical. Keep under 120 words.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }]
    });

    const feedback = response.text || 'Evaluation completed.';
    res.json({ success: true, feedback });
  } catch (error) {
    console.error('[DE API Error] AI evaluation failed:', error);
    res.status(500).json({ error: 'AI evaluation failed', details: error.message });
  }
});

export default router;
