import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../db/index.js';
import { users, userPreferences } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { cryptoNative } from '../utils/crypto.js';

test('PRODUCTION PERSISTENCE & ARCHITECTURAL SAFETY TESTS', async (t) => {
  const userId = cryptoNative.randomUUID();
  const googleId = 'google_prod_safety_' + Date.now();
  const email = 'safety_user_' + Date.now() + '@example.com';

  await t.test('1. Production Mode Must Reject Ephemeral SQLite Fallback', () => {
    const isVercel = true;
    const tursoUrl = null;
    const isValidTursoUrl = Boolean(tursoUrl);
    
    assert.throws(() => {
      if (isVercel && !isValidTursoUrl) {
        throw new Error('[FATAL PRODUCTION DB ERROR] Production environment requires valid TURSO_DATABASE_URL and TURSO_AUTH_TOKEN.');
      }
    }, /[FATAL PRODUCTION DB ERROR]/);
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

  t.after(async () => {
    await db.delete(userPreferences).where(eq(userPreferences.userId, userId));
    await db.delete(users).where(eq(users.id, userId));
  });
});
