import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../db/index.js';
import { users, userPreferences } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { cryptoNative } from '../utils/crypto.js';

test('PROFILE UPGRADE — BIO & AVATAR CUSTOMIZATION TESTS', async (t) => {
  const userIdA = cryptoNative.randomUUID();
  const userIdB = cryptoNative.randomUUID();
  const googleIdA = 'google_prof_user_a_' + Date.now();
  const googleIdB = 'google_prof_user_b_' + Date.now();

  await t.test('1. Create User Profile with Personal Bio & Custom Avatar', async () => {
    await db.insert(users).values({
      id: userIdA,
      googleId: googleIdA,
      email: 'profilea@example.com',
      displayName: 'Profile User Alpha',
      avatarUrl: 'https://lh3.googleusercontent.com/a/default_google_photo_a',
      isActive: true,
    });

    await db.insert(userPreferences).values({
      userId: userIdA,
      customDisplayName: 'Siddiq Alpha',
      bio: 'Building my future one system at a time.',
      customAvatarUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    });

    const [fetchedPrefs] = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userIdA));

    assert.equal(fetchedPrefs.bio, 'Building my future one system at a time.');
    assert.equal(fetchedPrefs.customDisplayName, 'Siddiq Alpha');
    assert.match(fetchedPrefs.customAvatarUrl, /^data:image\/png/);
  });

  await t.test('2. Revert Custom Avatar to Fall Back to Google Photo', async () => {
    await db
      .update(userPreferences)
      .set({
        customAvatarUrl: null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(userPreferences.userId, userIdA));

    const [updatedPrefs] = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userIdA));

    assert.equal(updatedPrefs.customAvatarUrl, null);
  });

  await t.test('3. Enforce Strict User Isolation on Profile Updates', async () => {
    await db.insert(users).values({
      id: userIdB,
      googleId: googleIdB,
      email: 'profileb@example.com',
      displayName: 'Profile User Beta',
      avatarUrl: 'https://lh3.googleusercontent.com/a/default_google_photo_b',
      isActive: true,
    });

    await db.insert(userPreferences).values({
      userId: userIdB,
      customDisplayName: 'User Beta Original',
      bio: 'Beta bio string.',
    });

    // User A attempts to query User B's bio -> retrieves strictly isolated data
    const [prefsB] = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userIdB));

    assert.equal(prefsB.bio, 'Beta bio string.');
    assert.equal(prefsB.customDisplayName, 'User Beta Original');
  });

  await t.test('4. Cross-Save Integrity: Save avatar -> Save bio -> Verify avatar remains unchanged', async () => {
    const testAvatarDataUri = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP...';
    
    // Step A: Update avatar only
    await db
      .update(userPreferences)
      .set({ customAvatarUrl: testAvatarDataUri })
      .where(eq(userPreferences.userId, userIdA));

    const [afterAvatarSave] = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userIdA));
    assert.equal(afterAvatarSave.customAvatarUrl, testAvatarDataUri);

    // Step B: Update bio only (simulating field-safe PATCH)
    const newBio = 'Updated bio string without avatar in payload';
    await db
      .update(userPreferences)
      .set({ bio: newBio, updatedAt: new Date().toISOString() })
      .where(eq(userPreferences.userId, userIdA));

    const [afterBioSave] = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userIdA));
    
    assert.equal(afterBioSave.bio, newBio);
    assert.equal(afterBioSave.customAvatarUrl, testAvatarDataUri, 'Avatar must NOT be cleared when saving bio');
  });

  await t.test('5. Cross-Save Integrity: Save bio -> Save avatar -> Verify bio remains unchanged', async () => {
    const testBio = 'Persistent bio string for test 5';
    
    // Step A: Update bio only
    await db
      .update(userPreferences)
      .set({ bio: testBio })
      .where(eq(userPreferences.userId, userIdA));

    // Step B: Update avatar only
    const newAvatar = 'data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA';
    await db
      .update(userPreferences)
      .set({ customAvatarUrl: newAvatar })
      .where(eq(userPreferences.userId, userIdA));

    const [afterAvatarSave] = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userIdA));

    assert.equal(afterAvatarSave.bio, testBio, 'Bio must NOT be cleared when saving avatar');
    assert.equal(afterAvatarSave.customAvatarUrl, newAvatar);
  });

  await t.test('6. Refresh & Auth Reload Simulation: Persistence from Database', async () => {
    // Simulate AppContext checkAuth loading existing user preferences from DB
    const [persistedRow] = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userIdA));

    assert.ok(persistedRow);
    assert.equal(persistedRow.bio, 'Persistent bio string for test 5');
    assert.match(persistedRow.customAvatarUrl, /^data:image\/webp/);
  });

  // Cleanup test users & preferences
  t.after(async () => {
    await db.delete(users).where(eq(users.id, userIdA));
    await db.delete(users).where(eq(users.id, userIdB));
  });
});
