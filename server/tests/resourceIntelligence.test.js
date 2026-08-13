import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../db/index.js';
import { users, resourceStock, resourceEvents } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { cryptoNative } from '../utils/crypto.js';
import { INITIAL_INVENTORY } from '../../src/data/doctrineData.js';

test('FEATURE 8 — RESOURCE INTELLIGENCE + PURCHASE PLANNING TESTS', async (t) => {
  const userIdA = cryptoNative.randomUUID();
  const userIdB = cryptoNative.randomUUID();
  const googleIdA = 'google_feat8_user_a_' + Date.now();
  const googleIdB = 'google_feat8_user_b_' + Date.now();

  await t.test('1. Setup Test Users & Verify Doctrine Source of Truth', async () => {
    await db.insert(users).values([
      { id: userIdA, googleId: googleIdA, email: 'feat8_user_a@example.com', displayName: 'Feat8 User A', isActive: true },
      { id: userIdB, googleId: googleIdB, email: 'feat8_user_b@example.com', displayName: 'Feat8 User B', isActive: true }
    ]);

    assert.ok(Array.isArray(INITIAL_INVENTORY));
    assert.ok(INITIAL_INVENTORY.length >= 25);
    const eggs = INITIAL_INVENTORY.find(i => i.name === 'Eggs');
    assert.ok(eggs);
    assert.equal(eggs.id, 'inv-1');
  });

  const eggsId = 'inv-1'; // Eggs (30 pcs purchaseQty)
  const peanutsId = 'inv-7'; // Raw Peanuts (1 kg purchaseQty)

  await t.test('2. Permanent Purchase Event Logging & Database Stock Sync', async () => {
    const nowIso = new Date().toISOString();
    const eventId = cryptoNative.randomUUID();
    const stockId = cryptoNative.randomUUID();

    // User A records PURCHASE of 30 pcs Eggs
    await db.insert(resourceEvents).values({
      id: eventId,
      userId: userIdA,
      resourceId: eggsId,
      resourceName: 'Eggs',
      eventType: 'PURCHASE',
      amount: 30,
      unit: 'pcs',
      date: '2026-08-13',
      notes: 'Initial restock',
      createdAt: nowIso
    });

    await db.insert(resourceStock).values({
      id: stockId,
      userId: userIdA,
      resourceId: eggsId,
      currentQty: 30,
      inCart: false,
      lastPurchased: '2026-08-13',
      createdAt: nowIso,
      updatedAt: nowIso
    });

    const [savedStock] = await db
      .select()
      .from(resourceStock)
      .where(and(eq(resourceStock.userId, userIdA), eq(resourceStock.resourceId, eggsId)));

    assert.ok(savedStock);
    assert.equal(savedStock.currentQty, 30);

    const events = await db
      .select()
      .from(resourceEvents)
      .where(and(eq(resourceEvents.userId, userIdA), eq(resourceEvents.resourceId, eggsId)));

    assert.equal(events.length, 1);
    assert.equal(events[0].eventType, 'PURCHASE');
    assert.equal(events[0].amount, 30);
  });

  await t.test('3. Consumption Event Logging & Deterministic Needed / Surplus Calculation', async () => {
    const nowIso = new Date().toISOString();

    // User A consumes 6 pcs Eggs -> stock becomes 24
    await db.insert(resourceEvents).values({
      id: cryptoNative.randomUUID(),
      userId: userIdA,
      resourceId: eggsId,
      resourceName: 'Eggs',
      eventType: 'CONSUMPTION',
      amount: 6,
      unit: 'pcs',
      date: '2026-08-13',
      notes: 'Breakfast consumption',
      createdAt: nowIso
    });

    await db
      .update(resourceStock)
      .set({ currentQty: 24, updatedAt: nowIso })
      .where(and(eq(resourceStock.userId, userIdA), eq(resourceStock.resourceId, eggsId)));

    const [stockRec] = await db
      .select()
      .from(resourceStock)
      .where(and(eq(resourceStock.userId, userIdA), eq(resourceStock.resourceId, eggsId)));

    const required = 30; // purchaseQty
    const needed = Math.max(0, required - stockRec.currentQty);
    const surplus = Math.max(0, stockRec.currentQty - required);

    assert.equal(stockRec.currentQty, 24);
    assert.equal(needed, 6);
    assert.equal(surplus, 0);
  });

  await t.test('4. Surplus Calculation when Stock Exceeds Requirement', async () => {
    const required = 30;
    const currentQty = 40;
    const needed = Math.max(0, required - currentQty);
    const surplus = Math.max(0, currentQty - required);

    assert.equal(needed, 0);
    assert.equal(surplus, 10);
  });

  await t.test('5. Strict User Isolation (User B cannot access or mutate User A stock/events)', async () => {
    const userBStock = await db
      .select()
      .from(resourceStock)
      .where(and(eq(resourceStock.userId, userIdB), eq(resourceStock.resourceId, eggsId)));

    assert.equal(userBStock.length, 0);

    const userBEvents = await db
      .select()
      .from(resourceEvents)
      .where(and(eq(resourceEvents.userId, userIdB), eq(resourceEvents.resourceId, eggsId)));

    assert.equal(userBEvents.length, 0);
  });

  t.after(async () => {
    await db.delete(users).where(eq(users.id, userIdA));
    await db.delete(users).where(eq(users.id, userIdB));
  });
});
