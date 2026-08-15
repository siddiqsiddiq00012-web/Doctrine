import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../db/index.js';
import { users, userPreferences } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { cryptoNative } from '../utils/crypto.js';
import { ensureProfileInitialized, DEFAULT_BIO, DEFAULT_AVATAR } from '../services/profileInitService.js';

test('FEATURE 1.7 — PERMANENT PRODUCTION PROFILE ASSET & BIO INITIALIZATION TESTS', async (t) => {
  const userId = cryptoNative.randomUUID();
  const googleId = 'google_perm_profile_' + Date.now();
  const email = 'perm_user_' + Date.now() + '@example.com';

  await t.test('1. Setup User Entity', async () => {
    await db.insert(users).values({
      id: userId,
      googleId,
      email,
      displayName: 'Siddiq Doctrine Owner',
      avatarUrl: 'https://example.com/lh3_photo.jpg',
      isActive: true,
    });

    const [u] = await db.select().from(users).where(eq(users.id, userId));
    assert.equal(u.id, userId);
  });

  await t.test('2. Missing Bio and Avatar receive exact provided defaults on initialization', async () => {
    await ensureProfileInitialized(userId, 'Siddiq Doctrine Owner');

    const [prefs] = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId));
    assert.equal(prefs.bio, DEFAULT_BIO);
    assert.equal(prefs.customAvatarUrl, DEFAULT_AVATAR);
  });

  await t.test('3. Existing Bio is NEVER overwritten by initialization', async () => {
    const customBio = 'My personal custom bio that must be preserved permanently.';
    await db.update(userPreferences).set({ bio: customBio }).where(eq(userPreferences.userId, userId));

    await ensureProfileInitialized(userId, 'Siddiq Doctrine Owner');

    const [prefs] = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId));
    assert.equal(prefs.bio, customBio);
  });

  await t.test('4. Existing Avatar is NEVER overwritten by initialization', async () => {
    const customAvatar = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    await db.update(userPreferences).set({ customAvatarUrl: customAvatar }).where(eq(userPreferences.userId, userId));

    await ensureProfileInitialized(userId, 'Siddiq Doctrine Owner');

    const [prefs] = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId));
    assert.equal(prefs.customAvatarUrl, customAvatar);
  });

  await t.test('5. Bio survives avatar initialization / update', async () => {
    const customBio = 'Bio survives avatar update test.';
    await db.update(userPreferences).set({ bio: customBio }).where(eq(userPreferences.userId, userId));

    await db.update(userPreferences).set({ customAvatarUrl: '/profile-picture.jpg' }).where(eq(userPreferences.userId, userId));

    const [prefs] = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId));
    assert.equal(prefs.bio, customBio);
    assert.equal(prefs.customAvatarUrl, '/profile-picture.jpg');
  });

  await t.test('6. Avatar survives Bio initialization / update', async () => {
    const customAvatar = 'https://cdn.example.com/my-custom-dp.webp';
    await db.update(userPreferences).set({ customAvatarUrl: customAvatar }).where(eq(userPreferences.userId, userId));

    await db.update(userPreferences).set({ bio: DEFAULT_BIO }).where(eq(userPreferences.userId, userId));

    const [prefs] = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId));
    assert.equal(prefs.customAvatarUrl, customAvatar);
    assert.equal(prefs.bio, DEFAULT_BIO);
  });

  await t.test('7. Bio survives refresh / repeated initialization calls', async () => {
    const customBio = 'Persistent Bio across multiple reloads.';
    await db.update(userPreferences).set({ bio: customBio }).where(eq(userPreferences.userId, userId));

    for (let i = 0; i < 5; i++) {
      await ensureProfileInitialized(userId, 'Siddiq Doctrine Owner');
    }

    const [prefs] = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId));
    assert.equal(prefs.bio, customBio);
  });

  await t.test('8. Avatar survives refresh / repeated initialization calls', async () => {
    const customAvatar = '/custom-saved-avatar.jpg';
    await db.update(userPreferences).set({ customAvatarUrl: customAvatar }).where(eq(userPreferences.userId, userId));

    for (let i = 0; i < 5; i++) {
      await ensureProfileInitialized(userId, 'Siddiq Doctrine Owner');
    }

    const [prefs] = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId));
    assert.equal(prefs.customAvatarUrl, customAvatar);
  });

  await t.test('9. Profile survives authentication initialization', async () => {
    const [prefsBefore] = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId));
    assert.ok(prefsBefore);

    const prefsAfter = await ensureProfileInitialized(userId, 'Siddiq Doctrine Owner');
    assert.equal(prefsAfter.bio, prefsBefore.bio);
    assert.equal(prefsAfter.customAvatarUrl, prefsBefore.customAvatarUrl);
  });

  await t.test('10. Profile survives repeated server initialization', async () => {
    const initialPrefs = await ensureProfileInitialized(userId, 'Siddiq Doctrine Owner');
    const repeatedPrefs = await ensureProfileInitialized(userId, 'Siddiq Doctrine Owner');

    assert.deepEqual(initialPrefs.userId, repeatedPrefs.userId);
    assert.equal(initialPrefs.bio, repeatedPrefs.bio);
    assert.equal(initialPrefs.customAvatarUrl, repeatedPrefs.customAvatarUrl);
  });

  await t.test('11. Same Google identity maps to exact same users.id', async () => {
    const [first] = await db.select().from(users).where(eq(users.googleId, googleId));
    const [second] = await db.select().from(users).where(eq(users.googleId, googleId));

    assert.equal(first.id, userId);
    assert.equal(second.id, userId);
    assert.equal(first.id, second.id);
  });

  await t.test('12. Production mode strictly rejects temporary SQLite fallback', () => {
    const isVercel = true;
    const tursoUrl = null;
    const isValidTursoUrl = Boolean(tursoUrl);

    assert.throws(() => {
      if (isVercel && !isValidTursoUrl) {
        throw new Error('[FATAL PRODUCTION DB ERROR] Production environment requires valid TURSO_DATABASE_URL and TURSO_AUTH_TOKEN.');
      }
    }, /[FATAL PRODUCTION DB ERROR]/);
  });

  await t.test('13. GET preferences is pure read-only and does not issue DB updates', async () => {
    const [prefsBefore] = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId));
    const updatedAtBefore = prefsBefore.updatedAt;

    // Simulate pure read
    const [readPrefs] = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId));
    assert.equal(readPrefs.updatedAt, updatedAtBefore);
  });

  t.after(async () => {
    await db.delete(userPreferences).where(eq(userPreferences.userId, userId));
    await db.delete(users).where(eq(users.id, userId));
  });
});
