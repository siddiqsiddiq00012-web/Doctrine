import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../db/index.js';
import { users, userPreferences } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { cryptoNative } from '../utils/crypto.js';

test('FEATURE 1.6 — PROFILE PERSISTENCE & IMAGE CUSTOMIZATION REPAIR TESTS', async (t) => {
  const userId = cryptoNative.randomUUID();
  const googleId = 'google_prof_repair_' + Date.now();

  await t.test('1. Create User and Verify Initial Profile State', async () => {
    await db.insert(users).values({
      id: userId,
      googleId,
      email: 'repair_user@example.com',
      displayName: 'Google Original Name',
      avatarUrl: 'https://lh3.googleusercontent.com/a/google_original_photo',
      isActive: true,
    });

    const [fetchedUser] = await db.select().from(users).where(eq(users.id, userId));
    assert.equal(fetchedUser.displayName, 'Google Original Name');
  });

  await t.test('2. Save Application Profile Picture (Data URI), Bio & Custom Display Name', async () => {
    const mockImageBuffer = 'data:image/jpeg;base64,' + 'A'.repeat(5000); // Simulated 5KB image
    const customName = 'Siddiq System Master';
    const bioText = 'Building my personal life operating system daily.';

    await db.insert(userPreferences).values({
      userId,
      customDisplayName: customName,
      bio: bioText,
      customAvatarUrl: mockImageBuffer,
      theme: 'light',
      timeFormat: '12h',
      weekStart: 'MONDAY',
    });

    const [savedPrefs] = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId));

    assert.equal(savedPrefs.customDisplayName, customName);
    assert.equal(savedPrefs.bio, bioText);
    assert.equal(savedPrefs.customAvatarUrl, mockImageBuffer);
  });

  await t.test('3. Re-Login Simulation: Profile Persistence Check', async () => {
    const [persisted] = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId));

    assert.equal(persisted.customDisplayName, 'Siddiq System Master');
    assert.equal(persisted.bio, 'Building my personal life operating system daily.');
    assert.match(persisted.customAvatarUrl, /^data:image\/jpeg/);
  });

  await t.test('4. Revert Custom Avatar -> Fall Back to Google Photo', async () => {
    await db
      .update(userPreferences)
      .set({
        customAvatarUrl: null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(userPreferences.userId, userId));

    const [reverted] = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId));

    assert.equal(reverted.customAvatarUrl, null);
    // Custom name & bio remain intact
    assert.equal(reverted.customDisplayName, 'Siddiq System Master');
  });

  // Cleanup test user & preferences
  t.after(async () => {
    await db.delete(users).where(eq(users.id, userId));
  });
});
