import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';

const STABLE_DEFAULT_USER_ID = 'default-user-siddiq';

export async function requireAuth(req, res, next) {
  try {
    const isProduction = Boolean(process.env.VERCEL || process.env.VERCEL_ENV || process.env.NODE_ENV === 'production');
    const userId = req.session?.userId;

    let user = null;
    if (userId) {
      const [foundUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      user = foundUser || null;
    }

    if (!user) {
      if (isProduction) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required. Please log in.'
        });
      }

      // Local Development Only Fallback Chain
      const [defaultUser] = await db.select().from(users).where(eq(users.id, STABLE_DEFAULT_USER_ID)).limit(1);
      user = defaultUser || null;

      if (!user) {
        const [activeUser] = await db.select().from(users).where(eq(users.isActive, true)).limit(1);
        user = activeUser || null;
      }

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
        const [createdUser] = await db.select().from(users).where(eq(users.id, STABLE_DEFAULT_USER_ID)).limit(1);
        user = createdUser || null;
      }

      if (req.session && user) {
        req.session.userId = user.id;
      }
    }

    req.user = user;
    return next();
  } catch (error) {
    console.error('[Auth Middleware Error]:', error);
    return res.status(500).json({ error: 'Internal Authentication Error' });
  }
}
