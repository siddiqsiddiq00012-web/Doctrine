import { eq, and, sql, asc } from 'drizzle-orm';
import {
  financialTransactions,
  financialGoals,
  cartItems,
  purchaseRecords,
  financialPreferences,
  resourceStock
} from '../db/schema.js';
import { syncGoalAllocationCache } from './financialSyncService.js';
import { INITIAL_INVENTORY } from '../../src/data/doctrineData.js';

const DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

/**
 * DETERMINISTIC FINANCIAL ENGINE
 * Computes authoritative financial state, cash balance, discretionary spending limits,
 * transport obligations, goal allocations, resource depletion needs, and cart intent.
 *
 * Rules:
 * 1. ACTUAL CASH = SUM(INCOME) - SUM(EXPENSE)
 * 2. RESERVE and ALLOCATION reduce discretionary money, NOT actual cash.
 * 3. Pending Cart items represent INTENT only and do NOT reduce cash or discretionary money automatically.
 * 4. User goal priority (1 > 2 > 3) is 100% authoritative and preserved.
 * 5. Multi-tenant isolated per userId.
 * 6. Zero AI dependencies / 100% deterministic.
 */
export async function calculateFinancialState(db, userId, targetDateStr = null) {
  if (!userId) {
    throw new Error('[FinancialEngine Error] userId is required');
  }

  // Derive target date and day of week
  const dateStr = targetDateStr || new Date().toISOString().split('T')[0];
  const targetDate = new Date(`${dateStr}T00:00:00Z`);
  if (isNaN(targetDate.getTime())) {
    throw new Error(`[FinancialEngine Error] Invalid targetDateStr format: ${targetDateStr}`);
  }
  const dayOfWeek = DAYS[targetDate.getUTCDay()];

  // 1. Fetch User Financial Preferences
  let [pref] = await db
    .select()
    .from(financialPreferences)
    .where(eq(financialPreferences.userId, userId));

  if (!pref) {
    pref = {
      dailyWorkdayIncomePaise: 22000, // ₹220.00
      transportDailyCostPaise: 5000,  // ₹50.00
      transportReserveDay: 'THURSDAY',
      transportReserveAmountPaise: 10000, // ₹100.00
      workdaysJson: JSON.stringify(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY']),
      weeklyBudgetLimitPaise: 0,
      autoApproveThresholdPaise: 0
    };
  }

  let workdays = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY'];
  try {
    workdays = JSON.parse(pref.workdaysJson || '[]');
  } catch (e) {}

  const isWorkday = workdays.includes(dayOfWeek);

  // 2. Fetch Authoritative Ledger Totals from financial_transactions
  const userTransactions = await db
    .select()
    .from(financialTransactions)
    .where(eq(financialTransactions.userId, userId));

  let totalIncomePaise = 0;
  let totalExpensePaise = 0;
  let totalReservePaise = 0;
  let totalAllocationPaise = 0;

  let todayActualIncomePaise = 0;

  userTransactions.forEach((tx) => {
    const amount = Number(tx.amountPaise || 0);
    if (tx.type === 'INCOME') {
      totalIncomePaise += amount;
      if (tx.date === dateStr) {
        todayActualIncomePaise += amount;
      }
    } else if (tx.type === 'EXPENSE') {
      totalExpensePaise += amount;
    } else if (tx.type === 'RESERVE') {
      totalReservePaise += amount;
    } else if (tx.type === 'ALLOCATION') {
      totalAllocationPaise += amount;
    }
  });

  // Formula 1: Net Cash = SUM(INCOME) - SUM(EXPENSE) (Unclamped actual financial truth)
  const netCashPaise = totalIncomePaise - totalExpensePaise;
  const actualCashPaise = netCashPaise;
  const spendableCashPaise = Math.max(0, netCashPaise);

  // Income expected today
  const todayExpectedIncomePaise = isWorkday ? Number(pref.dailyWorkdayIncomePaise || 22000) : 0;

  // Transport calculations derived from preferences
  const requiredTodayTransportPaise = isWorkday ? Number(pref.transportDailyCostPaise || 5000) : 0;
  const isReserveDay = dayOfWeek === pref.transportReserveDay;
  const reserveRequiredTransportPaise = isReserveDay ? Number(pref.transportReserveAmountPaise || 10000) : 0;

  let transportReason = 'Non-workday / no transport obligation';
  if (isWorkday && isReserveDay) {
    transportReason = `Workday transport required today & ${pref.transportReserveDay} transport reserve active`;
  } else if (isWorkday) {
    transportReason = 'Workday transport required today';
  } else if (isReserveDay) {
    transportReason = `${pref.transportReserveDay} transport reserve required today`;
  }

  // 3. Fetch Financial Goals (Sorted strictly by User Priority ASC)
  const rawGoals = await db
    .select()
    .from(financialGoals)
    .where(eq(financialGoals.userId, userId))
    .orderBy(asc(financialGoals.priority));

  const goals = [];
  const upcomingObligations = [];

  for (const g of rawGoals) {
    // Perform deterministic cache sync check
    await syncGoalAllocationCache(db, userId, g.id);

    // Re-read authoritative ledger allocation for goal
    const goalLedgerAllocPaise = userTransactions
      .filter((t) => t.financialGoalId === g.id && t.type === 'ALLOCATION')
      .reduce((sum, t) => sum + Number(t.amountPaise || 0), 0);

    const allocatedPaise = Math.max(Number(g.allocatedAmountPaise || 0), goalLedgerAllocPaise);
    const targetPricePaise = Number(g.targetPricePaise || 0);
    const remainingPaise = Math.max(0, targetPricePaise - allocatedPaise);

    const goalItem = {
      id: g.id,
      name: g.name,
      priority: g.priority,
      targetPricePaise,
      allocatedPaise,
      remainingPaise,
      urgency: g.urgency,
      deadlineDate: g.deadlineDate || null,
      desiredPurchaseDate: g.desiredPurchaseDate || null,
      status: g.status
    };

    goals.push(goalItem);

    if (remainingPaise > 0 && (g.urgency === 'CRITICAL' || g.urgency === 'HIGH' || g.deadlineDate || g.desiredPurchaseDate)) {
      upcomingObligations.push({
        id: g.id,
        name: g.name,
        type: 'GOAL',
        remainingPaise,
        urgency: g.urgency,
        deadlineDate: g.deadlineDate || null
      });
    }
  }

  // 4. Fetch Cart Items (Purchase Intent)
  const rawCart = await db
    .select()
    .from(cartItems)
    .where(eq(cartItems.userId, userId));

  const cartCommitments = rawCart
    .filter((c) => c.status === 'PENDING' || c.status === 'APPROVED')
    .map((c) => ({
      id: c.id,
      itemName: c.itemName,
      resourceId: c.resourceId || null,
      quantity: Number(c.quantity || 1),
      estimatedPricePaise: Number(c.estimatedPricePaise || 0),
      totalEstimatedPaise: Math.round(Number(c.quantity || 1) * Number(c.estimatedPricePaise || 0)),
      status: c.status
    }));

  // 5. Fetch Resource Stock & Depletion Needs
  const dbStocks = await db
    .select()
    .from(resourceStock)
    .where(eq(resourceStock.userId, userId));

  const stockMap = new Map(dbStocks.map((s) => [s.resourceId, s]));
  const resourceNeeds = [];

  INITIAL_INVENTORY.forEach((item) => {
    const stockRec = stockMap.get(item.id);
    const currentQty = stockRec ? stockRec.currentQty : item.currentQty;

    // Resource purchase urgency: Only flag if stock <= minStockLevel or currentQty <= 0
    if (currentQty <= (item.minStockLevel || 0) || currentQty <= 0) {
      resourceNeeds.push({
        resourceId: item.id,
        itemName: item.name,
        category: item.category,
        currentQty,
        minStockLevel: item.minStockLevel || 0,
        estimatedPricePaise: item.estimatedPrice ? Math.round(item.estimatedPrice * 100) : 0,
        neededNow: true,
        reason: currentQty <= 0 ? 'Out of stock' : 'At or below minimum stock level'
      });
    }
  });

  // 6. Calculate Discretionary Money & Decision State
  // Discretionary Cash = Net Cash - Total Reserves - Total Allocations
  const totalCommittedPaise = totalReservePaise + totalAllocationPaise;
  const rawDiscretionaryPaise = netCashPaise - totalCommittedPaise;

  const discretionaryPaise = Math.max(0, rawDiscretionaryPaise);
  const blockedByObligations = rawDiscretionaryPaise < 0 || netCashPaise < totalCommittedPaise || netCashPaise < 0;

  const canSpendPaise = blockedByObligations ? 0 : discretionaryPaise;
  const canAllocatePaise = blockedByObligations ? 0 : discretionaryPaise;
  const highestPriorityGoalId = goals.length > 0 ? goals[0].id : null;

  return {
    date: dateStr,
    dayOfWeek,

    cash: {
      netCashPaise,
      actualCashPaise: netCashPaise, // Full financial truth preserved (can be negative!)
      spendableCashPaise,
      reservedPaise: totalReservePaise,
      allocatedPaise: totalAllocationPaise,
      discretionaryPaise
    },

    income: {
      todayExpectedPaise: todayExpectedIncomePaise,
      todayActualPaise: todayActualIncomePaise,
      isWorkday
    },

    transport: {
      requiredTodayPaise: requiredTodayTransportPaise,
      reserveRequiredPaise: reserveRequiredTransportPaise,
      reason: transportReason
    },

    goals,

    upcomingObligations,

    resourceNeeds,

    cartCommitments,

    decisionState: {
      canSpendPaise,
      mustReservePaise: reserveRequiredTransportPaise,
      canAllocatePaise,
      blockedByObligations,
      highestPriorityGoalId
    }
  };
}
