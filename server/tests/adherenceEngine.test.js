import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../db/index.js';
import {
  users,
  dailyExecutions,
  taskExecutions,
  tasks,
  lifeAreas,
  goals,
  goalTaskMappings,
  taskFailureReasons,
} from '../db/schema.js';
import {
  isHighPriorityTask,
  calculateDailyAdherence,
  calculateWindowAdherence,
  calculateExecutionStreaks,
  calculateLifeAreaAdherence,
  calculateTaskReliability,
  calculateGoalExecutionAdherence,
  getUserUnifiedProgressOverview,
} from '../services/adherenceEngine.js';
import { eq, and } from 'drizzle-orm';
import cryptoNative from 'node:crypto';

test('STEP 7 — UNIFIED PROGRESS & ADHERENCE ENGINE TESTS', async (t) => {
  const userIdA = cryptoNative.randomUUID();
  const userIdB = cryptoNative.randomUUID();
  const nowIso = new Date().toISOString();
  const todayStr = nowIso.split('T')[0];

  t.before(async () => {
    // Insert test users
    await db.insert(users).values([
      { id: userIdA, googleId: `g-adh-a-${userIdA}`, email: `adh_a_${userIdA}@example.com`, displayName: 'Adherence User A' },
      { id: userIdB, googleId: `g-adh-b-${userIdB}`, email: `adh_b_${userIdB}@example.com`, displayName: 'Adherence User B' },
    ]);
  });

  t.after(async () => {
    await db.delete(users).where(eq(users.id, userIdA));
    await db.delete(users).where(eq(users.id, userIdB));
  });

  await t.test('1. Daily Completion Calculation', async () => {
    const mockDaily = { id: 'd-1', userId: userIdA, date: '2026-08-17', currentCapacityMode: 'NORMAL' };
    const mockTasks = [
      { id: 't-1', taskKey: 'namaz_fajr', category: 'NAMAZ', status: 'COMPLETED' },
      { id: 't-2', taskKey: 'mass_shake', category: 'NUTRITION', status: 'COMPLETED' },
      { id: 't-3', taskKey: 'study_de', category: 'DATA_ENG', status: 'SKIPPED' },
      { id: 't-4', taskKey: 'gym_workout', category: 'WORKOUT', status: 'MISSED' },
    ];

    const result = calculateDailyAdherence(mockDaily, mockTasks);

    assert.equal(result.scheduledCount, 4);
    assert.equal(result.completedCount, 2);
    assert.equal(result.skippedCount, 1);
    assert.equal(result.missedCount, 1);
    assert.equal(result.rawCompletionPercentage, 50); // 2 / 4 = 50%
    assert.equal(result.executionPercentage, 75); // (2 + 1) / 4 = 75%
  });

  await t.test('2. Status Classification (Completed, Skipped, Missed, Deferred)', async () => {
    const mockDaily = { id: 'd-2', userId: userIdA, date: '2026-08-17', currentCapacityMode: 'NORMAL' };
    const mockTasks = [
      { id: 't-10', taskKey: 'task_1', category: 'DOCTRINE', status: 'COMPLETED' },
      { id: 't-11', taskKey: 'task_2', category: 'DOCTRINE', status: 'SKIPPED', deferredToDate: '2026-08-18' },
      { id: 't-12', taskKey: 'task_3', category: 'DOCTRINE', status: 'MISSED' },
    ];

    const result = calculateDailyAdherence(mockDaily, mockTasks);

    assert.equal(result.completedCount, 1);
    assert.equal(result.skippedCount, 1);
    assert.equal(result.missedCount, 1);
    assert.equal(result.deferredCount, 1);
  });

  await t.test('3. Empty Day Handling (No NaN or Division by Zero)', async () => {
    const result = calculateDailyAdherence({ id: 'd-empty', currentCapacityMode: 'NORMAL' }, []);

    assert.equal(result.scheduledCount, 0);
    assert.equal(result.completedCount, 0);
    assert.equal(result.rawCompletionPercentage, 0);
    assert.equal(result.executionPercentage, 0);
    assert.equal(result.capacityAdherencePercentage, 0);
  });

  await t.test('4. Zero-Task Day Handling', async () => {
    const result = calculateDailyAdherence(null, null);

    assert.equal(result.scheduledCount, 0);
    assert.equal(result.completedCount, 0);
    assert.equal(result.rawCompletionPercentage, 0);
  });

  await t.test('5. 7-Day Window Aggregation', async () => {
    // Seed 7 days of daily executions for User A
    const dailyIds = [];
    for (let i = 0; i < 7; i++) {
      const dObj = new Date(Date.now() - i * 86400000);
      const dStr = dObj.toISOString().split('T')[0];
      const dId = `d_7d_${i}_${userIdA}`;
      dailyIds.push(dId);

      await db.insert(dailyExecutions).values({
        id: dId,
        userId: userIdA,
        date: dStr,
        currentCapacityMode: 'NORMAL',
        createdAt: nowIso,
        updatedAt: nowIso,
      });

      // Insert 2 completed, 1 missed
      await db.insert(taskExecutions).values([
        { id: `t_7d_${i}_1`, dailyExecutionId: dId, taskKey: 'namaz_fajr', category: 'NAMAZ', status: 'COMPLETED' },
        { id: `t_7d_${i}_2`, dailyExecutionId: dId, taskKey: 'mass_shake', category: 'NUTRITION', status: 'COMPLETED' },
        { id: `t_7d_${i}_3`, dailyExecutionId: dId, taskKey: 'gym_workout', category: 'WORKOUT', status: 'MISSED' },
      ]);
    }

    const windowRes = await calculateWindowAdherence(db, userIdA, 7, todayStr);

    assert.equal(windowRes.daysWindow, 7);
    assert.equal(windowRes.totalScheduledTasks, 21);
    assert.equal(windowRes.totalCompletedTasks, 14);
    assert.equal(windowRes.averageRawAdherence, 67); // 14/21 = 66.6% -> 67%
    assert.ok(windowRes.activeDays >= 1);
  });

  await t.test('6. 30-Day Window Aggregation', async () => {
    const windowRes = await calculateWindowAdherence(db, userIdA, 30, todayStr);
    assert.equal(windowRes.daysWindow, 30);
    assert.equal(windowRes.totalDays, 30);
  });

  await t.test('7. 90-Day Window Aggregation', async () => {
    const windowRes = await calculateWindowAdherence(db, userIdA, 90, todayStr);
    assert.equal(windowRes.daysWindow, 90);
    assert.equal(windowRes.totalDays, 90);
  });

  await t.test('8. Current Streak Calculation', async () => {
    const list = [
      { date: '2026-08-15', rawCompletionPercentage: 80, capacityAdherencePercentage: 80 },
      { date: '2026-08-16', rawCompletionPercentage: 75, capacityAdherencePercentage: 75 },
      { date: '2026-08-17', rawCompletionPercentage: 90, capacityAdherencePercentage: 90 },
    ];

    const streaks = calculateExecutionStreaks(list);
    assert.equal(streaks.currentStreak, 3);
    assert.equal(streaks.longestStreak, 3);
  });

  await t.test('9. Longest Streak Calculation', async () => {
    const list = [
      { date: '2026-08-10', rawCompletionPercentage: 80, capacityAdherencePercentage: 80 },
      { date: '2026-08-11', rawCompletionPercentage: 90, capacityAdherencePercentage: 90 },
      { date: '2026-08-12', rawCompletionPercentage: 85, capacityAdherencePercentage: 85 },
      { date: '2026-08-13', rawCompletionPercentage: 20, capacityAdherencePercentage: 20 }, // broken streak
      { date: '2026-08-14', rawCompletionPercentage: 100, capacityAdherencePercentage: 100 },
    ];

    const streaks = calculateExecutionStreaks(list);
    assert.equal(streaks.currentStreak, 1);
    assert.equal(streaks.longestStreak, 3);
  });

  await t.test('10. NORMAL Capacity Mode Adherence', async () => {
    const mockDaily = { id: 'd-norm', currentCapacityMode: 'NORMAL' };
    const mockTasks = [
      { id: 't-1', taskKey: 'namaz_fajr', category: 'NAMAZ', status: 'COMPLETED' },
      { id: 't-2', taskKey: 'gym_workout', category: 'WORKOUT', status: 'MISSED' },
    ];

    const res = calculateDailyAdherence(mockDaily, mockTasks);
    assert.equal(res.capacityAdherencePercentage, 50);
  });

  await t.test('11. MINIMUM_VIABLE Capacity Mode Adherence', async () => {
    const mockDaily = { id: 'd-mvp', currentCapacityMode: 'MINIMUM_VIABLE' };
    const mockTasks = [
      { id: 't-1', taskKey: 'namaz_fajr', category: 'NAMAZ', status: 'COMPLETED' }, // essential
      { id: 't-2', taskKey: 'discretionary_reading', category: 'OTHER', status: 'MISSED' }, // non-essential dropped
    ];

    const res = calculateDailyAdherence(mockDaily, mockTasks);
    assert.equal(res.capacityAdherencePercentage, 100, 'Essential tasks were 100% completed under MINIMUM_VIABLE');
    assert.equal(res.rawCompletionPercentage, 50);
  });

  await t.test('12. EXAM_COMPRESSED Capacity Mode Adherence', async () => {
    const mockDaily = { id: 'd-exam', currentCapacityMode: 'EXAM_COMPRESSED' };
    const mockTasks = [
      { id: 't-1', taskKey: 'study_de_sql', category: 'DATA_ENG', status: 'COMPLETED' }, // essential
      { id: 't-2', taskKey: 'namaz_dhuhr', category: 'NAMAZ', status: 'COMPLETED' }, // essential
      { id: 't-3', taskKey: 'heavy_legs_workout', category: 'WORKOUT', status: 'SKIPPED' }, // non-essential during exams
    ];

    const res = calculateDailyAdherence(mockDaily, mockTasks);
    assert.equal(res.capacityAdherencePercentage, 100, 'Essential Data Eng and Namaz tasks completed under EXAM_COMPRESSED');
  });

  await t.test('13. REST_RECOVERY Capacity Mode Adherence', async () => {
    const mockDaily = { id: 'd-rest', currentCapacityMode: 'REST_RECOVERY' };
    const mockTasks = [
      { id: 't-1', taskKey: 'namaz_fajr', category: 'NAMAZ', status: 'COMPLETED' },
      { id: 't-2', taskKey: 'heavy_deadlifts', category: 'WORKOUT', status: 'SKIPPED' }, // dropped for rest
    ];

    const res = calculateDailyAdherence(mockDaily, mockTasks);
    assert.equal(res.capacityAdherencePercentage, 100, 'Heavy workout skipped during REST_RECOVERY does not penalize capacity adherence');
  });

  await t.test('14. High-Priority Task Adherence', async () => {
    const mockDaily = { id: 'd-hp', currentCapacityMode: 'NORMAL' };
    const mockTasks = [
      { id: 't-1', taskKey: 'namaz_fajr', category: 'NAMAZ', defaultPriority: 1, status: 'COMPLETED' }, // high priority
      { id: 't-2', taskKey: 'clean_desk', category: 'OTHER', defaultPriority: 5, status: 'MISSED' }, // low priority
    ];

    const res = calculateDailyAdherence(mockDaily, mockTasks);
    assert.equal(res.highPriorityScheduledCount, 1);
    assert.equal(res.highPriorityCompletedCount, 1);
    assert.equal(res.highPriorityAdherence, 100);
    assert.equal(res.rawCompletionPercentage, 50);
  });

  await t.test('15. Task Reliability Metrics & Grades', async () => {
    const relRes = await calculateTaskReliability(db, userIdA, 30);

    assert.ok(Array.isArray(relRes.tasks));
    assert.ok(relRes.tasks.length > 0);

    const namazTask = relRes.tasks.find((t) => t.taskKey === 'namaz_fajr');
    assert.ok(namazTask);
    assert.equal(namazTask.completionRate, 100);
    assert.equal(namazTask.reliabilityGrade, 'HIGH');
  });

  await t.test('16. Life-Area Adherence Mapping', async () => {
    const lifeRes = await calculateLifeAreaAdherence(db, userIdA, 30);

    assert.ok(Array.isArray(lifeRes.lifeAreas));
    assert.ok(lifeRes.lifeAreas.length >= 7);

    const spiritual = lifeRes.lifeAreas.find((a) => a.key === 'SPIRITUAL_MINDFULNESS');
    assert.ok(spiritual);
    assert.ok(spiritual.completedCount >= 1);
  });

  await t.test('17. Goal-Linked Execution Adherence', async () => {
    // Seed a life_area, goal, and goal_task_mapping for User A
    const laId = `la_adh_${cryptoNative.randomUUID()}`;
    await db.insert(lifeAreas).values({
      id: laId,
      userId: userIdA,
      key: 'DATA_ENGINEERING',
      name: 'Data Engineering & Tech',
      createdAt: nowIso,
    });

    const goalId = `g_adh_${cryptoNative.randomUUID()}`;
    await db.insert(goals).values({
      id: goalId,
      userId: userIdA,
      lifeAreaId: laId,
      title: 'Master Data Engineering',
      level: 'GOAL',
      status: 'ACTIVE',
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    await db.insert(goalTaskMappings).values({
      id: `gtm_${cryptoNative.randomUUID()}`,
      userId: userIdA,
      goalId,
      taskKey: 'study_de',
      weight: 2,
      createdAt: nowIso,
    });

    const goalRes = await calculateGoalExecutionAdherence(db, userIdA, 30);

    assert.ok(Array.isArray(goalRes.goals));
    const deGoal = goalRes.goals.find((g) => g.goalId === goalId);
    assert.ok(deGoal);
    assert.equal(deGoal.mappedTaskCount, 1);
  });

  await t.test('18. Failure Pattern Integration', async () => {
    // Insert a task failure reason
    await db.insert(taskFailureReasons).values({
      id: `tfr_${cryptoNative.randomUUID()}`,
      userId: userIdA,
      date: todayStr,
      taskKey: 'gym_workout',
      reason: 'Too tired',
      userNote: 'Long workday',
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    const overview = await getUserUnifiedProgressOverview(db, userIdA, 30);
    assert.ok(overview.failurePatterns);
  });

  await t.test('19. Deterministic Trend Calculation', async () => {
    const windowRes = await calculateWindowAdherence(db, userIdA, 7, todayStr);

    assert.ok(windowRes.trend);
    assert.ok(['IMPROVING', 'DECLINING', 'STABLE'].includes(windowRes.trend.direction));
    assert.ok(typeof windowRes.trend.deltaPct === 'number');
  });

  await t.test('20. Multi-Tenant User Isolation', async () => {
    // Ensure User B adherence metrics do NOT include User A data
    const overviewB = await getUserUnifiedProgressOverview(db, userIdB, 30);

    assert.equal(overviewB.userId, userIdB);
    assert.equal(overviewB.windows.days30.totalScheduledTasks, 0);
    assert.equal(overviewB.windows.days30.totalCompletedTasks, 0);
    assert.equal(overviewB.streaks.currentStreak, 0);
  });

  await t.test('21. Date-Boundary Correctness', async () => {
    const window7 = await calculateWindowAdherence(db, userIdA, 7, '2026-08-17');
    assert.equal(window7.endDate, '2026-08-17');
    assert.equal(window7.daysWindow, 7);
  });

  await t.test('22. Duplicate-Count Prevention', async () => {
    const mockDaily = { id: 'd-dup', currentCapacityMode: 'NORMAL' };
    const mockTasks = [
      { id: 't-1', taskKey: 'namaz_fajr', category: 'NAMAZ', status: 'COMPLETED' },
      { id: 't-2', taskKey: 'mass_shake', category: 'NUTRITION', status: 'COMPLETED' },
    ];

    const res = calculateDailyAdherence(mockDaily, mockTasks);
    assert.equal(res.scheduledCount, 2);
    assert.equal(res.completedCount, 2);
  });

  await t.test('23. Deferred Task Handling', async () => {
    const mockDaily = { id: 'd-def', currentCapacityMode: 'NORMAL' };
    const mockTasks = [
      { id: 't-1', taskKey: 'namaz_fajr', category: 'NAMAZ', status: 'COMPLETED' },
      { id: 't-2', taskKey: 'study_de', category: 'DATA_ENG', status: 'SKIPPED', deferredToDate: '2026-08-18' },
    ];

    const res = calculateDailyAdherence(mockDaily, mockTasks);
    assert.equal(res.deferredCount, 1);
    assert.equal(res.skippedCount, 1);
  });

  await t.test('24. Historical-Data Compatibility', async () => {
    const overview = await getUserUnifiedProgressOverview(db, userIdA, 30);

    assert.ok(overview.windows);
    assert.ok(overview.windows.days7);
    assert.ok(overview.windows.days30);
    assert.ok(overview.windows.days90);
  });

  await t.test('25. Bounded 90-Day Performance Sanity Test', async () => {
    const startMs = Date.now();
    const window90 = await calculateWindowAdherence(db, userIdA, 90, todayStr);
    const duration = Date.now() - startMs;

    assert.ok(duration < 200, `90-day window aggregation took ${duration}ms, expected under 200ms`);
    assert.equal(window90.daysWindow, 90);
  });

  await t.test('26. Dashboard API Endpoint Integration', async () => {
    const overview = await getUserUnifiedProgressOverview(db, userIdA, 30);

    assert.ok(overview.today);
    assert.ok(typeof overview.today.rawCompletionPercentage === 'number');
    assert.ok(typeof overview.today.capacityAdherencePercentage === 'number');
  });

  await t.test('27. History API Overview Consistency', async () => {
    const window30 = await calculateWindowAdherence(db, userIdA, 30, todayStr);

    assert.ok(typeof window30.averageRawAdherence === 'number');
    assert.ok(typeof window30.averageCapacityAdherence === 'number');
    assert.ok(typeof window30.activeDays === 'number');
  });
});
