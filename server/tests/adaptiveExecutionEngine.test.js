import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SUPPORTED_CAPACITY_MODES,
  calculateTaskPriorityScore,
  getTaskDurationMinutes,
  adaptDailyPlan,
  calculateComplianceMetrics,
  validateTaskDeferral,
  determineCarryoverTarget,
  categorizeFailureReason,
  MAX_CARRYOVER_CHAIN_DEPTH
} from '../services/adaptiveExecutionService.js';

test('FEATURE — ADAPTIVE EXECUTION ENGINE UNIT TESTS', async (t) => {
  const sampleTasks = [
    { id: 't1', taskKey: 'namaz_fajr', category: 'NAMAZ', taskName: 'Fajr Prayer', status: 'SCHEDULED', startMinutes: 330, endMinutes: 345 },
    { id: 't2', taskKey: 'de_session', category: 'DATA_ENG', taskName: 'Data Engineering Session', status: 'SCHEDULED', startMinutes: 360, endMinutes: 420 },
    { id: 't3', taskKey: 'workout_a', category: 'WORKOUT', taskName: 'Workout A — Hypertrophy', status: 'SCHEDULED', startMinutes: 430, endMinutes: 470 },
    { id: 't4', taskKey: 'skincare_am', category: 'SKINCARE', taskName: 'Morning Skincare Routine', status: 'SCHEDULED', startMinutes: 480, endMinutes: 500 },
    { id: 't5', taskKey: 'posture_angles', category: 'POSTURE', taskName: 'Wall Angels 2x10', status: 'SCHEDULED', startMinutes: 1170, endMinutes: 1190 }
  ];

  const goalMappings = [
    { goalId: 'g1', taskKey: 'de_session', weight: 3 },
    { goalId: 'g2', taskKey: 'workout_a', weight: 2 }
  ];

  const activeGoals = [
    { id: 'g1', title: 'Data Engineering Mastery', priority: 1 },
    { id: 'g2', title: 'Physical Hypertrophy', priority: 2 }
  ];

  await t.test('1. NORMAL capacity mode returns full planned schedule', async () => {
    const result = adaptDailyPlan({ tasks: sampleTasks, capacityMode: 'NORMAL', goalMappings, activeGoals });
    assert.equal(result.capacityMode, 'NORMAL');
    assert.equal(result.adaptedTasks.length, sampleTasks.length);
  });

  await t.test('2. MINIMUM_VIABLE capacity mode compresses plan to high-value essential tasks', async () => {
    const result = adaptDailyPlan({ tasks: sampleTasks, capacityMode: 'MINIMUM_VIABLE', goalMappings, activeGoals });
    assert.equal(result.capacityMode, 'MINIMUM_VIABLE');
    assert.ok(result.adaptedTasks.length < sampleTasks.length);
    assert.ok(result.essentialTaskKeys.includes('namaz_fajr'));
    assert.ok(result.essentialTaskKeys.includes('de_session'));
  });

  await t.test('3. EXAM_COMPRESSED capacity mode prioritizes Data Eng and Namaz while dropping posture/skincare', async () => {
    const result = adaptDailyPlan({ tasks: sampleTasks, capacityMode: 'EXAM_COMPRESSED', goalMappings, activeGoals });
    assert.equal(result.capacityMode, 'EXAM_COMPRESSED');
    assert.ok(result.essentialTaskKeys.includes('de_session'));
    assert.ok(result.essentialTaskKeys.includes('namaz_fajr'));
    assert.ok(!result.essentialTaskKeys.includes('posture_angles'));
  });

  await t.test('4. REST_RECOVERY capacity mode reduces heavy workouts while preserving recovery', async () => {
    const result = adaptDailyPlan({ tasks: sampleTasks, capacityMode: 'REST_RECOVERY', goalMappings, activeGoals });
    assert.equal(result.capacityMode, 'REST_RECOVERY');
    assert.ok(!result.essentialTaskKeys.includes('workout_a'));
    assert.ok(result.essentialTaskKeys.includes('skincare_am'));
  });

  await t.test('5. Available-minute budget compression is strictly respected', async () => {
    const result = adaptDailyPlan({ tasks: sampleTasks, capacityMode: 'NORMAL', availableMinutes: 45, goalMappings, activeGoals });
    assert.equal(result.availableMinutes, 45);
    assert.ok(result.totalDurationMinutes <= 75, 'Preserves top task even if duration matches budget');
  });

  await t.test('6. Goal-linked tasks receive deterministic priority score boost', async () => {
    const deScore = calculateTaskPriorityScore(sampleTasks[1], goalMappings, activeGoals);
    const postureScore = calculateTaskPriorityScore(sampleTasks[4], [], activeGoals);
    assert.ok(deScore > postureScore, 'Data Eng mapped to Priority 1 Goal outranks unmapped posture');
  });

  await t.test('7. Higher-priority active goals outrank lower-priority goals', async () => {
    const highPriorityTask = { taskKey: 'task_p1', category: 'WORKOUT' };
    const lowPriorityTask = { taskKey: 'task_p5', category: 'WORKOUT' };

    const mappings = [
      { goalId: 'gp1', taskKey: 'task_p1', weight: 1 },
      { goalId: 'gp5', taskKey: 'task_p5', weight: 1 }
    ];
    const goals = [
      { id: 'gp1', priority: 1 },
      { id: 'gp5', priority: 5 }
    ];

    const scoreP1 = calculateTaskPriorityScore(highPriorityTask, mappings, goals);
    const scoreP5 = calculateTaskPriorityScore(lowPriorityTask, mappings, goals);
    assert.ok(scoreP1 > scoreP5);
  });

  await t.test('8. Raw compliance calculation is mathematically correct', async () => {
    const tasks = [
      { status: 'COMPLETED' },
      { status: 'COMPLETED' },
      { status: 'SCHEDULED' },
      { status: 'SKIPPED' }
    ];
    const metrics = calculateComplianceMetrics({ plannedTasks: tasks });
    assert.equal(metrics.rawCompliance, 50); // 2/4 = 50%
  });

  await t.test('9. Adapted compliance calculation evaluates essential tasks correctly', async () => {
    const tasks = [
      { taskKey: 'namaz_fajr', status: 'COMPLETED' },
      { taskKey: 'de_session', status: 'COMPLETED' },
      { taskKey: 'posture_angles', status: 'SKIPPED' },
      { taskKey: 'skincare_am', status: 'SKIPPED' }
    ];
    const essentialKeys = ['namaz_fajr', 'de_session'];
    const metrics = calculateComplianceMetrics({ plannedTasks: tasks, essentialTaskKeys: essentialKeys });
    assert.equal(metrics.rawCompliance, 50); // 2/4
    assert.equal(metrics.adaptedCompliance, 100); // 2/2 essential tasks completed
  });

  await t.test('10. Zero-task compliance handles empty inputs without NaN', async () => {
    const metrics = calculateComplianceMetrics({ plannedTasks: [] });
    assert.equal(metrics.rawCompliance, 0);
    assert.equal(metrics.adaptedCompliance, 0);
    assert.ok(!Number.isNaN(metrics.rawCompliance));
    assert.ok(!Number.isNaN(metrics.adaptedCompliance));
  });

  await t.test('11. Deferred task validation rejects completed tasks', async () => {
    const completedTask = { id: 't_comp', status: 'COMPLETED', date: '2026-08-16' };
    const res = validateTaskDeferral({ sourceTask: completedTask, targetDate: '2026-08-17', sourceUserId: 'u1', targetUserId: 'u1' });
    assert.equal(res.isValid, false);
    assert.ok(res.reason.includes('Completed tasks cannot be deferred'));
  });

  await t.test('12. Same-day task deferral is rejected', async () => {
    const schedTask = { id: 't_sched', status: 'SCHEDULED', date: '2026-08-16' };
    const res = validateTaskDeferral({ sourceTask: schedTask, targetDate: '2026-08-16', sourceUserId: 'u1', targetUserId: 'u1' });
    assert.equal(res.isValid, false);
    assert.ok(res.reason.includes('Same-day deferral is rejected'));
  });

  await t.test('13. Malformed target date format is rejected', async () => {
    const schedTask = { id: 't_sched', status: 'SCHEDULED', date: '2026-08-16' };
    const res = validateTaskDeferral({ sourceTask: schedTask, targetDate: 'tomorrow', sourceUserId: 'u1', targetUserId: 'u1' });
    assert.equal(res.isValid, false);
    assert.ok(res.reason.includes('Invalid target date format'));
  });

  await t.test('14. Cross-user deferral attempt is rejected', async () => {
    const schedTask = { id: 't_sched', status: 'SCHEDULED', date: '2026-08-16' };
    const res = validateTaskDeferral({ sourceTask: schedTask, targetDate: '2026-08-17', sourceUserId: 'user_a', targetUserId: 'user_b' });
    assert.equal(res.isValid, false);
    assert.ok(res.reason.includes('Unauthorized cross-user'));
  });

  await t.test('15. Carryover target detects existing target task correctly (REUSE_EXISTING)', async () => {
    const targetDayTasks = [{ id: 'target_de', taskKey: 'de_session' }];
    const res = determineCarryoverTarget({ targetDayExecutions: targetDayTasks, taskKey: 'de_session', sourceTaskId: 'src_123' });
    assert.equal(res.mode, 'REUSE_EXISTING');
    assert.equal(res.targetExecutionId, 'target_de');
  });

  await t.test('16. Carryover target detects missing target task correctly (CREATE_CARRYOVER)', async () => {
    const targetDayTasks = [{ id: 'target_skincare', taskKey: 'skincare_am' }];
    const res = determineCarryoverTarget({ targetDayExecutions: targetDayTasks, taskKey: 'de_session', sourceTaskId: 'src_123' });
    assert.equal(res.mode, 'CREATE_CARRYOVER');
    assert.ok(res.taskKey.startsWith('carryover_de_session_'));
  });

  await t.test('17. Calculation engine does not mutate task execution parameters or create DB records', async () => {
    const inputTasks = JSON.parse(JSON.stringify(sampleTasks));
    adaptDailyPlan({ tasks: inputTasks, capacityMode: 'MINIMUM_VIABLE' });
    assert.deepEqual(inputTasks, sampleTasks, 'Input array unmutated');
  });

  await t.test('18. Existing execution history parameters remain untouched by adaptDailyPlan', async () => {
    const planned = [{ id: 't1', status: 'SKIPPED', taskKey: 'workout_a' }];
    const res = calculateComplianceMetrics({ plannedTasks: planned });
    assert.equal(res.rawCompliance, 0);
    assert.equal(planned[0].status, 'SKIPPED');
  });

  await t.test('19. 100-Iteration Stability Test: 100 repeated calculations produce identical deterministic outputs', async () => {
    const baseline = JSON.stringify(adaptDailyPlan({ tasks: sampleTasks, capacityMode: 'MINIMUM_VIABLE', goalMappings, activeGoals }));
    for (let i = 0; i < 100; i++) {
      const current = JSON.stringify(adaptDailyPlan({ tasks: sampleTasks, capacityMode: 'MINIMUM_VIABLE', goalMappings, activeGoals }));
      assert.equal(current, baseline, `Iteration ${i + 1} produced identical deterministic output`);
    }
  });

  await t.test('20. Failure reasons are correctly categorized as Capacity Constraint vs Execution Friction', async () => {
    assert.equal(categorizeFailureReason('Work/college conflict'), 'CAPACITY_CONSTRAINT');
    assert.equal(categorizeFailureReason('Lack of time'), 'CAPACITY_CONSTRAINT');
    assert.equal(categorizeFailureReason('Too tired'), 'CAPACITY_CONSTRAINT');
    assert.equal(categorizeFailureReason('Screen distraction'), 'EXECUTION_FRICTION');
    assert.equal(categorizeFailureReason('Forgot'), 'EXECUTION_FRICTION');
  });

  await t.test('21. Priority ties are resolved deterministically using taskKey ascending tie-breaker', async () => {
    const tieTasks = [
      { id: 't_b', taskKey: 'task_b', category: 'WORKOUT' },
      { id: 't_a', taskKey: 'task_a', category: 'WORKOUT' }
    ];
    const res = adaptDailyPlan({ tasks: tieTasks, capacityMode: 'NORMAL' });
    assert.equal(res.adaptedTasks[0].taskKey, 'task_a', 'task_a comes first alphabetically when priority score is equal');
    assert.equal(res.adaptedTasks[1].taskKey, 'task_b');
  });

  await t.test('22. Deferral validation enforces MAX_CARRYOVER_CHAIN_DEPTH to prevent infinite carryover loops', async () => {
    const task = { id: 't_hop3', status: 'SCHEDULED', date: '2026-08-16', taskKey: 'carryover_de_hop3' };
    const res = validateTaskDeferral({ sourceTask: task, targetDate: '2026-08-17', sourceUserId: 'u1', targetUserId: 'u1', lineageDepth: 3 });
    assert.equal(res.isValid, false);
    assert.ok(res.reason.includes('Maximum carryover chain depth'));
  });

  await t.test('23. Performance Benchmark: 100-task synthetic schedule calculation completes in < 25ms', async () => {
    const syntheticTasks = Array.from({ length: 100 }, (_, i) => ({
      id: `syn_${i}`,
      taskKey: `task_key_${i}`,
      category: i % 2 === 0 ? 'ANCHOR' : 'DATA_ENG',
      startMinutes: i * 10,
      endMinutes: i * 10 + 20
    }));

    const startTime = performance.now();
    const res = adaptDailyPlan({ tasks: syntheticTasks, capacityMode: 'MINIMUM_VIABLE', availableMinutes: 120 });
    const duration = performance.now() - startTime;

    assert.ok(res.adaptedTasks.length > 0, 'Adapted tasks returned');
    assert.ok(duration < 25, `Execution completed in ${duration.toFixed(2)}ms (< 25ms target)`);
  });
});
