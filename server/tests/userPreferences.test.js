import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../db/index.js';
import { users, userPreferences } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { cryptoNative } from '../utils/crypto.js';

test('FEATURE 1.5 — USER PREFERENCES & PROFILE PERSISTENCE TESTS', async (t) => {
  const userId = cryptoNative.randomUUID();
  const googleId = 'google_pref_user_' + Date.now();

  await t.test('1. Create User and Default User Preferences', async () => {
    await db.insert(users).values({
      id: userId,
      googleId,
      email: 'prefuser@example.com',
      displayName: 'Original Google Name',
      avatarUrl: 'https://example.com/avatar.png',
      isActive: true,
    });

    await db.insert(userPreferences).values({
      userId,
      customDisplayName: 'Custom Siddiq Name',
      theme: 'dark',
      timeFormat: '12h',
      weekStart: 'MONDAY',
    });

    const [fetchedPrefs] = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId));

    assert.equal(fetchedPrefs.customDisplayName, 'Custom Siddiq Name');
    assert.equal(fetchedPrefs.theme, 'dark');
    assert.equal(fetchedPrefs.timeFormat, '12h');
    assert.equal(fetchedPrefs.weekStart, 'MONDAY');
  });

  await t.test('2. Update Preferences and Verify Database Persistence', async () => {
    await db
      .update(userPreferences)
      .set({
        theme: 'light',
        timeFormat: '24h',
        customDisplayName: 'Updated Preferred Name',
        updatedAt: new Date().toISOString(),
      })
      .where(eq(userPreferences.userId, userId));

    const [updated] = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId));

    assert.equal(updated.customDisplayName, 'Updated Preferred Name');
    assert.equal(updated.theme, 'light');
    assert.equal(updated.timeFormat, '24h');
  });

  // Cleanup test user & preferences
  t.after(async () => {
    await db.delete(users).where(eq(users.id, userId));
  });
});
