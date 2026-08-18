import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../db/index.js';
import {
  users,
  tasks,
  schedules,
  scheduleEntries,
  taskResourceRequirements,
  resourceStock,
  resourceEvents,
  cartItems,
  financialTransactions
} from '../db/schema.js';
import { eq, and, inArray } from 'drizzle-orm';
import { INITIAL_INVENTORY } from '../../src/data/doctrineData.js';
import { calculateResourceForecasts } from '../services/resourceForecastService.js';
import { evaluatePurchaseIntelligence, cleanupCorruptedAutomatedCartItems } from '../services/purchaseIntelligenceService.js';
import { generateDeterministicPlan } from '../services/planningEngine.js';

test('TASK 9D — REAL CONSUMPTION-AWARE PURCHASE INTELLIGENCE TESTS (25 VERIFICATIONS)', async (t) => {

  const userA = {
    id: `test-9d-userA-${Date.now()}`,
    googleId: `google-9d-userA-${Date.now()}`,
    email: `realpi.userA.${Date.now()}@doctrine.test`,
    displayName: 'Task 9D Real PI User A'
  };

  const userB = {
    id: `test-9d-userB-${Date.now()}`,
    googleId: `google-9d-userB-${Date.now()}`,
    email: `realpi.userB.${Date.now()}@doctrine.test`,
    displayName: 'Task 9D Real PI User B'
  };

  t.before(async () => {
    await db.insert(users).values([userA, userB]);
  });

  t.after(async () => {
    await db.delete(cartItems).where(inArray(cartItems.userId, [userA.id, userB.id]));
    await db.delete(resourceEvents).where(inArray(resourceEvents.userId, [userA.id, userB.id]));
    await db.delete(resourceStock).where(inArray(resourceStock.userId, [userA.id, userB.id]));
    await db.delete(financialTransactions).where(inArray(financialTransactions.userId, [userA.id, userB.id]));
    await db.delete(users).where(inArray(users.id, [userA.id, userB.id]));
  });

  await t.test('1. Four-week egg history produces correct weekly average (Week 1:24, W2:28, W3:25, W4:27 => ~26 eggs/week)', async () => {
    // Insert 4 weeks of consumption events for Eggs (inv-1)
    const nowMs = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    
    // Day 28 ago: 24 eggs (Week 1)
    // Day 21 ago: 28 eggs (Week 2)
    // Day 14 ago: 25 eggs (Week 3)
    // Today (0 days ago): 27 eggs (Week 4)
    // Total = 104 eggs over 28 days = 3.714 eggs/day = 26 eggs/week
    await db.insert(resourceEvents).values([
      { id: `re_e1_${nowMs}`, userId: userA.id, resourceId: 'inv-1', resourceName: 'Eggs', unit: 'pcs', eventType: 'CONSUMPTION', amount: 24, date: new Date(nowMs - 27 * dayMs).toISOString().split('T')[0], createdAt: new Date(nowMs - 27 * dayMs).toISOString() },
      { id: `re_e2_${nowMs}`, userId: userA.id, resourceId: 'inv-1', resourceName: 'Eggs', unit: 'pcs', eventType: 'CONSUMPTION', amount: 28, date: new Date(nowMs - 20 * dayMs).toISOString().split('T')[0], createdAt: new Date(nowMs - 20 * dayMs).toISOString() },
      { id: `re_e3_${nowMs}`, userId: userA.id, resourceId: 'inv-1', resourceName: 'Eggs', unit: 'pcs', eventType: 'CONSUMPTION', amount: 25, date: new Date(nowMs - 13 * dayMs).toISOString().split('T')[0], createdAt: new Date(nowMs - 13 * dayMs).toISOString() },
      { id: `re_e4_${nowMs}`, userId: userA.id, resourceId: 'inv-1', resourceName: 'Eggs', unit: 'pcs', eventType: 'CONSUMPTION', amount: 27, date: new Date(nowMs).toISOString().split('T')[0], createdAt: new Date(nowMs).toISOString() }
    ]);

    const forecastRes = await calculateResourceForecasts(db, userA.id);
    const eggForecast = forecastRes.resources.find((r) => r.id === 'inv-1');

    assert.ok(eggForecast, 'Eggs forecast should exist');
    assert.equal(Math.round(eggForecast.forecast.historicalWeeklyConsumption), 26, 'Historical 4-week consumption average must equal ~26 eggs/week');
  });

  await t.test('2. Egg price ₹7 per egg is used correctly in database schema/seed', async () => {
    const eggItem = INITIAL_INVENTORY.find((i) => i.id === 'inv-1');
    assert.equal(eggItem.estimatedPrice, 7, 'Egg unit price must be ₹7 per egg');
  });

  await t.test('3. Current stock 8 + weekly demand 26 produces purchase quantity 18', async () => {
    const existingStock = await db.select().from(resourceStock).where(and(eq(resourceStock.userId, userA.id), eq(resourceStock.resourceId, 'inv-1')));
    if (existingStock.length > 0) {
      await db.update(resourceStock).set({ currentQty: 8 }).where(and(eq(resourceStock.userId, userA.id), eq(resourceStock.resourceId, 'inv-1')));
    } else {
      await db.insert(resourceStock).values({
        id: `stock_egg_${userA.id}`,
        userId: userA.id,
        resourceId: 'inv-1',
        currentQty: 8,
        inCart: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    const forecastRes = await calculateResourceForecasts(db, userA.id);
    const eggForecast = forecastRes.resources.find((r) => r.id === 'inv-1');

    assert.equal(eggForecast.currentQty, 8);
    assert.equal(eggForecast.forecast.requiredPurchaseQty, 18, 'Stock 8 with weekly demand 26 must produce purchase quantity 18');
  });

  await t.test('4. 18 eggs produces ₹126 total cost (18 x ₹7 = ₹126)', async () => {
    const forecastRes = await calculateResourceForecasts(db, userA.id);
    const eggForecast = forecastRes.resources.find((r) => r.id === 'inv-1');

    assert.equal(eggForecast.forecast.estimatedPurchaseCostRupees, 126, '18 eggs x ₹7/egg must equal ₹126 total cost');
  });

  await t.test('5. Stock 9 => LOW STOCK = true (9 < 10 threshold)', async () => {
    await db.update(resourceStock).set({ currentQty: 9 }).where(and(eq(resourceStock.userId, userA.id), eq(resourceStock.resourceId, 'inv-1')));
    const forecastRes = await calculateResourceForecasts(db, userA.id);
    const eggForecast = forecastRes.resources.find((r) => r.id === 'inv-1');

    assert.equal(eggForecast.forecast.isLowStock, true, 'Stock 9 must trigger LOW STOCK = true');
  });

  await t.test('6. Stock 10 => LOW STOCK = false (10 >= 10 threshold)', async () => {
    await db.update(resourceStock).set({ currentQty: 10 }).where(and(eq(resourceStock.userId, userA.id), eq(resourceStock.resourceId, 'inv-1')));
    const forecastRes = await calculateResourceForecasts(db, userA.id);
    const eggForecast = forecastRes.resources.find((r) => r.id === 'inv-1');

    assert.equal(eggForecast.forecast.isLowStock, false, 'Stock 10 must result in LOW STOCK = false');
  });

  await t.test('7. Stock 11 => LOW STOCK = false (11 >= 10 threshold)', async () => {
    await db.update(resourceStock).set({ currentQty: 11 }).where(and(eq(resourceStock.userId, userA.id), eq(resourceStock.resourceId, 'inv-1')));
    const forecastRes = await calculateResourceForecasts(db, userA.id);
    const eggForecast = forecastRes.resources.find((r) => r.id === 'inv-1');

    assert.equal(eggForecast.forecast.isLowStock, false, 'Stock 11 must result in LOW STOCK = false');
  });

  await t.test('8. Stock 20 with weekly demand 26 => purchase 6 but NOT LOW STOCK', async () => {
    await db.update(resourceStock).set({ currentQty: 20 }).where(and(eq(resourceStock.userId, userA.id), eq(resourceStock.resourceId, 'inv-1')));
    const forecastRes = await calculateResourceForecasts(db, userA.id);
    const eggForecast = forecastRes.resources.find((r) => r.id === 'inv-1');

    assert.equal(eggForecast.forecast.requiredPurchaseQty, 6, 'Stock 20 with demand 26 requires purchase 6');
    assert.equal(eggForecast.forecast.isLowStock, false, 'Stock 20 is NOT LOW STOCK (20 >= 10)');
    assert.equal(eggForecast.forecast.isPurchaseRequired, true);
  });

  await t.test('9. Stock 30 with weekly demand 26 => purchase 0', async () => {
    await db.update(resourceStock).set({ currentQty: 30 }).where(and(eq(resourceStock.userId, userA.id), eq(resourceStock.resourceId, 'inv-1')));
    const forecastRes = await calculateResourceForecasts(db, userA.id);
    const eggForecast = forecastRes.resources.find((r) => r.id === 'inv-1');

    assert.equal(eggForecast.forecast.requiredPurchaseQty, 0, 'Stock 30 >= demand 26 requires purchase 0');
    assert.equal(eggForecast.forecast.isPurchaseRequired, false);
  });

  await t.test('10. Peanuts use generic algorithm (Stock 40g, Weekly demand 135g => Purchase 95g)', async () => {
    const existingStock = await db.select().from(resourceStock).where(and(eq(resourceStock.userId, userA.id), eq(resourceStock.resourceId, 'inv-7')));
    if (existingStock.length > 0) {
      await db.update(resourceStock).set({ currentQty: 40 }).where(and(eq(resourceStock.userId, userA.id), eq(resourceStock.resourceId, 'inv-7')));
    } else {
      await db.insert(resourceStock).values({
        id: `stock_peanut_${userA.id}`,
        userId: userA.id,
        resourceId: 'inv-7',
        currentQty: 40,
        inCart: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    // 4-week peanut history: W1=120g, W2=140g, W3=130g, W4=150g => Average = 135g/week
    const nowMs = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    await db.insert(resourceEvents).values([
      { id: `re_p1_${nowMs}`, userId: userA.id, resourceId: 'inv-7', resourceName: 'Raw Peanuts', unit: 'g', eventType: 'CONSUMPTION', amount: 120, date: new Date(nowMs - 27 * dayMs).toISOString().split('T')[0], createdAt: new Date(nowMs - 27 * dayMs).toISOString() },
      { id: `re_p2_${nowMs}`, userId: userA.id, resourceId: 'inv-7', resourceName: 'Raw Peanuts', unit: 'g', eventType: 'CONSUMPTION', amount: 140, date: new Date(nowMs - 20 * dayMs).toISOString().split('T')[0], createdAt: new Date(nowMs - 20 * dayMs).toISOString() },
      { id: `re_p3_${nowMs}`, userId: userA.id, resourceId: 'inv-7', resourceName: 'Raw Peanuts', unit: 'g', eventType: 'CONSUMPTION', amount: 130, date: new Date(nowMs - 13 * dayMs).toISOString().split('T')[0], createdAt: new Date(nowMs - 13 * dayMs).toISOString() },
      { id: `re_p4_${nowMs}`, userId: userA.id, resourceId: 'inv-7', resourceName: 'Raw Peanuts', unit: 'g', eventType: 'CONSUMPTION', amount: 150, date: new Date(nowMs).toISOString().split('T')[0], createdAt: new Date(nowMs).toISOString() }
    ]);

    const forecastRes = await calculateResourceForecasts(db, userA.id);
    const peanutForecast = forecastRes.resources.find((r) => r.id === 'inv-7');

    assert.equal(Math.round(peanutForecast.forecast.historicalWeeklyConsumption), 135, 'Peanut weekly average must be ~135g');
    assert.equal(peanutForecast.forecast.requiredPurchaseQty, 95, 'Stock 40g with weekly demand 135g requires purchase 95g');
  });

  await t.test('11. Milk and Banana DAILY_PURCHASE behavior remains correct', async () => {
    const milkItem = INITIAL_INVENTORY.find((i) => i.id === 'inv-2');
    const bananaItem = INITIAL_INVENTORY.find((i) => i.id === 'inv-5');

    assert.equal(milkItem.procurementMode, 'DAILY_PURCHASE');
    assert.equal(bananaItem.procurementMode, 'DAILY_PURCHASE');

    const result = await evaluatePurchaseIntelligence(db, userA.id);
    const milkQueued = result.queuedCartItems.find((c) => c.resourceId === 'inv-2');
    const bananaQueued = result.queuedCartItems.find((c) => c.resourceId === 'inv-5');

    assert.equal(milkQueued, undefined, 'Milk DAILY_PURCHASE must NOT generate automated inventory depletion cart item');
    assert.equal(bananaQueued, undefined, 'Bananas DAILY_PURCHASE must NOT generate automated inventory depletion cart item');
  });

  await t.test('12. Repeated planning runs set quantity idempotently (never incrementing)', async () => {
    // Set Eggs stock = 8 (requires 18)
    await db.update(resourceStock).set({ currentQty: 8 }).where(and(eq(resourceStock.userId, userA.id), eq(resourceStock.resourceId, 'inv-1')));

    await evaluatePurchaseIntelligence(db, userA.id);
    await evaluatePurchaseIntelligence(db, userA.id);
    await evaluatePurchaseIntelligence(db, userA.id);

    const eggCartItems = await db
      .select()
      .from(cartItems)
      .where(and(eq(cartItems.userId, userA.id), eq(cartItems.resourceId, 'inv-1'), eq(cartItems.status, 'PENDING')));

    assert.equal(eggCartItems.length, 1, 'Exactly one active cart item must exist after duplicate processing');
    assert.equal(eggCartItems[0].quantity, 18, 'Cart item quantity must equal exact required purchase 18 (not 36 or 54)');
  });

  await t.test('13. User-added cart items are preserved (Speaker Test)', async () => {
    const speakerId = `cart_speaker_${Date.now()}`;
    await db.insert(cartItems).values({
      id: speakerId,
      userId: userA.id,
      itemName: 'speaker',
      quantity: 1,
      estimatedPricePaise: 450000,
      priority: 1,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    await cleanupCorruptedAutomatedCartItems(db, userA.id);

    const [userSpeaker] = await db.select().from(cartItems).where(eq(cartItems.id, speakerId));
    assert.ok(userSpeaker, 'User added item "speaker" must be preserved 100%');
    assert.equal(userSpeaker.itemName, 'speaker');
  });

  await t.test('14. Multi-Tenant Isolation', async () => {
    const userBCartItems = await db.select().from(cartItems).where(eq(cartItems.userId, userB.id));
    assert.equal(userBCartItems.length, 0, "User A evaluations must NEVER pollute User B's cart items");
  });

  await t.test('15. Purchase intent creates ₹0 financial transactions', async () => {
    const txs = await db.select().from(financialTransactions).where(eq(financialTransactions.userId, userA.id));
    assert.equal(txs.length, 0, 'Purchase intent recommendations must create ZERO financial ledger transactions');
  });
});
