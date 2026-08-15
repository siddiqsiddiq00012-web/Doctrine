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
import financialRouter from '../routes/financial.js';

test('FEATURE 20 — INDEPENDENT CART MANAGEMENT TESTS', async (t) => {
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
    await db.delete(users).where(eq(users.id, userA));
    await db.delete(users).where(eq(users.id, userB));
  });

  await t.test('1. Setup Test Users', async () => {
    await db.insert(users).values([
      { id: userA, googleId: 'g_cart_user_a_' + Date.now(), email: 'cart_a@example.com', displayName: 'Cart User A', isActive: true },
      { id: userB, googleId: 'g_cart_user_b_' + Date.now(), email: 'cart_b@example.com', displayName: 'Cart User B', isActive: true }
    ]);
  });

  await t.test('2. Unauthenticated Cart GET Returns 401 in Production Mode', async () => {
    process.env.NODE_ENV = 'production';

    const res = await fetch(`${baseUrl}/api/financial/cart`);
    const body = await res.json();

    assert.equal(res.status, 401);
    assert.equal(body.error, 'Unauthorized');
  });

  await t.test('3. Create Independent Cart Item Without Resource (e.g. Speaker)', async () => {
    process.env.NODE_ENV = origNodeEnv;

    const res = await fetch(`${baseUrl}/api/financial/cart`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-test-session-user-id': userA
      },
      body: JSON.stringify({
        itemName: 'Bluetooth Speaker',
        quantity: 1,
        estimatedPricePaise: 50000, // ₹500.00
        priority: 1,
        targetPurchaseDate: '2026-08-20',
        notes: 'Desktop speaker'
      })
    });
    const body = await res.json();

    assert.equal(res.status, 201);
    assert.equal(body.success, true);
    assert.equal(body.item.itemName, 'Bluetooth Speaker');
    assert.equal(body.item.resourceId, null);
    assert.equal(body.item.estimatedPricePaise, 50000);
    assert.equal(body.item.totalEstimatedPaise, 50000);
    assert.equal(body.item.status, 'PENDING');
  });

  await t.test('4. Create Cart Item Linked to Resource (e.g. Eggs -> inv-1)', async () => {
    const res = await fetch(`${baseUrl}/api/financial/cart`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-test-session-user-id': userA
      },
      body: JSON.stringify({
        itemName: 'Eggs',
        resourceId: 'inv-1',
        quantity: 30,
        estimatedPricePaise: 20000, // ₹200.00
        priority: 2
      })
    });
    const body = await res.json();

    assert.equal(res.status, 201);
    assert.equal(body.item.resourceId, 'inv-1');
    assert.equal(body.item.totalEstimatedPaise, 600000); // 30 * 20000 = 600000 paise (₹6,000)
  });

  await t.test('5. Create Cart Item Linked to Financial Goal', async () => {
    const goalId = cryptoNative.randomUUID();
    await db.insert(financialGoals).values({
      id: goalId,
      userId: userA,
      name: 'Monitor Goal',
      targetPricePaise: 1500000,
      priority: 1
    });

    const res = await fetch(`${baseUrl}/api/financial/cart`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-test-session-user-id': userA
      },
      body: JSON.stringify({
        itemName: '4K Monitor',
        financialGoalId: goalId,
        quantity: 1,
        estimatedPricePaise: 1500000,
        priority: 3
      })
    });
    const body = await res.json();

    assert.equal(res.status, 201);
    assert.equal(body.item.financialGoalId, goalId);
  });

  await t.test('6. Input Validation: Quantity, Price, Priority, and Date Checks', async () => {
    // Zero quantity
    const resQty = await fetch(`${baseUrl}/api/financial/cart`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-test-session-user-id': userA },
      body: JSON.stringify({ itemName: 'Test', quantity: 0, estimatedPricePaise: 100 })
    });
    assert.equal(resQty.status, 400);

    // Negative price
    const resPrice = await fetch(`${baseUrl}/api/financial/cart`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-test-session-user-id': userA },
      body: JSON.stringify({ itemName: 'Test', quantity: 1, estimatedPricePaise: -500 })
    });
    assert.equal(resPrice.status, 400);

    // Invalid priority < 1
    const resPri = await fetch(`${baseUrl}/api/financial/cart`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-test-session-user-id': userA },
      body: JSON.stringify({ itemName: 'Test', quantity: 1, estimatedPricePaise: 500, priority: 0 })
    });
    assert.equal(resPri.status, 400);

    // Impossible calendar date
    const resDate = await fetch(`${baseUrl}/api/financial/cart`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-test-session-user-id': userA },
      body: JSON.stringify({ itemName: 'Test', quantity: 1, estimatedPricePaise: 500, targetPurchaseDate: '2026-02-30' })
    });
    assert.equal(resDate.status, 400);
  });

  await t.test('7. Multi-User Isolation: User B Cannot Read, Modify, or Delete User A Cart Items', async () => {
    // User A fetches items
    const getA = await fetch(`${baseUrl}/api/financial/cart`, {
      headers: { 'x-test-session-user-id': userA }
    });
    const bodyA = await getA.json();
    assert.equal(bodyA.items.length, 3);

    const userAItemId = bodyA.items[0].id;

    // User B fetches items -> receives empty list
    const getB = await fetch(`${baseUrl}/api/financial/cart`, {
      headers: { 'x-test-session-user-id': userB }
    });
    const bodyB = await getB.json();
    assert.equal(bodyB.items.length, 0);

    // User B attempts PATCH on User A's item -> returns 404 (IDOR Protection)
    const patchB = await fetch(`${baseUrl}/api/financial/cart/${userAItemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-test-session-user-id': userB },
      body: JSON.stringify({ quantity: 99 })
    });
    assert.equal(patchB.status, 404);

    // User B attempts DELETE on User A's item -> returns 404 (IDOR Protection)
    const delB = await fetch(`${baseUrl}/api/financial/cart/${userAItemId}`, {
      method: 'DELETE',
      headers: { 'x-test-session-user-id': userB }
    });
    assert.equal(delB.status, 404);
  });

  await t.test('8. PATCH Item Updates Quantity, Price, Priority, and Status', async () => {
    const getA = await fetch(`${baseUrl}/api/financial/cart`, {
      headers: { 'x-test-session-user-id': userA }
    });
    const bodyA = await getA.json();
    const itemId = bodyA.items[0].id;

    const patchRes = await fetch(`${baseUrl}/api/financial/cart/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-test-session-user-id': userA },
      body: JSON.stringify({
        quantity: 2,
        estimatedPricePaise: 60000, // ₹600.00
        priority: 1,
        status: 'APPROVED'
      })
    });
    const patchBody = await patchRes.json();

    assert.equal(patchRes.status, 200);
    assert.equal(patchBody.item.quantity, 2);
    assert.equal(patchBody.item.estimatedPricePaise, 60000);
    assert.equal(patchBody.item.totalEstimatedPaise, 120000);
    assert.equal(patchBody.item.status, 'APPROVED');
  });

  await t.test('9. Direct Status Transition to PURCHASED via Normal Edit Is Rejected', async () => {
    const getA = await fetch(`${baseUrl}/api/financial/cart`, {
      headers: { 'x-test-session-user-id': userA }
    });
    const bodyA = await getA.json();
    const itemId = bodyA.items[0].id;

    const patchRes = await fetch(`${baseUrl}/api/financial/cart/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-test-session-user-id': userA },
      body: JSON.stringify({ status: 'PURCHASED' })
    });
    const patchBody = await patchRes.json();

    assert.equal(patchRes.status, 400);
    assert.equal(patchBody.error, 'Invalid status transition');
  });

  await t.test('10. Cart Creation and Deletion DOES NOT Create Expense, Purchase Record, or Mutate Cash', async () => {
    // 1. Initial financial state check
    const stateBefore = await fetch(`${baseUrl}/api/financial/state?date=2026-08-17`, {
      headers: { 'x-test-session-user-id': userA }
    }).then(r => r.json());

    // 2. Add high-value cart item (₹50,000 / 5,000,000 paise)
    const createRes = await fetch(`${baseUrl}/api/financial/cart`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-test-session-user-id': userA },
      body: JSON.stringify({ itemName: 'Expensive PC Table', quantity: 1, estimatedPricePaise: 5000000 })
    });
    const createBody = await createRes.json();

    // 3. Re-verify financial state (Cash MUST remain identical!)
    const stateAfterCreate = await fetch(`${baseUrl}/api/financial/state?date=2026-08-17`, {
      headers: { 'x-test-session-user-id': userA }
    }).then(r => r.json());

    assert.equal(stateBefore.financialState.cash.netCashPaise, stateAfterCreate.financialState.cash.netCashPaise);

    // 4. Verify ZERO purchase records and ZERO extra transactions created
    const userTx = await db.select().from(financialTransactions).where(eq(financialTransactions.userId, userA));
    const userPur = await db.select().from(purchaseRecords).where(eq(purchaseRecords.userId, userA));

    assert.equal(userPur.length, 0); // Zero purchase records!
    assert.equal(userTx.filter(t => t.type === 'EXPENSE').length, 0); // Zero expense transactions!

    // 5. Delete cart item
    await fetch(`${baseUrl}/api/financial/cart/${createBody.item.id}`, {
      method: 'DELETE',
      headers: { 'x-test-session-user-id': userA }
    });

    const stateAfterDelete = await fetch(`${baseUrl}/api/financial/state?date=2026-08-17`, {
      headers: { 'x-test-session-user-id': userA }
    }).then(r => r.json());

    assert.equal(stateBefore.financialState.cash.netCashPaise, stateAfterDelete.financialState.cash.netCashPaise);
  });
});
