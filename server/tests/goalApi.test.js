import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import session from 'express-session';
import goalsRouter from '../routes/goals.js';
import { db, sqlite } from '../db/index.js';
import {
  users,
  lifeAreas,
  goals,
  goalMilestones,
  goalTaskMappings,
  financialGoals,
  dailyExecutions,
  taskExecutions
} from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { cryptoNative } from '../utils/crypto.js';

// Setup lightweight test Express app using standard session injection
function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use(session({
    secret: 'test_secret_goals_api_isolation',
    resave: false,
    saveUninitialized: false
  }));

  // Inject req.session.userId from header for test runner
  app.use((req, res, next) => {
    if (req.headers['x-test-user-id']) {
      req.session = req.session || {};
      req.session.userId = req.headers['x-test-user-id'];
    }
    next();
  });

  app.use('/api/goals', goalsRouter);
  return app;
}

test('GOAL REST API ISOLATION & SECURITY AUDIT TESTS', async (t) => {
  const userA = `user_a_sec_${Date.now()}`;
  const userB = `user_b_sec_${Date.now()}`;
  const nowIso = new Date().toISOString();
  let server;
  let baseUrl;

  t.before(async () => {
    // Seed test user A
    await db.insert(users).values({
      id: userA,
      googleId: `google_${userA}`,
      email: `${userA}@doctrine.test`,
      displayName: 'User A Security',
      createdAt: nowIso,
      updatedAt: nowIso,
      lastLoginAt: nowIso
    });

    // Seed test user B
    await db.insert(users).values({
      id: userB,
      googleId: `google_${userB}`,
      email: `${userB}@doctrine.test`,
      displayName: 'User B Security',
      createdAt: nowIso,
      updatedAt: nowIso,
      lastLoginAt: nowIso
    });

    // Seed Life Area for User A
    await db.insert(lifeAreas).values({
      id: `la_${userA}_physical`,
      userId: userA,
      key: 'PHYSICAL',
      name: 'Physical Transformation',
      color: '#3B82F6',
      icon: 'User',
      sortOrder: 1,
      isSystemDefault: true,
      createdAt: nowIso
    });

    // Seed Life Area for User B
    await db.insert(lifeAreas).values({
      id: `la_${userB}_physical`,
      userId: userB,
      key: 'PHYSICAL',
      name: 'Physical Transformation B',
      color: '#3B82F6',
      icon: 'User',
      sortOrder: 1,
      isSystemDefault: true,
      createdAt: nowIso
    });

    // Start ephemeral Express test server
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

  let createdVisionId;
  let createdObjectiveId;
  let createdGoalId;
  let createdMilestoneId;
  let createdMappingId;

  await t.test('1. GET /api/goals returns hierarchy and life areas', async () => {
    const res = await fetch(`${baseUrl}/api/goals`, {
      headers: { 'x-test-user-id': userA }
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.hierarchy);
    assert.ok(Array.isArray(body.lifeAreas));
  });

  await t.test('2. GET /api/goals/life-areas returns user life areas', async () => {
    const res = await fetch(`${baseUrl}/api/goals/life-areas`, {
      headers: { 'x-test-user-id': userA }
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.lifeAreas));
  });

  await t.test('3. POST /api/goals creates Vision level goal', async () => {
    const res = await fetch(`${baseUrl}/api/goals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-test-user-id': userA },
      body: JSON.stringify({ title: 'User A Vision', level: 'VISION' })
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.goal.level, 'VISION');
    createdVisionId = body.goal.id;
  });

  await t.test('4. POST /api/goals validates hierarchy rules (VISION cannot have parent)', async () => {
    const res = await fetch(`${baseUrl}/api/goals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-test-user-id': userA },
      body: JSON.stringify({ title: 'Invalid Sub Vision', level: 'VISION', parentId: createdVisionId })
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.ok(body.error.includes('cannot have a parent'));
  });

  await t.test('5. POST /api/goals creates Objective under Vision', async () => {
    const res = await fetch(`${baseUrl}/api/goals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-test-user-id': userA },
      body: JSON.stringify({ title: 'User A Objective', level: 'OBJECTIVE', parentId: createdVisionId })
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.goal.level, 'OBJECTIVE');
    createdObjectiveId = body.goal.id;
  });

  await t.test('6. POST /api/goals creates GOAL under Objective', async () => {
    const res = await fetch(`${baseUrl}/api/goals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-test-user-id': userA },
      body: JSON.stringify({ title: 'User A Goal', level: 'GOAL', parentId: createdObjectiveId })
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.goal.level, 'GOAL');
    createdGoalId = body.goal.id;
  });

  await t.test('7. GET /api/goals/:id returns calculated domain details', async () => {
    const res = await fetch(`${baseUrl}/api/goals/${createdGoalId}`, {
      headers: { 'x-test-user-id': userA }
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.goal.id, createdGoalId);
  });

  await t.test('8. POST /api/goals/:id/milestones creates milestone', async () => {
    const res = await fetch(`${baseUrl}/api/goals/${createdGoalId}/milestones`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-test-user-id': userA },
      body: JSON.stringify({ title: 'User A Milestone', targetValue: 10, currentValue: 5 })
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.ok(body.milestoneId);
    createdMilestoneId = body.milestoneId;
  });

  await t.test('9. PUT /api/goals/:id/milestones/:mId updates milestone', async () => {
    const res = await fetch(`${baseUrl}/api/goals/${createdGoalId}/milestones/${createdMilestoneId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-test-user-id': userA },
      body: JSON.stringify({ title: 'Updated Milestone Title', currentValue: 7 })
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
  });

  await t.test('10. POST /api/goals/:id/milestones/:mId/toggle updates progress', async () => {
    const res = await fetch(`${baseUrl}/api/goals/${createdGoalId}/milestones/${createdMilestoneId}/toggle`, {
      method: 'POST',
      headers: { 'x-test-user-id': userA }
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.isCompleted, true);
  });

  await t.test('11. POST /api/goals/:id/task-mappings creates mapping', async () => {
    const res = await fetch(`${baseUrl}/api/goals/${createdGoalId}/task-mappings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-test-user-id': userA },
      body: JSON.stringify({ taskKey: 'workout_a', milestoneId: createdMilestoneId })
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.ok(body.mappingId);
    createdMappingId = body.mappingId;
  });

  await t.test('12. User B Isolation & Malformed Input Attacks (All fail 404/400)', async () => {
    const headersB = { 'Content-Type': 'application/json', 'x-test-user-id': userB };

    // GET User A goal details as User B
    const resGet = await fetch(`${baseUrl}/api/goals/${createdGoalId}`, { headers: headersB });
    assert.equal(resGet.status, 404);

    // Payload attack: body contains "userId": userA
    const resAttack = await fetch(`${baseUrl}/api/goals`, {
      method: 'POST',
      headers: headersB,
      body: JSON.stringify({ title: 'Attack Goal 1', userId: userA })
    });
    assert.equal(resAttack.status, 201);
    const bodyAttack = await resAttack.json();
    assert.equal(bodyAttack.goal.userId, userB, 'Bound to userB session');

    // Cross-user lifeAreaId attack
    const resAreaAttack = await fetch(`${baseUrl}/api/goals`, {
      method: 'POST',
      headers: headersB,
      body: JSON.stringify({ title: 'Cross Area Goal', lifeAreaId: `la_${userA}_physical` })
    });
    assert.equal(resAreaAttack.status, 400);
  });

  await t.test('13. DELETE /api/goals/:id/task-mappings/:mapId deletes mapping without touching task history', async () => {
    const preTaskCount = sqlite.prepare("SELECT count(*) as c FROM task_executions").get().c;

    const res = await fetch(`${baseUrl}/api/goals/${createdGoalId}/task-mappings/${createdMappingId}`, {
      method: 'DELETE',
      headers: { 'x-test-user-id': userA }
    });
    assert.equal(res.status, 200);

    const postTaskCount = sqlite.prepare("SELECT count(*) as c FROM task_executions").get().c;
    assert.equal(preTaskCount, postTaskCount, 'task_executions untouched');
  });

  await t.test('14. PUT /api/goals/:id rejects cycle assignments and self-references', async () => {
    // Self-reference attack
    const resSelf = await fetch(`${baseUrl}/api/goals/${createdGoalId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-test-user-id': userA },
      body: JSON.stringify({ parentId: createdGoalId })
    });
    assert.equal(resSelf.status, 400);

    // Ancestor cycle attack: try to set parent of Vision to Goal
    const resCycle = await fetch(`${baseUrl}/api/goals/${createdVisionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-test-user-id': userA },
      body: JSON.stringify({ parentId: createdGoalId })
    });
    assert.equal(resCycle.status, 400);
  });

  await t.test('15. DELETE /api/goals/:id deletes goal cleanly', async () => {
    const res = await fetch(`${baseUrl}/api/goals/${createdGoalId}`, {
      method: 'DELETE',
      headers: { 'x-test-user-id': userA }
    });
    assert.equal(res.status, 200);
  });
});
