import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { db } from '../db/index.js';
import { dailySummaries } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { generateDailySummary, getDailyExecutionSnapshot } from '../services/aiService.js';

const router = Router();

// GET /api/summary/:date — Fetch Saved AI Daily Summary for Authenticated User
router.get('/:date', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { date } = req.params;

    // Strict YYYY-MM-DD Date Regex Validation
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Invalid Date Format', message: 'Date must be YYYY-MM-DD' });
    }

    const [summaryRecord] = await db
      .select()
      .from(dailySummaries)
      .where(and(eq(dailySummaries.userId, userId), eq(dailySummaries.date, date)))
      .limit(1);

    res.json({
      success: true,
      summaryRecord: summaryRecord || null
    });
  } catch (error) {
    console.error('[Summary API Error] Fetch failed:', error);
    res.status(500).json({ error: 'Failed to retrieve daily summary', details: error.message });
  }
});

// POST /api/summary/:date/generate — Generate or Regenerate AI Daily Summary
router.post('/:date/generate', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { date } = req.params;
    const { forceRegenerate } = req.body || {};

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Invalid Date Format', message: 'Date must be YYYY-MM-DD' });
    }

    const summaryRecord = await generateDailySummary(userId, date, Boolean(forceRegenerate));

    res.json({
      success: true,
      summaryRecord
    });
  } catch (error) {
    console.error('[Summary API Error] Generation failed:', error);
    res.status(500).json({
      success: false,
      error: 'Daily summary generation failed',
      details: error.message || 'AI service error'
    });
  }
});

export default router;
