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
  cartItems,
  financialTransactions
} from '../db/schema.js';
import { eq, inArray } from 'drizzle-orm';
import { generateDeterministicPlan } from '../services/planningEngine.js';

test('TASK 9C — PROACTIVE PURCHASE RECOMMENDATIONS & UI CLEANUP TESTS', async (t) => {

  const userA = {
    id: `test-9c-userA-${Date.now()}`,
    googleId: `google-9c-userA-${Date.now()}`,
    email: `plan9c.userA.${Date.now()}@doctrine.test`,
    displayName: 'Task 9C User A'
  };

  let schedIdA = null;
  let taskIdMassShake = null;
  let taskIdPostWorkout = null;

  t.after(async () => {
    // Cleanup test data
    await db.delete(scheduleEntries).where(inArray(scheduleEntries.scheduleId, [schedIdA].filter(Boolean)));
    await db.delete(schedules).where(eq(schedules.userId, userA.id));
    await db.delete(taskResourceRequirements).where(eq(taskResourceRequirements.userId, userA.id));
    await db.delete(tasks).where(eq(tasks.userId, userA.id));
    await db.delete(cartItems).where(eq(cartItems.userId, userA.id));
    await db.delete(resourceStock).where(eq(resourceStock.userId, userA.id));
    await db.delete(financialTransactions).where(eq(financialTransactions.userId, userA.id));
    await db.delete(users).where(eq(users.id, userA.id));
  });

  await t.test('1. Setup Realistic Schedule & Resource Requirements Scenario', async () => {
    await db.insert(users).values(userA);

    taskIdMassShake = `task-9c-shake-${Date.now()}`;
    taskIdPostWorkout = `task-9c-workout-${Date.now()}`;

    await db.insert(tasks).values([
      {
        id: taskIdMassShake,
        userId: userA.id,
        taskKey: 'mass_shake',
        title: 'Mass Shake (~1000 kcal)',
        category: 'NUTRITION',
        defaultPriority: 1,
        defaultDurationMinutes: 15,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: taskIdPostWorkout,
        userId: userA.id,
        taskKey: 'post_workout',
        title: 'Post Workout Shake',
        category: 'FITNESS',
        defaultPriority: 2,
        defaultDurationMinutes: 10,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ]);

    schedIdA = `sched-9c-${Date.now()}`;
    await db.insert(schedules).values({
      id: schedIdA,
      userId: userA.id,
      name: 'Task 9C Protocol Schedule',
      isDefault: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // Schedule Entries:
    // Tomorrow: Mass Shake (0.3L Milk) + Post Workout (0.2L Milk) = 0.5L total Milk demand tomorrow
    const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const tomorrowTarget = new Date(`${tomorrowStr}T00:00:00Z`);
    const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    const tomorrowDayName = dayNames[tomorrowTarget.getUTCDay()];

    await db.insert(scheduleEntries).values([
      {
        id: `entry-9c-shake-${Date.now()}`,
        scheduleId: schedIdA,
        taskId: taskIdMassShake,
        timingType: 'FIXED',
        recurrencePattern: 'WEEKLY',
        dayOfWeek: tomorrowDayName,
        startMinutes: 450, // 07:30 AM
        sortOrder: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: `entry-9c-workout-${Date.now()}`,
        scheduleId: schedIdA,
        taskId: taskIdPostWorkout,
        timingType: 'FIXED',
        recurrencePattern: 'WEEKLY',
        dayOfWeek: tomorrowDayName,
        startMinutes: 1020, // 05:00 PM
        sortOrder: 2,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ]);

    // Task Resource Requirements:
    // Mass Shake -> Milk (inv-2) = 0.3 L
    // Post Workout -> Milk (inv-2) = 0.2 L
    await db.insert(taskResourceRequirements).values([
      {
        id: `trr-9c-shake-${Date.now()}`,
        userId: userA.id,
        taskKey: 'mass_shake',
        resourceId: 'inv-2',
        quantityConsumed: 0.3,
        unit: 'liters',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: `trr-9c-workout-${Date.now()}`,
        userId: userA.id,
        taskKey: 'post_workout',
        resourceId: 'inv-2',
        quantityConsumed: 0.2,
        unit: 'liters',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ]);
  });

  await t.test('2. Schedule-Driven Shortage Detection: Stock (0.2 L) < Tomorrow Demand (0.5 L) -> BUY_TODAY', async () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];

    // Set Milk stock = 0.2 L
    await db.insert(resourceStock).values({
      id: `stock-${userA.id}-inv-2`,
      userId: userA.id,
      resourceId: 'inv-2',
      currentQty: 0.2,
      inCart: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    const plan = await generateDeterministicPlan(db, userA.id, todayStr, 7);

    assert.ok(plan.today.buyToday.length > 0, 'buyToday should surface Milk shortage recommendation');

    const milkRec = plan.today.buyToday.find((b) => b.resourceId === 'inv-2');
    assert.ok(milkRec, 'Milk must be present in buyToday');
    assert.ok(milkRec.itemName.includes('Milk'));
    assert.equal(milkRec.firstRequiredDate, tomorrowStr);
    assert.equal(milkRec.firstAffectedTask, 'Mass Shake (~1000 kcal)');
    assert.equal(milkRec.alreadyHandled, false);
    assert.ok(milkRec.recommendedPurchaseQty >= 1);
    assert.ok(milkRec.estimatedPriceRupees > 0);
  });

  await t.test('3. Active Cart Intent -> Transitions BUY_TODAY to ALREADY_HANDLED (No Duplicates)', async () => {
    const todayStr = new Date().toISOString().split('T')[0];

    // Add active cart item for Milk (1 L)
    await db.insert(cartItems).values({
      id: `cart-${userA.id}-milk`,
      userId: userA.id,
      itemName: 'Full-Fat Buffalo Milk',
      resourceId: 'inv-2',
      quantity: 1,
      estimatedPricePaise: 6000,
      priority: 1,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    const plan = await generateDeterministicPlan(db, userA.id, todayStr, 7);

    // Milk must NOW be in alreadyHandled, NOT in buyToday
    const milkBuy = plan.today.buyToday.find((b) => b.resourceId === 'inv-2');
    assert.equal(milkBuy, undefined, 'Milk must NOT be recommended in buyToday when active cart item exists');

    const milkHandled = plan.today.alreadyHandled.find((b) => b.resourceId === 'inv-2');
    assert.ok(milkHandled, 'Milk must be classified under alreadyHandled');
    assert.equal(milkHandled.alreadyHandled, true);
  });

  await t.test('4. Sufficient Stock (2.0 L) >= Demand (0.5 L) -> Zero Shortage Recommendation', async () => {
    const todayStr = new Date().toISOString().split('T')[0];

    // Update Milk stock to 2.0 L (above 0.5L demand and 1.0L minStockLevel)
    await db.update(resourceStock)
      .set({ currentQty: 2.0 })
      .where(eq(resourceStock.id, `stock-${userA.id}-inv-2`));

    // Remove active cart item
    await db.delete(cartItems).where(eq(cartItems.id, `cart-${userA.id}-milk`));

    const plan = await generateDeterministicPlan(db, userA.id, todayStr, 7);

    const milkBuy = plan.today.buyToday.find((b) => b.resourceId === 'inv-2');
    assert.equal(milkBuy, undefined, 'Milk must NOT be recommended when stock (2.0 L) fully covers demand (0.5 L)');
  });

  await t.test('5. Read-Only Safety & Financial Integrity Verification', async () => {
    const todayStr = new Date().toISOString().split('T')[0];

    const stockBefore = await db.select().from(resourceStock).where(eq(resourceStock.userId, userA.id));
    const txsBefore = await db.select().from(financialTransactions).where(eq(financialTransactions.userId, userA.id));

    await generateDeterministicPlan(db, userA.id, todayStr, 7);

    const stockAfter = await db.select().from(resourceStock).where(eq(resourceStock.userId, userA.id));
    const txsAfter = await db.select().from(financialTransactions).where(eq(financialTransactions.userId, userA.id));

    assert.equal(stockBefore.length, stockAfter.length, 'Planning Engine must not mutate resource_stock');
    assert.equal(txsBefore.length, txsAfter.length, 'Planning Engine must not create financial transactions');
  });
});
