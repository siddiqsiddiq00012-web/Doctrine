/**
 * Centralized Domain Event Type Definitions for Doctrine OS.
 * These represent the contracts for system events that trigger automated side-effects.
 */
export const DOMAIN_EVENT_TYPES = Object.freeze({
  TASK_COMPLETED: 'TASK_COMPLETED',
  TASK_SKIPPED: 'TASK_SKIPPED',
  TASK_MISSED: 'TASK_MISSED',
  TASK_DEFERRED: 'TASK_DEFERRED',
  WORKDAY_COMPLETED: 'WORKDAY_COMPLETED',
  PURCHASE_COMPLETED: 'PURCHASE_COMPLETED',
  RESOURCE_ADJUSTED: 'RESOURCE_ADJUSTED',
  GOAL_UPDATED: 'GOAL_UPDATED',
});

/**
 * Validates whether a given string is a recognized domain event type.
 */
export function isValidEventType(eventType) {
  return typeof eventType === 'string' && Object.values(DOMAIN_EVENT_TYPES).includes(eventType);
}
