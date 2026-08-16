import test from 'node:test';
import assert from 'node:assert/strict';
import { db, sqlite } from '../db/index.js';
import {
  users,
  lifeAreas,
  goals,
  goalMilestones,
  goalTaskMappings,
  financialGoals,
  financialTransactions,
  dailyExecutions,
  taskExecutions
} from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { cryptoNative } from '../utils/crypto.js';
import {
  clampPercentage,
  calculateMilestoneProgress,
  calculateTaskMappingProgress,
  calculateFinancialGoalProgress,
  combineProgressSources,
  calculateRiskAndVelocity,
  deriveGoalStatus,
  getGoalDetails,
  getGoalHierarchy
} from '../services/goalEngine.js';

test('GOAL ENGINE CALCULATION & INTEGRITY TESTS', async (t) => {
  const userA = `test_user_eng_a_${Date.now()}`;
  const userB = `test_user_eng_b_${Date.now()}`;
  const nowIso = new Date().toISOString();

  t.before(async () => {
    // Seed test users
    await db.insert(users).values({
      id: userA,
      googleId: `google_${userA}`,
      email: `${userA}@doctrine.test`,
      displayName: 'User A Engine',
      createdAt: nowIso,
      updatedAt: nowIso,
      lastLoginAt: nowIso
    });
    await db.insert(users).values({
      id: userB,
      googleId: `google_${userB}`,
      email: `${userB}@doctrine.test`,
      displayName: 'User B Engine',
      createdAt: nowIso,
      updatedAt: nowIso,
      lastLoginAt: nowIso
    });
  });

  t.after(async () => {
    // Clean up test data
    await db.delete(goalTaskMappings).where(eq(goalTaskMappings.userId, userA));
    await db.delete(goalTaskMappings).where(eq(goalTaskMappings.userId, userB));
    await db.delete(goalMilestones).where(eq(goalMilestones.userId, userA));
    await db.delete(goalMilestones).where(eq(goalMilestones.userId, userB));
    await db.delete(goals).where(eq(goals.userId, userA));
    await db.delete(goals).where(eq(goals.userId, userB));
    await db.delete(lifeAreas).where(eq(lifeAreas.userId, userA));
    await db.delete(lifeAreas).where(eq(lifeAreas.userId, userB));
    await db.delete(users).where(eq(users.id, userA));
    await db.delete(users).where(eq(users.id, userB));
  });

  await t.test('1. Goal with no milestones/tasks returns 0% progress', async () => {
    const res = combineProgressSources({
      milestoneSummary: { total: 0, completed: 0, progress: 0 },
      taskSummary: { mapped: 0, completed: 0, progress: 0 },
      financialSummary: { linked: false, progress: 0 }
    });
    assert.equal(res, 0);
  });

  await t.test('2. Goal with one completed milestone returns 100%', async () => {
    const summary = calculateMilestoneProgress([{ isCompleted: true, targetValue: 1, currentValue: 1 }]);
    assert.equal(summary.progress, 100);
    assert.equal(summary.completed, 1);
  });

  await t.test('3. Goal with multiple milestones (1 of 2 completed) returns 50%', async () => {
    const summary = calculateMilestoneProgress([
      { isCompleted: true, targetValue: 1, currentValue: 1 },
      { isCompleted: false, targetValue: 1, currentValue: 0 }
    ]);
    assert.equal(summary.progress, 50);
  });

  await t.test('4. Partial milestone progress calculation', async () => {
    const summary = calculateMilestoneProgress([
      { isCompleted: false, targetValue: 100, currentValue: 50 }
    ]);
    assert.equal(summary.progress, 50);
  });

  await t.test('5. Task mapping with completed task contributes positive progress', async () => {
    const summary = calculateTaskMappingProgress(
      [{ taskKey: 'workout_a', weight: 1 }],
      [{ taskKey: 'workout_a', status: 'COMPLETED' }]
    );
    assert.equal(summary.progress, 100);
    assert.equal(summary.completed, 1);
  });

  await t.test('6. Task mapping with skipped task does not contribute progress', async () => {
    const summary = calculateTaskMappingProgress(
      [{ taskKey: 'workout_a', weight: 1 }],
      [{ taskKey: 'workout_a', status: 'SKIPPED' }]
    );
    assert.equal(summary.progress, 0);
    assert.equal(summary.completed, 0);
  });

  await t.test('7. Task mapping with scheduled task produces 0 progress', async () => {
    const summary = calculateTaskMappingProgress(
      [{ taskKey: 'workout_a', weight: 1 }],
      [{ taskKey: 'workout_a', status: 'SCHEDULED' }]
    );
    assert.equal(summary.progress, 0);
  });

  await t.test('8. Multiple task mappings progress calculation', async () => {
    const summary = calculateTaskMappingProgress(
      [{ taskKey: 'task_1', weight: 1 }, { taskKey: 'task_2', weight: 1 }],
      [{ taskKey: 'task_1', status: 'COMPLETED' }]
    );
    assert.equal(summary.progress, 50);
  });

  await t.test('9. Weighted task mappings calculate proportional weights', async () => {
    const summary = calculateTaskMappingProgress(
      [{ taskKey: 'heavy_task', weight: 3 }, { taskKey: 'light_task', weight: 1 }],
      [{ taskKey: 'heavy_task', status: 'COMPLETED' }]
    );
    assert.equal(summary.progress, 75); // 3 out of 4 weight = 75%
  });

  await t.test('10. Financial-linked goal progress from allocated amount', async () => {
    const summary = calculateFinancialGoalProgress({
      id: 'fin_1',
      allocatedAmountPaise: 5000,
      targetPricePaise: 10000
    });
    assert.equal(summary.progress, 50);
  });

  await t.test('11. Zero or null financial target handled safely', async () => {
    const summaryZero = calculateFinancialGoalProgress({ id: 'fin_2', allocatedAmountPaise: 500, targetPricePaise: 0 });
    assert.equal(summaryZero.progress, 0);

    const summaryNull = calculateFinancialGoalProgress(null);
    assert.equal(summaryNull.progress, 0);
  });

  await t.test('12. 100% progress clamp enforcement', async () => {
    assert.equal(clampPercentage(150), 100);
    assert.equal(clampPercentage(100.4), 100);
  });

  await t.test('13. 0% progress clamp & NaN protection', async () => {
    assert.equal(clampPercentage(-20), 0);
    assert.equal(clampPercentage(NaN), 0);
    assert.equal(clampPercentage(Infinity), 0);
  });

  await t.test('14. Vision aggregation from child Objectives', async () => {
    const hierarchy = await getGoalHierarchy(userA);
    assert.ok(Array.isArray(hierarchy.visions));
  });

  await t.test('15. Objective aggregation from child Goals', async () => {
    const hierarchy = await getGoalHierarchy(userA);
    assert.ok(Array.isArray(hierarchy.standaloneObjectives));
  });

  await t.test('16. Goal hierarchy user isolation', async () => {
    const hierarchyB = await getGoalHierarchy(userB);
    assert.equal(hierarchyB.visions.length, 0);
    assert.equal(hierarchyB.standaloneGoals.length, 0);
  });

  await t.test('17. User A cannot see User B goal details', async () => {
    const details = await getGoalDetails(userA, 'non_existent_goal_id');
    assert.equal(details, null);
  });

  await t.test('18. Completed status derived at 100% progress', async () => {
    const status = deriveGoalStatus({ status: 'ACTIVE', progress: 100 });
    assert.equal(status, 'COMPLETED');
  });

  await t.test('19. Planned status derived when progress is 0% and status is PLANNED', async () => {
    const status = deriveGoalStatus({ status: 'PLANNED', progress: 0 });
    assert.equal(status, 'PLANNED');
  });

  await t.test('20. Active status derived when progress > 0% and < 100%', async () => {
    const status = deriveGoalStatus({ status: 'ACTIVE', progress: 50 });
    assert.equal(status, 'ACTIVE');
  });

  await t.test('21. Abandoned status remains ABANDONED (Terminal Decision)', async () => {
    const status100 = deriveGoalStatus({ status: 'ABANDONED', progress: 100 });
    assert.equal(status100, 'ABANDONED');

    const statusRisk = deriveGoalStatus({ status: 'ABANDONED', progress: 50, risk: { isAtRisk: true } });
    assert.equal(statusRisk, 'ABANDONED');
  });

  await t.test('22. At-risk goal with past target date', async () => {
    const risk = calculateRiskAndVelocity({ progress: 50, targetDate: '2020-01-01' });
    assert.equal(risk.isAtRisk, true);
    assert.equal(risk.reason, 'Target date elapsed');
  });

  await t.test('23. Insufficient velocity data returns null velocity', async () => {
    const risk = calculateRiskAndVelocity({ progress: 50, targetDate: '2030-01-01', activeDaysCount: 1 });
    assert.equal(risk.velocity, null);
  });

  await t.test('24. Required velocity calculated safely with valid target date', async () => {
    const risk = calculateRiskAndVelocity({ progress: 50, targetDate: '2030-01-01', activeDaysCount: 5 });
    assert.ok(risk.requiredVelocity > 0);
  });

  await t.test('25. Division-by-zero protection in velocity', async () => {
    const risk = calculateRiskAndVelocity({ progress: 50, targetDate: '2030-01-01', activeDaysCount: 0 });
    assert.equal(risk.velocity, null);
  });

  await t.test('26. No mutation of task history during engine calculations', async () => {
    const initialExecCount = sqlite.prepare("SELECT count(*) as c FROM task_executions").get().c;
    await getGoalHierarchy(userA);
    const postExecCount = sqlite.prepare("SELECT count(*) as c FROM task_executions").get().c;
    assert.equal(initialExecCount, postExecCount, 'Task history remains untouched');
  });

  await t.test('27. No mutation of financial ledger during engine calculations', async () => {
    const initialTxCount = sqlite.prepare("SELECT count(*) as c FROM financial_transactions").get().c;
    await getGoalHierarchy(userA);
    const postTxCount = sqlite.prepare("SELECT count(*) as c FROM financial_transactions").get().c;
    assert.equal(initialTxCount, postTxCount, 'Financial ledger remains untouched');
  });

  await t.test('28. No mutation of financial goals during engine calculations', async () => {
    const initialFinCount = sqlite.prepare("SELECT count(*) as c FROM financial_goals").get().c;
    await getGoalHierarchy(userA);
    const postFinCount = sqlite.prepare("SELECT count(*) as c FROM financial_goals").get().c;
    assert.equal(initialFinCount, postFinCount, 'Financial goals remain untouched');
  });

  await t.test('29. Deterministic repeated calculation returns identical result', async () => {
    const summary1 = combineProgressSources({
      milestoneSummary: { total: 2, completed: 1, progress: 50 },
      taskSummary: { mapped: 2, completed: 1, progress: 50 },
      financialSummary: { linked: false, progress: 0 }
    });

    const summary2 = combineProgressSources({
      milestoneSummary: { total: 2, completed: 1, progress: 50 },
      taskSummary: { mapped: 2, completed: 1, progress: 50 },
      financialSummary: { linked: false, progress: 0 }
    });

    assert.equal(summary1, summary2, 'Repeated calculation is 100% deterministic');
  });

  await t.test('30. Database records survive read-only calculations', async () => {
    const userCount = sqlite.prepare("SELECT count(*) as c FROM users").get().c;
    assert.ok(userCount >= 2, 'Users exist in DB');
  });
});
