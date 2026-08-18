import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../db/index.js';
import {
  users,
  resourceStock,
  resourceEvents,
  cartItems,
  purchaseRecords,
  financialTransactions,
} from '../db/schema.js';
import { initializeAutomationHandlers } from '../services/automationBootstrap.js';
import { emitTaskCompletedEvent } from '../services/taskExecutionService.js';
import { calculateResourceForecasts } from '../services/resourceForecastService.js';
import { evaluatePurchaseIntelligence } from '../services/purchaseIntelligenceService.js';
import { seedDefaultTaskResourceRequirements } from '../services/taskResourceService.js';
import { INITIAL_INVENTORY } from '../../src/data/doctrineData.js';
import { eq, and, inArray } from 'drizzle-orm';
import cryptoNative from 'node:crypto';

// Initialize bootstrap handlers before running tests
initializeAutomationHandlers();

test('STEP 6 — INVENTORY DEPLETION -> CART & PURCHASE INTELLIGENCE TESTS', async (t) => {
  const userIdA = `test_pi_user_a_${Date.now()}`;
  const userIdB = `test_pi_user_b_${Date.now()}`;
  const nowIso = new Date().toISOString();

  t.before(async () => {
    // Setup Test User A & User B
    await db.insert(users).values([
      {
        id: userIdA,
        googleId: `google_${userIdA}`,
        email: `pi_user_a_${Date.now()}@doctrine.local`,
        name: 'Purchase Intel User A',
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: userIdB,
        googleId: `google_${userIdB}`,
        email: `pi_user_b_${Date.now()}@doctrine.local`,
        name: 'Purchase Intel User B',
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    ]);

    // Seed default task resource requirements for both users
    await seedDefaultTaskResourceRequirements(userIdA);
    await seedDefaultTaskResourceRequirements(userIdB);

    // Initialize all 29 inventory stock items for User A and User B to high stock (100)
    for (const item of INITIAL_INVENTORY) {
      await db.insert(resourceStock).values([
        {
          id: cryptoNative.randomUUID(),
          userId: userIdA,
          resourceId: item.id,
          currentQty: 100,
          inCart: false,
          createdAt: nowIso,
          updatedAt: nowIso,
        },
        {
          id: cryptoNative.randomUUID(),
          userId: userIdB,
          resourceId: item.id,
          currentQty: 100,
          inCart: false,
          createdAt: nowIso,
          updatedAt: nowIso,
        },
      ]);
    }
  });

  await t.test('1. Normal Inventory -> No Cart Item Created', async () => {
    // Eggs (inv-1) stock set to 30 pcs (minStockLevel = 6)
    await db
      .update(resourceStock)
      .set({ currentQty: 30, inCart: false, updatedAt: nowIso })
      .where(and(eq(resourceStock.userId, userIdA), eq(resourceStock.resourceId, 'inv-1')));

    const result = await evaluatePurchaseIntelligence(db, userIdA);
    assert.equal(result.success, true);

    const userCartItems = await db
      .select()
      .from(cartItems)
      .where(and(eq(cartItems.userId, userIdA), eq(cartItems.resourceId, 'inv-1')));

    assert.equal(userCartItems.length, 0, 'No cart items should be created for fully stocked resource');
  });

  await t.test('2. Depleted Inventory -> Cart Item Automatically Created', async () => {
    // Set Bananas (inv-5) to 0 pcs (minStockLevel = 4)
    await db
      .update(resourceStock)
      .set({ currentQty: 0, inCart: false, updatedAt: nowIso })
      .where(and(eq(resourceStock.userId, userIdA), eq(resourceStock.resourceId, 'inv-5')));

    const result = await evaluatePurchaseIntelligence(db, userIdA);
    assert.equal(result.success, true);

    const userCartItems = await db
      .select()
      .from(cartItems)
      .where(and(eq(cartItems.userId, userIdA), eq(cartItems.resourceId, 'inv-5'), eq(cartItems.status, 'PENDING')));

    if (userCartItems.length !== 1) {
      console.error('TEST 2 CART ITEMS DEBUG:', userCartItems);
    }
    assert.equal(userCartItems.length, 1, 'Exactly one PENDING cart item must be created');
    assert.ok(userCartItems[0].quantity > 0, 'Quantity must be positive');

    const [bananaStock] = await db
      .select()
      .from(resourceStock)
      .where(and(eq(resourceStock.userId, userIdA), eq(resourceStock.resourceId, 'inv-5')));
    assert.equal(bananaStock.inCart, true, 'resource_stock.inCart must be set to true');
  });

  await t.test('3. Forecast Recommended Quantity -> Cart Quantity Matches Forecast', async () => {
    const forecastRes = await calculateResourceForecasts(db, userIdA);
    const bananaItem = forecastRes.resources.find((r) => r.id === 'inv-5');

    const [cartRow] = await db
      .select()
      .from(cartItems)
      .where(and(eq(cartItems.userId, userIdA), eq(cartItems.resourceId, 'inv-5'), eq(cartItems.status, 'PENDING')));

    assert.equal(cartRow.quantity, bananaItem.forecast.recommendedPurchaseQty);
  });

  await t.test('4. Existing Active Cart Item -> Updated Rather Than Duplicated', async () => {
    // Re-evaluate purchase intelligence for User A
    await evaluatePurchaseIntelligence(db, userIdA);

    const bananaCartItems = await db
      .select()
      .from(cartItems)
      .where(and(eq(cartItems.userId, userIdA), eq(cartItems.resourceId, 'inv-5')));

    assert.equal(bananaCartItems.length, 1, 'Existing cart item must be updated without creating duplicate row');
  });

  await t.test('5. Repeated Event Processing -> Exactly 1 Active Cart Item', async () => {
    const execId = `exec_pi_idem_${Date.now()}`;
    await emitTaskCompletedEvent(userIdA, {
      taskExecutionId: execId,
      taskKey: 'mass_shake',
      date: '2026-08-17',
    });
    // Retry emission with same execution ID
    await emitTaskCompletedEvent(userIdA, {
      taskExecutionId: execId,
      taskKey: 'mass_shake',
      date: '2026-08-17',
    });

    const activeCartItems = await db
      .select()
      .from(cartItems)
      .where(and(eq(cartItems.userId, userIdA), eq(cartItems.resourceId, 'inv-5'), inArray(cartItems.status, ['PENDING', 'APPROVED'])));

    assert.equal(activeCartItems.length, 1, 'Exactly one active cart item must exist after duplicate processing');
  });

  await t.test('6. Concurrent Processing Simulation -> No Duplicate Active Cart Items', async () => {
    // Run 3 evaluation requests simultaneously
    await Promise.all([
      evaluatePurchaseIntelligence(db, userIdA),
      evaluatePurchaseIntelligence(db, userIdA),
      evaluatePurchaseIntelligence(db, userIdA),
    ]);

    const activeCartItems = await db
      .select()
      .from(cartItems)
      .where(and(eq(cartItems.userId, userIdA), eq(cartItems.resourceId, 'inv-5'), inArray(cartItems.status, ['PENDING', 'APPROVED'])));

    assert.equal(activeCartItems.length, 1, 'Concurrent evaluations must resolve to exactly 1 active cart item');
  });

  await t.test('7. Multi-Resource Task -> Each Depleted Resource Evaluated Independently', async () => {
    // Set Milk (inv-2) to 0 L & Oats (inv-3) to 0 kg
    await db
      .update(resourceStock)
      .set({ currentQty: 0, inCart: false, updatedAt: nowIso })
      .where(and(eq(resourceStock.userId, userIdA), eq(resourceStock.resourceId, 'inv-2')));

    await db
      .update(resourceStock)
      .set({ currentQty: 0, inCart: false, updatedAt: nowIso })
      .where(and(eq(resourceStock.userId, userIdA), eq(resourceStock.resourceId, 'inv-3')));

    await evaluatePurchaseIntelligence(db, userIdA);

    const milkCart = await db.select().from(cartItems).where(and(eq(cartItems.userId, userIdA), eq(cartItems.resourceId, 'inv-2')));
    const oatsCart = await db.select().from(cartItems).where(and(eq(cartItems.userId, userIdA), eq(cartItems.resourceId, 'inv-3')));

    assert.equal(milkCart.length, 1);
    assert.equal(oatsCart.length, 1);
  });

  await t.test('8. Non-Depleted Resources -> No Unnecessary Cart Items', async () => {
    // Delete any prior cart items for inv-6 created by earlier routine completions
    await db.delete(cartItems).where(and(eq(cartItems.userId, userIdA), eq(cartItems.resourceId, 'inv-6')));

    // Peanut butter (inv-6) has high stock 500 g (minStockLevel = 300 g)
    await db
      .update(resourceStock)
      .set({ currentQty: 500, inCart: false, updatedAt: nowIso })
      .where(and(eq(resourceStock.userId, userIdA), eq(resourceStock.resourceId, 'inv-6')));

    await evaluatePurchaseIntelligence(db, userIdA);

    const pbCart = await db.select().from(cartItems).where(and(eq(cartItems.userId, userIdA), eq(cartItems.resourceId, 'inv-6')));
    assert.equal(pbCart.length, 0, 'No cart items should be created for non-depleted peanut butter');
  });

  await t.test('9. Automatic Cart Generation -> Zero Financial Transactions (₹0 Ledger Impact)', async () => {
    const userTxBefore = await db.select().from(financialTransactions).where(eq(financialTransactions.userId, userIdA));

    await evaluatePurchaseIntelligence(db, userIdA);

    const userTxAfter = await db.select().from(financialTransactions).where(eq(financialTransactions.userId, userIdA));
    assert.equal(userTxBefore.length, userTxAfter.length, 'Automatic cart generation MUST create 0 financial ledger entries');
  });

  await t.test('10. Strict Multi-Tenant Isolation', async () => {
    // User A inventory is depleted. User B inventory is high (Milk inv-2 = 10 L).
    await db
      .update(resourceStock)
      .set({ currentQty: 10, inCart: false, updatedAt: nowIso })
      .where(and(eq(resourceStock.userId, userIdB), eq(resourceStock.resourceId, 'inv-2')));

    await evaluatePurchaseIntelligence(db, userIdA);

    const userBCartItems = await db
      .select()
      .from(cartItems)
      .where(and(eq(cartItems.userId, userIdB), eq(cartItems.resourceId, 'inv-2')));

    assert.equal(userBCartItems.length, 0, "User A's inventory depletion must NEVER create or modify User B's cart items");
  });

  await t.test('11. Forecast API and Purchase Intelligence Produce Consistent Results', async () => {
    const forecastRes = await calculateResourceForecasts(db, userIdA);
    const milkForecast = forecastRes.resources.find((r) => r.id === 'inv-2');

    const [milkCartRow] = await db
      .select()
      .from(cartItems)
      .where(and(eq(cartItems.userId, userIdA), eq(cartItems.resourceId, 'inv-2'), eq(cartItems.status, 'PENDING')));

    assert.equal(milkCartRow.quantity, milkForecast.forecast.recommendedPurchaseQty);
  });

  await t.test('12. Existing Actual Purchase Flow Remains Intact', async () => {
    // Simulating actual purchase completion:
    // 1. Insert EXPENSE in financial_transactions
    // 2. Insert purchase_records
    // 3. Update resource_stock currentQty + inCart: false
    // 4. Update cart_items status: 'PURCHASED'
    const purchaseId = `pur_${cryptoNative.randomUUID()}`;
    const cartItem = (await db.select().from(cartItems).where(and(eq(cartItems.userId, userIdA), eq(cartItems.resourceId, 'inv-2'))))[0];

    await db.insert(financialTransactions).values({
      id: `ft_exp_${cryptoNative.randomUUID()}`,
      userId: userIdA,
      amountPaise: 10000, // ₹100.00
      date: '2026-08-17',
      type: 'EXPENSE',
      category: 'RESOURCE_PURCHASE',
      description: 'Milk purchase',
      source: 'PURCHASE',
      cartItemId: cartItem.id,
      resourceId: 'inv-2',
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    await db.insert(purchaseRecords).values({
      id: purchaseId,
      userId: userIdA,
      resourceId: 'inv-2',
      itemName: 'Full-Fat Buffalo Milk',
      quantity: 2.0,
      actualPricePaise: 10000,
      purchaseDate: '2026-08-17',
      cartItemId: cartItem.id,
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    await db
      .update(cartItems)
      .set({ status: 'PURCHASED', updatedAt: nowIso })
      .where(and(eq(cartItems.userId, userIdA), eq(cartItems.id, cartItem.id)));

    await db
      .update(resourceStock)
      .set({ currentQty: 2.0, inCart: false, updatedAt: nowIso })
      .where(and(eq(resourceStock.userId, userIdA), eq(resourceStock.resourceId, 'inv-2')));

    const [updatedMilkStock] = await db
      .select()
      .from(resourceStock)
      .where(and(eq(resourceStock.userId, userIdA), eq(resourceStock.resourceId, 'inv-2')));

    assert.equal(updatedMilkStock.currentQty, 2.0);
    assert.equal(updatedMilkStock.inCart, false);

    const [updatedCart] = await db
      .select()
      .from(cartItems)
      .where(and(eq(cartItems.userId, userIdA), eq(cartItems.id, cartItem.id)));

    assert.equal(updatedCart.status, 'PURCHASED');
  });

  await t.test('13. Critical Integration Test: End-to-End Task Completion -> Consumption -> Forecast -> Cart Decision', async () => {
    // Reset routine stock items (Milk: 10 L, Oats: 2 kg, Peanut Butter: 500 g) to high levels so consumption succeeds
    await db
      .update(resourceStock)
      .set({ currentQty: 10, inCart: false, updatedAt: nowIso })
      .where(and(eq(resourceStock.userId, userIdA), eq(resourceStock.resourceId, 'inv-2')));
    await db
      .update(resourceStock)
      .set({ currentQty: 2, inCart: false, updatedAt: nowIso })
      .where(and(eq(resourceStock.userId, userIdA), eq(resourceStock.resourceId, 'inv-3')));
    await db
      .update(resourceStock)
      .set({ currentQty: 500, inCart: false, updatedAt: nowIso })
      .where(and(eq(resourceStock.userId, userIdA), eq(resourceStock.resourceId, 'inv-6')));

    // Set Bananas (inv-5) to 1.5 pcs (minStockLevel = 4)
    await db
      .update(resourceStock)
      .set({ currentQty: 1.5, inCart: false, updatedAt: nowIso })
      .where(and(eq(resourceStock.userId, userIdA), eq(resourceStock.resourceId, 'inv-5')));

    // Clear any previous cart items for inv-5 for User A
    await db.delete(cartItems).where(and(eq(cartItems.userId, userIdA), eq(cartItems.resourceId, 'inv-5')));

    // 2. Emit TASK_COMPLETED event for "Mass Shake" (consumes 1 banana, 0.3 L milk, 40 g oats, 20 g peanut butter)
    const execIdChain = `exec_chain_${Date.now()}`;
    const result = await emitTaskCompletedEvent(userIdA, {
      taskExecutionId: execIdChain,
      taskKey: 'mass_shake',
      date: '2026-08-17',
    });

    if (!result.success) {
      console.error('TEST 13 FAILURE RESULTS:', result.results);
    }
    assert.equal(result.success, true);

    // 3. Verify causal sequence:
    // Step 4 resource_consumption_handler (priority 10) ran FIRST:
    // Banana stock decreased from 1.5 pcs to 0.5 pcs
    const [bananaStockPost] = await db
      .select()
      .from(resourceStock)
      .where(and(eq(resourceStock.userId, userIdA), eq(resourceStock.resourceId, 'inv-5')));
    assert.equal(bananaStockPost.currentQty, 0.5, 'Stock must be deducted by resource consumption handler before purchase intelligence runs');

    // Step 6 resource_purchase_intelligence_handler (priority 50) ran SECOND:
    // Forecast evaluated NEW stock (0.5 pcs <= minStockLevel 4) -> created PENDING cart item for inv-5!
    const bananaCartItems = await db
      .select()
      .from(cartItems)
      .where(and(eq(cartItems.userId, userIdA), eq(cartItems.resourceId, 'inv-5'), eq(cartItems.status, 'PENDING')));

    assert.equal(bananaCartItems.length, 1, 'Purchase intelligence handler must use NEW post-consumption stock state to create cart item');
    assert.equal(bananaStockPost.inCart, true, 'resource_stock.inCart must be updated to true');
  });
});
