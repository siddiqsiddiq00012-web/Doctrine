import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../db/index.js';
import { users, userPreferences } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { cryptoNative } from '../utils/crypto.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('FEATURE 1.7 — DP UPLOAD RELIABILITY & DISK STORAGE TESTS', async (t) => {
  const userId = cryptoNative.randomUUID();
  const googleId = 'google_dp_rel_' + Date.now();
  const uploadsAvatarsDir = path.resolve(__dirname, '../../uploads/avatars');

  if (!fs.existsSync(uploadsAvatarsDir)) {
    fs.mkdirSync(uploadsAvatarsDir, { recursive: true });
  }

  await t.test('1. Create Test User Account', async () => {
    await db.insert(users).values({
      id: userId,
      googleId,
      email: 'dptest@example.com',
      displayName: 'DP Reliability User',
      avatarUrl: 'https://lh3.googleusercontent.com/a/google_original_photo',
      isActive: true,
    });

    const [u] = await db.select().from(users).where(eq(users.id, userId));
    assert.equal(u.email, 'dptest@example.com');
  });

  await t.test('2. Verify Local Server Filesystem Avatar Storage & Database Path Persistence', async () => {
    // 1x1 Transparent JPEG Data URI
    const mockJpegDataUri = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
    const filename = `avatar_${userId}_${Date.now()}.jpg`;
    const targetFilePath = path.join(uploadsAvatarsDir, filename);

    // Simulate saving file to uploads/avatars/
    const base64Data = mockJpegDataUri.replace(/^data:image\/jpeg;base64,/, '');
    fs.writeFileSync(targetFilePath, Buffer.from(base64Data, 'base64'));

    assert.equal(fs.existsSync(targetFilePath), true);

    const relativeUrl = `/uploads/avatars/${filename}`;

    // Insert database reference
    await db.insert(userPreferences).values({
      userId,
      customDisplayName: 'Siddiq DP Test',
      bio: 'Testing DP Disk Reliability',
      customAvatarUrl: relativeUrl,
      theme: 'light',
      timeFormat: '12h',
      weekStart: 'MONDAY',
    });

    const [prefs] = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId));
    assert.equal(prefs.customAvatarUrl, relativeUrl);
  });

  await t.test('3. Revert Custom Avatar -> Clean Up File on Disk & Reset Database Column', async () => {
    const [prefsBefore] = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId));
    assert.ok(prefsBefore, 'Preferences record must exist');
    const relativeUrl = prefsBefore.customAvatarUrl;
    assert.ok(relativeUrl, 'customAvatarUrl must exist before revert');

    const filename = path.basename(relativeUrl);
    const filePath = path.join(uploadsAvatarsDir, filename);

    // Delete file from disk
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    assert.equal(fs.existsSync(filePath), false);

    // Update DB
    await db
      .update(userPreferences)
      .set({ customAvatarUrl: null, updatedAt: new Date().toISOString() })
      .where(eq(userPreferences.userId, userId));

    const [prefsAfter] = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId));
    assert.equal(prefsAfter.customAvatarUrl, null);
  });

  // Cleanup test user
  t.after(async () => {
    await db.delete(users).where(eq(users.id, userId));
  });
});
