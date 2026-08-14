import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { db } from '../db/index.js';
import { userPreferences } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();
const uploadsAvatarsDir = path.resolve(__dirname, '../../uploads/avatars');

// Ensure upload directory exists
if (!fs.existsSync(uploadsAvatarsDir)) {
  fs.mkdirSync(uploadsAvatarsDir, { recursive: true });
}

// Helper to delete previous avatar files for user
function deleteUserAvatarFiles(userId) {
  try {
    const files = fs.readdirSync(uploadsAvatarsDir);
    const userPrefix = `avatar_${userId}_`;
    files.forEach((file) => {
      if (file.startsWith(userPrefix)) {
        const filePath = path.join(uploadsAvatarsDir, file);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
    });
  } catch (err) {
    console.error(`[Avatar Storage] Warning: Failed to cleanup old avatar for user ${userId}:`, err.message);
  }
}

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
      return res.json({
        userId,
        customDisplayName: req.user.displayName,
        bio: '',
        customAvatarUrl: null,
        theme: 'light',
        timeFormat: '12h',
        weekStart: 'MONDAY',
      });
    }

    res.json({
      userId: prefs.userId,
      customDisplayName: prefs.customDisplayName || req.user.displayName,
      bio: prefs.bio || '',
      customAvatarUrl: prefs.customAvatarUrl || null,
      theme: prefs.theme || 'light',
      timeFormat: prefs.timeFormat || '12h',
      weekStart: prefs.weekStart || 'MONDAY',
    });
  } catch (error) {
    console.error('[User API] Error fetching preferences:', error);
    res.status(500).json({ error: 'Failed to retrieve preferences', details: error.message });
  }
});

// POST /api/user/avatar — High Reliability Avatar Upload to Disk or DB
router.post('/avatar', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { avatarData } = req.body;

    if (!avatarData || typeof avatarData !== 'string') {
      return res.status(400).json({ error: 'Validation Error', message: 'Missing avatar image data' });
    }

    // Extract MIME type and Base64 content
    const matches = avatarData.match(/^data:(image\/(jpeg|jpg|png|webp));base64,(.+)$/i);
    if (!matches) {
      return res.status(400).json({
        error: 'Unsupported File Type',
        message: 'Only JPEG, PNG, and WebP image formats are supported.'
      });
    }

    const nowIso = new Date().toISOString();
    const isVercel = Boolean(process.env.VERCEL || process.env.VERCEL_ENV || process.env.NODE_ENV === 'production');

    let avatarUrlToSave = avatarData;

    // Try disk write only in local non-serverless development environment
    if (!isVercel) {
      try {
        const mimeType = matches[1].toLowerCase();
        const base64Data = matches[3];
        const buffer = Buffer.from(base64Data, 'base64');

        // Enforce 5MB size limit on buffer
        const MAX_SIZE_BYTES = 5 * 1024 * 1024;
        if (buffer.length > MAX_SIZE_BYTES) {
          return res.status(400).json({
            error: 'File Too Large',
            message: 'Image size exceeds 5MB limit.'
          });
        }

        let ext = 'jpg';
        if (mimeType.includes('png')) ext = 'png';
        else if (mimeType.includes('webp')) ext = 'webp';

        if (!fs.existsSync(uploadsAvatarsDir)) {
          fs.mkdirSync(uploadsAvatarsDir, { recursive: true });
        }
        deleteUserAvatarFiles(userId);
        const filename = `avatar_${userId}_${Date.now()}.${ext}`;
        const filePath = path.join(uploadsAvatarsDir, filename);
        fs.writeFileSync(filePath, buffer);
        avatarUrlToSave = `/uploads/avatars/${filename}`;
      } catch (diskErr) {
        console.warn('[Avatar Storage] Disk write disallowed, storing Data URI directly in DB:', diskErr.message);
        avatarUrlToSave = avatarData;
      }
    }

    // Update database record with avatar URL / Data URI
    const [existing] = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId))
      .limit(1);

    if (existing) {
      await db
        .update(userPreferences)
        .set({ customAvatarUrl: avatarUrlToSave, updatedAt: nowIso })
        .where(eq(userPreferences.userId, userId));
    } else {
      await db.insert(userPreferences).values({
        userId,
        customDisplayName: req.user.displayName,
        bio: '',
        customAvatarUrl: avatarUrlToSave,
        theme: 'light',
        timeFormat: '12h',
        weekStart: 'MONDAY',
        createdAt: nowIso,
        updatedAt: nowIso,
      });
    }

    const [updated] = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId))
      .limit(1);

    console.log(`[Avatar Storage] Saved avatar for user ${userId}`);
    res.json({ success: true, customAvatarUrl: updated ? updated.customAvatarUrl : avatarUrlToSave });
  } catch (error) {
    console.error('[Avatar API Error]:', error);
    res.status(500).json({ error: 'Failed to process avatar upload', details: error.message });
  }
});

// DELETE /api/user/avatar — Revert Custom Avatar to Fall Back to Google Profile Photo
router.delete('/avatar', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    deleteUserAvatarFiles(userId);

    const nowIso = new Date().toISOString();

    await db
      .update(userPreferences)
      .set({ customAvatarUrl: null, updatedAt: nowIso })
      .where(eq(userPreferences.userId, userId));

    console.log(`[Avatar Storage] Reverted avatar for user ${userId} to Google photo fallback`);
    res.json({ success: true, customAvatarUrl: null });
  } catch (error) {
    console.error('[Avatar API Error]:', error);
    res.status(500).json({ error: 'Failed to revert avatar', details: error.message });
  }
});

// Update Handler for Preferences (PUT & POST /api/user/preferences)
const handleUpdatePreferences = async (req, res) => {
  try {
    const userId = req.user.id;
    const { customDisplayName, bio, customAvatarUrl, theme, timeFormat, weekStart } = req.body;

    const allowedThemes = ['light', 'dark', 'system'];
    const allowedTimeFormats = ['12h', '24h'];
    const allowedWeekStarts = ['MONDAY', 'SUNDAY'];

    // Bio character validation
    if (bio !== undefined && typeof bio === 'string' && bio.length > 180) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Bio cannot exceed 180 characters'
      });
    }

    const nowIso = new Date().toISOString();
    const updatePayload = { updatedAt: nowIso };

    if (customDisplayName !== undefined) updatePayload.customDisplayName = String(customDisplayName).trim();
    if (bio !== undefined) updatePayload.bio = String(bio).trim();
    if (customAvatarUrl !== undefined) updatePayload.customAvatarUrl = customAvatarUrl ? String(customAvatarUrl).trim() : null;
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
        customDisplayName: updatePayload.customDisplayName !== undefined ? updatePayload.customDisplayName : req.user.displayName,
        bio: updatePayload.bio !== undefined ? updatePayload.bio : '',
        customAvatarUrl: updatePayload.customAvatarUrl !== undefined ? updatePayload.customAvatarUrl : null,
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
        bio: updated.bio || '',
        customAvatarUrl: (updated.customAvatarUrl !== undefined) ? updated.customAvatarUrl : null,
        theme: updated.theme || 'light',
        timeFormat: updated.timeFormat || '12h',
        weekStart: updated.weekStart || 'MONDAY',
      },
    });
  } catch (error) {
    console.error('[User API Error] Updating preferences failed:', error);
    res.status(500).json({ error: 'Failed to save preferences', details: error.message });
  }
};

router.put('/preferences', requireAuth, handleUpdatePreferences);
router.post('/preferences', requireAuth, handleUpdatePreferences);

export default router;
