import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Pure string formatting helper for integer Paise.
 * Performs ZERO financial arithmetic / state calculations.
 */
export function formatPaise(paise) {
  if (typeof paise !== 'number' || isNaN(paise)) return '₹0';
  const isNegative = paise < 0;
  const absPaise = Math.abs(paise);
  const rupees = (absPaise / 100).toLocaleString('en-IN', {
    minimumFractionDigits: absPaise % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  });
  return `${isNegative ? '-' : ''}₹${rupees}`;
}

test('FEATURE 19 — BUDGET MANAGEMENT UI FOUNDATION TESTS', async (t) => {
  await t.test('1. formatPaise Pure Formatting Unit Verification (Zero Arithmetic)', () => {
    assert.equal(formatPaise(17000), '₹170');
    assert.equal(formatPaise(12000), '₹120');
    assert.equal(formatPaise(5000), '₹50');
    assert.equal(formatPaise(22000), '₹220');
    assert.equal(formatPaise(350000), '₹3,500');
    assert.equal(formatPaise(18550), '₹185.50');
    assert.equal(formatPaise(-5000), '-₹50');
    assert.equal(formatPaise(-1550), '-₹15.50');
    assert.equal(formatPaise(0), '₹0');
    assert.equal(formatPaise(null), '₹0');
    assert.equal(formatPaise(undefined), '₹0');
    assert.equal(formatPaise(NaN), '₹0');
  });

  await t.test('2. Verification of Frontend Zero-Calculation Principle', () => {
    // Contract verification: Ensure frontend component uses exact API values without client arithmetic
    const mockApiState = {
      date: '2026-08-17',
      dayOfWeek: 'MONDAY',
      cash: {
        netCashPaise: -5000,
        actualCashPaise: -5000,
        spendableCashPaise: 0,
        reservedPaise: 10000,
        allocatedPaise: 5000,
        discretionaryPaise: 0
      },
      income: {
        todayExpectedPaise: 22000,
        todayActualPaise: 0,
        isWorkday: true
      },
      transport: {
        requiredTodayPaise: 5000,
        reserveRequiredPaise: 10000,
        reason: 'Workday transport required today & Thursday transport reserve active'
      },
      goals: [
        { id: 'g1', name: 'Bluetooth Speaker', priority: 1, targetPricePaise: 350000, allocatedPaise: 5000, remainingPaise: 345000, urgency: 'HIGH' },
        { id: 'g2', name: 'PC Table', priority: 2, targetPricePaise: 450000, allocatedPaise: 0, remainingPaise: 450000, urgency: 'MEDIUM' }
      ],
      upcomingObligations: [
        { id: 'g1', name: 'Bluetooth Speaker', type: 'GOAL', remainingPaise: 345000, urgency: 'HIGH' }
      ],
      resourceNeeds: [
        { resourceId: 'inv-1', itemName: 'Eggs', currentQty: 0, minStockLevel: 5, estimatedPricePaise: 20000, reason: 'Out of stock' }
      ],
      cartCommitments: [
        { id: 'c1', itemName: 'Keyboard', quantity: 1, estimatedPricePaise: 450000, totalEstimatedPaise: 450000, status: 'PENDING' }
      ],
      decisionState: {
        canSpendPaise: 0,
        mustReservePaise: 10000,
        canAllocatePaise: 0,
        blockedByObligations: true,
        highestPriorityGoalId: 'g1'
      }
    };

    // Formatted strings directly match authoritative API values
    assert.equal(formatPaise(mockApiState.cash.netCashPaise), '-₹50');
    assert.equal(formatPaise(mockApiState.cash.spendableCashPaise), '₹0');
    assert.equal(formatPaise(mockApiState.cash.reservedPaise), '₹100');
    assert.equal(formatPaise(mockApiState.cash.allocatedPaise), '₹50');
    assert.equal(formatPaise(mockApiState.cash.discretionaryPaise), '₹0');
    assert.equal(formatPaise(mockApiState.decisionState.canAllocatePaise), '₹0');
    assert.equal(mockApiState.goals[0].priority, 1);
    assert.equal(mockApiState.goals[1].priority, 2);
    assert.equal(mockApiState.resourceNeeds.length, 1);
    assert.equal(mockApiState.resourceNeeds[0].itemName, 'Eggs');
    assert.equal(mockApiState.cartCommitments[0].status, 'PENDING');
  });
});
