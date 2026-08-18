import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../db/index.js';
import { users, resourceStock } from '../db/schema.js';
import { initializeAutomationHandlers } from '../services/automationBootstrap.js';
import { emitTaskCompletedEvent } from '../services/taskExecutionService.js';
import { adaptDailyPlan } from '../services/adaptiveExecutionService.js';
import { calculateWindowAdherence } from '../services/adherenceEngine.js';
import { eq } from 'drizzle-orm';
import cryptoNative from 'node:crypto';

test('TASK 9.5 — CAPACITY TRACKING CLEANUP & ADHERENCE STABILITY TESTS', async (t) => {
  const userId = cryptoNative.randomUUID();
  const todayStr = new Date().toISOString().split('T')[0];

  t.before(async () => {
    initializeAutomationHandlers();

    await db.insert(users).values({
      id: userId,
      googleId: `g-t95-${userId}`,
      email: `t95_${userId}@example.com`,
      displayName: 'T95 User'
    });
  });

  t.after(async () => {
    await db.delete(resourceStock).where(eq(resourceStock.userId, userId));
    await db.delete(users).where(eq(users.id, userId));
  });

  await t.test('1. Today task completion triggers automation chain & records event', async () => {
    const result = await emitTaskCompletedEvent(userId, {
      taskExecutionId: `t95_exec_${cryptoNative.randomUUID()}`,
      taskKey: 'mon-1',
      date: todayStr,
      category: 'WAKE',
      taskName: 'Wake Routine'
    });

    assert.ok(result.success);
    assert.equal(result.eventType, 'TASK_COMPLETED');
    assert.ok(result.eventId);
  });

  await t.test('2. Backend adaptive engine & daily_adaptations table remain operational', async () => {
    const adaptation = adaptDailyPlan({ tasks: [], capacityMode: 'NORMAL' });
    assert.ok(adaptation);
    assert.equal(adaptation.capacityMode, 'NORMAL');
  });

  await t.test('3. Adherence engine calculates window adherence cleanly without capacity UI dependency', async () => {
    const windowMetrics = await calculateWindowAdherence(db, userId, 7);
    assert.ok(windowMetrics);
    assert.ok(typeof windowMetrics.averageRawAdherence === 'number');
    assert.ok(typeof windowMetrics.averageCapacityAdherence === 'number');
  });
});
