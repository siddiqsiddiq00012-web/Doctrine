import session from 'express-session';
import { db as defaultDb } from './index.js';
import { sessions } from './schema.js';
import { eq, lte } from 'drizzle-orm';

const Store = session.Store;

export class DrizzleSessionStore extends Store {
  constructor(options = {}) {
    super(options);
    this.database = options.db || defaultDb;
  }

  async get(sid, callback) {
    if (!sid) {
      if (typeof callback === 'function') callback(null, null);
      return;
    }
    try {
      const now = Date.now();
      const [record] = await this.database
        .select()
        .from(sessions)
        .where(eq(sessions.id, sid))
        .limit(1);

      if (!record) {
        if (typeof callback === 'function') callback(null, null);
        return;
      }

      if (record.expiresAt && record.expiresAt < now) {
        // Expired session -> delete and return null
        await this.database.delete(sessions).where(eq(sessions.id, sid));
        if (typeof callback === 'function') callback(null, null);
        return;
      }

      let sessionData = {};
      if (record.sess) {
        try {
          sessionData = JSON.parse(record.sess);
        } catch (parseErr) {
          console.error('[DrizzleSessionStore] Error parsing sess JSON for sid:', sid, parseErr);
          sessionData = {};
        }
      }

      if (record.userId && !sessionData.userId) {
        sessionData.userId = record.userId;
      }

      if (typeof callback === 'function') callback(null, sessionData);
    } catch (err) {
      console.error('[DrizzleSessionStore] Database error in get():', err.message);
      if (typeof callback === 'function') callback(err);
    }
  }

  async set(sid, sessionData, callback) {
    if (!sid) {
      if (typeof callback === 'function') callback(new Error('Missing session ID (sid)'));
      return;
    }
    try {
      const nowIso = new Date().toISOString();
      let expiresAt;

      if (sessionData && sessionData.cookie && sessionData.cookie.expires) {
        expiresAt = new Date(sessionData.cookie.expires).getTime();
      } else if (sessionData && sessionData.cookie && typeof sessionData.cookie.maxAge === 'number') {
        expiresAt = Date.now() + sessionData.cookie.maxAge;
      } else {
        expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 days fallback
      }

      const userId = sessionData?.userId || null;
      const sessJson = JSON.stringify(sessionData || {});

      try {
        await this.database
          .insert(sessions)
          .values({
            id: sid,
            userId: userId,
            sess: sessJson,
            expiresAt: expiresAt,
            createdAt: nowIso
          })
          .onConflictDoUpdate({
            target: sessions.id,
            set: {
              userId: userId,
              sess: sessJson,
              expiresAt: expiresAt
            }
          });
      } catch (insertErr) {
        if (insertErr.message && (insertErr.message.includes('FOREIGN KEY') || insertErr.message.includes('foreign key'))) {
          await this.database
            .insert(sessions)
            .values({
              id: sid,
              userId: null,
              sess: sessJson,
              expiresAt: expiresAt,
              createdAt: nowIso
            })
            .onConflictDoUpdate({
              target: sessions.id,
              set: {
                userId: null,
                sess: sessJson,
                expiresAt: expiresAt
              }
            });
        } else {
          throw insertErr;
        }
      }

      if (typeof callback === 'function') callback(null);
    } catch (err) {
      console.error('[DrizzleSessionStore] Database error in set():', err.message);
      if (typeof callback === 'function') callback(err);
    }
  }

  async destroy(sid, callback) {
    if (!sid) {
      if (typeof callback === 'function') callback(null);
      return;
    }
    try {
      await this.database.delete(sessions).where(eq(sessions.id, sid));
      if (typeof callback === 'function') callback(null);
    } catch (err) {
      console.error('[DrizzleSessionStore] Database error in destroy():', err.message);
      if (typeof callback === 'function') callback(err);
    }
  }

  async touch(sid, sessionData, callback) {
    if (!sid) {
      if (typeof callback === 'function') callback(null);
      return;
    }
    try {
      let expiresAt;
      if (sessionData && sessionData.cookie && sessionData.cookie.expires) {
        expiresAt = new Date(sessionData.cookie.expires).getTime();
      } else if (sessionData && sessionData.cookie && typeof sessionData.cookie.maxAge === 'number') {
        expiresAt = Date.now() + sessionData.cookie.maxAge;
      } else {
        expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000);
      }

      await this.database
        .update(sessions)
        .set({ expiresAt: expiresAt })
        .where(eq(sessions.id, sid));

      if (typeof callback === 'function') callback(null);
    } catch (err) {
      console.error('[DrizzleSessionStore] Database error in touch():', err.message);
      if (typeof callback === 'function') callback(err);
    }
  }

  async destroyExpired(callback) {
    try {
      const now = Date.now();
      await this.database.delete(sessions).where(lte(sessions.expiresAt, now));
      if (typeof callback === 'function') callback(null);
    } catch (err) {
      if (typeof callback === 'function') callback(err);
    }
  }
}
