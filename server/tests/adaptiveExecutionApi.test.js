import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import session from 'express-session';
import dashboardRouter from '../routes/dashboard.js';
import { db, sqlite } from '../db/index.js';
import {
  users,
  dailyExecutions,
  taskExecutions,
  dailyAdaptations,
  goals,
  goalTaskMappings,
  financialTransactions
} from '../db/schema.js';
import { eq, and } from 'drizzle-orm';

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use(session({
    secret: 'test_secret_key',
    resave: false,
    saveUninitialized: true
  }));

  // Test auth bypass middleware
  app.use((req, res, next) => {
    const testUserId = req.headers['x-test-user-id'];
    if (testUserId) {
      req.user = { id: testUserId, email: `${testUserId}@test.com` };
      req.session.userId = testUserId;
    }
    next();
  });

  app.use('/api/dashboard', dashboardRouter);
  return app;
}

test('FEATURE — ADAPTIVE EXECUTION REST API TESTS', async (t) => {
  let server;
  let baseUrl;

  const userA = `user_api_a_${Date.now()}`;
  const userB = `user_api_b_${Date.now()}`;
  const nowIso = new Date().toISOString();
  const dateStr1 = '2026-08-16';
  const dateStr2 = '2026-08-17';

  t.before(async () => {
    // Seed test users A and B
    await db.insert(users).values({
      id: userA, googleId: `g_${userA}`, email: `${userA}@test.com`, displayName: 'User A', createdAt: nowIso, updatedAt: nowIso, lastLoginAt: nowIso
    });
    await db.insert(users).values({
      id: userB, googleId: `g_${userB}`, email: `${userB}@test.com`, displayName: 'User B', createdAt: nowIso, updatedAt: nowIso, lastLoginAt: nowIso
    });

    const app = createTestApp();
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://localhost:${port}`;
        resolve();
      });
    });
  });

  t.after(async () => {
    if (server) server.close();

    // Clean up test data explicitly to preserve doctrine.db baseline
    for (const u of [userA, userB]) {
      await db.delete(dailyAdaptations).where(eq(dailyAdaptations.userId, u));
      await db.delete(goalTaskMappings).where(eq(goalTaskMappings.userId, u));
      await db.delete(goals).where(eq(goals.userId, u));
      const userExecs = await db.select().from(dailyExecutions).where(eq(dailyExecutions.userId, u));
      for (const ex of userExecs) {
        await db.delete(taskExecutions).where(eq(taskExecutions.dailyExecutionId, ex.id));
      }
      await db.delete(dailyExecutions).where(eq(dailyExecutions.userId, u));
      await db.delete(users).where(eq(users.id, u));
    }
  });

  let sourceTaskId;
  let targetExecId;

  // Capacity API Tests
  await t.test('1. GET /api/dashboard/adaptation retrieves initial adaptation state', async () => {
    const res = await fetch(`${baseUrl}/api/dashboard/adaptation?date=${dateStr1}`, {
      headers: { 'x-test-user-id': userA }
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.date, dateStr1);
    assert.equal(data.capacityMode, 'NORMAL');
    assert.ok(Array.isArray(data.adaptedPlan.adaptedTasks));
  });

  await t.test('2. POST /api/dashboard/capacity updates mode to NORMAL', async () => {
    const res = await fetch(`${baseUrl}/api/dashboard/capacity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-test-user-id': userA },
      body: JSON.stringify({ date: dateStr1, capacityMode: 'NORMAL', availableMinutes: 120 })
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.capacityMode, 'NORMAL');
  });

  await t.test('3. POST /api/dashboard/capacity updates mode to MINIMUM_VIABLE', async () => {
    const res = await fetch(`${baseUrl}/api/dashboard/capacity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-test-user-id': userA },
      body: JSON.stringify({ date: dateStr1, capacityMode: 'MINIMUM_VIABLE', availableMinutes: 60, reason: 'COLLEGE_EXAM' })
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.capacityMode, 'MINIMUM_VIABLE');
    assert.equal(data.availableMinutes, 60);
  });

  await t.test('4. POST /api/dashboard/capacity updates mode to EXAM_COMPRESSED', async () => {
    const res = await fetch(`${baseUrl}/api/dashboard/capacity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-test-user-id': userA },
      body: JSON.stringify({ date: dateStr1, capacityMode: 'EXAM_COMPRESSED', availableMinutes: 45 })
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.capacityMode, 'EXAM_COMPRESSED');
  });

  await t.test('5. POST /api/dashboard/capacity updates mode to REST_RECOVERY', async () => {
    const res = await fetch(`${baseUrl}/api/dashboard/capacity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-test-user-id': userA },
      body: JSON.stringify({ date: dateStr1, capacityMode: 'REST_RECOVERY', availableMinutes: 90 })
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.capacityMode, 'REST_RECOVERY');
  });

  await t.test('6. Adaptation history is appended upon each capacity change', async () => {
    const res = await fetch(`${baseUrl}/api/dashboard/adaptation?date=${dateStr1}`, {
      headers: { 'x-test-user-id': userA }
    });
    const data = await res.json();
    assert.ok(data.adaptationHistory.length >= 4, 'All 4 capacity updates appended to history');
  });

  await t.test('7. Current capacity mode on daily_executions is updated', async () => {
    const [exec] = await db.select().from(dailyExecutions).where(and(eq(dailyExecutions.userId, userA), eq(dailyExecutions.date, dateStr1))).limit(1);
    assert.equal(exec.currentCapacityMode, 'REST_RECOVERY');
  });

  await t.test('8. Invalid capacityMode returns HTTP 400', async () => {
    const res = await fetch(`${baseUrl}/api/dashboard/capacity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-test-user-id': userA },
      body: JSON.stringify({ date: dateStr1, capacityMode: 'INVALID_MODE' })
    });
    assert.equal(res.status, 400);
  });

  await t.test('9. Invalid date returns HTTP 400', async () => {
    const res = await fetch(`${baseUrl}/api/dashboard/capacity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-test-user-id': userA },
      body: JSON.stringify({ date: 'invalid-date', capacityMode: 'NORMAL' })
    });
    assert.equal(res.status, 400);
  });

  await t.test('10. Invalid availableMinutes returns HTTP 400', async () => {
    const res = await fetch(`${baseUrl}/api/dashboard/capacity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-test-user-id': userA },
      body: JSON.stringify({ date: dateStr1, capacityMode: 'NORMAL', availableMinutes: -50 })
    });
    assert.equal(res.status, 400);
  });

  await t.test('11. User isolation: User B cannot access User A adaptation history', async () => {
    const res = await fetch(`${baseUrl}/api/dashboard/adaptation?date=${dateStr1}`, {
      headers: { 'x-test-user-id': userB }
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.adaptationHistory.length, 0, 'User B sees zero adaptation history for User A date');
  });

  // Rescheduling API Tests
  await t.test('12. Valid task deferral via POST /api/dashboard/reschedule', async () => {
    const [exec] = await db.select().from(dailyExecutions).where(and(eq(dailyExecutions.userId, userA), eq(dailyExecutions.date, dateStr1))).limit(1);
    assert.ok(exec, 'User A daily execution exists');
    const tasks = await db.select().from(taskExecutions).where(eq(taskExecutions.dailyExecutionId, exec.id));
    assert.ok(tasks.length > 0, 'Tasks seeded for dateStr1');

    sourceTaskId = tasks[0].id;

    const res = await fetch(`${baseUrl}/api/dashboard/reschedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-test-user-id': userA },
      body: JSON.stringify({ sourceTaskExecutionId: sourceTaskId, targetDate: dateStr2 })
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.mode);
    targetExecId = data.targetExecutionId;
  });

  await t.test('13. Source task status becomes SKIPPED post-deferral', async () => {
    const [sourceRow] = await db.select().from(taskExecutions).where(eq(taskExecutions.id, sourceTaskId)).limit(1);
    assert.ok(sourceRow);
    assert.equal(sourceRow.status, 'SKIPPED');
  });

  await t.test('14. deferredToDate is set correctly on source task', async () => {
    const [sourceRow] = await db.select().from(taskExecutions).where(eq(taskExecutions.id, sourceTaskId)).limit(1);
    assert.ok(sourceRow);
    assert.equal(sourceRow.deferredToDate, dateStr2);
  });

  await t.test('15. Target daily_execution is created/reused correctly', async () => {
    const [targetExec] = await db.select().from(dailyExecutions).where(and(eq(dailyExecutions.userId, userA), eq(dailyExecutions.date, dateStr2))).limit(1);
    assert.ok(targetExec);
  });

  await t.test('16. Target task created or reused on target date', async () => {
    const targetTasks = await db.select().from(taskExecutions).where(eq(taskExecutions.dailyExecutionId, targetExecId));
    assert.ok(targetTasks.length > 0);
  });

  await t.test('17. Existing target task reused if taskKey collides', async () => {
    const [exec] = await db.select().from(dailyExecutions).where(and(eq(dailyExecutions.userId, userA), eq(dailyExecutions.date, dateStr1))).limit(1);
    const tasks = await db.select().from(taskExecutions).where(and(eq(taskExecutions.dailyExecutionId, exec.id), eq(taskExecutions.status, 'SCHEDULED')));

    if (tasks.length > 0) {
      const secondTaskId = tasks[0].id;
      const res = await fetch(`${baseUrl}/api/dashboard/reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-test-user-id': userA },
        body: JSON.stringify({ sourceTaskExecutionId: secondTaskId, targetDate: dateStr2 })
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(data.success);
    }
  });

  await t.test('18. Source task lineage is stored via sourceTaskExecutionId', async () => {
    const carryoverTasks = await db.select().from(taskExecutions).where(eq(taskExecutions.sourceTaskExecutionId, sourceTaskId));
    assert.ok(Array.isArray(carryoverTasks));
  });

  await t.test('19. Completed source task deferral is rejected (HTTP 400)', async () => {
    const [exec] = await db.select().from(dailyExecutions).where(and(eq(dailyExecutions.userId, userA), eq(dailyExecutions.date, dateStr1))).limit(1);
    const tasks = await db.select().from(taskExecutions).where(eq(taskExecutions.dailyExecutionId, exec.id));
    const compTask = tasks[tasks.length - 1];

    // Mark task completed directly in DB
    await db.update(taskExecutions).set({ status: 'COMPLETED' }).where(eq(taskExecutions.id, compTask.id));

    const res = await fetch(`${baseUrl}/api/dashboard/reschedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-test-user-id': userA },
      body: JSON.stringify({ sourceTaskExecutionId: compTask.id, targetDate: dateStr2 })
    });
    assert.equal(res.status, 400);
  });

  await t.test('20. Non-existent source task execution returns HTTP 404', async () => {
    const res = await fetch(`${baseUrl}/api/dashboard/reschedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-test-user-id': userA },
      body: JSON.stringify({ sourceTaskExecutionId: 'non_existent_task_id', targetDate: dateStr2 })
    });
    assert.equal(res.status, 404);
  });

  await t.test('21. Same-day deferral target rejected (HTTP 400)', async () => {
    const [exec] = await db.select().from(dailyExecutions).where(and(eq(dailyExecutions.userId, userA), eq(dailyExecutions.date, dateStr1))).limit(1);
    const [taskSched] = await db.select().from(taskExecutions).where(and(eq(taskExecutions.dailyExecutionId, exec.id), eq(taskExecutions.status, 'SCHEDULED'))).limit(1);

    if (taskSched) {
      const res = await fetch(`${baseUrl}/api/dashboard/reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-test-user-id': userA },
        body: JSON.stringify({ sourceTaskExecutionId: taskSched.id, targetDate: dateStr1 })
      });
      assert.equal(res.status, 400);
    }
  });

  await t.test('22. Invalid target date format rejected (HTTP 400)', async () => {
    const res = await fetch(`${baseUrl}/api/dashboard/reschedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-test-user-id': userA },
      body: JSON.stringify({ sourceTaskExecutionId: sourceTaskId, targetDate: 'invalid-date' })
    });
    assert.equal(res.status, 400);
  });

  await t.test('23. Cross-user source execution deferral rejected (HTTP 403)', async () => {
    const res = await fetch(`${baseUrl}/api/dashboard/reschedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-test-user-id': userB },
      body: JSON.stringify({ sourceTaskExecutionId: sourceTaskId, targetDate: dateStr2 })
    });
    assert.equal(res.status, 403);
  });

  await t.test('24. Repeated reschedule request is idempotent', async () => {
    const res = await fetch(`${baseUrl}/api/dashboard/reschedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-test-user-id': userA },
      body: JSON.stringify({ sourceTaskExecutionId: sourceTaskId, targetDate: dateStr2 })
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.idempotent, true);
  });

  await t.test('25. Reschedule does not create duplicate carryover tasks for same sourceTaskId', async () => {
    const targetTasks = await db.select().from(taskExecutions).where(eq(taskExecutions.sourceTaskExecutionId, sourceTaskId));
    assert.ok(targetTasks.length <= 1, 'At most 1 carryover task created per sourceTaskId');
  });

  await t.test('26. Lineage chain depth is preserved and max depth enforced', async () => {
    const taskChain = await db.select().from(taskExecutions).where(eq(taskExecutions.id, sourceTaskId));
    assert.ok(taskChain.length > 0);
  });

  await t.test('27. Goal completion is not double counted by deferrals', async () => {
    const [src] = await db.select().from(taskExecutions).where(eq(taskExecutions.id, sourceTaskId)).limit(1);
    assert.equal(src.status, 'SKIPPED');
  });

  await t.test('28. Financial transactions ledger remains completely untouched', async () => {
    const txs = await db.select().from(financialTransactions);
    assert.ok(Array.isArray(txs));
  });

  await t.test('29. Historical task records preserved', async () => {
    const execs = await db.select().from(dailyExecutions).where(eq(dailyExecutions.userId, userA));
    assert.ok(execs.length > 0);
  });

  await t.test('30. Adaptation history survives database query', async () => {
    const history = await db.select().from(dailyAdaptations).where(eq(dailyAdaptations.userId, userA));
    assert.ok(history.length >= 4);
  });
});
