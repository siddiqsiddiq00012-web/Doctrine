import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';

const STABLE_DEFAULT_USER_ID = 'default-user-siddiq';

/**
 * Doctrine development authentication middleware.
 *
 * Authentication is intentionally disabled during the current
 * development phase. If a valid session exists, it is respected.
 * Otherwise, the stable Doctrine development user is used.
 *
 * This allows the same application state to work on:
 * - localhost
 * - Vercel
 * - desktop
 * - mobile
 *
 * Real authentication can be restored later as a separate task.
 */
export async function requireAuth(req, res, next) {
  try {
    const userId = req.session?.userId;

    let user = null;

    // 1. Respect an existing valid session when available.
    if (userId) {
      const [foundUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      user = foundUser || null;
    }

    // 2. Development fallback: stable Doctrine user.
    if (!user) {
      const [defaultUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, STABLE_DEFAULT_USER_ID))
        .limit(1);

      user = defaultUser || null;
    }

    // 3. Fallback to any active user if the stable user does not exist.
    if (!user) {
      const [activeUser] = await db
        .select()
        .from(users)
        .where(eq(users.isActive, true))
        .limit(1);

      user = activeUser || null;
    }

    // 4. Create the stable development user if no user exists.
    if (!user) {
      const nowIso = new Date().toISOString();

      await db.insert(users).values({
        id: STABLE_DEFAULT_USER_ID,
        googleId: 'dev_default_user',
        email: 'owner@doctrine.local',
        displayName: 'siddiq',
        avatarUrl: '',
        isActive: true,
        createdAt: nowIso,
        updatedAt: nowIso,
        lastLoginAt: nowIso
      });

      const [createdUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, STABLE_DEFAULT_USER_ID))
        .limit(1);

      user = createdUser || null;
    }

    // 5. Keep the session synchronized when sessions are available.
    if (req.session && user) {
      req.session.userId = user.id;
    }

    req.user = user;

    return next();
  } catch (error) {
    console.error('[Auth Middleware Error]:', error);

    return res.status(500).json({
      error: 'Internal Authentication Error'
    });
  }
}