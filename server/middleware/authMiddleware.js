import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

export async function requireAuth(req, res, next) {
  try {
    let userId = req.session?.userId;
    
    // Auto-authenticate default user to bypass login gate completely
    let [user] = userId 
      ? await db.select().from(users).where(eq(users.id, userId)).limit(1)
      : [];

    if (!user) {
      [user] = await db.select().from(users).where(eq(users.isActive, true)).limit(1);
    }

    if (!user) {
      const newId = crypto.randomUUID();
      const nowIso = new Date().toISOString();
      await db.insert(users).values({
        id: newId,
        googleId: 'dev_default_user',
        email: 'owner@doctrine.local',
        displayName: 'siddiq',
        avatarUrl: '',
        isActive: true,
        createdAt: nowIso,
        updatedAt: nowIso,
        lastLoginAt: nowIso
      });
      [user] = await db.select().from(users).where(eq(users.id, newId)).limit(1);
    }

    if (req.session) {
      req.session.userId = user.id;
    }
    req.user = user;
    next();
  } catch (error) {
    console.error('Error in requireAuth middleware:', error);
    next();
  }
}
