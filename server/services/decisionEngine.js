import { buildIntelligenceContext } from './intelligenceContextService.js';

/**
 * DOCTRINE DETERMINISTIC DECISION PRIORITY & CONFLICT RESOLUTION ENGINE
 * Evaluates structured intelligence context and generates ranked actionable signals.
 *
 * CRITICAL ARCHITECTURAL GUARANTEES:
 * 1. 100% DETERMINISTIC: Priority scores and thresholds are mathematically calculated.
 * 2. AUTOMATION-AWARE: Distinguishes 'USER ACTION REQUIRED' from 'ALREADY AUTOMATED'.
 * 3. CONFLICT RESOLUTION: Ranks competing signals into CRITICAL, HIGH, MEDIUM, INFORMATIONAL.
 * 4. FALLBACK SUMMARY: Generates a complete structured summary if Gemini is unavailable.
 */

export const DECISION_PRIORITY_LEVELS = {
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  INFORMATIONAL: 'INFORMATIONAL',
};

/**
 * Evaluates structured intelligence context and produces prioritized decision signals.
 */
export function evaluateDecisions(context) {
  if (!context) {
    return { decisions: [], topPriorities: [], automatedCount: 0 };
  }

  const decisions = [];

  // 1. RESOURCE CONSTRAINTS & DEPLETION
  const constrainedResources = context.resources?.constrainedResources || [];
  constrainedResources.forEach((res) => {
    const isZeroStock = res.currentQty <= 0;
    const isUrgentDepletion = res.daysToDepletion !== null && res.daysToDepletion <= 3;
    const isInCart = Boolean(res.inCart);

    if (isZeroStock) {
      decisions.push({
        id: `dec_res_zero_${res.id}`,
        category: 'RESOURCE',
        priority: DECISION_PRIORITY_LEVELS.CRITICAL,
        severityScore: 100,
        title: `Resource Depleted: ${res.name}`,
        description: `Current stock of ${res.name} is 0 ${res.unit || ''}.`,
        evidence: `Quantity = 0. Min stock level = ${res.minStockLevel}.`,
        action: isInCart
          ? `Doctrine has queued ${res.name} in your purchase cart.`
          : `Restock ${res.name} immediately.`,
        automated: isInCart,
        targetId: res.id,
      });
    } else if (isUrgentDepletion) {
      decisions.push({
        id: `dec_res_urgent_${res.id}`,
        category: 'RESOURCE',
        priority: DECISION_PRIORITY_LEVELS.HIGH,
        severityScore: 75,
        title: `Resource Depletion Warning: ${res.name}`,
        description: `${res.name} is projected to deplete in ${res.daysToDepletion} days.`,
        evidence: `Projected depletion in ${res.daysToDepletion} days. Current stock = ${res.currentQty}.`,
        action: isInCart
          ? `Purchase item queued in active cart.`
          : `Prepare purchase of ${res.recommendedPurchaseQty || 1} units of ${res.name}.`,
        automated: isInCart,
        targetId: res.id,
      });
    }
  });

  // 2. FINANCIAL DEFICIT & CASH CONSTRAINTS
  const finances = context.finances || {};
  if (finances.isDeficit || (finances.netCashPaise !== undefined && finances.netCashPaise < 0)) {
    const deficitRupees = Math.abs(finances.netCashPaise || 0) / 100;
    decisions.push({
      id: 'dec_fin_deficit',
      category: 'FINANCE',
      priority: DECISION_PRIORITY_LEVELS.CRITICAL,
      severityScore: 100,
      title: 'Financial Deficit Detected',
      description: `Net financial position is in deficit by ₹${deficitRupees.toFixed(2)}.`,
      evidence: `Net cash balance = -₹${deficitRupees.toFixed(2)}.`,
      action: 'Defer non-essential cart purchases and preserve spendable cash reserve.',
      automated: false,
      targetId: 'finances',
    });
  }

  // 3. ADHERENCE DECLINE & STREAK BREAKS
  const adherence = context.adherence || {};
  const trend = adherence.trend || {};
  if (trend.direction === 'DECLINING' && trend.deltaPct <= -15) {
    decisions.push({
      id: 'dec_adh_decline',
      category: 'ADHERENCE',
      priority: DECISION_PRIORITY_LEVELS.HIGH,
      severityScore: 80,
      title: 'Major Adherence Decline',
      description: `30-day protocol adherence dropped by ${Math.abs(trend.deltaPct)}%.`,
      evidence: `Recent period average = ${trend.recentAvg}%, prior period average = ${trend.priorAvg}%.`,
      action: 'Consider switching capacity mode to MINIMUM_VIABLE to protect essential anchors.',
      automated: false,
      targetId: 'adherence',
    });
  }

  // 4. TASK RELIABILITY BOTTLENECKS
  const lowReliabilityTasks = context.taskReliability?.lowReliabilityTasks || [];
  lowReliabilityTasks.forEach((task) => {
    const isHighPriority = task.category === 'NAMAZ' || task.category === 'ANCHOR' || task.category === 'DATA_ENG';
    const priority = isHighPriority ? DECISION_PRIORITY_LEVELS.HIGH : DECISION_PRIORITY_LEVELS.MEDIUM;
    const severityScore = isHighPriority ? 75 : 50;

    decisions.push({
      id: `dec_task_low_rel_${task.taskKey}`,
      category: 'TASK_RELIABILITY',
      priority,
      severityScore,
      title: `Low Task Reliability: ${task.taskName || task.taskKey}`,
      description: `${task.taskName || task.taskKey} has a ${task.completionRate}% completion rate over the last 30 days.`,
      evidence: `Scheduled ${task.scheduledOccurrences} times, missed/skipped ${task.failureCount} times.`,
      action: `Review timing and capacity allocation for ${task.taskName || task.taskKey}.`,
      automated: false,
      targetId: task.taskKey,
    });
  });

  // 5. GOAL EXECUTION GAPS
  const activeGoals = context.goals?.goals || [];
  activeGoals.forEach((goal) => {
    if (goal.mappedTaskCount > 0 && goal.executionAdherencePct < 80) {
      const gap = 100 - goal.executionAdherencePct;
      const priority = gap >= 40 ? DECISION_PRIORITY_LEVELS.HIGH : DECISION_PRIORITY_LEVELS.MEDIUM;

      decisions.push({
        id: `dec_goal_gap_${goal.goalId}`,
        category: 'GOAL',
        priority,
        severityScore: gap >= 40 ? 70 : 45,
        title: `Goal Execution Gap: ${goal.title}`,
        description: `Mapped task execution for "${goal.title}" is running at ${goal.executionAdherencePct}%.`,
        evidence: `${goal.mappedTaskCount} mapped tasks with 30-day execution adherence of ${goal.executionAdherencePct}%.`,
        action: `Increase execution consistency for tasks linked to "${goal.title}".`,
        automated: false,
        targetId: goal.goalId,
      });
    }
  });

  // 6. FAILURE PATTERN CONCENTRATION
  const failures = context.failures || {};
  if (failures.primaryPattern && failures.totalFailures >= 3) {
    const pattern = failures.primaryPattern;
    decisions.push({
      id: 'dec_fail_pattern',
      category: 'FAILURE_PATTERN',
      priority: DECISION_PRIORITY_LEVELS.MEDIUM,
      severityScore: 50,
      title: `Primary Bottleneck: ${pattern.reason}`,
      description: `"${pattern.reason}" accounts for ${pattern.percentage}% of recorded misses.`,
      evidence: `${pattern.count} of ${failures.totalFailures} recorded task failures attributed to "${pattern.reason}".`,
      action: `Address root friction point: "${pattern.reason}".`,
      automated: false,
      targetId: 'failures',
    });
  }

  // 7. INFORMATIONAL STABILITY (If no critical/high issues exist)
  if (decisions.length === 0) {
    decisions.push({
      id: 'dec_info_stable',
      category: 'SYSTEM',
      priority: DECISION_PRIORITY_LEVELS.INFORMATIONAL,
      severityScore: 25,
      title: 'Protocol Operations Stable',
      description: 'Protocol adherence and inventory levels remain steady.',
      evidence: `Current adherence = ${context.adherence?.days30?.averageCapacityAdherence || 100}%. 0 urgent shortages.`,
      action: 'Maintain current daily execution routine.',
      automated: true,
      targetId: 'system',
    });
  }

  // Conflict Resolution & Ranking
  decisions.sort((a, b) => b.severityScore - a.severityScore);

  const automatedCount = decisions.filter((d) => d.automated).length;
  const topPriorities = decisions.slice(0, 5);

  return {
    totalDecisions: decisions.length,
    automatedCount,
    topPriorities,
    decisions,
  };
}

/**
 * Generates a deterministic fallback structured intelligence summary if AI is unavailable.
 */
export function generateFallbackSummary(context, decisionResult = null) {
  const evalResult = decisionResult || evaluateDecisions(context);
  const topDecisions = evalResult.topPriorities || [];

  const summary = topDecisions.length > 0
    ? `Protocol Status: ${topDecisions[0].title}. ${topDecisions[0].description}`
    : 'Protocol status normal and stable.';

  const observations = topDecisions.map((d) => ({
    type: d.category,
    severity: d.priority,
    evidence: d.evidence,
  }));

  const recommendations = topDecisions.map((d) => ({
    priority: d.priority,
    action: d.action,
    reason: d.description,
    evidence: d.evidence,
    automated: d.automated,
  }));

  return {
    summary,
    observations,
    recommendations,
    confidence: 1.0, // 100% deterministic fallback confidence
    isFallback: true,
    generatedAt: new Date().toISOString(),
  };
}
