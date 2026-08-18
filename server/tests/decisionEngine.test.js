import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DECISION_PRIORITY_LEVELS,
  evaluateDecisions,
  generateFallbackSummary
} from '../services/decisionEngine.js';

test('STEP 8 — DECISION ENGINE TESTS', async (t) => {
  await t.test('1. CRITICAL Classification (Resource Stock = 0 & Deficit)', async () => {
    const mockContext = {
      resources: {
        constrainedResources: [
          { id: 'res_1', name: 'Milk', currentQty: 0, minStockLevel: 1.0, daysToDepletion: 0, inCart: true }
        ]
      },
      finances: { netCashPaise: -5000, spendableCashPaise: 0, isDeficit: true }
    };

    const res = evaluateDecisions(mockContext);

    assert.ok(res.decisions.length >= 2);
    const criticalDecs = res.decisions.filter(d => d.priority === DECISION_PRIORITY_LEVELS.CRITICAL);
    assert.equal(criticalDecs.length, 2);
  });

  await t.test('2. HIGH Classification (Adherence Decline & Urgent Depletion)', async () => {
    const mockContext = {
      adherence: {
        trend: { direction: 'DECLINING', deltaPct: -20, recentAvg: 60, priorAvg: 80 }
      },
      resources: {
        constrainedResources: [
          { id: 'res_2', name: 'Eggs', currentQty: 2, minStockLevel: 6, daysToDepletion: 2, recommendedPurchaseQty: 12, inCart: false }
        ]
      }
    };

    const res = evaluateDecisions(mockContext);

    const highDecs = res.decisions.filter(d => d.priority === DECISION_PRIORITY_LEVELS.HIGH);
    assert.ok(highDecs.length >= 2);
  });

  await t.test('3. MEDIUM Classification (Low Task Reliability & Goal Gap)', async () => {
    const mockContext = {
      taskReliability: {
        lowReliabilityTasks: [
          { taskKey: 'read_book', taskName: 'Read 20 mins', category: 'OTHER', completionRate: 40, scheduledOccurrences: 10, failureCount: 6 }
        ]
      },
      goals: {
        goals: [
          { goalId: 'g_1', title: 'Master Data Engineering', mappedTaskCount: 2, executionAdherencePct: 70 }
        ]
      }
    };

    const res = evaluateDecisions(mockContext);

    const mediumDecs = res.decisions.filter(d => d.priority === DECISION_PRIORITY_LEVELS.MEDIUM);
    assert.ok(mediumDecs.length >= 2);
  });

  await t.test('4. INFORMATIONAL Classification (Stable Conditions)', async () => {
    const mockContext = {
      adherence: { days30: { averageCapacityAdherence: 95 } },
      resources: { constrainedResources: [] }
    };

    const res = evaluateDecisions(mockContext);

    assert.equal(res.decisions.length, 1);
    assert.equal(res.decisions[0].priority, DECISION_PRIORITY_LEVELS.INFORMATIONAL);
    assert.equal(res.decisions[0].automated, true);
  });

  await t.test('5. Automation Flag Detection (automated: true)', async () => {
    const mockContext = {
      resources: {
        constrainedResources: [
          { id: 'res_milk', name: 'Milk', currentQty: 0, minStockLevel: 1.0, daysToDepletion: 0, inCart: true }
        ]
      }
    };

    const res = evaluateDecisions(mockContext);

    assert.equal(res.automatedCount, 1);
    assert.equal(res.decisions[0].automated, true);
    assert.ok(res.decisions[0].action.includes('queued'));
  });

  await t.test('6. Conflict Resolution & Severity Ranking', async () => {
    const mockContext = {
      resources: {
        constrainedResources: [
          { id: 'res_zero', name: 'Zero Item', currentQty: 0, minStockLevel: 1.0, daysToDepletion: 0, inCart: true },
          { id: 'res_urgent', name: 'Urgent Item', currentQty: 2, minStockLevel: 5, daysToDepletion: 2, inCart: false }
        ]
      },
      adherence: {
        trend: { direction: 'DECLINING', deltaPct: -25, recentAvg: 50, priorAvg: 75 }
      }
    };

    const res = evaluateDecisions(mockContext);

    assert.ok(res.topPriorities[0].severityScore >= res.topPriorities[1].severityScore);
    assert.equal(res.topPriorities[0].priority, DECISION_PRIORITY_LEVELS.CRITICAL);
  });

  await t.test('7. Threshold Enforcement', async () => {
    const mockContext = {
      adherence: {
        trend: { direction: 'DECLINING', deltaPct: -10 } // Decline under 15% threshold -> not HIGH
      }
    };

    const res = evaluateDecisions(mockContext);

    const highAdh = res.decisions.find(d => d.id === 'dec_adh_decline');
    assert.equal(highAdh, undefined, 'Decline of 10% does not trigger HIGH adherence decline decision');
  });

  await t.test('8. Deterministic Fallback Summary Generation', async () => {
    const mockContext = {
      resources: {
        constrainedResources: [
          { id: 'res_1', name: 'Milk', currentQty: 0, minStockLevel: 1.0, daysToDepletion: 0, inCart: true }
        ]
      }
    };

    const fallback = generateFallbackSummary(mockContext);

    assert.ok(fallback.summary);
    assert.ok(Array.isArray(fallback.observations));
    assert.ok(Array.isArray(fallback.recommendations));
    assert.equal(fallback.confidence, 1.0);
    assert.equal(fallback.isFallback, true);
  });
});
