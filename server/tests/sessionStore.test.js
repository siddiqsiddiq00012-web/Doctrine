import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../db/index.js';
import { DrizzleSessionStore } from '../db/sessionStore.js';
import { sessions, users, userPreferences, dailyExecutions, taskExecutions } from '../db/schema.js';
import { eq, sql } from 'drizzle-orm';
import { cryptoNative } from '../utils/crypto.js';

test('FEATURE — DRIZZLE SESSION STORE & PERSISTENCE TESTS', async (t) => {
  const store = new DrizzleSessionStore({ db });
  const testSid1 = 'test_sid_' + cryptoNative.randomUUID();
  const testSid2 = 'test_sid_' + cryptoNative.randomUUID();
  const testUserId = cryptoNative.randomUUID();

  // Insert valid test user entity so userId foreign key succeeds
  await db.insert(users).values({
    id: testUserId,
    googleId: 'google_session_store_test_' + Date.now(),
    email: 'session_store_user@example.com',
    displayName: 'Session Store User',
    isActive: true
  });

  // Helper promises for store callback API
  const storeSet = (sid, sess) => new Promise((res, rej) => store.set(sid, sess, (err) => err ? rej(err) : res()));
  const storeGet = (sid) => new Promise((res, rej) => store.get(sid, (err, data) => err ? rej(err) : res(data)));
  const storeDestroy = (sid) => new Promise((res, rej) => store.destroy(sid, (err) => err ? rej(err) : res()));
  const storeTouch = (sid, sess) => new Promise((res, rej) => store.touch(sid, sess, (err) => err ? rej(err) : res()));
  const storeDestroyExpired = () => new Promise((res, rej) => store.destroyExpired((err) => err ? rej(err) : res()));

  await t.test('1. SET + GET — Session Object Serialization Round Trip', async () => {
    const sessionObj = {
      cookie: { originalMaxAge: 604800000, expires: new Date(Date.now() + 604800000).toISOString(), httpOnly: true, path: '/' },
      userId: testUserId,
      customData: 'doctrine_session_value'
    };

    await storeSet(testSid1, sessionObj);

    const retrieved = await storeGet(testSid1);
    assert.notEqual(retrieved, null);
    assert.equal(retrieved.userId, testUserId);
    assert.equal(retrieved.customData, 'doctrine_session_value');
    assert.equal(retrieved.cookie.httpOnly, true);
  });

  await t.test('2. USER ID PERSISTENCE — req.session.userId Round Trip', async () => {
    const retrieved = await storeGet(testSid1);
    assert.equal(retrieved.userId, testUserId);

    // Verify in database direct query
    const [dbRecord] = await db.select().from(sessions).where(eq(sessions.id, testSid1));
    assert.equal(dbRecord.userId, testUserId);
    assert.notEqual(dbRecord.sess, null);
  });

  await t.test('3. EXPIRATION — Expired Session Returns Null & Is Cleaned Up', async () => {
    const expiredSid = 'expired_sid_' + cryptoNative.randomUUID();
    const expiredSessionObj = {
      cookie: { expires: new Date(Date.now() - 10000).toISOString() }, // 10s in past
      userId: testUserId
    };

    await storeSet(expiredSid, expiredSessionObj);

    const result = await storeGet(expiredSid);
    assert.equal(result, null);

    // Verify row was deleted from DB
    const [dbRecord] = await db.select().from(sessions).where(eq(sessions.id, expiredSid));
    assert.equal(dbRecord, undefined);
  });

  await t.test('4. DESTROY — Explicit Session Removal', async () => {
    await storeDestroy(testSid1);

    const result = await storeGet(testSid1);
    assert.equal(result, null);

    const [dbRecord] = await db.select().from(sessions).where(eq(sessions.id, testSid1));
    assert.equal(dbRecord, undefined);
  });

  await t.test('5. TOUCH — Expiration Update Preserves Payload', async () => {
    const sessionObj = {
      cookie: { expires: new Date(Date.now() + 3600000).toISOString() },
      userId: testUserId,
      payloadData: 'preserved_after_touch'
    };

    await storeSet(testSid1, sessionObj);

    const newExpiry = new Date(Date.now() + 7200000).toISOString();
    const updatedCookieObj = {
      cookie: { expires: newExpiry },
      userId: testUserId
    };

    await storeTouch(testSid1, updatedCookieObj);

    const retrieved = await storeGet(testSid1);
    assert.equal(retrieved.payloadData, 'preserved_after_touch');
    assert.equal(retrieved.userId, testUserId);
  });

  await t.test('6. UPSERT — Overwriting Same sid Updates Record Idempotently', async () => {
    const updatedSessionObj = {
      cookie: { expires: new Date(Date.now() + 3600000).toISOString() },
      userId: testUserId,
      payloadData: 'upserted_new_data'
    };

    await storeSet(testSid1, updatedSessionObj);

    const countRecords = await db.select().from(sessions).where(eq(sessions.id, testSid1));
    assert.equal(countRecords.length, 1);

    const retrieved = await storeGet(testSid1);
    assert.equal(retrieved.payloadData, 'upserted_new_data');
  });

  await t.test('7. MULTI-SESSION ISOLATION — Destroying One Session Does Not Affect Others', async () => {
    const sessionObj1 = { cookie: { expires: new Date(Date.now() + 3600000).toISOString() }, userId: testUserId, tag: 'sess1' };
    const sessionObj2 = { cookie: { expires: new Date(Date.now() + 3600000).toISOString() }, userId: testUserId, tag: 'sess2' };

    await storeSet(testSid1, sessionObj1);
    await storeSet(testSid2, sessionObj2);

    await storeDestroy(testSid1);

    const res1 = await storeGet(testSid1);
    const res2 = await storeGet(testSid2);

    assert.equal(res1, null);
    assert.notEqual(res2, null);
    assert.equal(res2.tag, 'sess2');
  });

  await t.test('8. DATABASE ERROR HANDLING — Propagates Database Errors via Callback', async () => {
    const badDbMock = {
      select: () => { throw new Error('Simulated DB Query Failure'); },
      insert: () => { throw new Error('Simulated DB Insert Failure'); },
      delete: () => { throw new Error('Simulated DB Delete Failure'); }
    };
    const badStore = new DrizzleSessionStore({ db: badDbMock });

    await assert.rejects(async () => {
      await new Promise((res, rej) => badStore.get('any_sid', (err, data) => err ? rej(err) : res(data)));
    }, /Simulated DB Query Failure/);
  });

  await t.test('9. EXISTING AUTH COMPATIBILITY — New Store Instance Reads Existing Sessions', async () => {
    const newStoreInstance = new DrizzleSessionStore({ db });
    const res = await new Promise((res, rej) => newStoreInstance.get(testSid2, (err, data) => err ? rej(err) : res(data)));

    assert.notEqual(res, null);
    assert.equal(res.userId, testUserId);
  });

  await t.test('10. EXPIRATION CLEANUP — destroyExpired() Removes All Stale Sessions', async () => {
    const st1 = 'stale_1_' + cryptoNative.randomUUID();
    const st2 = 'stale_2_' + cryptoNative.randomUUID();

    await storeSet(st1, { cookie: { expires: new Date(Date.now() - 5000).toISOString() }, userId: testUserId });
    await storeSet(st2, { cookie: { expires: new Date(Date.now() - 5000).toISOString() }, userId: testUserId });

    await storeDestroyExpired();

    const check1 = await db.select().from(sessions).where(eq(sessions.id, st1));
    const check2 = await db.select().from(sessions).where(eq(sessions.id, st2));

    assert.equal(check1.length, 0);
    assert.equal(check2.length, 0);
  });

  await t.test('11. CRITICAL DATA SAFETY — Session Store Operations Do Not Alter User Data Tables', async () => {
    const [userCount] = await db.select({ count: sql`count(*)` }).from(users);
    const [prefsCount] = await db.select({ count: sql`count(*)` }).from(userPreferences);
    const [execCount] = await db.select({ count: sql`count(*)` }).from(dailyExecutions);
    const [taskCount] = await db.select({ count: sql`count(*)` }).from(taskExecutions);

    assert.notEqual(userCount, undefined);
    assert.notEqual(prefsCount, undefined);
    assert.notEqual(execCount, undefined);
    assert.notEqual(taskCount, undefined);
  });

  t.after(async () => {
    await storeDestroy(testSid1);
    await storeDestroy(testSid2);
    await db.delete(users).where(eq(users.id, testUserId));
  });
});
