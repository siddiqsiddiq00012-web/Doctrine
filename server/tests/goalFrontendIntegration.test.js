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
  goalTaskMappings
} from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { cryptoNative } from '../utils/crypto.js';

// Setup test server for frontend contract verification
function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use(session({ secret: 'fe_integration_secret', resave: false, saveUninitialized: false }));
  app.use((req, res, next) => {
    if (req.headers['x-test-user-id'] && req.session) {
      req.session.userId = req.headers['x-test-user-id'];
    }
    next();
  });
  app.use('/api/goals', goalsRouter);
  return app;
}

test('GOAL FRONTEND INTEGRATION & CONTRACT TESTS', async (t) => {
  const userA = `fe_user_${Date.now()}`;
  const nowIso = new Date().toISOString();
  let server;
  let baseUrl;

  t.before(async () => {
    await db.insert(users).values({
      id: userA,
      googleId: `google_${userA}`,
      email: `${userA}@doctrine.test`,
      displayName: 'FE Test User',
      createdAt: nowIso,
      updatedAt: nowIso,
      lastLoginAt: nowIso
    });

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
    await db.delete(goalTaskMappings).where(eq(goalTaskMappings.userId, userA));
    await db.delete(goalMilestones).where(eq(goalMilestones.userId, userA));
    await db.delete(goals).where(eq(goals.userId, userA));
    await db.delete(lifeAreas).where(eq(lifeAreas.userId, userA));
    await db.delete(users).where(eq(users.id, userA));
  });

  let visionId;
  let milestoneId;

  await t.test('1. Goals API Contract: GET /api/goals returns valid hierarchy', async () => {
    const res = await fetch(`${baseUrl}/api/goals`, { headers: { 'x-test-user-id': userA } });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.hierarchy);
  });

  await t.test('2. Goals API Contract: GET /api/goals/life-areas loads life areas', async () => {
    const res = await fetch(`${baseUrl}/api/goals/life-areas`, { headers: { 'x-test-user-id': userA } });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.lifeAreas.length >= 1);
  });

  await t.test('3. Goal Creation Contract: POST /api/goals creates goal with backend-derived metrics', async () => {
    const res = await fetch(`${baseUrl}/api/goals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-test-user-id': userA },
      body: JSON.stringify({ title: 'Frontend Vision Target', level: 'VISION' })
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.ok(body.goal.id);
    assert.equal(body.goal.progress, 0);
    assert.equal(body.goal.derivedStatus, 'PLANNED');
    visionId = body.goal.id;
  });

  await t.test('4. Milestone Creation & Progress Toggle Contract', async () => {
    const resMs = await fetch(`${baseUrl}/api/goals/${visionId}/milestones`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-test-user-id': userA },
      body: JSON.stringify({ title: 'FE Milestone 1', targetValue: 10, currentValue: 0 })
    });
    assert.equal(resMs.status, 201);
    const bodyMs = await resMs.json();
    milestoneId = bodyMs.milestoneId;

    const resTog = await fetch(`${baseUrl}/api/goals/${visionId}/milestones/${milestoneId}/toggle`, {
      method: 'POST',
      headers: { 'x-test-user-id': userA }
    });
    assert.equal(resTog.status, 200);
    const bodyTog = await resTog.json();
    assert.equal(bodyTog.isCompleted, true);
    assert.equal(bodyTog.goal.progress, 100);
    assert.equal(bodyTog.goal.derivedStatus, 'COMPLETED');
  });

  await t.test('5. Milestone Deletion Contract', async () => {
    const resDelMs = await fetch(`${baseUrl}/api/goals/${visionId}/milestones/${milestoneId}`, {
      method: 'DELETE',
      headers: { 'x-test-user-id': userA }
    });
    assert.equal(resDelMs.status, 200);
  });

  await t.test('6. Goal Deletion Contract', async () => {
    const resDelG = await fetch(`${baseUrl}/api/goals/${visionId}`, {
      method: 'DELETE',
      headers: { 'x-test-user-id': userA }
    });
    assert.equal(resDelG.status, 200);
  });
});
