import { DOMAIN_EVENT_TYPES } from './domainEventTypes.js';
import { registerHandler } from './automationEngine.js';
import { handleTaskCompletedResourceConsumption } from './resourceConsumptionService.js';
import { handleResourceDepletionPurchaseIntelligence } from './purchaseIntelligenceService.js';
import { handleWorkdayCompletedIncome } from './financialEngine.js';

let initialized = false;

/**
 * Initializes and registers all domain-specific automation handlers with the generic Automation Engine.
 */
export function initializeAutomationHandlers() {
  if (initialized) return;

  // 1. Register Resource Consumption Handler for TASK_COMPLETED events (Priority 10: runs FIRST to mutate stock)
  registerHandler({
    handlerId: 'resource_consumption_handler',
    eventType: DOMAIN_EVENT_TYPES.TASK_COMPLETED,
    priority: 10,
    handlerFn: handleTaskCompletedResourceConsumption,
  });

  // 2. Register Purchase Intelligence Handler for TASK_COMPLETED events (Priority 50: runs SECOND using updated stock)
  registerHandler({
    handlerId: 'resource_purchase_intelligence_handler',
    eventType: DOMAIN_EVENT_TYPES.TASK_COMPLETED,
    priority: 50,
    handlerFn: handleResourceDepletionPurchaseIntelligence,
  });

  // 3. Register Workday Income Automation Handler for WORKDAY_COMPLETED events
  registerHandler({
    handlerId: 'workday_income_automation_handler',
    eventType: DOMAIN_EVENT_TYPES.WORKDAY_COMPLETED,
    priority: 10,
    handlerFn: handleWorkdayCompletedIncome,
  });

  initialized = true;
}
