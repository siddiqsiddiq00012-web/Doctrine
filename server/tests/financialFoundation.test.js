import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../db/index.js';
import {
  users,
  financialTransactions,
  financialGoals,
  cartItems,
  purchaseRecords,
  financialDecisions,
  financialPreferences,
  resourceStock
} from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { cryptoNative } from '../utils/crypto.js';
import { rupeesToPaise, paiseToRupees, formatPaiseToINR } from '../utils/money.js';

test('FEATURE 15 — FINANCIAL DATA FOUNDATION & HARDENING TESTS', async (t) => {
  const userIdA = cryptoNative.randomUUID();
  const userIdB = cryptoNative.randomUUID();
  const googleIdA = 'google_fin_user_a_' + Date.now();
  const googleIdB = 'google_fin_user_b_' + Date.now();

  t.after(async () => {
    // Cleanup test data safely
    await db.delete(financialDecisions).where(eq(financialDecisions.userId, userIdA));
    await db.delete(financialDecisions).where(eq(financialDecisions.userId, userIdB));
    await db.delete(purchaseRecords).where(eq(purchaseRecords.userId, userIdA));
    await db.delete(purchaseRecords).where(eq(purchaseRecords.userId, userIdB));
    await db.delete(cartItems).where(eq(cartItems.userId, userIdA));
    await db.delete(cartItems).where(eq(cartItems.userId, userIdB));
    await db.delete(financialGoals).where(eq(financialGoals.userId, userIdA));
    await db.delete(financialGoals).where(eq(financialGoals.userId, userIdB));
    await db.delete(financialTransactions).where(eq(financialTransactions.userId, userIdA));
    await db.delete(financialTransactions).where(eq(financialTransactions.userId, userIdB));
    await db.delete(financialPreferences).where(eq(financialPreferences.userId, userIdA));
    await db.delete(financialPreferences).where(eq(financialPreferences.userId, userIdB));
    await db.delete(users).where(eq(users.id, userIdA));
    await db.delete(users).where(eq(users.id, userIdB));
  });

  await t.test('1. Deterministic Money Conversion Helper & Edge Cases', async () => {
    // Part 11 Tests 1-5: Exact Rupee to Paise Conversions
    assert.equal(rupeesToPaise(220), 22000);
    assert.equal(rupeesToPaise(50), 5000);
    assert.equal(rupeesToPaise(100), 10000);
    assert.equal(rupeesToPaise(185.50), 18550);
    assert.equal(rupeesToPaise(499.99), 49999);

    // Part 11 Test 6: Zero Handling
    assert.equal(rupeesToPaise(0), 0);
    assert.equal(paiseToRupees(0), 0);
    assert.equal(formatPaiseToINR(0), '₹0.00');

    // Part 11 Test 7: Invalid NaN Handling
    assert.throws(() => rupeesToPaise(NaN), TypeError);

    // Part 11 Test 8: Infinity Handling
    assert.throws(() => rupeesToPaise(Infinity), TypeError);

    // Part 11 Test 9: Prohibited Negative-Value Handling
    assert.throws(() => rupeesToPaise(-50), RangeError);
    assert.throws(() => paiseToRupees(-5000), RangeError);

    // Part 11 Test 10: No Floating-Point Accumulation in Common Operations
    // e.g. 0.1 + 0.2 in JS float = 0.30000000000000004; in Paise integer = 10 + 20 = 30
    const item1Paise = rupeesToPaise(0.10); // 10
    const item2Paise = rupeesToPaise(0.20); // 20
    const totalPaise = item1Paise + item2Paise; // 30
    assert.equal(totalPaise, 30);
    assert.equal(paiseToRupees(totalPaise), 0.3);

    // Test Reverse Formatting
    assert.equal(paiseToRupees(22000), 220.00);
    assert.equal(paiseToRupees(18550), 185.50);
    assert.equal(formatPaiseToINR(18550), '₹185.50');
  });

  await t.test('2. Setup Test Users', async () => {
    await db.insert(users).values([
      { id: userIdA, googleId: googleIdA, email: 'fin_user_a@example.com', displayName: 'Fin User A', isActive: true },
      { id: userIdB, googleId: googleIdB, email: 'fin_user_b@example.com', displayName: 'Fin User B', isActive: true }
    ]);
  });

  await t.test('3. Financial Ledger Transactions in Exact Integer Paise', async () => {
    const txIncomeId = cryptoNative.randomUUID();
    const txExpenseId = cryptoNative.randomUUID();

    // Workday Income Event: ₹220 -> 22000 paise
    await db.insert(financialTransactions).values({
      id: txIncomeId,
      userId: userIdA,
      amountPaise: rupeesToPaise(220), // 22000 paise
      date: '2026-08-15',
      type: 'INCOME',
      category: 'WORKDAY_INCOME',
      description: 'Monday Workday Income',
      source: 'WORKDAY'
    });

    // College Transport Reserve: ₹50 -> 5000 paise
    await db.insert(financialTransactions).values({
      id: txExpenseId,
      userId: userIdA,
      amountPaise: rupeesToPaise(50), // 5000 paise
      date: '2026-08-15',
      type: 'RESERVE',
      category: 'TRANSPORT',
      description: 'College Transport Reserve',
      source: 'MANUAL'
    });

    const userATransactions = await db.select().from(financialTransactions).where(eq(financialTransactions.userId, userIdA));
    assert.equal(userATransactions.length, 2);
    const incomeTx = userATransactions.find(t => t.id === txIncomeId);
    assert.ok(incomeTx);
    assert.equal(incomeTx.amountPaise, 22000); // Integer paise!
    assert.equal(paiseToRupees(incomeTx.amountPaise), 220.00);
    assert.equal(incomeTx.type, 'INCOME');
  });

  await t.test('4. Financial Goals Creation, Exact Target Price & Priority Preservation', async () => {
    const goal1Id = cryptoNative.randomUUID();
    const goal2Id = cryptoNative.randomUUID();

    // User A sets Goal 1: Speaker (Priority 1 - Highest, ₹3500 -> 350000 paise)
    await db.insert(financialGoals).values({
      id: goal1Id,
      userId: userIdA,
      name: 'Bluetooth Speaker',
      targetPricePaise: rupeesToPaise(3500.0), // 350000 paise
      priority: 1,
      urgency: 'HIGH',
      allocatedAmountPaise: rupeesToPaise(500.0), // 50000 paise
      status: 'SAVING'
    });

    // User A sets Goal 2: PC Table (Priority 2, ₹4500 -> 450000 paise)
    await db.insert(financialGoals).values({
      id: goal2Id,
      userId: userIdA,
      name: 'PC Table',
      targetPricePaise: rupeesToPaise(4500.0), // 450000 paise
      priority: 2,
      urgency: 'MEDIUM',
      allocatedAmountPaise: 0,
      status: 'PLANNED'
    });

    const userAGoals = await db.select().from(financialGoals).where(eq(financialGoals.userId, userIdA));
    assert.equal(userAGoals.length, 2);

    const goal1 = userAGoals.find(g => g.id === goal1Id);
    assert.ok(goal1);
    assert.equal(goal1.priority, 1); // User priority preserved!
    assert.equal(goal1.targetPricePaise, 350000); // Exact integer paise!
    assert.equal(paiseToRupees(goal1.targetPricePaise), 3500.00);
  });

  await t.test('5. Independent Cart Items Creation (Resource vs Non-Resource) in Integer Paise', async () => {
    const cartNonResourceId = cryptoNative.randomUUID();
    const cartResourceId = cryptoNative.randomUUID();

    // 5a. Non-resource cart item (e.g. Monitor ₹12000 -> 1200000 paise)
    await db.insert(cartItems).values({
      id: cartNonResourceId,
      userId: userIdA,
      itemName: '27-inch Monitor',
      resourceId: null,
      quantity: 1,
      estimatedPricePaise: rupeesToPaise(12000.0),
      priority: 1,
      status: 'PENDING'
    });

    // 5b. Resource cart item (e.g. Eggs ₹200 -> 20000 paise)
    await db.insert(cartItems).values({
      id: cartResourceId,
      userId: userIdA,
      itemName: 'Eggs',
      resourceId: 'inv-1',
      quantity: 30,
      estimatedPricePaise: rupeesToPaise(200.0),
      priority: 1,
      status: 'APPROVED'
    });

    const userACart = await db.select().from(cartItems).where(eq(cartItems.userId, userIdA));
    assert.equal(userACart.length, 2);

    const nonResourceItem = userACart.find(c => c.id === cartNonResourceId);
    assert.ok(nonResourceItem);
    assert.equal(nonResourceItem.resourceId, null);
    assert.equal(nonResourceItem.estimatedPricePaise, 1200000);

    const resourceItem = userACart.find(c => c.id === cartResourceId);
    assert.ok(resourceItem);
    assert.equal(resourceItem.resourceId, 'inv-1');
    assert.equal(resourceItem.estimatedPricePaise, 20000);
  });

  await t.test('6. Purchase Records Historical Authoritative Price (Actual Price in Integer Paise)', async () => {
    const cartItemId = cryptoNative.randomUUID();
    const purchaseId = cryptoNative.randomUUID();

    // Cart Item: Estimated ₹200 -> 20000 paise
    await db.insert(cartItems).values({
      id: cartItemId,
      userId: userIdA,
      itemName: 'Eggs',
      resourceId: 'inv-1',
      quantity: 30,
      estimatedPricePaise: rupeesToPaise(200.0),
      status: 'PURCHASED'
    });

    // Actual Purchase: ₹185.50 -> 18550 paise
    await db.insert(purchaseRecords).values({
      id: purchaseId,
      userId: userIdA,
      cartItemId: cartItemId,
      resourceId: 'inv-1',
      itemName: 'Eggs',
      quantity: 30,
      actualPricePaise: rupeesToPaise(185.50), // 18550 paise
      purchaseDate: '2026-08-15',
      notes: 'Discounted at local store'
    });

    const [purchase] = await db.select().from(purchaseRecords).where(eq(purchaseRecords.id, purchaseId));
    assert.ok(purchase);
    assert.equal(purchase.actualPricePaise, 18550); // Exact integer paise!
    assert.equal(paiseToRupees(purchase.actualPricePaise), 185.50);
    assert.equal(purchase.quantity, 30);
  });

  await t.test('7. Financial Decisions & Recommendation History', async () => {
    const decisionId = cryptoNative.randomUUID();
    const goalId = cryptoNative.randomUUID();

    await db.insert(financialGoals).values({
      id: goalId,
      userId: userIdA,
      name: 'Exam Fees',
      targetPricePaise: rupeesToPaise(1500.0),
      priority: 1,
      urgency: 'CRITICAL',
      status: 'PLANNED'
    });

    await db.insert(financialDecisions).values({
      id: decisionId,
      userId: userIdA,
      recommendationType: 'GOAL_ALLOCATION',
      payload: JSON.stringify({ recommendedAllocationPaise: 22000, reason: 'Workday income available' }),
      date: '2026-08-15',
      userDecision: 'ACCEPTED',
      financialGoalId: goalId,
      outcome: 'Allocated ₹220 to Exam Fees'
    });

    const [decision] = await db.select().from(financialDecisions).where(eq(financialDecisions.id, decisionId));
    assert.ok(decision);
    assert.equal(decision.userDecision, 'ACCEPTED');
    assert.equal(decision.financialGoalId, goalId);
  });

  await t.test('8. User Financial Preferences in Integer Paise & Multi-Tenant Isolation', async () => {
    // User A sets preferences: ₹220 workday income (22000 paise), ₹50 transport (5000 paise), ₹100 THURSDAY reserve (10000 paise)
    await db.insert(financialPreferences).values({
      userId: userIdA,
      dailyWorkdayIncomePaise: rupeesToPaise(220.0), // 22000
      transportDailyCostPaise: rupeesToPaise(50.0), // 5000
      transportReserveDay: 'THURSDAY',
      transportReserveAmountPaise: rupeesToPaise(100.0), // 10000
      workdaysJson: JSON.stringify(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY']),
      weeklyBudgetLimitPaise: rupeesToPaise(1500.0), // 150000
      autoApproveThresholdPaise: rupeesToPaise(200.0) // 20000
    });

    const [prefA] = await db.select().from(financialPreferences).where(eq(financialPreferences.userId, userIdA));
    assert.ok(prefA);
    assert.equal(prefA.dailyWorkdayIncomePaise, 22000);
    assert.equal(prefA.transportDailyCostPaise, 5000);
    assert.equal(prefA.transportReserveAmountPaise, 10000);

    // Multi-tenant Isolation Check: User B cannot read User A preferences
    const [prefB] = await db.select().from(financialPreferences).where(eq(financialPreferences.userId, userIdB));
    assert.equal(prefB, undefined);

    // Multi-tenant Isolation Check: User B cannot access User A's transactions, goals, cart, purchases, or decisions
    const userBTransactions = await db.select().from(financialTransactions).where(eq(financialTransactions.userId, userIdB));
    assert.equal(userBTransactions.length, 0);

    const userBGoals = await db.select().from(financialGoals).where(eq(financialGoals.userId, userIdB));
    assert.equal(userBGoals.length, 0);

    const userBCart = await db.select().from(cartItems).where(eq(cartItems.userId, userIdB));
    assert.equal(userBCart.length, 0);

    const userBPurchases = await db.select().from(purchaseRecords).where(eq(purchaseRecords.userId, userIdB));
    assert.equal(userBPurchases.length, 0);

    const userBDecisions = await db.select().from(financialDecisions).where(eq(financialDecisions.userId, userIdB));
    assert.equal(userBDecisions.length, 0);
  });

  await t.test('9. Existing Resource Stock inCart Field Preserved Intact', async () => {
    const stockId = cryptoNative.randomUUID();
    await db.insert(resourceStock).values({
      id: stockId,
      userId: userIdA,
      resourceId: 'inv-1',
      currentQty: 10,
      inCart: true
    });

    const [stock] = await db.select().from(resourceStock).where(eq(resourceStock.id, stockId));
    assert.ok(stock);
    assert.equal(stock.inCart, true); // Legacy inCart field remains 100% untouched!

    await db.delete(resourceStock).where(eq(resourceStock.id, stockId));
  });
});
