import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { db } from '../db/index.js';
import { userPreferences } from '../db/schema.js';
import { eq } from 'drizzle-orm';

const router = Router();

// GET /api/user/preferences
router.get('/preferences', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const [prefs] = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId))
      .limit(1);

    if (!prefs) {
      // Default preferences
      return res.json({
        userId,
        customDisplayName: req.user.displayName,
        theme: 'light',
        timeFormat: '12h',
        weekStart: 'MONDAY',
      });
    }

    res.json({
      userId: prefs.userId,
      customDisplayName: prefs.customDisplayName || req.user.displayName,
      theme: prefs.theme || 'light',
      timeFormat: prefs.timeFormat || '12h',
      weekStart: prefs.weekStart || 'MONDAY',
    });
  } catch (error) {
    console.error('Error fetching user preferences:', error);
    res.status(500).json({ error: 'Failed to retrieve preferences' });
  }
});

// PUT /api/user/preferences
router.put('/preferences', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { customDisplayName, theme, timeFormat, weekStart } = req.body;

    const allowedThemes = ['light', 'dark', 'system'];
    const allowedTimeFormats = ['12h', '24h'];
    const allowedWeekStarts = ['MONDAY', 'SUNDAY'];

    const nowIso = new Date().toISOString();

    const updatePayload = {
      updatedAt: nowIso,
    };

    if (customDisplayName !== undefined) updatePayload.customDisplayName = String(customDisplayName).trim();
    if (theme && allowedThemes.includes(theme)) updatePayload.theme = theme;
    if (timeFormat && allowedTimeFormats.includes(timeFormat)) updatePayload.timeFormat = timeFormat;
    if (weekStart && allowedWeekStarts.includes(weekStart)) updatePayload.weekStart = weekStart;

    const [existing] = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId))
      .limit(1);

    if (existing) {
      await db
        .update(userPreferences)
        .set(updatePayload)
        .where(eq(userPreferences.userId, userId));
    } else {
      await db.insert(userPreferences).values({
        userId,
        customDisplayName: updatePayload.customDisplayName || req.user.displayName,
        theme: updatePayload.theme || 'light',
        timeFormat: updatePayload.timeFormat || '12h',
        weekStart: updatePayload.weekStart || 'MONDAY',
        createdAt: nowIso,
        updatedAt: nowIso,
      });
    }

    const [updated] = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId))
      .limit(1);

    res.json({
      success: true,
      preferences: {
        userId: updated.userId,
        customDisplayName: updated.customDisplayName || req.user.displayName,
        theme: updated.theme || 'light',
        timeFormat: updated.timeFormat || '12h',
        weekStart: updated.weekStart || 'MONDAY',
      },
    });
  } catch (error) {
    console.error('Error updating user preferences:', error);
    res.status(500).json({ error: 'Failed to save preferences' });
  }
});

export default router;
