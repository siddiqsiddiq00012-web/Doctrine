import { createDomainEvent } from './domainEventBus.js';
import { DOMAIN_EVENT_TYPES } from './domainEventTypes.js';
import { processEvent } from './automationEngine.js';

/**
 * Task Execution Boundary: Emits a canonical TASK_COMPLETED domain event upon completing a task execution.
 * Deterministically derives the event ID from taskExecutionId to guarantee duplicate task completion protection.
 */
export async function emitTaskCompletedEvent(userId, { taskExecutionId, taskKey, date, category, taskName }) {
  if (!userId || typeof userId !== 'string') {
    throw new Error('[TaskExecutionService Error] userId string is required');
  }
  if (!taskExecutionId || typeof taskExecutionId !== 'string') {
    throw new Error('[TaskExecutionService Error] taskExecutionId string is required');
  }
  if (!taskKey || typeof taskKey !== 'string') {
    throw new Error('[TaskExecutionService Error] taskKey string is required');
  }

  // Deterministic Event ID guarantees one taskExecutionId -> one event ID
  const deterministicEventId = `evt_task_exec_${taskExecutionId}`;
  const occurredAt = date ? `${date}T12:00:00.000Z` : new Date().toISOString();

  const domainEvent = createDomainEvent({
    id: deterministicEventId,
    type: DOMAIN_EVENT_TYPES.TASK_COMPLETED,
    userId,
    occurredAt,
    sourceType: 'task_execution',
    sourceId: taskExecutionId,
    payload: {
      taskKey,
      taskExecutionId,
      date: date || occurredAt.split('T')[0],
      category: category || null,
      taskName: taskName || taskKey,
    },
    correlationId: deterministicEventId,
  });

  return await processEvent(domainEvent, { persist: true });
}
