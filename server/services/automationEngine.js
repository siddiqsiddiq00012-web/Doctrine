import { db } from '../db/index.js';
import { domainEvents, automationProcessingLogs } from '../db/schema.js';
import { domainEventBus, createDomainEvent } from './domainEventBus.js';
import { eq, and } from 'drizzle-orm';
import cryptoNative from 'node:crypto';

export const MAX_CAUSATION_DEPTH = 5;

/**
 * Register an automation side-effect handler.
 */
export function registerHandler({ handlerId, eventType, priority = 100, handlerFn }) {
  if (!handlerId || typeof handlerId !== 'string') {
    throw new Error('[AutomationEngine] handlerId string is required');
  }
  domainEventBus.subscribe(eventType, handlerId, handlerFn, { priority });
}

/**
 * Unregister a handler by event type and handlerId.
 */
export function unregisterHandler(eventType, handlerId) {
  domainEventBus.unsubscribe(eventType, handlerId);
}

/**
 * Persist a domain event to the domain_events table.
 */
export async function persistDomainEvent(event) {
  try {
    const existing = await db.select()
      .from(domainEvents)
      .where(and(
        eq(domainEvents.id, event.id),
        eq(domainEvents.userId, event.userId)
      ));

    if (existing.length === 0) {
      await db.insert(domainEvents).values({
        id: event.id,
        userId: event.userId,
        eventType: event.type,
        sourceType: event.sourceType,
        sourceId: event.sourceId || null,
        payload: JSON.stringify(event.payload || {}),
        correlationId: event.correlationId,
        causationId: event.causationId || null,
        schemaVersion: event.schemaVersion || 1,
        status: 'PUBLISHED',
        occurredAt: event.occurredAt,
        createdAt: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.warn(`[AutomationEngine Warning] Failed persisting domain event ${event.id}:`, err.message);
  }
}

/**
 * Checks if a specific event + handler combination has already been successfully processed.
 */
export async function isHandlerProcessed(userId, eventId, handlerId) {
  try {
    const records = await db.select()
      .from(automationProcessingLogs)
      .where(and(
        eq(automationProcessingLogs.userId, userId),
        eq(automationProcessingLogs.eventId, eventId),
        eq(automationProcessingLogs.handlerId, handlerId)
      ));

    return records.some(r => r.status === 'COMPLETED');
  } catch (err) {
    console.warn(`[AutomationEngine Warning] Idempotency log check error:`, err.message);
    return false;
  }
}

/**
 * Log the result of a handler execution in automation_processing_logs.
 */
export async function logHandlerExecution(userId, eventId, handlerId, status, durationMs, errorDetails = null) {
  try {
    const logId = `auto_log_${cryptoNative.randomUUID()}`;
    await db.insert(automationProcessingLogs).values({
      id: logId,
      userId,
      eventId,
      handlerId,
      status,
      errorDetails: errorDetails ? String(errorDetails) : null,
      executionDurationMs: Number(durationMs) || 0,
      processedAt: new Date().toISOString(),
    });
  } catch (err) {
    // If unique constraint violation occurs on retry, update existing record
    try {
      await db.update(automationProcessingLogs)
        .set({
          status,
          errorDetails: errorDetails ? String(errorDetails) : null,
          executionDurationMs: Number(durationMs) || 0,
          processedAt: new Date().toISOString(),
        })
        .where(and(
          eq(automationProcessingLogs.userId, userId),
          eq(automationProcessingLogs.eventId, eventId),
          eq(automationProcessingLogs.handlerId, handlerId)
        ));
    } catch (updateErr) {
      console.warn(`[AutomationEngine Warning] Failed logging handler execution:`, updateErr.message);
    }
  }
}

/**
 * Recursively calculates causation depth to prevent infinite event loops.
 */
export async function getCausationDepth(eventId, userId, depth = 0) {
  if (!eventId || depth >= MAX_CAUSATION_DEPTH) return depth;
  try {
    const events = await db.select()
      .from(domainEvents)
      .where(and(
        eq(domainEvents.id, eventId),
        eq(domainEvents.userId, userId)
      ));

    if (events.length === 0 || !events[0].causationId) return depth;
    return await getCausationDepth(events[0].causationId, userId, depth + 1);
  } catch (err) {
    return depth;
  }
}

/**
 * Process a Domain Event through the Automation Engine with full validation,
 * persistence, idempotency checks, deterministic execution, and recursion safeguards.
 */
export async function processEvent(eventInput, options = {}) {
  // Construct and validate DomainEvent object
  const event = typeof eventInput.type === 'string' && eventInput.id && eventInput.occurredAt
    ? eventInput
    : createDomainEvent(eventInput);

  // Recursion Protection Check
  if (event.causationId) {
    const currentDepth = await getCausationDepth(event.causationId, event.userId, 1);
    if (currentDepth >= MAX_CAUSATION_DEPTH) {
      const errorMsg = `[AutomationEngine Error] Causation depth limit exceeded (${currentDepth} >= ${MAX_CAUSATION_DEPTH}). Event processing aborted to prevent infinite loop.`;
      console.error(errorMsg);
      return {
        eventId: event.id,
        eventType: event.type,
        userId: event.userId,
        success: false,
        recursionAborted: true,
        error: errorMsg,
        results: [],
      };
    }
  }

  // Persist domain event for traceability
  if (options.persist !== false) {
    await persistDomainEvent(event);
  }

  // Resolve registered handlers sorted by priority
  const handlers = domainEventBus.getHandlers(event.type);
  const executionResults = [];
  let overallSuccess = true;

  for (const h of handlers) {
    // Idempotency Protection Check
    const alreadyProcessed = await isHandlerProcessed(event.userId, event.id, h.handlerId);

    if (alreadyProcessed && options.force !== true) {
      executionResults.push({
        handlerId: h.handlerId,
        status: 'SKIPPED_ALREADY_PROCESSED',
        success: true,
        durationMs: 0,
      });
      continue;
    }

    const startTime = Date.now();
    try {
      const output = await h.fn(event);
      const durationMs = Date.now() - startTime;

      if (options.persist !== false) {
        await logHandlerExecution(event.userId, event.id, h.handlerId, 'COMPLETED', durationMs);
      }

      executionResults.push({
        handlerId: h.handlerId,
        status: 'COMPLETED',
        success: true,
        durationMs,
        output,
      });
    } catch (err) {
      const durationMs = Date.now() - startTime;
      overallSuccess = false;

      if (options.persist !== false) {
        await logHandlerExecution(event.userId, event.id, h.handlerId, 'FAILED', durationMs, err.message);
      }

      executionResults.push({
        handlerId: h.handlerId,
        status: 'FAILED',
        success: false,
        durationMs,
        error: err.message,
      });
    }
  }

  return {
    eventId: event.id,
    eventType: event.type,
    userId: event.userId,
    correlationId: event.correlationId,
    causationId: event.causationId || null,
    handlersEvaluatedCount: handlers.length,
    success: overallSuccess,
    results: executionResults,
  };
}
