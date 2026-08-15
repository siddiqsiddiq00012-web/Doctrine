import { eq, and, sql } from 'drizzle-orm';
import { financialTransactions, financialGoals } from '../db/schema.js';

/**
 * Calculates authoritative total allocated integer paise from ledger transactions.
 * Source of Truth: financial_transactions where type = 'ALLOCATION' and financial_goal_id = goalId
 */
export async function calculateLedgerGoalAllocationPaise(db, userId, goalId) {
  if (!userId || !goalId) return 0;

  const [result] = await db
    .select({
      totalAllocatedPaise: sql`COALESCE(SUM(${financialTransactions.amountPaise}), 0)`
    })
    .from(financialTransactions)
    .where(
      and(
        eq(financialTransactions.userId, userId),
        eq(financialTransactions.financialGoalId, goalId),
        eq(financialTransactions.type, 'ALLOCATION')
      )
    );

  return Number(result?.totalAllocatedPaise || 0);
}

/**
 * Deterministically synchronizes financial_goals.allocated_amount_paise cache
 * against authoritative ledger allocation transactions.
 * NEVER mutates financial_transactions ledger records.
 */
export async function syncGoalAllocationCache(db, userId, goalId) {
  if (!userId || !goalId) {
    throw new Error('userId and goalId are required for goal allocation synchronization');
  }

  const [goal] = await db
    .select()
    .from(financialGoals)
    .where(and(eq(financialGoals.userId, userId), eq(financialGoals.id, goalId)));

  if (!goal) {
    throw new Error(`Financial goal not found or access denied for goalId: ${goalId}`);
  }

  const authoritativeLedgerPaise = await calculateLedgerGoalAllocationPaise(db, userId, goalId);
  const previousCachePaise = goal.allocatedAmountPaise || 0;

  if (previousCachePaise !== authoritativeLedgerPaise) {
    await db
      .update(financialGoals)
      .set({
        allocatedAmountPaise: authoritativeLedgerPaise,
        updatedAt: new Date().toISOString()
      })
      .where(and(eq(financialGoals.userId, userId), eq(financialGoals.id, goalId)));

    return {
      updated: true,
      ledgerPaise: authoritativeLedgerPaise,
      previousCachePaise
    };
  }

  return {
    updated: false,
    ledgerPaise: authoritativeLedgerPaise,
    previousCachePaise
  };
}
