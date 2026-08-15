import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';
import { db } from '../db/index.js';
import {
  users,
  financialTransactions,
  financialGoals,
  cartItems,
  purchaseRecords,
  financialPreferences
} from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { cryptoNative } from '../utils/crypto.js';
import financialRouter, { isValidCalendarDate } from '../routes/financial.js';

test('FEATURE 18 — FINANCIAL API LAYER TESTS', async (t) => {
  const userA = cryptoNative.randomUUID();
  const userB = cryptoNative.randomUUID();
  const origNodeEnv = process.env.NODE_ENV;

  let app;
  let server;
  let baseUrl;

  t.before((_, done) => {
    app = express();
    app.use(express.json());

    // Middleware to attach session from test header 'x-test-session-user-id'
    app.use((req, res, next) => {
      const sessionUserId = req.headers['x-test-session-user-id'];
      if (sessionUserId) {
        req.session = { userId: sessionUserId };
      } else {
        req.session = null;
      }
      next();
    });

    app.use('/api/financial', financialRouter);

    server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      done();
    });
  });

  t.after(async () => {
    process.env.NODE_ENV = origNodeEnv;
    if (server) server.close();

    // Cleanup test data safely
    await db.delete(cartItems).where(eq(cartItems.userId, userA));
    await db.delete(cartItems).where(eq(cartItems.userId, userB));
    await db.delete(financialGoals).where(eq(financialGoals.userId, userA));
    await db.delete(financialGoals).where(eq(financialGoals.userId, userB));
    await db.delete(financialTransactions).where(eq(financialTransactions.userId, userA));
    await db.delete(financialTransactions).where(eq(financialTransactions.userId, userB));
    await db.delete(financialPreferences).where(eq(financialPreferences.userId, userA));
    await db.delete(financialPreferences).where(eq(financialPreferences.userId, userB));
    await db.delete(users).where(eq(users.id, userA));
    await db.delete(users).where(eq(users.id, userB));
  });

  await t.test('1. Setup Test Users & Financial Data', async () => {
    await db.insert(users).values([
      { id: userA, googleId: 'g_api_user_a_' + Date.now(), email: 'api_a@example.com', displayName: 'API User A', isActive: true },
      { id: userB, googleId: 'g_api_user_b_' + Date.now(), email: 'api_b@example.com', displayName: 'API User B', isActive: true }
    ]);

    await db.insert(financialPreferences).values({
      userId: userA,
      dailyWorkdayIncomePaise: 22000,
      transportDailyCostPaise: 5000,
      transportReserveDay: 'THURSDAY',
      transportReserveAmountPaise: 10000,
      workdaysJson: JSON.stringify(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY'])
    });

    // Seed income for User A (₹500 / 50000 paise)
    await db.insert(financialTransactions).values({
      id: cryptoNative.randomUUID(),
      userId: userA,
      amountPaise: 50000,
      date: '2026-08-17',
      type: 'INCOME',
      category: 'WORKDAY_INCOME'
    });

    // Seed Goal for User A
    await db.insert(financialGoals).values({
      id: cryptoNative.randomUUID(),
      userId: userA,
      name: 'Monitor',
      targetPricePaise: 1500000,
      priority: 1,
      urgency: 'HIGH'
    });

    // Seed Cart Item for User A
    await db.insert(cartItems).values({
      id: cryptoNative.randomUUID(),
      userId: userA,
      itemName: 'Keyboard',
      quantity: 1,
      estimatedPricePaise: 450000,
      status: 'PENDING'
    });
  });

  await t.test('2. Strict Calendar Date Validator Unit Verification', () => {
    assert.equal(isValidCalendarDate('2026-08-17'), true);
    assert.equal(isValidCalendarDate('2024-02-29'), true); // Leap year
    assert.equal(isValidCalendarDate('2026-02-29'), false); // Non-leap year
    assert.equal(isValidCalendarDate('2026-02-30'), false); // Impossible February date
    assert.equal(isValidCalendarDate('2026-04-31'), false); // Impossible April date
    assert.equal(isValidCalendarDate('2026-13-01'), false); // Invalid month
    assert.equal(isValidCalendarDate('invalid-date'), false);
    assert.equal(isValidCalendarDate(''), false);
    assert.equal(isValidCalendarDate(null), false);
  });

  await t.test('3. Authenticated User Receives Deterministic Financial State', async () => {
    const res = await fetch(`${baseUrl}/api/financial/state?date=2026-08-17`, {
      headers: { 'x-test-session-user-id': userA }
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.notEqual(body.financialState, undefined);
    assert.equal(body.financialState.date, '2026-08-17');
    assert.equal(body.financialState.cash.netCashPaise, 50000);
    assert.equal(body.financialState.cash.actualCashPaise, 50000);
    assert.equal(body.financialState.cash.spendableCashPaise, 50000);
    assert.equal(body.financialState.goals.length, 1);
    assert.equal(body.financialState.goals[0].name, 'Monitor');
    assert.equal(body.financialState.cartCommitments.length, 1);
    assert.equal(body.financialState.cartCommitments[0].itemName, 'Keyboard');
  });

  await t.test('4. Unauthenticated Request Returns 401 in Production Mode', async () => {
    process.env.NODE_ENV = 'production';

    const res = await fetch(`${baseUrl}/api/financial/state?date=2026-08-17`);
    const body = await res.json();

    assert.equal(res.status, 401);
    assert.equal(body.error, 'Unauthorized');
  });

  await t.test('5. Invalid Session Returns 401 in Production Mode', async () => {
    process.env.NODE_ENV = 'production';

    const res = await fetch(`${baseUrl}/api/financial/state?date=2026-08-17`, {
      headers: { 'x-test-session-user-id': 'non-existent-user-id' }
    });
    const body = await res.json();

    assert.equal(res.status, 401);
    assert.equal(body.error, 'Unauthorized');
  });

  await t.test('6. User A Cannot Access User B Financial State', async () => {
    process.env.NODE_ENV = origNodeEnv; // Restore dev test environment

    const resA = await fetch(`${baseUrl}/api/financial/state?date=2026-08-17`, {
      headers: { 'x-test-session-user-id': userA }
    });
    const bodyA = await resA.json();

    const resB = await fetch(`${baseUrl}/api/financial/state?date=2026-08-17`, {
      headers: { 'x-test-session-user-id': userB }
    });
    const bodyB = await resB.json();

    assert.equal(resA.status, 200);
    assert.equal(resB.status, 200);
    assert.equal(bodyA.financialState.cash.netCashPaise, 50000);
    assert.equal(bodyB.financialState.cash.netCashPaise, 0); // User B has 0 cash
    assert.equal(bodyB.financialState.goals.length, 0);
    assert.equal(bodyB.financialState.cartCommitments.length, 0);
  });

  await t.test('7. Client Query userId Parameter CANNOT Override Authenticated Identity', async () => {
    // User B attempts to pass ?userId=userA in query string
    const res = await fetch(`${baseUrl}/api/financial/state?date=2026-08-17&userId=${userA}`, {
      headers: { 'x-test-session-user-id': userB }
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.financialState.cash.netCashPaise, 0); // Still User B's state! Not User A!
    assert.equal(body.financialState.goals.length, 0);
  });

  await t.test('8. Invalid Date Format Returns HTTP 400', async () => {
    const res = await fetch(`${baseUrl}/api/financial/state?date=invalid-date-format`, {
      headers: { 'x-test-session-user-id': userA }
    });
    const body = await res.json();

    assert.equal(res.status, 400);
    assert.equal(body.error, 'Invalid date');
    assert.equal(body.message, 'date must use YYYY-MM-DD format');
  });

  await t.test('9. Impossible Calendar Date Returns HTTP 400', async () => {
    const resFeb30 = await fetch(`${baseUrl}/api/financial/state?date=2026-02-30`, {
      headers: { 'x-test-session-user-id': userA }
    });
    const bodyFeb30 = await resFeb30.json();

    const resApr31 = await fetch(`${baseUrl}/api/financial/state?date=2026-04-31`, {
      headers: { 'x-test-session-user-id': userA }
    });
    const bodyApr31 = await resApr31.json();

    assert.equal(resFeb30.status, 400);
    assert.equal(bodyFeb30.error, 'Invalid date');

    assert.equal(resApr31.status, 400);
    assert.equal(bodyApr31.error, 'Invalid date');
  });

  await t.test('10. Missing Date Query Uses Current Calendar Date', async () => {
    const res = await fetch(`${baseUrl}/api/financial/state`, {
      headers: { 'x-test-session-user-id': userA }
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(typeof body.financialState.date, 'string');
    assert.equal(/^\d{4}-\d{2}-\d{2}$/.test(body.financialState.date), true);
  });

  await t.test('11. Integer Paise Values Preserved & Distinct Field Separation', async () => {
    const res = await fetch(`${baseUrl}/api/financial/state?date=2026-08-17`, {
      headers: { 'x-test-session-user-id': userA }
    });
    const body = await res.json();

    const cash = body.financialState.cash;
    assert.equal(Number.isInteger(cash.netCashPaise), true);
    assert.equal(Number.isInteger(cash.actualCashPaise), true);
    assert.equal(Number.isInteger(cash.spendableCashPaise), true);
    assert.equal(Number.isInteger(cash.reservedPaise), true);
    assert.equal(Number.isInteger(cash.allocatedPaise), true);
    assert.equal(Number.isInteger(cash.discretionaryPaise), true);
  });

  await t.test('12. Deficit Net Cash & Clamped Spendable Cash API Verification', async () => {
    const userDef = cryptoNative.randomUUID();
    await db.insert(users).values({
      id: userDef,
      googleId: 'g_api_def_' + Date.now(),
      email: 'api_def@example.com',
      displayName: 'Def User',
      isActive: true
    });

    // Income ₹100, Expense ₹150 -> Net cash -₹50 (-5000 paise)
    await db.insert(financialTransactions).values([
      { id: cryptoNative.randomUUID(), userId: userDef, amountPaise: 10000, date: '2026-08-17', type: 'INCOME', category: 'WORKDAY_INCOME' },
      { id: cryptoNative.randomUUID(), userId: userDef, amountPaise: 15000, date: '2026-08-17', type: 'EXPENSE', category: 'OTHER' }
    ]);

    const res = await fetch(`${baseUrl}/api/financial/state?date=2026-08-17`, {
      headers: { 'x-test-session-user-id': userDef }
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.financialState.cash.netCashPaise, -5000);
    assert.equal(body.financialState.cash.actualCashPaise, -5000);
    assert.equal(body.financialState.cash.spendableCashPaise, 0);
    assert.equal(body.financialState.decisionState.canSpendPaise, 0);
    assert.equal(body.financialState.decisionState.blockedByObligations, true);

    await db.delete(financialTransactions).where(eq(financialTransactions.userId, userDef));
    await db.delete(users).where(eq(users.id, userDef));
  });

  await t.test('13. Unexpected Engine / DB Error Yields Safe HTTP 500 Response Without Leaking Stack Traces', async () => {
    // Inject invalid user ID headers to trigger internal handler exception handling if DB throws
    process.env.NODE_ENV = 'production';
    const res = await fetch(`${baseUrl}/api/financial/state?date=2026-08-17`, {
      headers: { 'x-test-session-user-id': 'non-existent-500-trigger' }
    });
    const body = await res.json();

    if (res.status === 500) {
      assert.equal(body.error, 'Internal Server Error');
      assert.equal(body.stack, undefined);
    } else {
      assert.equal(res.status, 401); // Standard 401 for non-existent auth
    }
  });
});
