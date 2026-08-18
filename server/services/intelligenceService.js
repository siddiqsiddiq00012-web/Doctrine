import { GoogleGenAI } from '@google/genai';
import { buildIntelligenceContext } from './intelligenceContextService.js';
import { evaluateDecisions, generateFallbackSummary } from './decisionEngine.js';

/**
 * DOCTRINE STRUCTURED INTELLIGENCE & REASONING SERVICE
 * Executes AI reasoning over deterministic structured context using Gemini 2.5 Flash.
 *
 * CRITICAL ARCHITECTURAL GUARANTEES:
 * 1. AI REASONS OVER FACTS: Gemini receives structured facts from intelligenceContextService.
 * 2. ZERO WRITE AUTHORITY: AI output is strictly advisory. Zero database mutations.
 * 3. VALIDATED CONTRACT: Enforces strict JSON output schema (summary, observations, recommendations).
 * 4. RESILIENT FALLBACK: API outage/malformed JSON falls back cleanly to deterministic decisionEngine.
 * 5. SELECTIVE INVOCATION: Zero LLM invocations during routine TASK_COMPLETED event processing.
 */

let genAIClient = null;

export function setGenAIClient(client) {
  genAIClient = client;
}

function getGenAIClient() {
  if (genAIClient) return genAIClient;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    genAIClient = new GoogleGenAI({ apiKey });
    return genAIClient;
  } catch (e) {
    console.error('[IntelligenceService] Error initializing GenAI client:', e.message);
    return null;
  }
}

export const INTELLIGENCE_MODES = {
  DAILY_REASONING: 'DAILY_REASONING',
  WEEKLY_REASONING: 'WEEKLY_REASONING',
  DECISION_SUPPORT: 'DECISION_SUPPORT',
  FAILURE_ANALYSIS: 'FAILURE_ANALYSIS',
};

/**
 * Validates that an AI output object satisfies the structured recommendation contract.
 */
export function validateIntelligenceOutput(output) {
  if (!output || typeof output !== 'object') return false;
  if (typeof output.summary !== 'string' || output.summary.trim().length === 0) return false;

  if (!Array.isArray(output.observations)) return false;
  for (const obs of output.observations) {
    if (!obs || typeof obs.type !== 'string' || typeof obs.evidence !== 'string') return false;
  }

  if (!Array.isArray(output.recommendations)) return false;
  for (const rec of output.recommendations) {
    if (!rec || typeof rec.priority !== 'string' || typeof rec.action !== 'string' || typeof rec.evidence !== 'string') {
      return false;
    }
  }

  return true;
}

/**
 * Builds system prompt for Gemini based on intelligence mode and context.
 */
function buildSystemPrompt(mode, context, decisions) {
  return `
You are Doctrine OS Intelligence — an evidence-based, deterministic operating system assistant.

STRICT OPERATING RULES:
1. Reason strictly over the provided verified facts. Never invent unrecorded events or psychological causes.
2. DO NOT make psychological claims (e.g. "you fear failure" or "you lack motivation"). State evidence-based observations.
3. Acknowledge items marked as "automated: true" as already handled by Doctrine.
4. Output strictly valid JSON matching the following contract:
{
  "summary": "Concise 1-2 sentence executive overview",
  "observations": [
    { "type": "ADHERENCE|RESOURCE|FINANCE|GOAL|FAILURE", "severity": "CRITICAL|HIGH|MEDIUM|INFORMATIONAL", "evidence": "Factual evidence string" }
  ],
  "recommendations": [
    { "priority": "CRITICAL|HIGH|MEDIUM|INFORMATIONAL", "action": "Clear actionable recommendation", "reason": "Why this matters", "evidence": "Exact metric evidence", "automated": boolean }
  ],
  "confidence": 0.95
}

INTELLIGENCE MODE: ${mode}
VERIFIED DOCTRINE CONTEXT:
${JSON.stringify(context, null, 2)}

DETERMINISTIC DECISIONS:
${JSON.stringify(decisions, null, 2)}
`;
}

/**
 * Main Entry Point: Gets structured intelligence for a given mode and user.
 */
export async function getStructuredIntelligence(dbClient, userId, mode = INTELLIGENCE_MODES.DAILY_REASONING, options = {}) {
  // 1. Build deterministic context
  const context = await buildIntelligenceContext(dbClient, userId, options);

  // 2. Evaluate deterministic decision rules
  const decisionResult = evaluateDecisions(context);

  // 3. Check for Gemini client availability
  const aiClient = getGenAIClient();
  if (!aiClient || options.skipAi) {
    return generateFallbackSummary(context, decisionResult);
  }

  // 4. Invoke Gemini AI model for contextual reasoning
  try {
    const model = options.modelName || 'gemini-2.5-flash';
    const prompt = buildSystemPrompt(mode, context, decisionResult.topPriorities);

    const response = await aiClient.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const text = response?.text?.() || response?.response?.text?.() || '';
    if (!text) {
      console.warn('[IntelligenceService] Gemini returned empty response. Falling back to deterministic summary.');
      return generateFallbackSummary(context, decisionResult);
    }

    const parsed = JSON.parse(text);
    if (!validateIntelligenceOutput(parsed)) {
      console.warn('[IntelligenceService] Gemini output failed contract validation. Falling back to deterministic summary.');
      return generateFallbackSummary(context, decisionResult);
    }

    return {
      mode,
      summary: parsed.summary,
      observations: parsed.observations,
      recommendations: parsed.recommendations,
      confidence: parsed.confidence || 0.95,
      isFallback: false,
      generatedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error('[IntelligenceService Error] Gemini invocation failed:', err.message);
    return generateFallbackSummary(context, decisionResult);
  }
}
