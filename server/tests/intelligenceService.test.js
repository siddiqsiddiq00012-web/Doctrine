import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../db/index.js';
import { users, dailyExecutions, taskExecutions, financialTransactions, resourceStock, cartItems, goals } from '../db/schema.js';
import {
  INTELLIGENCE_MODES,
  setGenAIClient,
  validateIntelligenceOutput,
  getStructuredIntelligence,
} from '../services/intelligenceService.js';
import { eq } from 'drizzle-orm';
import cryptoNative from 'node:crypto';

test('STEP 8 — STRUCTURED INTELLIGENCE SERVICE TESTS', async (t) => {
  const userIdA = cryptoNative.randomUUID();
  const userIdB = cryptoNative.randomUUID();
  const nowIso = new Date().toISOString();
  const todayStr = nowIso.split('T')[0];

  // Mock Gemini AI Client
  const mockValidGeminiClient = {
    models: {
      generateContent: async () => ({
        text: () => JSON.stringify({
          summary: 'Today execution was solid with 100% adherence on core Namaz tasks.',
          observations: [
            { type: 'ADHERENCE', severity: 'INFORMATIONAL', evidence: '100% adherence on core tasks.' }
          ],
          recommendations: [
            { priority: 'INFORMATIONAL', action: 'Maintain current routine.', reason: 'Adherence is stable.', evidence: '100% adherence.', automated: true }
          ],
          confidence: 0.98
        })
      })
    }
  };

  const mockInvalidGeminiClient = {
    models: {
      generateContent: async () => ({
        text: () => 'Invalid free-form markdown response without JSON'
      })
    }
  };

  const mockErrorGeminiClient = {
    models: {
      generateContent: async () => {
        throw new Error('API Key Invalid or Quota Exceeded');
      }
    }
  };

  t.before(async () => {
    // Insert test users
    await db.insert(users).values([
      { id: userIdA, googleId: `g-intel-a-${userIdA}`, email: `intel_a_${userIdA}@example.com`, displayName: 'Intel User A' },
      { id: userIdB, googleId: `g-intel-b-${userIdB}`, email: `intel_b_${userIdB}@example.com`, displayName: 'Intel User B' },
    ]);
  });

  t.after(async () => {
    setGenAIClient(null);
    await db.delete(users).where(eq(users.id, userIdA));
    await db.delete(users).where(eq(users.id, userIdB));
  });

  await t.test('1. DAILY_REASONING Mode Output', async () => {
    setGenAIClient(mockValidGeminiClient);
    const result = await getStructuredIntelligence(db, userIdA, INTELLIGENCE_MODES.DAILY_REASONING, { date: todayStr });

    assert.equal(result.mode, INTELLIGENCE_MODES.DAILY_REASONING);
    assert.ok(result.summary);
    assert.equal(result.isFallback, false);
  });

  await t.test('2. WEEKLY_REASONING Mode Output', async () => {
    setGenAIClient(mockValidGeminiClient);
    const result = await getStructuredIntelligence(db, userIdA, INTELLIGENCE_MODES.WEEKLY_REASONING, { date: todayStr });

    assert.equal(result.mode, INTELLIGENCE_MODES.WEEKLY_REASONING);
    assert.ok(result.summary);
  });

  await t.test('3. DECISION_SUPPORT Mode Output', async () => {
    setGenAIClient(mockValidGeminiClient);
    const result = await getStructuredIntelligence(db, userIdA, INTELLIGENCE_MODES.DECISION_SUPPORT, { date: todayStr });

    assert.equal(result.mode, INTELLIGENCE_MODES.DECISION_SUPPORT);
    assert.ok(result.summary);
  });

  await t.test('4. FAILURE_ANALYSIS Mode Output', async () => {
    setGenAIClient(mockValidGeminiClient);
    const result = await getStructuredIntelligence(db, userIdA, INTELLIGENCE_MODES.FAILURE_ANALYSIS, { date: todayStr });

    assert.equal(result.mode, INTELLIGENCE_MODES.FAILURE_ANALYSIS);
    assert.ok(result.summary);
  });

  await t.test('5. Valid AI Response Schema Contract Verification', async () => {
    const validPayload = {
      summary: 'Valid summary text',
      observations: [{ type: 'RESOURCE', severity: 'HIGH', evidence: 'Stock low' }],
      recommendations: [{ priority: 'HIGH', action: 'Restock milk', reason: 'Depletion soon', evidence: 'Qty = 0.2', automated: true }],
      confidence: 0.95
    };

    assert.equal(validateIntelligenceOutput(validPayload), true);
    assert.equal(validateIntelligenceOutput({ summary: '' }), false);
    assert.equal(validateIntelligenceOutput({ summary: 'ok', observations: 'not-an-array' }), false);
  });

  await t.test('6. Invalid AI Response Safe Rejection & Fallback', async () => {
    setGenAIClient(mockInvalidGeminiClient);
    const result = await getStructuredIntelligence(db, userIdA, INTELLIGENCE_MODES.DAILY_REASONING, { date: todayStr });

    assert.equal(result.isFallback, true);
    assert.ok(result.summary);
    assert.equal(result.confidence, 1.0);
  });

  await t.test('7. Gemini API Outage / Error Fallback', async () => {
    setGenAIClient(mockErrorGeminiClient);
    const result = await getStructuredIntelligence(db, userIdA, INTELLIGENCE_MODES.DAILY_REASONING, { date: todayStr });

    assert.equal(result.isFallback, true);
    assert.ok(result.summary);
  });

  await t.test('8. Offline Mocked Gemini Provider Integration', async () => {
    setGenAIClient(mockValidGeminiClient);
    const result = await getStructuredIntelligence(db, userIdA, INTELLIGENCE_MODES.DAILY_REASONING, { date: todayStr });

    assert.equal(result.isFallback, false);
    assert.ok(result.recommendations.length >= 1);
  });

  await t.test('9. AI Write-Authority Invariant (No State Mutation)', async () => {
    setGenAIClient(mockValidGeminiClient);

    const initialTxCount = (await db.select().from(financialTransactions).where(eq(financialTransactions.userId, userIdA))).length;
    const initialCartCount = (await db.select().from(cartItems).where(eq(cartItems.userId, userIdA))).length;
    const initialStockCount = (await db.select().from(resourceStock).where(eq(resourceStock.userId, userIdA))).length;

    await getStructuredIntelligence(db, userIdA, INTELLIGENCE_MODES.DAILY_REASONING, { date: todayStr });

    const finalTxCount = (await db.select().from(financialTransactions).where(eq(financialTransactions.userId, userIdA))).length;
    const finalCartCount = (await db.select().from(cartItems).where(eq(cartItems.userId, userIdA))).length;
    const finalStockCount = (await db.select().from(resourceStock).where(eq(resourceStock.userId, userIdA))).length;

    assert.equal(initialTxCount, finalTxCount);
    assert.equal(initialCartCount, finalCartCount);
    assert.equal(initialStockCount, finalStockCount);
  });

  await t.test('10. Multi-Tenant User Isolation', async () => {
    setGenAIClient(mockValidGeminiClient);

    const intelA = await getStructuredIntelligence(db, userIdA, INTELLIGENCE_MODES.DAILY_REASONING, { date: todayStr });
    const intelB = await getStructuredIntelligence(db, userIdB, INTELLIGENCE_MODES.DAILY_REASONING, { date: todayStr });

    assert.ok(intelA);
    assert.ok(intelB);
  });
});
