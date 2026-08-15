import { db } from '../db/index.js';
import { userPreferences } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export const DEFAULT_BIO = 'Perhaps a life is measured less by what it gathers than by what it gradually becomes. In the space between what is given and what is chosen, character takes shape.';
export const DEFAULT_AVATAR = '/profile-picture.jpg';

/**
 * Dedicated, guarded, idempotent profile initialization function.
 * Initializes missing Bio and/or default Avatar ONLY when genuinely missing.
 * Existing bio and avatar values are strictly preserved.
 */
export async function ensureProfileInitialized(userId, defaultDisplayName = 'Doctrine User') {
  if (!userId) return null;

  try {
    const [existing] = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId))
      .limit(1);

    const nowIso = new Date().toISOString();

    if (!existing) {
      // 1. Initial creation for new user record
      await db.insert(userPreferences).values({
        userId,
        customDisplayName: defaultDisplayName,
        bio: DEFAULT_BIO,
        customAvatarUrl: DEFAULT_AVATAR,
        theme: 'light',
        timeFormat: '12h',
        weekStart: 'MONDAY',
        createdAt: nowIso,
        updatedAt: nowIso,
      });

      const [created] = await db
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.userId, userId))
        .limit(1);

      return created;
    }

    // 2. Idempotent check for existing record: update ONLY missing fields
    const updates = {};
    if (!existing.bio || !existing.bio.trim()) {
      updates.bio = DEFAULT_BIO;
    }
    if (!existing.customAvatarUrl || !existing.customAvatarUrl.trim()) {
      updates.customAvatarUrl = DEFAULT_AVATAR;
    }

    if (Object.keys(updates).length > 0) {
      updates.updatedAt = nowIso;
      await db
        .update(userPreferences)
        .set(updates)
        .where(eq(userPreferences.userId, userId));

      const [updated] = await db
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.userId, userId))
        .limit(1);

      return updated;
    }

    // 3. Both fields already present — zero DB mutations
    return existing;
  } catch (error) {
    console.error(`[ProfileInitService] Error initializing profile for user ${userId}:`, error);
    return null;
  }
}
