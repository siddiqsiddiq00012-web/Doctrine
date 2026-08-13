import { GoogleGenAI } from '@google/genai';
import { db } from '../db/index.js';
import { dailyExecutions, taskExecutions, dailySummaries, users, userPreferences } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { cryptoNative } from '../utils/crypto.js';

// Lazy initialize Google GenAI client using server-side GEMINI_API_KEY
let genAIClient = null;

function getGenAIClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is missing from environment variables.');
  }
  if (!genAIClient) {
    genAIClient = new GoogleGenAI({ apiKey });
  }
  return genAIClient;
}

/**
 * Deterministically collects daily execution data for (userId, date) and calculates metrics.
 */
export async function getDailyExecutionSnapshot(userId, dateStr) {
  // Fetch User & Profile Info
  const [userRecord] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const [userPrefs] = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1);

  const displayName = userPrefs?.customDisplayName || userRecord?.displayName || 'User';

  // Fetch Daily Execution Record
  const [dailyExec] = await db
    .select()
    .from(dailyExecutions)
    .where(and(eq(dailyExecutions.userId, userId), eq(dailyExecutions.date, dateStr)))
    .limit(1);

  if (!dailyExec) {
    return {
      userId,
      displayName,
      date: dateStr,
      dayOfWeek: new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' }),
      completionPercentage: 0,
      completedCount: 0,
      totalTasksCount: 0,
      waterLiters: 0,
      tahajjud: false,
      notes: '',
      tasks: [],
      emptyDay: true
    };
  }

  // Fetch Task Executions
  const tasks = await db
    .select()
    .from(taskExecutions)
    .where(eq(taskExecutions.dailyExecutionId, dailyExec.id));

  const totalTasksCount = tasks.length;
  const completedCount = tasks.filter(t => t.status === 'COMPLETED').length;
  const completionPercentage = totalTasksCount > 0 ? Math.round((completedCount / totalTasksCount) * 100) : 0;

  // Breakdown by Category
  const categorizedTasks = {
    DOCTRINE: [],
    NAMAZ: [],
    ANCHOR: [],
    PREPARATION: []
  };

  tasks.forEach(t => {
    const isDone = t.status === 'COMPLETED';
    const formattedTime = t.completedAt
      ? new Date(t.completedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
      : null;

    const item = {
      taskKey: t.taskKey,
      taskName: t.taskName || t.taskKey,
      status: t.status,
      completed: isDone,
      time: formattedTime
    };

    if (categorizedTasks[t.category]) {
      categorizedTasks[t.category].push(item);
    } else {
      categorizedTasks.DOCTRINE.push(item);
    }
  });

  return {
    userId,
    displayName,
    date: dateStr,
    dayOfWeek: dailyExec.dayOfWeek || new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' }),
    completionPercentage,
    completedCount,
    totalTasksCount,
    waterLiters: dailyExec.waterLiters || 0,
    tahajjud: Boolean(dailyExec.tahajjud),
    notes: dailyExec.notes || '',
    categorizedTasks,
    tasks,
    emptyDay: false
  };
}

/**
 * Generates an AI-powered daily summary for (userId, date) grounded strictly in recorded data.
 */
export async function generateDailySummary(userId, dateStr, forceRegenerate = false) {
  // 1. Check if summary already exists unless forceRegenerate is true
  if (!forceRegenerate) {
    const [existing] = await db
      .select()
      .from(dailySummaries)
      .where(and(eq(dailySummaries.userId, userId), eq(dailySummaries.date, dateStr)))
      .limit(1);

    if (existing) {
      return existing;
    }
  }

  // 2. Collect Deterministic Daily Execution Data
  const snapshot = await getDailyExecutionSnapshot(userId, dateStr);
  const ai = getGenAIClient();
  const MODEL_NAME = 'gemini-2.5-flash';

  // System Prompt instructing Gemini as an objective execution analyst
  const systemPrompt = `You are an objective, precise personal execution analyst for Doctrine OS.
Your objective is to analyze the user's ACTUAL recorded data for date ${snapshot.date} (${snapshot.dayOfWeek}) and generate a clear, analytical summary.

CRITICAL GROUNDING RULES:
1. NEVER assume or claim the user completed any action, task, workout, prayer, or study session where status is NOT recorded as completed.
2. If a task or area has no completion record, state clearly that it was not completed or not recorded today.
3. Use the deterministic calculated metrics provided in the snapshot (${snapshot.completionPercentage}% completion, ${snapshot.completedCount}/${snapshot.totalTasksCount} tasks completed). Do NOT invent percentages.
4. Keep all time mentions in 12-hour AM/PM format (e.g. 8:30 PM, 5:00 AM).
5. Tone: Professional, concise, analytical, constructive. Absolutely NO generic motivational fluff or exaggerated praise.
6. Target Length: 150 to 250 words.

REQUIRED STRUCTURED SECTIONS (Use Markdown):
### 1. Overall Execution
Summarize actual percentage (${snapshot.completionPercentage}%), completed vs missed task count, water intake (${snapshot.waterLiters}L), and Tahajjud (${snapshot.tahajjud ? 'Completed' : 'Not completed'}).

### 2. What Went Well
Highlight specific tasks and categories where execution was completed.

### 3. Impact
Briefly describe how today's completed work contributed toward priorities (physical transformation/recovery, data engineering, or project execution).

### 4. Gaps & Missed Items
List specific missed or skipped tasks/anchors objectively.

### 5. Carry Forward
Identify 1-2 specific focus areas for tomorrow based on today's gaps.

### 6. AI Assessment
A 2-sentence concise summary assessment of the day's discipline.`;

  // Format Snapshot JSON Payload for Gemini
  const dataPayload = JSON.stringify({
    user: snapshot.displayName,
    date: snapshot.date,
    dayOfWeek: snapshot.dayOfWeek,
    deterministicMetrics: {
      completionPercentage: snapshot.completionPercentage,
      completedCount: snapshot.completedCount,
      totalTasksCount: snapshot.totalTasksCount,
      waterLiters: snapshot.waterLiters,
      tahajjudCompleted: snapshot.tahajjud
    },
    userReflectionNotes: snapshot.notes || 'None recorded',
    taskBreakdown: snapshot.categorizedTasks
  }, null, 2);

  // Invoke Gemini AI
  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: [
      { role: 'user', parts: [{ text: `${systemPrompt}\n\nRECORED DAILY DATA SNAPSHOT:\n${dataPayload}` }] }
    ],
  });

  const generatedText = response.text || 'Daily summary generation produced no text.';
  const nowIso = new Date().toISOString();

  // 3. Persist in daily_summaries DB table
  const [existingRecord] = await db
    .select()
    .from(dailySummaries)
    .where(and(eq(dailySummaries.userId, userId), eq(dailySummaries.date, dateStr)))
    .limit(1);

  if (existingRecord) {
    await db
      .update(dailySummaries)
      .set({
        summary: generatedText,
        completionPercentage: snapshot.completionPercentage,
        completedCount: snapshot.completedCount,
        totalTasksCount: snapshot.totalTasksCount,
        provider: 'gemini',
        model: MODEL_NAME,
        generatedAt: nowIso,
        updatedAt: nowIso
      })
      .where(eq(dailySummaries.id, existingRecord.id));
  } else {
    await db.insert(dailySummaries).values({
      id: cryptoNative.randomUUID(),
      userId,
      date: dateStr,
      summary: generatedText,
      completionPercentage: snapshot.completionPercentage,
      completedCount: snapshot.completedCount,
      totalTasksCount: snapshot.totalTasksCount,
      provider: 'gemini',
      model: MODEL_NAME,
      generatedAt: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso
    });
  }

  const [savedSummary] = await db
    .select()
    .from(dailySummaries)
    .where(and(eq(dailySummaries.userId, userId), eq(dailySummaries.date, dateStr)))
    .limit(1);

  return savedSummary;
}
