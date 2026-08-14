import { db } from '../db/index.js';
import { taskFailureReasons, taskExecutions, dailyExecutions, resourceStock, weeklyReviews } from '../db/schema.js';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { GoogleGenAI } from '@google/genai';

let genAIClient = null;
function getGenAIClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!genAIClient) {
    genAIClient = new GoogleGenAI({ apiKey });
  }
  return genAIClient;
}

export const VALID_FAILURE_REASONS = [
  'Lack of time',
  'Forgot',
  'No resources',
  'Too tired',
  'Work/college conflict',
  'Started too late',
  'Screen distraction',
  'Meal preparation failure',
  'Other'
];

/**
 * Calculates failure patterns deterministically for a user over a historical window (default 28 days = 4 weeks).
 */
export async function calculateFailurePatterns(userId, weeksCount = 4) {
  const today = new Date();
  const endDateStr = today.toISOString().split('T')[0];
  
  const startDateObj = new Date(today.getTime() - (weeksCount * 7 - 1) * 86400000);
  const startDateStr = startDateObj.toISOString().split('T')[0];

  // Fetch failure reason records in the window
  const failureRecords = await db
    .select()
    .from(taskFailureReasons)
    .where(
      and(
        eq(taskFailureReasons.userId, userId),
        gte(taskFailureReasons.date, startDateStr),
        lte(taskFailureReasons.date, endDateStr)
      )
    )
    .orderBy(desc(taskFailureReasons.date));

  const totalFailures = failureRecords.length;

  // Calculate actual historical date range covered
  let earliestDate = startDateStr;
  let latestDate = endDateStr;
  if (totalFailures > 0) {
    const dates = failureRecords.map(r => r.date).sort();
    earliestDate = dates[0];
    latestDate = dates[dates.length - 1];
  }

  // Calculate reason frequency breakdown deterministically
  const countsByReason = {};
  VALID_FAILURE_REASONS.forEach(r => { countsByReason[r] = 0; });

  failureRecords.forEach(rec => {
    const r = rec.reason;
    if (countsByReason[r] !== undefined) {
      countsByReason[r]++;
    } else {
      countsByReason['Other']++;
    }
  });

  const breakdown = Object.entries(countsByReason)
    .map(([reason, count]) => ({
      reason,
      count,
      percentage: totalFailures > 0 ? Math.round((count / totalFailures) * 100) : 0
    }))
    .filter(item => item.count > 0)
    .sort((a, b) => b.count - a.count);

  const primaryPattern = breakdown.length > 0 ? breakdown[0] : null;
  const secondaryPatterns = breakdown.slice(1);

  // Requirement 32: Analytics Safety — Insufficient Data Handling
  // If fewer than 5 failure records exist, do not present an exaggerated primary bottleneck claim.
  const hasStrongPattern = totalFailures >= 5 && Boolean(primaryPattern);
  
  let patternSummary = '';
  if (totalFailures === 0) {
    patternSummary = 'No task failures recorded in the analyzed period.';
  } else if (totalFailures < 5) {
    patternSummary = `${totalFailures} recent failure(s) recorded as ${primaryPattern.reason}.`;
  } else {
    patternSummary = `${primaryPattern.reason} is the primary execution bottleneck, accounting for ${primaryPattern.percentage}% of recent failures (${primaryPattern.count} of ${totalFailures} recorded misses).`;
  }

  // Calculate Contextual Correlations
  const correlations = [];
  if (totalFailures > 0) {
    // 1. Time Window Correlation
    let morningCount = 0;
    let eveningCount = 0;

    failureRecords.forEach(rec => {
      const k = (rec.taskKey || '').toLowerCase();
      const n = (rec.taskName || '').toLowerCase();
      if (k.includes('am') || k.includes('fajr') || k.includes('05:') || k.includes('08:') || k.includes('09:') || k.includes('11:') || n.includes('morning')) {
        morningCount++;
      } else if (k.includes('pm') || k.includes('isha') || k.includes('20:') || k.includes('21:') || n.includes('evening') || n.includes('night')) {
        eveningCount++;
      }
    });

    if (morningCount > 0 && morningCount >= eveningCount) {
      correlations.push(`Associated with morning tasks (05:00 AM - 12:00 PM)`);
    } else if (eveningCount > 0) {
      correlations.push(`Associated with evening schedule targets (06:00 PM - 10:00 PM)`);
    }

    // 2. Resource Shortage Correlation
    const noResourcesCount = countsByReason['No resources'] || 0;
    if (noResourcesCount > 0) {
      const outOfStockItems = await db
        .select()
        .from(resourceStock)
        .where(and(eq(resourceStock.userId, userId), lte(resourceStock.currentQty, 0)));

      if (outOfStockItems.length > 0) {
        correlations.push(`Occurred alongside ${outOfStockItems.length} out-of-stock resource item(s)`);
      } else {
        correlations.push(`Associated with resource allocation constraints`);
      }
    }

    // 3. Sleep / Tiredness Correlation
    const tooTiredCount = countsByReason['Too tired'] || 0;
    if (tooTiredCount > 0) {
      correlations.push(`Associated with sleep schedule variance or low recovery indicators`);
    }
  }

  // Determine Grounded Potential Intervention (Requirement 14)
  let potentialIntervention = null;
  if (primaryPattern) {
    switch (primaryPattern.reason) {
      case 'Too tired':
      case 'Started too late':
        potentialIntervention = 'Protect the existing 10:00 PM evening shutdown and sleep target.';
        break;
      case 'Meal preparation failure':
        potentialIntervention = 'Ensure evening meal prep templates are executed before shutdown.';
        break;
      case 'No resources':
        potentialIntervention = 'Replenish depleted resource stock items before the week starts.';
        break;
      case 'Screen distraction':
        potentialIntervention = 'Enforce 09:30 PM digital device shutdown rule.';
        break;
      case 'Lack of time':
        potentialIntervention = 'Focus on high-priority morning Doctrine anchors first.';
        break;
      default:
        potentialIntervention = 'Review daily time block scheduling alignment.';
        break;
    }
  }

  // Generate Grounded AI Interpretation (Requirements 15, 16, 17)
  let aiInterpretation = null;
  const ai = getGenAIClient();

  if (ai && totalFailures > 0) {
    try {
      const promptText = `You are a precise, analytical personal execution analyst for Doctrine OS.
Evaluate the following CALCULATED FAILURE PATTERN DATA for the user over the last ${weeksCount} weeks:
- Total Recorded Failures: ${totalFailures}
- Primary Bottleneck: ${primaryPattern ? `${primaryPattern.reason} (${primaryPattern.percentage}%, ${primaryPattern.count} occurrences)` : 'None'}
- Breakdown: ${JSON.stringify(breakdown)}
- Contextual Associations: ${correlations.join(', ') || 'None identified'}
- Operational Intervention Grounding: ${potentialIntervention || 'None'}

CRITICAL RULES:
1. Ground strictly in the facts provided above. Do NOT invent failure counts, percentages, causes, or unrecorded reasons.
2. Output a concise 3 to 4 sentence analytical summary.
3. Tone: Analytical, objective, neutral. Absolutely NO generic motivational quotes or shame language (NO "stay disciplined", "you can do better", "don't give up").`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: [{ role: 'user', parts: [{ text: promptText }] }]
      });

      if (response.text) {
        aiInterpretation = response.text.trim();
      }
    } catch (e) {
      console.error('[FailurePatternService] AI interpretation error:', e);
    }
  }

  return {
    userId,
    weeksCount,
    startDateStr,
    endDateStr,
    earliestDate,
    latestDate,
    totalFailures,
    hasStrongPattern,
    patternSummary,
    primaryPattern,
    secondaryPatterns,
    breakdown,
    correlations,
    potentialIntervention,
    aiInterpretation,
    failureRecords
  };
}
