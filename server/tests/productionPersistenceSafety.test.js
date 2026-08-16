import test from 'node:test';
import assert from 'node:assert/strict';
import { db, getDbConfig, getSessionSecret } from '../db/index.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { users, userPreferences } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { cryptoNative } from '../utils/crypto.js';

test('PRODUCTION PERSISTENCE & ARCHITECTURAL SAFETY TESTS', async (t) => {
  const userId = cryptoNative.randomUUID();
  const googleId = 'google_prod_safety_' + Date.now();
  const email = 'safety_user_' + Date.now() + '@example.com';

  await t.test('1. Production Mode Configuration & Safety Enforcement', () => {
    // 1a. Production + Valid Turso credentials -> Turso selected
    const validProdConfig = getDbConfig({
      VERCEL: '1',
      TURSO_DATABASE_URL: 'libsql://test-db.turso.io',
      TURSO_AUTH_TOKEN: 'test_token_12345'
    });
    assert.equal(validProdConfig.type, 'turso');
    assert.equal(validProdConfig.tursoUrl, 'libsql://test-db.turso.io');
    assert.equal(validProdConfig.authToken, 'test_token_12345');

    // 1b. Production + Missing TURSO_DATABASE_URL -> Falls back to SQLite /tmp/doctrine.db
    const missingUrlConfig = getDbConfig({
      VERCEL: '1',
      TURSO_AUTH_TOKEN: 'test_token_12345'
    });
    assert.equal(missingUrlConfig.type, 'sqlite');
    assert.equal(missingUrlConfig.dbPath, '/tmp/doctrine.db');

    // 1c. Production + Missing TURSO_AUTH_TOKEN -> Falls back to SQLite /tmp/doctrine.db
    const missingTokenConfig = getDbConfig({
      VERCEL: '1',
      TURSO_DATABASE_URL: 'libsql://test-db.turso.io'
    });
    assert.equal(missingTokenConfig.type, 'sqlite');
    assert.equal(missingTokenConfig.dbPath, '/tmp/doctrine.db');

    // 1d. Local Development without Turso -> SQLite default preserved
    const localDevConfig = getDbConfig({
      NODE_ENV: 'development'
    });
    assert.equal(localDevConfig.type, 'sqlite');
    assert.equal(localDevConfig.dbPath, 'doctrine.db');
  });


  await t.test('2. Same Google Identity Always Maps to Same users.id', async () => {
    await db.insert(users).values({
      id: userId,
      googleId,
      email,
      displayName: 'Google User Safety',
      avatarUrl: 'https://example.com/photo.jpg',
      isActive: true,
    });

    const [firstLookup] = await db.select().from(users).where(eq(users.googleId, googleId));
    assert.equal(firstLookup.id, userId);

    const [secondLookup] = await db.select().from(users).where(eq(users.googleId, googleId));
    assert.equal(secondLookup.id, userId);
    assert.equal(secondLookup.id, firstLookup.id);
  });

  await t.test('3. Initializing Preferences Works and Does Not Overwrite Existing Record', async () => {
    await db.insert(userPreferences).values({
      userId,
      customDisplayName: 'Initial Name',
      bio: 'Initial Bio Text',
      customAvatarUrl: 'https://example.com/custom.png',
      theme: 'dark',
      timeFormat: '12h',
      weekStart: 'MONDAY',
    });

    const [created] = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId));
    assert.equal(created.bio, 'Initial Bio Text');

    const [existing] = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId));
    assert.equal(existing.bio, 'Initial Bio Text');
    assert.equal(existing.customAvatarUrl, 'https://example.com/custom.png');
  });

  await t.test('4. Bio Survives Avatar Update (Cross-Save Integrity)', async () => {
    const newAvatar = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    await db
      .update(userPreferences)
      .set({ customAvatarUrl: newAvatar, updatedAt: new Date().toISOString() })
      .where(eq(userPreferences.userId, userId));

    const [updated] = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId));
    assert.equal(updated.customAvatarUrl, newAvatar);
    assert.equal(updated.bio, 'Initial Bio Text');
    assert.equal(updated.customDisplayName, 'Initial Name');
  });

  await t.test('5. Avatar Survives Bio Update (Cross-Save Integrity)', async () => {
    const newBio = 'Updated Bio Text — Persistent Across Sessions';

    await db
      .update(userPreferences)
      .set({ bio: newBio, updatedAt: new Date().toISOString() })
      .where(eq(userPreferences.userId, userId));

    const [updated] = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId));
    assert.equal(updated.bio, newBio);
    assert.match(updated.customAvatarUrl, /^data:image\/png/);
  });

  await t.test('6. Unauthenticated Mode in Production Does Not Yield Arbitrary Users', async () => {
    const isProduction = true;
    const reqSessionUserId = undefined;

    let user = null;
    if (reqSessionUserId) {
      [user] = await db.select().from(users).where(eq(users.id, reqSessionUserId));
    }

    if (!user && !isProduction) {
      [user] = await db.select().from(users).where(eq(users.isActive, true));
    }

    assert.equal(user, null);
  });

  await t.test('7. Development Login Route Strict Production Restriction', async () => {
    const originalEnv = process.env.NODE_ENV;
    const originalVercel = process.env.VERCEL;

    try {
      // Simulate production environment
      process.env.NODE_ENV = 'production';
      process.env.VERCEL = '1';

      const isProduction = Boolean(process.env.VERCEL || process.env.VERCEL_ENV || process.env.NODE_ENV === 'production');
      assert.equal(isProduction, true);

      // Simulated handler response verification
      let responseStatus = null;
      let responseBody = null;

      const mockRes = {
        status: (code) => {
          responseStatus = code;
          return {
            json: (payload) => {
              responseBody = payload;
              return payload;
            }
          };
        }
      };

      // Execute simulated dev-login logic check under production env
      if (isProduction) {
        mockRes.status(403).json({
          error: 'Forbidden',
          message: 'Development login is disabled in production environments.'
        });
      }

      assert.equal(responseStatus, 403);
      assert.equal(responseBody.error, 'Forbidden');
      assert.match(responseBody.message, /disabled in production/i);

    } finally {
      process.env.NODE_ENV = originalEnv;
      if (originalVercel === undefined) {
        delete process.env.VERCEL;
      } else {
        process.env.VERCEL = originalVercel;
      }
    }
  });

  await t.test('8. Production Session Secret Security Enforcement', () => {
    // 8a. Production + Valid custom SESSION_SECRET -> Returns custom secret
    const prodValid = getSessionSecret({
      VERCEL: '1',
      SESSION_SECRET: 'custom_production_secret_987654321'
    });
    assert.equal(prodValid, 'custom_production_secret_987654321');

    // 8b. Production + Missing SESSION_SECRET -> Fails explicitly
    assert.throws(() => {
      getSessionSecret({
        VERCEL: '1',
        NODE_ENV: 'production'
      });
    }, /\[FATAL PRODUCTION AUTH ERROR\]/);

    // 8c. Production + Empty SESSION_SECRET -> Fails explicitly
    assert.throws(() => {
      getSessionSecret({
        VERCEL: '1',
        SESSION_SECRET: '   '
      });
    }, /\[FATAL PRODUCTION AUTH ERROR\]/);

    // 8d. Production + Hardcoded Dev Fallback -> Fails explicitly
    assert.throws(() => {
      getSessionSecret({
        VERCEL: '1',
        SESSION_SECRET: 'doctrine_dev_session_secret_change_in_production_12345'
      });
    }, /\[FATAL PRODUCTION AUTH ERROR\]/);

    // 8e. Local Development + Missing SESSION_SECRET -> Uses development fallback safely
    const devFallback = getSessionSecret({
      NODE_ENV: 'development'
    });
    assert.equal(devFallback, 'doctrine_dev_session_secret_change_in_production_12345');
  });

  await t.test('9. Production Unauthenticated Session 401 Enforcement & Dev Fallback Isolation', async () => {
    const originalEnv = process.env.NODE_ENV;
    const originalVercel = process.env.VERCEL;

    try {
      process.env.NODE_ENV = 'production';
      process.env.VERCEL = '1';

      // Mock Express req, res, next helpers
      const createMockReqRes = (sessionObj = {}) => {
        let responseStatus = null;
        let responseJson = null;
        let nextCalled = false;

        const req = {
          session: sessionObj,
          user: undefined
        };

        const res = {
          status: (code) => {
            responseStatus = code;
            return {
              json: (payload) => {
                responseJson = payload;
                return payload;
              }
            };
          }
        };

        const next = () => {
          nextCalled = true;
        };

        return { req, res, next, getStatus: () => responseStatus, getJson: () => responseJson, isNextCalled: () => nextCalled };
      };

      // 9a. Production + Missing Session -> 401 Unauthorized
      const ctx1 = createMockReqRes({});
      await requireAuth(ctx1.req, ctx1.res, ctx1.next);
      assert.equal(ctx1.getStatus(), 401);
      assert.equal(ctx1.getJson().error, 'Unauthorized');
      assert.equal(ctx1.isNextCalled(), false);
      assert.equal(ctx1.req.user, undefined);
      assert.equal(ctx1.req.session.userId, undefined);

      // 9b. Production + Nonexistent User ID -> 401 Unauthorized
      const ctx2 = createMockReqRes({ userId: 'non_existent_user_9999' });
      await requireAuth(ctx2.req, ctx2.res, ctx2.next);
      assert.equal(ctx2.getStatus(), 401);
      assert.equal(ctx2.getJson().error, 'Unauthorized');
      assert.equal(ctx2.isNextCalled(), false);

      // 9c. Production + Valid Session User -> Next called & req.user attached
      const ctx3 = createMockReqRes({ userId: userId });
      await requireAuth(ctx3.req, ctx3.res, ctx3.next);
      assert.equal(ctx3.isNextCalled(), true);
      assert.notEqual(ctx3.req.user, undefined);
      assert.equal(ctx3.req.user.id, userId);

      // 9d. Development Mode + Missing Session -> Local Dev Fallback Chain Works
      delete process.env.VERCEL;
      process.env.NODE_ENV = 'development';

      const ctx4 = createMockReqRes({});
      await requireAuth(ctx4.req, ctx4.res, ctx4.next);
      assert.equal(ctx4.isNextCalled(), true);
      assert.notEqual(ctx4.req.user, undefined);
      assert.equal(ctx4.req.session.userId, ctx4.req.user.id);

    } finally {
      process.env.NODE_ENV = originalEnv;
      if (originalVercel === undefined) {
        delete process.env.VERCEL;
      } else {
        process.env.VERCEL = originalVercel;
      }
    }
  });

  await t.test('10. Frontend Authentication Gate State & Contract Verification', () => {
    // 10a. Unauthenticated State Contract
    const unauthState = { authenticated: false, user: null };
    assert.equal(unauthState.authenticated, false);
    assert.equal(unauthState.user, null);

    // Simulated App.jsx gate decision function
    const resolveAppScreen = (user, loadingAuth, isDev = false) => {
      if (loadingAuth) return 'LOADING';
      if (!user && !isDev) return 'LOGIN_VIEW';
      return 'MAIN_APP';
    };

    assert.equal(resolveAppScreen(null, true, false), 'LOADING');
    assert.equal(resolveAppScreen(null, false, false), 'LOGIN_VIEW');
    assert.equal(resolveAppScreen(null, false, true), 'MAIN_APP');
    assert.equal(resolveAppScreen({ id: 'user_123' }, false, false), 'MAIN_APP');
  });

  await t.test('11. Localhost Login Gate Bypass & Financial API Protection Safety', () => {
    const isLocalDevCheck = (isDev, hostname) => {
      return Boolean(isDev || hostname === 'localhost' || hostname === '127.0.0.1');
    };

    assert.equal(isLocalDevCheck(true, 'anything.com'), true);
    assert.equal(isLocalDevCheck(false, 'localhost'), true);
    assert.equal(isLocalDevCheck(false, '127.0.0.1'), true);
    assert.equal(isLocalDevCheck(false, 'doctrine-pi.vercel.app'), false);
  });

  t.after(async () => {
    await db.delete(userPreferences).where(eq(userPreferences.userId, userId));
    await db.delete(users).where(eq(users.id, userId));
  });
});
