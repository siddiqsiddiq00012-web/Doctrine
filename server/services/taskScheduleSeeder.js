import { db } from '../db/index.js';
import { tasks, schedules, scheduleEntries } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { cryptoNative } from '../utils/crypto.js';
import { WEEKLY_DOCTRINE } from '../../src/data/doctrineData.js';
import { createTask, getTaskByKey } from './taskService.js';
import { createSchedule, addScheduleEntry } from './scheduleService.js';

/**
 * Dedicated Idempotent Seeder for Section 4:
 * Populates persistent Task Definitions, Default Schedule, and Schedule Entries
 * for a user based on WEEKLY_DOCTRINE template.
 *
 * Safe & Idempotent: If user already has a schedule, seeding is skipped.
 */
export async function seedDefaultTaskScheduleForUser(userId) {
  if (!userId || typeof userId !== 'string') {
    throw new Error('[TaskScheduleSeeder] Invalid or missing userId');
  }

  // 1. Idempotency Check: Does user already have any schedules?
  const existingSchedules = await db
    .select()
    .from(schedules)
    .where(eq(schedules.userId, userId))
    .limit(1);

  if (existingSchedules.length > 0) {
    return {
      seeded: false,
      reason: 'ALREADY_EXISTS',
      scheduleId: existingSchedules[0].id
    };
  }

  // 2. Create Default Schedule for User
  const defaultSched = await createSchedule({
    userId,
    name: 'Default Doctrine Schedule',
    isDefault: true
  });

  const scheduleId = defaultSched.id;
  const createdTasksMap = new Map(); // taskKey -> task object
  let tasksCreatedCount = 0;
  let entriesCreatedCount = 0;

  // 3. Process WEEKLY_DOCTRINE across all days (MONDAY .. SUNDAY)
  const dayKeys = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

  for (const dayOfWeek of dayKeys) {
    const dayData = WEEKLY_DOCTRINE[dayOfWeek];
    if (!dayData || !Array.isArray(dayData.timeBlocks)) continue;

    let sortOrder = 1;
    for (const block of dayData.timeBlocks) {
      const taskKey = block.id;

      // A. Get or Create Task Definition
      let taskInst = createdTasksMap.get(taskKey);
      if (!taskInst) {
        taskInst = await getTaskByKey(userId, taskKey);
        if (!taskInst) {
          const duration = (block.endMinutes && block.startMinutes !== undefined && block.endMinutes > block.startMinutes)
            ? (block.endMinutes - block.startMinutes)
            : 30;

          taskInst = await createTask({
            userId,
            taskKey,
            title: block.activity || taskKey,
            description: `Doctrine ${block.category || 'DOCTRINE'} block`,
            category: block.category || 'DOCTRINE',
            defaultPriority: 1,
            defaultDurationMinutes: duration
          });
          tasksCreatedCount++;
        }
        createdTasksMap.set(taskKey, taskInst);
      }

      // B. Create Schedule Entry for Day
      const isFlex = (block.startMinutes === 0 && block.endMinutes === 1440) || block.time === 'Flex';
      const timingType = isFlex ? 'FLEXIBLE' : 'FIXED';

      await addScheduleEntry({
        userId,
        scheduleId,
        taskId: taskInst.id,
        timingType,
        recurrencePattern: 'WEEKLY',
        dayOfWeek,
        startMinutes: block.startMinutes !== undefined ? block.startMinutes : null,
        endMinutes: block.endMinutes !== undefined ? block.endMinutes : null,
        sortOrder: sortOrder++
      });
      entriesCreatedCount++;
    }
  }

  return {
    seeded: true,
    userId,
    scheduleId,
    tasksCreatedCount,
    entriesCreatedCount
  };
}
