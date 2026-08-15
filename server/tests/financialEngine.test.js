import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../db/index.js';
import {
  users,
  financialTransactions,
  financialGoals,
  cartItems,
  purchaseRecords,
  financialPreferences,
  resourceStock
} from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { cryptoNative } from '../utils/crypto.js';
import { calculateFinancialState } from '../services/financialEngine.js';
import { rupeesToPaise } from '../utils/money.js';

test('FEATURE 17 — DETERMINISTIC FINANCIAL ENGINE TESTS', async (t) => {
  const userA = cryptoNative.randomUUID();
  const userB = cryptoNative.randomUUID();

  t.after(async () => {
    // Cleanup test data safely
    await db.delete(purchaseRecords).where(eq(purchaseRecords.userId, userA));
    await db.delete(purchaseRecords).where(eq(purchaseRecords.userId, userB));
    await db.delete(cartItems).where(eq(cartItems.userId, userA));
    await db.delete(cartItems).where(eq(cartItems.userId, userB));
    await db.delete(financialGoals).where(eq(financialGoals.userId, userA));
    await db.delete(financialGoals).where(eq(financialGoals.userId, userB));
    await db.delete(financialTransactions).where(eq(financialTransactions.userId, userA));
    await db.delete(financialTransactions).where(eq(financialTransactions.userId, userB));
    await db.delete(financialPreferences).where(eq(financialPreferences.userId, userA));
    await db.delete(financialPreferences).where(eq(financialPreferences.userId, userB));
    await db.delete(resourceStock).where(eq(resourceStock.userId, userA));
    await db.delete(resourceStock).where(eq(resourceStock.userId, userB));
    await db.delete(users).where(eq(users.id, userA));
    await db.delete(users).where(eq(users.id, userB));
  });

  await t.test('1. Setup Test Users & Default Preferences', async () => {
    await db.insert(users).values([
      { id: userA, googleId: 'g_eng_user_a_' + Date.now(), email: 'eng_a@example.com', displayName: 'Engine User A' },
      { id: userB, googleId: 'g_eng_user_b_' + Date.now(), email: 'eng_b@example.com', displayName: 'Engine User B' }
    ]);

    await db.insert(financialPreferences).values({
      userId: userA,
      dailyWorkdayIncomePaise: 22000, // ₹220.00
      transportDailyCostPaise: 5000,  // ₹50.00
      transportReserveDay: 'THURSDAY',
      transportReserveAmountPaise: 10000, // ₹100.00
      workdaysJson: JSON.stringify(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY']),
      weeklyBudgetLimitPaise: 150000,
      autoApproveThresholdPaise: 20000
    });
  });

  await t.test('2. Fresh User With Zero Ledger Has Zero Cash', async () => {
    const state = await calculateFinancialState(db, userA, '2026-08-17'); // MONDAY
    assert.equal(state.cash.actualCashPaise, 0);
    assert.equal(state.cash.reservedPaise, 0);
    assert.equal(state.cash.allocatedPaise, 0);
    assert.equal(state.cash.discretionaryPaise, 0);
    assert.equal(state.decisionState.canSpendPaise, 0);
    assert.equal(state.income.isWorkday, true);
    assert.equal(state.income.todayExpectedPaise, 22000);
  });

  await t.test('3. ₹220 Income Transaction Increases Actual Cash', async () => {
    await db.insert(financialTransactions).values({
      id: cryptoNative.randomUUID(),
      userId: userA,
      amountPaise: 22000,
      date: '2026-08-17',
      type: 'INCOME',
      category: 'WORKDAY_INCOME',
      description: 'Monday Workday Income'
    });

    const state = await calculateFinancialState(db, userA, '2026-08-17');
    assert.equal(state.cash.actualCashPaise, 22000); // ₹220.00
    assert.equal(state.cash.discretionaryPaise, 22000);
    assert.equal(state.income.todayActualPaise, 22000);
  });

  await t.test('4. ₹220 Income + ₹50 Expense Results in ₹170 Actual Cash', async () => {
    await db.insert(financialTransactions).values({
      id: cryptoNative.randomUUID(),
      userId: userA,
      amountPaise: 5000,
      date: '2026-08-17',
      type: 'EXPENSE',
      category: 'TRANSPORT',
      description: 'Monday Transport Cost'
    });

    const state = await calculateFinancialState(db, userA, '2026-08-17');
    assert.equal(state.cash.actualCashPaise, 17000); // ₹170.00
    assert.equal(state.cash.discretionaryPaise, 17000);
  });

  await t.test('5. RESERVE Transaction Does NOT Reduce Actual Cash, But Reduces Discretionary Amount', async () => {
    await db.insert(financialTransactions).values({
      id: cryptoNative.randomUUID(),
      userId: userA,
      amountPaise: 10000, // ₹100.00 Reserve
      date: '2026-08-17',
      type: 'RESERVE',
      category: 'TRANSPORT',
      description: 'Friday Transport Reserve'
    });

    const state = await calculateFinancialState(db, userA, '2026-08-17');
    assert.equal(state.cash.actualCashPaise, 17000); // Cash remains ₹170! Not reduced by reserve!
    assert.equal(state.cash.reservedPaise, 10000);   // Reserved = ₹100
    assert.equal(state.cash.discretionaryPaise, 7000); // Discretionary = ₹170 - ₹100 = ₹70
  });

  await t.test('6. ALLOCATION Transaction Does NOT Reduce Actual Cash, But Reduces Discretionary Amount', async () => {
    const goalId = cryptoNative.randomUUID();
    await db.insert(financialGoals).values({
      id: goalId,
      userId: userA,
      name: 'Bluetooth Speaker',
      targetPricePaise: 350000,
      priority: 1,
      urgency: 'HIGH'
    });

    await db.insert(financialTransactions).values({
      id: cryptoNative.randomUUID(),
      userId: userA,
      amountPaise: 5000, // ₹50.00 Goal Allocation
      date: '2026-08-17',
      type: 'ALLOCATION',
      category: 'GOAL_SAVING',
      financialGoalId: goalId
    });

    const state = await calculateFinancialState(db, userA, '2026-08-17');
    assert.equal(state.cash.actualCashPaise, 17000); // Cash remains ₹170! Not reduced by allocation!
    assert.equal(state.cash.allocatedPaise, 5000);   // Allocated = ₹50
    assert.equal(state.cash.reservedPaise, 10000);   // Reserved = ₹100
    assert.equal(state.cash.discretionaryPaise, 2000); // Discretionary = ₹170 - ₹100 - ₹50 = ₹20
  });

  await t.test('7. Thursday Transport Reserve & Friday Non-Workday Preferences', async () => {
    // Thursday Date: 2026-08-20
    const thuState = await calculateFinancialState(db, userA, '2026-08-20');
    assert.equal(thuState.dayOfWeek, 'THURSDAY');
    assert.equal(thuState.income.isWorkday, true);
    assert.equal(thuState.transport.reserveRequiredPaise, 10000); // ₹100 Thursday Reserve

    // Friday Date: 2026-08-21
    const friState = await calculateFinancialState(db, userA, '2026-08-21');
    assert.equal(friState.dayOfWeek, 'FRIDAY');
    assert.equal(friState.income.isWorkday, false); // Friday is NOT in user's workdays_json
    assert.equal(friState.income.todayExpectedPaise, 0);
  });

  await t.test('8. Workday Income is Driven by Preferences workdaysJson', async () => {
    // User B sets FRIDAY as workday in preferences
    await db.insert(financialPreferences).values({
      userId: userB,
      dailyWorkdayIncomePaise: 25000,
      transportDailyCostPaise: 6000,
      workdaysJson: JSON.stringify(['FRIDAY', 'SATURDAY'])
    });

    const friStateB = await calculateFinancialState(db, userB, '2026-08-21'); // FRIDAY
    assert.equal(friStateB.income.isWorkday, true);
    assert.equal(friStateB.income.todayExpectedPaise, 25000);

    const monStateB = await calculateFinancialState(db, userB, '2026-08-17'); // MONDAY
    assert.equal(monStateB.income.isWorkday, false);
    assert.equal(monStateB.income.todayExpectedPaise, 0);
  });

  await t.test('9. Goal Priority 1 Strictly Preserved Above Priority 2 (User Ranking Authoritative)', async () => {
    const goal2Id = cryptoNative.randomUUID();

    await db.insert(financialGoals).values({
      id: goal2Id,
      userId: userA,
      name: 'PC Table',
      targetPricePaise: 450000,
      priority: 2,
      urgency: 'CRITICAL' // Even though CRITICAL, priority 1 remains first!
    });

    const state = await calculateFinancialState(db, userA, '2026-08-17');
    assert.equal(state.goals.length, 2);
    assert.equal(state.goals[0].priority, 1);
    assert.equal(state.goals[0].name, 'Bluetooth Speaker');
    assert.equal(state.goals[1].priority, 2);
    assert.equal(state.goals[1].name, 'PC Table');
    assert.equal(state.decisionState.highestPriorityGoalId, state.goals[0].id);
  });

  await t.test('10. Pending Cart Item Does NOT Become an Expense or Reduce Cash Automatically', async () => {
    await db.insert(cartItems).values({
      id: cryptoNative.randomUUID(),
      userId: userA,
      itemName: '27-inch Monitor',
      quantity: 1,
      estimatedPricePaise: 1200000,
      status: 'PENDING'
    });

    const state = await calculateFinancialState(db, userA, '2026-08-17');
    assert.equal(state.cash.actualCashPaise, 17000); // Cash remains ₹170! Not deducted!
    assert.equal(state.cartCommitments.length, 1);
    assert.equal(state.cartCommitments[0].itemName, '27-inch Monitor');
  });

  await t.test('11. Purchase & Expense Transaction Counted Exactly Once', async () => {
    const cartItemId = cryptoNative.randomUUID();
    const purId = cryptoNative.randomUUID();
    const txId = cryptoNative.randomUUID();

    await db.insert(cartItems).values({
      id: cartItemId,
      userId: userA,
      itemName: 'Eggs',
      quantity: 30,
      estimatedPricePaise: 20000,
      status: 'PURCHASED'
    });

    await db.insert(financialTransactions).values({
      id: txId,
      userId: userA,
      amountPaise: 18550,
      date: '2026-08-17',
      type: 'EXPENSE',
      category: 'RESOURCE_PURCHASE'
    });

    await db.insert(purchaseRecords).values({
      id: purId,
      userId: userA,
      cartItemId: cartItemId,
      itemName: 'Eggs',
      quantity: 30,
      actualPricePaise: 18550, // ₹185.50
      purchaseDate: '2026-08-17',
      financialTransactionId: txId
    });

    // Income ₹220 - Transport Expense ₹50 - Egg Expense ₹185.50 = -₹15.50 (-1550 paise deficit)
    const state = await calculateFinancialState(db, userA, '2026-08-17');
    assert.equal(state.cash.netCashPaise, -1550); // Unclamped real financial truth (-₹15.50 deficit)
    assert.equal(state.cash.actualCashPaise, -1550); // Unclamped real financial truth
    assert.equal(state.cash.spendableCashPaise, 0); // Clamped spendable cash
    assert.equal(state.cash.discretionaryPaise, 0);
    assert.equal(state.decisionState.canSpendPaise, 0);
    assert.equal(state.decisionState.blockedByObligations, true);
  });

  await t.test('12. Resource Stock at 90% Above Minimum Stock Level Does NOT Trigger Purchase Need', async () => {
    await db.insert(resourceStock).values({
      id: cryptoNative.randomUUID(),
      userId: userA,
      resourceId: 'inv-1', // Eggs
      currentQty: 27 // 27/30 = 90% stock, but minStockLevel is 5
    });

    const state = await calculateFinancialState(db, userA, '2026-08-17');
    const eggNeed = state.resourceNeeds.find(r => r.resourceId === 'inv-1');
    assert.equal(eggNeed, undefined); // 90% stock above min level does NOT trigger purchase candidate!
  });

  await t.test('13. Multi-Tenant User Isolation Guarantee Across Financial Engine Calculations', async () => {
    // Add unique transaction for userA
    await db.insert(financialTransactions).values({
      id: cryptoNative.randomUUID(),
      userId: userA,
      amountPaise: 50000,
      date: '2026-08-17',
      type: 'INCOME',
      category: 'WORKDAY_INCOME'
    });

    const stateA = await calculateFinancialState(db, userA, '2026-08-17');
    const stateB = await calculateFinancialState(db, userB, '2026-08-17');

    assert.equal(stateA.cash.actualCashPaise, 48450);
    assert.equal(stateB.cash.actualCashPaise, 0); // User B has zero cash
    assert.equal(stateB.goals.length, 0); // User B has zero goals
    assert.equal(stateB.cartCommitments.length, 0); // User B has zero cart items
  });

  await t.test('14. Deterministic Engine Reproducibility (Identical Input Yields Identical Output)', async () => {
    const run1 = await calculateFinancialState(db, userA, '2026-08-17');
    const run2 = await calculateFinancialState(db, userA, '2026-08-17');

    assert.deepEqual(run1, run2);
  });

  await t.test('15. Task 5.1 Financial Deficit Truth vs Spendable Cash Separation', async () => {
    const userDeficit = cryptoNative.randomUUID();
    await db.insert(users).values({
      id: userDeficit,
      googleId: 'g_deficit_user_' + Date.now(),
      email: 'deficit@example.com',
      displayName: 'Deficit User'
    });

    // Income ₹100 (10000 paise), Expenses ₹150 (15000 paise)
    await db.insert(financialTransactions).values([
      {
        id: cryptoNative.randomUUID(),
        userId: userDeficit,
        amountPaise: 10000,
        date: '2026-08-17',
        type: 'INCOME',
        category: 'WORKDAY_INCOME'
      },
      {
        id: cryptoNative.randomUUID(),
        userId: userDeficit,
        amountPaise: 15000,
        date: '2026-08-17',
        type: 'EXPENSE',
        category: 'OTHER'
      }
    ]);

    const state = await calculateFinancialState(db, userDeficit, '2026-08-17');

    // Verify netCashPaise and actualCashPaise preserve exact deficit -5000 paise (-₹50.00)
    assert.equal(state.cash.netCashPaise, -5000);
    assert.equal(state.cash.actualCashPaise, -5000);
    // Verify spendable cash is safely clamped to 0
    assert.equal(state.cash.spendableCashPaise, 0);
    assert.equal(state.cash.discretionaryPaise, 0);
    assert.equal(state.decisionState.canSpendPaise, 0);
    assert.equal(state.decisionState.blockedByObligations, true);

    // Cleanup
    await db.delete(financialTransactions).where(eq(financialTransactions.userId, userDeficit));
    await db.delete(users).where(eq(users.id, userDeficit));
  });
});
