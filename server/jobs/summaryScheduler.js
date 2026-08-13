import { db } from '../db/index.js';
import { users, dailySummaries } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { generateDailySummary } from '../services/aiService.js';

let schedulerInterval = null;
let lastScheduledDateRun = null;

export function start10pmSummaryScheduler() {
  if (schedulerInterval) return;

  console.log('[10:00 PM Scheduler] Initialized background daily summary scheduler...');

  // Check time every 60 seconds
  schedulerInterval = setInterval(async () => {
    try {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const todayStr = now.toISOString().split('T')[0];

      // Trigger at 10:00 PM (22:00) once per day
      if (hours === 22 && minutes === 0 && lastScheduledDateRun !== todayStr) {
        lastScheduledDateRun = todayStr;
        console.log(`[10:00 PM Scheduler] Triggering automatic 10:00 PM daily AI summaries for date ${todayStr}...`);

        const activeUsers = await db.select().from(users).where(eq(users.isActive, true));

        for (const u of activeUsers) {
          try {
            const [existing] = await db
              .select()
              .from(dailySummaries)
              .where(and(eq(dailySummaries.userId, u.id), eq(dailySummaries.date, todayStr)))
              .limit(1);

            if (!existing) {
              await generateDailySummary(u.id, todayStr, false);
              console.log(`[10:00 PM Scheduler] Generated 10:00 PM summary for user ${u.id} (${u.email})`);
            }
          } catch (err) {
            console.error(`[10:00 PM Scheduler] Error generating summary for user ${u.id}:`, err.message);
          }
        }
      }
    } catch (e) {
      console.error('[10:00 PM Scheduler] Scheduler loop error:', e);
    }
  }, 60 * 1000);
}
