import cryptoNative from 'node:crypto';
import { isValidEventType } from './domainEventTypes.js';

/**
 * Creates a deterministic, serializable Domain Event object with standard metadata.
 */
export function createDomainEvent({
  id,
  type,
  userId,
  occurredAt,
  sourceType,
  sourceId,
  payload,
  correlationId,
  causationId,
  schemaVersion = 1,
}) {
  if (!type || !isValidEventType(type)) {
    throw new Error(`[DomainEvent] Invalid or unsupported event type: "${type}"`);
  }
  if (!userId || typeof userId !== 'string') {
    throw new Error('[DomainEvent] userId string is required');
  }
  if (!sourceType || typeof sourceType !== 'string') {
    throw new Error('[DomainEvent] sourceType string is required');
  }

  const eventId = id || `evt_${cryptoNative.randomUUID()}`;
  const timestamp = occurredAt || new Date().toISOString();
  const rootCorrelationId = correlationId || eventId;

  return Object.freeze({
    id: eventId,
    type,
    userId,
    occurredAt: timestamp,
    sourceType,
    sourceId: sourceId || null,
    payload: payload && typeof payload === 'object' ? Object.freeze({ ...payload }) : {},
    correlationId: rootCorrelationId,
    causationId: causationId || null,
    schemaVersion: Number(schemaVersion) || 1,
  });
}

/**
 * Lightweight, server-side in-process Domain Event Bus.
 */
class DomainEventBus {
  constructor() {
    // Map<eventType, Map<handlerId, { priority: number, fn: Function }>>
    this.subscribers = new Map();
  }

  /**
   * Subscribe a handler function to a specific domain event type.
   */
  subscribe(eventType, handlerId, handlerFn, options = {}) {
    if (!isValidEventType(eventType)) {
      throw new Error(`[DomainEventBus] Cannot subscribe to invalid event type: "${eventType}"`);
    }
    if (!handlerId || typeof handlerId !== 'string') {
      throw new Error('[DomainEventBus] handlerId string is required');
    }
    if (typeof handlerFn !== 'function') {
      throw new Error('[DomainEventBus] handlerFn must be a function');
    }

    const priority = Number(options.priority) || 100; // Lower number = higher priority

    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, new Map());
    }

    const handlersMap = this.subscribers.get(eventType);
    handlersMap.set(handlerId, { priority, fn: handlerFn, handlerId });
  }

  /**
   * Unsubscribe a handler by ID.
   */
  unsubscribe(eventType, handlerId) {
    if (this.subscribers.has(eventType)) {
      this.subscribers.get(eventType).delete(handlerId);
    }
  }

  /**
   * Retrieve all registered handlers for an event type, sorted by priority.
   */
  getHandlers(eventType) {
    if (!this.subscribers.has(eventType)) return [];
    const handlers = Array.from(this.subscribers.get(eventType).values());
    return handlers.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Clear all registered subscribers (useful for testing).
   */
  reset() {
    this.subscribers.clear();
  }

  /**
   * Publish an event to registered subscribers with error isolation.
   */
  async publish(event) {
    const handlers = this.getHandlers(event.type);
    const results = [];

    for (const h of handlers) {
      const startTime = Date.now();
      try {
        const output = await h.fn(event);
        results.push({
          handlerId: h.handlerId,
          success: true,
          durationMs: Date.now() - startTime,
          output,
        });
      } catch (err) {
        results.push({
          handlerId: h.handlerId,
          success: false,
          durationMs: Date.now() - startTime,
          error: err.message,
        });
      }
    }

    return {
      eventId: event.id,
      type: event.type,
      handlersEvaluatedCount: handlers.length,
      results,
    };
  }
}

export const domainEventBus = new DomainEventBus();
