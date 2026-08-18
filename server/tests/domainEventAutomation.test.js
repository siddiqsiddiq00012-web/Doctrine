import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../db/index.js';
import { users, domainEvents, automationProcessingLogs } from '../db/schema.js';
import { DOMAIN_EVENT_TYPES, isValidEventType } from '../services/domainEventTypes.js';
import { domainEventBus, createDomainEvent } from '../services/domainEventBus.js';
import {
  processEvent,
  registerHandler,
  unregisterHandler,
  persistDomainEvent,
  isHandlerProcessed,
  MAX_CAUSATION_DEPTH
} from '../services/automationEngine.js';
import { eq, and } from 'drizzle-orm';
import cryptoNative from 'node:crypto';

test('STEP 3 — DOMAIN EVENT & AUTOMATION ENGINE INFRASTRUCTURE TESTS', async (t) => {
  const u1Id = cryptoNative.randomUUID();
  const u2Id = cryptoNative.randomUUID();

  t.before(async () => {
    await db.insert(users).values({
      id: u1Id,
      googleId: `g-evt-1-${u1Id}`,
      email: `evt1_${u1Id}@example.com`,
      displayName: 'Event Test User 1'
    });
    await db.insert(users).values({
      id: u2Id,
      googleId: `g-evt-2-${u2Id}`,
      email: `evt2_${u2Id}@example.com`,
      displayName: 'Event Test User 2'
    });
  });

  t.after(async () => {
    domainEventBus.reset();
    await db.delete(users).where(eq(users.id, u1Id));
    await db.delete(users).where(eq(users.id, u2Id));
  });

  await t.test('1. Event Type Constants & Validation', async () => {
    assert.equal(DOMAIN_EVENT_TYPES.TASK_COMPLETED, 'TASK_COMPLETED');
    assert.equal(DOMAIN_EVENT_TYPES.WORKDAY_COMPLETED, 'WORKDAY_COMPLETED');
    assert.equal(isValidEventType('TASK_COMPLETED'), true);
    assert.equal(isValidEventType('UNKNOWN_FAKE_EVENT'), false);
  });

  await t.test('2. Valid Event Creation & Schema Metadata Validation', async () => {
    const event = createDomainEvent({
      type: DOMAIN_EVENT_TYPES.TASK_COMPLETED,
      userId: u1Id,
      sourceType: 'task_execution',
      sourceId: 'exec-101',
      payload: { taskKey: 'mon-3', dayOfWeek: 'MONDAY' }
    });

    assert.ok(event.id.startsWith('evt_'));
    assert.equal(event.type, 'TASK_COMPLETED');
    assert.equal(event.userId, u1Id);
    assert.equal(event.sourceType, 'task_execution');
    assert.equal(event.sourceId, 'exec-101');
    assert.equal(event.payload.taskKey, 'mon-3');
    assert.equal(event.correlationId, event.id);
    assert.equal(event.causationId, null);
    assert.equal(event.schemaVersion, 1);
    assert.ok(event.occurredAt);
  });

  await t.test('3. Event Creation Input Validation Errors', async () => {
    assert.throws(() => {
      createDomainEvent({ type: 'INVALID_TYPE', userId: u1Id, sourceType: 'test' });
    }, /Invalid or unsupported event type/i);

    assert.throws(() => {
      createDomainEvent({ type: DOMAIN_EVENT_TYPES.TASK_COMPLETED, userId: '', sourceType: 'test' });
    }, /userId string is required/i);
  });

  await t.test('4. In-Process Event Bus Pub/Sub Execution', async () => {
    domainEventBus.reset();
    let handled = false;
    let receivedPayload = null;

    domainEventBus.subscribe(DOMAIN_EVENT_TYPES.WORKDAY_COMPLETED, 'test_handler_1', (evt) => {
      handled = true;
      receivedPayload = evt.payload;
      return 'OK';
    });

    const evt = createDomainEvent({
      type: DOMAIN_EVENT_TYPES.WORKDAY_COMPLETED,
      userId: u1Id,
      sourceType: 'daily_execution',
      payload: { score: 95 }
    });

    const pubRes = await domainEventBus.publish(evt);
    assert.equal(pubRes.eventId, evt.id);
    assert.equal(handled, true);
    assert.equal(receivedPayload.score, 95);
    assert.equal(pubRes.results[0].success, true);
  });

  await t.test('5. Deterministic Handler Ordering (Priority Order)', async () => {
    domainEventBus.reset();
    const executionOrder = [];

    // Priority 200 (Runs second)
    registerHandler({
      handlerId: 'handler_low_priority',
      eventType: DOMAIN_EVENT_TYPES.RESOURCE_ADJUSTED,
      priority: 200,
      handlerFn: async () => { executionOrder.push('LOW'); }
    });

    // Priority 10 (Runs first)
    registerHandler({
      handlerId: 'handler_high_priority',
      eventType: DOMAIN_EVENT_TYPES.RESOURCE_ADJUSTED,
      priority: 10,
      handlerFn: async () => { executionOrder.push('HIGH'); }
    });

    const evt = createDomainEvent({
      type: DOMAIN_EVENT_TYPES.RESOURCE_ADJUSTED,
      userId: u1Id,
      sourceType: 'resource_stock',
      payload: { resourceId: 'inv-1' }
    });

    await processEvent(evt, { persist: false });
    assert.deepEqual(executionOrder, ['HIGH', 'LOW'], 'High priority (10) must run before low priority (200)');
  });

  await t.test('6. Handler Error Isolation', async () => {
    domainEventBus.reset();
    let secondExecuted = false;

    // Failing handler
    registerHandler({
      handlerId: 'failing_handler',
      eventType: DOMAIN_EVENT_TYPES.GOAL_UPDATED,
      priority: 10,
      handlerFn: async () => { throw new Error('Simulated Handler Crash'); }
    });

    // Independent handler
    registerHandler({
      handlerId: 'success_handler',
      eventType: DOMAIN_EVENT_TYPES.GOAL_UPDATED,
      priority: 20,
      handlerFn: async () => { secondExecuted = true; }
    });

    const evt = createDomainEvent({
      type: DOMAIN_EVENT_TYPES.GOAL_UPDATED,
      userId: u1Id,
      sourceType: 'goal',
      payload: { goalId: 'g-1' }
    });

    const res = await processEvent(evt, { persist: false });
    assert.equal(secondExecuted, true, 'Second handler must execute despite first handler error');
    assert.equal(res.success, false, 'Overall process status indicates handler failure');
    assert.equal(res.results.find(r => r.handlerId === 'failing_handler').success, false);
    assert.equal(res.results.find(r => r.handlerId === 'success_handler').success, true);
  });

  await t.test('7. Database Event Persistence & Idempotency Logs', async () => {
    domainEventBus.reset();

    registerHandler({
      handlerId: 'test_persist_handler',
      eventType: DOMAIN_EVENT_TYPES.PURCHASE_COMPLETED,
      priority: 10,
      handlerFn: async () => { return { status: 'processed' }; }
    });

    const evt = createDomainEvent({
      type: DOMAIN_EVENT_TYPES.PURCHASE_COMPLETED,
      userId: u1Id,
      sourceType: 'purchase_record',
      payload: { amountPaise: 5000 }
    });

    const processRes = await processEvent(evt, { persist: true });
    assert.equal(processRes.success, true);

    // Verify domain_events table entry
    const dbEvents = await db.select()
      .from(domainEvents)
      .where(and(eq(domainEvents.id, evt.id), eq(domainEvents.userId, u1Id)));
    assert.equal(dbEvents.length, 1);
    assert.equal(dbEvents[0].eventType, 'PURCHASE_COMPLETED');

    // Verify automation_processing_logs entry
    const isProcessed = await isHandlerProcessed(u1Id, evt.id, 'test_persist_handler');
    assert.equal(isProcessed, true);
  });

  await t.test('8. Duplicate Protection: Re-processing Same Event Skips Handler', async () => {
    domainEventBus.reset();
    let callCount = 0;

    registerHandler({
      handlerId: 'idempotent_handler',
      eventType: DOMAIN_EVENT_TYPES.TASK_SKIPPED,
      priority: 10,
      handlerFn: async () => { callCount++; }
    });

    const evt = createDomainEvent({
      type: DOMAIN_EVENT_TYPES.TASK_SKIPPED,
      userId: u1Id,
      sourceType: 'task_execution',
      payload: { taskKey: 'mon-1' }
    });

    // 1st Execution
    const run1 = await processEvent(evt, { persist: true });
    assert.equal(callCount, 1);
    assert.equal(run1.results[0].status, 'COMPLETED');

    // 2nd Execution (Duplicate Retry Simulation)
    const run2 = await processEvent(evt, { persist: true });
    assert.equal(callCount, 1, 'Handler must NOT be called twice for same event');
    assert.equal(run2.results[0].status, 'SKIPPED_ALREADY_PROCESSED');
  });

  await t.test('9. Independent Processing of Multiple Handlers for Same Event', async () => {
    domainEventBus.reset();
    let h1Calls = 0;
    let h2Calls = 0;

    registerHandler({
      handlerId: 'handler_a',
      eventType: DOMAIN_EVENT_TYPES.TASK_COMPLETED,
      priority: 10,
      handlerFn: async () => { h1Calls++; }
    });

    registerHandler({
      handlerId: 'handler_b',
      eventType: DOMAIN_EVENT_TYPES.TASK_COMPLETED,
      priority: 20,
      handlerFn: async () => { h2Calls++; }
    });

    const evt = createDomainEvent({
      type: DOMAIN_EVENT_TYPES.TASK_COMPLETED,
      userId: u1Id,
      sourceType: 'task_execution',
      payload: { taskKey: 'mon-2' }
    });

    // Process event
    await processEvent(evt, { persist: true });
    assert.equal(h1Calls, 1);
    assert.equal(h2Calls, 1);

    // Verify both handlers logged independent idempotency records
    const h1Done = await isHandlerProcessed(u1Id, evt.id, 'handler_a');
    const h2Done = await isHandlerProcessed(u1Id, evt.id, 'handler_b');
    assert.equal(h1Done, true);
    assert.equal(h2Done, true);
  });

  await t.test('10. Correlation & Causation Metadata Preservation', async () => {
    const parentEvent = createDomainEvent({
      type: DOMAIN_EVENT_TYPES.TASK_COMPLETED,
      userId: u1Id,
      sourceType: 'task_execution',
      payload: { taskKey: 'mon-3' }
    });

    const childEvent = createDomainEvent({
      type: DOMAIN_EVENT_TYPES.RESOURCE_ADJUSTED,
      userId: u1Id,
      sourceType: 'resource_event',
      correlationId: parentEvent.correlationId,
      causationId: parentEvent.id,
      payload: { resourceId: 'inv-5', amount: -1 }
    });

    assert.equal(childEvent.correlationId, parentEvent.correlationId);
    assert.equal(childEvent.causationId, parentEvent.id);
  });

  await t.test('11. Recursion Safeguard Enforces Causation Depth Limit', async () => {
    domainEventBus.reset();

    // Create deep causation chain > MAX_CAUSATION_DEPTH (5)
    let lastId = null;
    let deepEvent = null;

    for (let i = 0; i < MAX_CAUSATION_DEPTH + 1; i++) {
      deepEvent = createDomainEvent({
        id: `evt_chain_${i}`,
        type: DOMAIN_EVENT_TYPES.TASK_COMPLETED,
        userId: u1Id,
        sourceType: 'task_execution',
        correlationId: 'root_corr_101',
        causationId: lastId,
        payload: { depth: i }
      });
      await persistDomainEvent(deepEvent);
      lastId = deepEvent.id;
    }

    // Process event with depth exceeding limit
    const res = await processEvent(deepEvent, { persist: true });
    assert.equal(res.success, false);
    assert.equal(res.recursionAborted, true);
  });

  await t.test('12. Strict Multi-Tenant User Isolation', async () => {
    domainEventBus.reset();

    const evt1 = createDomainEvent({
      type: DOMAIN_EVENT_TYPES.WORKDAY_COMPLETED,
      userId: u1Id,
      sourceType: 'daily_execution',
      payload: { user: 1 }
    });

    await processEvent(evt1, { persist: true });

    // User 2 checks idempotency status for User 1's event
    const u2Processed = await isHandlerProcessed(u2Id, evt1.id, 'handler_a');
    assert.equal(u2Processed, false, 'User 2 must not inherit User 1 idempotency logs');

    // Verify DB events query isolation
    const u2Events = await db.select()
      .from(domainEvents)
      .where(and(eq(domainEvents.id, evt1.id), eq(domainEvents.userId, u2Id)));
    assert.equal(u2Events.length, 0);
  });
});
