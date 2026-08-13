import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export async function requireAuth(req, res, next) {
  try {
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthenticated', message: 'Active session required' });
    }

    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

    if (!user || !user.isActive) {
      req.session.destroy(() => {});
      return res.status(401).json({ error: 'Unauthenticated', message: 'User account not found or deactivated' });
    }

    // Attach verified authenticated user object to request
    req.user = user;
    next();
  } catch (error) {
    console.error('Error in requireAuth middleware:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
