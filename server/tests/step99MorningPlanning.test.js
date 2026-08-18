import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../db/index.js';
import { users, financialTransactions, cartItems, resourceStock, domainEvents } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { calculateFinancialState } from '../services/financialEngine.js';
import { domainEventBus, createDomainEvent } from '../services/domainEventBus.js';
import { DOMAIN_EVENT_TYPES } from '../services/domainEventTypes.js';
import { initializeAutomationHandlers } from '../services/automationBootstrap.js';

initializeAutomationHandlers();

test('STEP 9.9 — MORNING FINANCIAL PLANNING CORRECTION TESTS', async (t) => {

  const userA = {
    id: `test-step99-userA-${Date.now()}`,
    googleId: `google-step99-userA-${Date.now()}`,
    email: `step99.userA.${Date.now()}@doctrine.test`,
    displayName: 'Step 9.9 User A'
  };

  const userB = {
    id: `test-step99-userB-${Date.now()}`,
    googleId: `google-step99-userB-${Date.now()}`,
    email: `step99.userB.${Date.now()}@doctrine.test`,
    displayName: 'Step 9.9 User B'
  };

  t.after(async () => {
    // Cleanup test data
    await db.delete(cartItems).where(eq(cartItems.userId, userA.id));
    await db.delete(cartItems).where(eq(cartItems.userId, userB.id));
    await db.delete(financialTransactions).where(eq(financialTransactions.userId, userA.id));
    await db.delete(financialTransactions).where(eq(financialTransactions.userId, userB.id));
    await db.delete(resourceStock).where(eq(resourceStock.userId, userA.id));
    await db.delete(resourceStock).where(eq(resourceStock.userId, userB.id));
    await db.delete(domainEvents).where(eq(domainEvents.userId, userA.id));
    await db.delete(domainEvents).where(eq(domainEvents.userId, userB.id));
    await db.delete(users).where(eq(users.id, userA.id));
    await db.delete(users).where(eq(users.id, userB.id));
  });

  await t.test('1. Setup Test Users', async () => {
    await db.insert(users).values([userA, userB]);
    const [foundA] = await db.select().from(users).where(eq(users.id, userA.id));
    assert.equal(foundA.id, userA.id);
  });

  await t.test('2. Morning State Before Workday Completion (Zero premature transaction)', async () => {
    // Target Monday (workday)
    const mondayStr = '2026-08-17'; // Monday
    const finState = await calculateFinancialState(db, userA.id, mondayStr);

    // Actual ledger cash must remain ₹0
    assert.equal(finState.cash.actualCashPaise, 0);
    assert.equal(finState.cash.spendableCashPaise, 0);

    // Expected workday income must be ₹220 (22000 Paise)
    assert.equal(finState.income.todayExpectedPaise, 22000);
    assert.equal(finState.income.isWorkday, true);

    // Transport commitment = ₹50 (5000 Paise)
    assert.equal(finState.transport.requiredTodayPaise, 5000);

    // Morning Planned Capacity = 22000 - 5000 = 17000 Paise (₹170)
    assert.equal(finState.morningPlan.plannedCapacityPaise, 17000);
    assert.equal(finState.cash.plannedCapacityPaise, 17000);

    // CRITICAL: Verify ZERO transactions exist in financial_transactions
    const txs = await db
      .select()
      .from(financialTransactions)
      .where(eq(financialTransactions.userId, userA.id));
    assert.equal(txs.length, 0, 'No premature financial transaction must be created before workday completion');
  });

  await t.test('3. Purchase Recommendations Evaluated Against Morning Planned Capacity', async () => {
    const mondayStr = '2026-08-17';

    // Set stock for Flaxseed Powder (inv-10, estimatedPrice: ₹120 = 12000 Paise) to 0 (depleted)
    await db.insert(resourceStock).values({
      id: `stock-${userA.id}-inv-10`,
      userId: userA.id,
      resourceId: 'inv-10',
      currentQty: 0,
      minStockLevel: 100,
      updatedAt: new Date().toISOString()
    });

    const finState = await calculateFinancialState(db, userA.id, mondayStr);

    // Find Flaxseed Powder in resourceNeeds
    const itemNeed = finState.resourceNeeds.find(r => r.resourceId === 'inv-10');
    assert.ok(itemNeed, 'Flaxseed Powder resource need must be surfaced in morning recommendations');

    // Item price = ₹120 (12000 Paise)
    // Even though actual ledger cash is ₹0, item is affordable within ₹170 Planned Capacity!
    assert.equal(itemNeed.isAffordable, true, 'Item (₹120) must be evaluated as affordable within ₹170 morning planned capacity');
    assert.equal(itemNeed.isAffordableActual, false, 'Item is NOT affordable with actual cash ₹0');
    assert.ok(itemNeed.affordabilityReason.includes('morning plan'), 'Affordability reason indicates morning plan capacity');
  });

  await t.test('4. Cart State Integration in Morning Planning', async () => {
    const mondayStr = '2026-08-17';

    // Add item to cart
    await db.insert(cartItems).values({
      id: `cart-${userA.id}-1`,
      userId: userA.id,
      itemName: 'Flaxseed Powder',
      resourceId: 'inv-10',
      quantity: 1,
      estimatedPricePaise: 12000,
      priority: 2,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    const finState = await calculateFinancialState(db, userA.id, mondayStr);
    assert.equal(finState.cartCommitments.length, 1);
    assert.equal(finState.cartCommitments[0].itemName, 'Flaxseed Powder');
    assert.equal(finState.cartCommitments[0].totalEstimatedPaise, 12000);

    // Verify actual cash is STILL ₹0 (cart items are intent only)
    assert.equal(finState.cash.actualCashPaise, 0);
  });

  await t.test('5. WORKDAY_COMPLETED Automates Realized Income into Financial Ledger', async () => {
    const mondayStr = '2026-08-17';

    // Process WORKDAY_COMPLETED domain event via domainEventBus
    const event = createDomainEvent({
      type: DOMAIN_EVENT_TYPES.WORKDAY_COMPLETED,
      userId: userA.id,
      sourceType: 'USER_ACTION',
      payload: { date: mondayStr }
    });
    await domainEventBus.publish(event);

    // Re-calculate financial state after workday completion
    const finState = await calculateFinancialState(db, userA.id, mondayStr);

    // Now actual ledger cash must equal ₹220 (22000 Paise)
    assert.equal(finState.cash.actualCashPaise, 22000, 'Actual cash updates to ₹220 after WORKDAY_COMPLETED');
    assert.equal(finState.cash.spendableCashPaise, 22000);
    assert.equal(finState.income.todayActualPaise, 22000);

    // Verify 1 income transaction was recorded in financial_transactions
    const txs = await db
      .select()
      .from(financialTransactions)
      .where(and(eq(financialTransactions.userId, userA.id), eq(financialTransactions.type, 'INCOME')));
    assert.equal(txs.length, 1, 'Exactly 1 actual income transaction recorded upon workday completion');
  });

  await t.test('6. Strict Multi-Tenant User Isolation', async () => {
    const mondayStr = '2026-08-17';
    const finStateB = await calculateFinancialState(db, userB.id, mondayStr);

    assert.equal(finStateB.cash.actualCashPaise, 0);
    assert.equal(finStateB.cartCommitments.length, 0, 'User B cannot see User A cart items');

    const txsB = await db
      .select()
      .from(financialTransactions)
      .where(eq(financialTransactions.userId, userB.id));
    assert.equal(txsB.length, 0);
  });
});
