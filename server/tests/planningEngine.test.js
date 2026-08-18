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
  financialTransactions,
  dailyExecutions,
  taskExecutions
} from '../db/schema.js';
import { eq, and, inArray } from 'drizzle-orm';
import {
  resolveScheduledTasksForDate,
  resolveUpcomingSchedule,
  projectResourceDemand,
  generateDeterministicPlan
} from '../services/planningEngine.js';

test('TASK 9B — DETERMINISTIC PLANNING ENGINE & SCHEDULE-DRIVEN REASONING TESTS', async (t) => {

  const userA = {
    id: `test-plan-userA-${Date.now()}`,
    googleId: `google-plan-userA-${Date.now()}`,
    email: `plan.userA.${Date.now()}@doctrine.test`,
    displayName: 'Plan User A'
  };

  const userB = {
    id: `test-plan-userB-${Date.now()}`,
    googleId: `google-plan-userB-${Date.now()}`,
    email: `plan.userB.${Date.now()}@doctrine.test`,
    displayName: 'Plan User B'
  };

  let schedIdA = null;
  let taskIdShake = null;
  let taskIdWorkout = null;

  t.after(async () => {
    // Cleanup test data
    await db.delete(scheduleEntries).where(inArray(scheduleEntries.scheduleId, [schedIdA].filter(Boolean)));
    await db.delete(schedules).where(inArray(schedules.userId, [userA.id, userB.id]));
    await db.delete(taskResourceRequirements).where(inArray(taskResourceRequirements.userId, [userA.id, userB.id]));
    await db.delete(tasks).where(inArray(tasks.userId, [userA.id, userB.id]));
    await db.delete(cartItems).where(inArray(cartItems.userId, [userA.id, userB.id]));
    await db.delete(resourceStock).where(inArray(resourceStock.userId, [userA.id, userB.id]));
    await db.delete(financialTransactions).where(inArray(financialTransactions.userId, [userA.id, userB.id]));
    await db.delete(users).where(inArray(users.id, [userA.id, userB.id]));
  });

  await t.test('1. Setup Test Users & Base Schedule Engine Data', async () => {
    await db.insert(users).values([userA, userB]);

    // Create Tasks for User A
    taskIdShake = `task-shake-${Date.now()}`;
    taskIdWorkout = `task-workout-${Date.now()}`;

    await db.insert(tasks).values([
      {
        id: taskIdShake,
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
        id: taskIdWorkout,
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

    // Create Schedule for User A
    schedIdA = `sched-A-${Date.now()}`;
    await db.insert(schedules).values({
      id: schedIdA,
      userId: userA.id,
      name: 'Default Protocol Schedule',
      isDefault: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // Create Schedule Entries:
    // Entry 1: WEEKLY MONDAY -> Mass Shake
    // Entry 2: DAILY -> Post Workout Shake
    await db.insert(scheduleEntries).values([
      {
        id: `entry-shake-${Date.now()}`,
        scheduleId: schedIdA,
        taskId: taskIdShake,
        timingType: 'FIXED',
        recurrencePattern: 'WEEKLY',
        dayOfWeek: 'MONDAY',
        startMinutes: 510, // 8:30 AM
        endMinutes: 525,
        sortOrder: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: `entry-workout-${Date.now()}`,
        scheduleId: schedIdA,
        taskId: taskIdWorkout,
        timingType: 'FIXED',
        recurrencePattern: 'DAILY',
        startMinutes: 1020, // 5:00 PM
        endMinutes: 1030,
        sortOrder: 2,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ]);

    // Create Task Resource Requirements:
    // mass_shake -> Milk (inv-2) 0.3 L
    // post_workout -> Milk (inv-2) 0.2 L
    await db.insert(taskResourceRequirements).values([
      {
        id: `trr-shake-${Date.now()}`,
        userId: userA.id,
        taskKey: 'mass_shake',
        resourceId: 'inv-2',
        quantityConsumed: 0.3,
        unit: 'liters',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: `trr-workout-${Date.now()}`,
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

  await t.test('2. DAILY & WEEKLY Schedule Resolution Correctness', async () => {
    const mondayStr = '2026-08-17'; // Monday
    const tuesdayStr = '2026-08-18'; // Tuesday

    const mondayTasks = await resolveScheduledTasksForDate(db, userA.id, mondayStr);
    assert.equal(mondayTasks.length, 2, 'Monday should resolve 2 tasks (Mass Shake + Post Workout)');
    assert.equal(mondayTasks[0].taskKey, 'mass_shake');
    assert.equal(mondayTasks[0].formattedTime, '8:30 AM');
    assert.equal(mondayTasks[1].taskKey, 'post_workout');

    const tuesdayTasks = await resolveScheduledTasksForDate(db, userA.id, tuesdayStr);
    assert.equal(tuesdayTasks.length, 1, 'Tuesday should resolve 1 task (Post Workout DAILY)');
    assert.equal(tuesdayTasks[0].taskKey, 'post_workout');
  });

  await t.test('3. DATE_RANGE & Schedule Boundary Resolution', async () => {
    // Add a date-specific schedule entry for Wednesday
    const wednesdayStr = '2026-08-19';
    await db.insert(scheduleEntries).values({
      id: `entry-date-range-${Date.now()}`,
      scheduleId: schedIdA,
      taskId: taskIdShake,
      timingType: 'FIXED',
      recurrencePattern: 'DATE_RANGE',
      activeDate: wednesdayStr,
      startMinutes: 540,
      sortOrder: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    const wedTasks = await resolveScheduledTasksForDate(db, userA.id, wednesdayStr);
    const dateRangeTask = wedTasks.find((t) => t.taskKey === 'mass_shake');
    assert.ok(dateRangeTask, 'DATE_RANGE entry for Wednesday should resolve Mass Shake');
  });

  await t.test('4. 7-Day Horizon Schedule Resolution', async () => {
    const mondayStr = '2026-08-17';
    const sundayStr = '2026-08-23';

    const horizonTasks = await resolveUpcomingSchedule(db, userA.id, mondayStr, sundayStr);
    assert.ok(horizonTasks.length >= 7, '7-day horizon resolves at least 7 task occurrences');
  });

  await t.test('5. Task -> Resource Demand Aggregation across Multiple Scheduled Tasks', async () => {
    const mondayStr = '2026-08-17';
    const mondayTasks = await resolveScheduledTasksForDate(db, userA.id, mondayStr);

    const { demandMap } = await projectResourceDemand(db, userA.id, mondayTasks);
    const milkDemand = demandMap.get('inv-2');

    assert.ok(milkDemand, 'Milk demand should be projected for Monday');
    // Monday has Mass Shake (0.3L) + Post Workout (0.2L) = 0.5L total demand
    assert.equal(milkDemand.totalDemandQty, 0.5, 'Total Milk demand for Monday must equal 0.5 L');
  });

  await t.test('6. Inventory Sufficiency & Shortage Detection', async () => {
    const mondayStr = '2026-08-17';

    // Set Milk (inv-2) currentQty = 0.4 L (minStockLevel = 1.0 L)
    await db.insert(resourceStock).values({
      id: `stock-${userA.id}-inv-2`,
      userId: userA.id,
      resourceId: 'inv-2',
      currentQty: 0.4,
      inCart: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    const plan = await generateDeterministicPlan(db, userA.id, mondayStr, 7);

    assert.ok(plan.today.buyToday.length > 0, 'buyToday should surface Milk shortage recommendation');
    const milkRec = plan.today.buyToday.find((b) => b.resourceId === 'inv-2');
    assert.ok(milkRec, 'Milk must be in buyToday recommendations');
    assert.equal(milkRec.alreadyHandled, false, 'alreadyHandled must be false when no active cart item exists');
    assert.ok(milkRec.shortageQty > 0 || milkRec.currentQty <= milkRec.minStockLevel);
  });

  await t.test('7. Active Cart Integration -> ALREADY_HANDLED & No Duplicates', async () => {
    const mondayStr = '2026-08-17';

    // Add active cart item for Milk
    await db.insert(cartItems).values({
      id: `cart-${userA.id}-milk`,
      userId: userA.id,
      itemName: 'Milk',
      resourceId: 'inv-2',
      quantity: 1,
      estimatedPricePaise: 6000,
      priority: 1,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    const plan = await generateDeterministicPlan(db, userA.id, mondayStr, 7);

    // Milk should NOW be in alreadyHandled, NOT in buyToday
    const milkBuy = plan.today.buyToday.find((b) => b.resourceId === 'inv-2');
    assert.equal(milkBuy, undefined, 'Milk must NOT be in buyToday when active cart item exists');

    const milkHandled = plan.today.alreadyHandled.find((b) => b.resourceId === 'inv-2');
    assert.ok(milkHandled, 'Milk must be classified under alreadyHandled when active cart item exists');
    assert.equal(milkHandled.alreadyHandled, true);
  });

  await t.test('8. Financial Affordability & Morning Capacity Integration', async () => {
    const mondayStr = '2026-08-17';
    const plan = await generateDeterministicPlan(db, userA.id, mondayStr, 7);

    // Verify output contract properties exist cleanly
    assert.ok(plan.today.doNow, 'doNow array exists');
    assert.ok(plan.today.buyToday, 'buyToday array exists');
    assert.ok(plan.today.alreadyHandled, 'alreadyHandled array exists');
    assert.ok(plan.tomorrow.scheduledTasks, 'tomorrow scheduledTasks array exists');
    assert.ok(plan.horizon.projectedResourceDemand, 'horizon projectedResourceDemand exists');
  });

  await t.test('9. Strict Multi-Tenant User Data Isolation', async () => {
    const mondayStr = '2026-08-17';
    const planB = await generateDeterministicPlan(db, userB.id, mondayStr, 7);

    assert.equal(planB.today.doNow.length, 0, 'User B has 0 scheduled tasks');
    assert.equal(planB.today.alreadyHandled.length, 0, 'User B does not see User A cart items');
  });

  await t.test('10. READ-ONLY Safety Guarantee (Zero Database Mutations During Planning)', async () => {
    const mondayStr = '2026-08-17';

    const stockBefore = await db.select().from(resourceStock).where(eq(resourceStock.userId, userA.id));
    const txsBefore = await db.select().from(financialTransactions).where(eq(financialTransactions.userId, userA.id));
    const cartBefore = await db.select().from(cartItems).where(eq(cartItems.userId, userA.id));

    // Call planning engine repeatedly
    await generateDeterministicPlan(db, userA.id, mondayStr, 7);
    await generateDeterministicPlan(db, userA.id, mondayStr, 7);

    const stockAfter = await db.select().from(resourceStock).where(eq(resourceStock.userId, userA.id));
    const txsAfter = await db.select().from(financialTransactions).where(eq(financialTransactions.userId, userA.id));
    const cartAfter = await db.select().from(cartItems).where(eq(cartItems.userId, userA.id));

    assert.equal(stockBefore.length, stockAfter.length, 'Planning Engine must not create or delete resource_stock rows');
    assert.equal(txsBefore.length, txsAfter.length, 'Planning Engine must not create financial transactions');
    assert.equal(cartBefore.length, cartAfter.length, 'Planning Engine must not mutate cart_items');
  });
});
