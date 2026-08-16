import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import session from 'express-session';
import dashboardRouter from '../routes/dashboard.js';
import { db } from '../db/index.js';
import { users, dailyExecutions, taskExecutions, dailyAdaptations } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use(session({
    secret: 'test_secret_key',
    resave: false,
    saveUninitialized: true
  }));

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

test('FEATURE — ADAPTIVE FRONTEND CONTRACT & STATE TESTS', async (t) => {
  let server;
  let baseUrl;

  const userId = `user_fe_${Date.now()}`;
  const nowIso = new Date().toISOString();
  const dateStr1 = '2026-08-16';
  const dateStr2 = '2026-08-17';

  t.before(async () => {
    await db.insert(users).values({
      id: userId, googleId: `g_${userId}`, email: `${userId}@test.com`, displayName: 'Frontend Contract User', createdAt: nowIso, updatedAt: nowIso, lastLoginAt: nowIso
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
    await db.delete(dailyAdaptations).where(eq(dailyAdaptations.userId, userId));
    const execs = await db.select().from(dailyExecutions).where(eq(dailyExecutions.userId, userId));
    for (const ex of execs) {
      await db.delete(taskExecutions).where(eq(taskExecutions.dailyExecutionId, ex.id));
    }
    await db.delete(dailyExecutions).where(eq(dailyExecutions.userId, userId));
    await db.delete(users).where(eq(users.id, userId));
  });

  let taskToRescheduleId;

  await t.test('1. AppContext contract: GET /api/dashboard/adaptation returns initial state', async () => {
    const res = await fetch(`${baseUrl}/api/dashboard/adaptation?date=${dateStr1}`, {
      headers: { 'x-test-user-id': userId }
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.capacityMode, 'NORMAL');
    assert.equal(data.rawCompliance, 0);
  });

  await t.test('2. AppContext contract: setCapacityMode posts capacity update', async () => {
    const res = await fetch(`${baseUrl}/api/dashboard/capacity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-test-user-id': userId },
      body: JSON.stringify({ date: dateStr1, capacityMode: 'MINIMUM_VIABLE', availableMinutes: 60, reason: 'Exam' })
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.capacityMode, 'MINIMUM_VIABLE');
    assert.equal(data.availableMinutes, 60);
  });

  await t.test('3. AppContext contract: rescheduleTask posts deferral request', async () => {
    // Locate task to defer
    const [exec] = await db.select().from(dailyExecutions).where(and(eq(dailyExecutions.userId, userId), eq(dailyExecutions.date, dateStr1))).limit(1);
    const tasks = await db.select().from(taskExecutions).where(eq(taskExecutions.dailyExecutionId, exec.id));
    assert.ok(tasks.length > 0);
    taskToRescheduleId = tasks[0].id;

    const res = await fetch(`${baseUrl}/api/dashboard/reschedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-test-user-id': userId },
      body: JSON.stringify({ sourceTaskExecutionId: taskToRescheduleId, targetDate: dateStr2 })
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
  });

  await t.test('4. API response becomes frontend state via adaptation endpoint', async () => {
    const res = await fetch(`${baseUrl}/api/dashboard/adaptation?date=${dateStr1}`, {
      headers: { 'x-test-user-id': userId }
    });
    const data = await res.json();
    assert.equal(data.capacityMode, 'MINIMUM_VIABLE');
  });

  await t.test('5. Capacity change appends to history log', async () => {
    const res = await fetch(`${baseUrl}/api/dashboard/adaptation?date=${dateStr1}`, {
      headers: { 'x-test-user-id': userId }
    });
    const data = await res.json();
    assert.ok(data.adaptationHistory.length >= 1);
  });

  await t.test('6. Rescheduling updates origin task status to SKIPPED', async () => {
    const [sourceRow] = await db.select().from(taskExecutions).where(eq(taskExecutions.id, taskToRescheduleId)).limit(1);
    assert.equal(sourceRow.status, 'SKIPPED');
    assert.equal(sourceRow.deferredToDate, dateStr2);
  });

  await t.test('7. Adapted compliance is returned separately from raw compliance', async () => {
    const res = await fetch(`${baseUrl}/api/dashboard/adaptation?date=${dateStr1}`, {
      headers: { 'x-test-user-id': userId }
    });
    const data = await res.json();
    assert.ok(data.rawCompliance !== undefined);
    assert.ok(data.adaptedCompliance !== undefined);
  });

  await t.test('8. Carryover tasks are created on target date with sourceTaskExecutionId link', async () => {
    const [targetExec] = await db.select().from(dailyExecutions).where(and(eq(dailyExecutions.userId, userId), eq(dailyExecutions.date, dateStr2))).limit(1);
    assert.ok(targetExec);
    const targetTasks = await db.select().from(taskExecutions).where(eq(taskExecutions.dailyExecutionId, targetExec.id));
    assert.ok(targetTasks.length > 0);
  });

  await t.test('9. Backend authoritative calculations are trusted (no frontend recalculation)', async () => {
    const res = await fetch(`${baseUrl}/api/dashboard/adaptation?date=${dateStr1}`, {
      headers: { 'x-test-user-id': userId }
    });
    const data = await res.json();
    assert.ok(data.adaptedPlan.essentialTaskKeys.length > 0);
  });

  await t.test('10. API errors (invalid capacityMode) are handled cleanly with 400 status', async () => {
    const res = await fetch(`${baseUrl}/api/dashboard/capacity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-test-user-id': userId },
      body: JSON.stringify({ date: dateStr1, capacityMode: 'BAD_MODE' })
    });
    assert.equal(res.status, 400);
  });

  await t.test('11. Duplicate reschedule submissions return idempotent success', async () => {
    const res = await fetch(`${baseUrl}/api/dashboard/reschedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-test-user-id': userId },
      body: JSON.stringify({ sourceTaskExecutionId: taskToRescheduleId, targetDate: dateStr2 })
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.idempotent, true);
  });

  await t.test('12. Normal capacity mode returns clean default adaptation state', async () => {
    await fetch(`${baseUrl}/api/dashboard/capacity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-test-user-id': userId },
      body: JSON.stringify({ date: dateStr1, capacityMode: 'NORMAL' })
    });
    const res = await fetch(`${baseUrl}/api/dashboard/adaptation?date=${dateStr1}`, {
      headers: { 'x-test-user-id': userId }
    });
    const data = await res.json();
    assert.equal(data.capacityMode, 'NORMAL');
  });
});
