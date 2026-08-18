import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { cryptoNative } from '../utils/crypto.js';
import { db } from '../db/index.js';
import { users, dailyExecutions, taskExecutions, tasks, schedules, scheduleEntries } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import {
  createTask,
  getTaskById,
  getTaskByKey,
  getTasksByUser,
  updateTask,
  deleteTask
} from '../services/taskService.js';
import {
  createSchedule,
  getScheduleById,
  getSchedulesByUser,
  getDefaultSchedule,
  updateSchedule,
  deleteSchedule,
  addScheduleEntry,
  updateScheduleEntry,
  deleteScheduleEntry,
  getScheduleWithEntries
} from '../services/scheduleService.js';
import { seedDefaultTaskScheduleForUser } from '../services/taskScheduleSeeder.js';

test('FEATURE — INSTRUCTION 18 TASK & SCHEDULE SERVICE LAYER & SEEDER TESTS', async (t) => {

  await t.test('1. TaskService: Task Creation & Attributes', async () => {
    const uId = cryptoNative.randomUUID();
    await db.insert(users).values({ id: uId, googleId: `g-ts-${uId}`, email: `${uId}@ex.com` });

    try {
      const task = await createTask({
        userId: uId,
        taskKey: 'TEST_DE_KEY',
        title: 'Data Engineering Lab',
        description: 'Lab work on PySpark',
        category: 'DATA_ENG',
        defaultPriority: 1,
        defaultDurationMinutes: 60
      });

      assert.ok(task.id);
      assert.equal(task.userId, uId);
      assert.equal(task.taskKey, 'TEST_DE_KEY');
      assert.equal(task.title, 'Data Engineering Lab');
      assert.equal(task.category, 'DATA_ENG');
      assert.equal(task.defaultPriority, 1);
      assert.equal(task.defaultDurationMinutes, 60);
    } finally {
      await db.delete(users).where(eq(users.id, uId));
    }
  });

  await t.test('2. TaskService: taskKey Uniqueness Enforcement', async () => {
    const uId = cryptoNative.randomUUID();
    await db.insert(users).values({ id: uId, googleId: `g-ts-uniq-${uId}`, email: `uniq_${uId}@ex.com` });

    try {
      await createTask({
        userId: uId,
        taskKey: 'NAMAZ_FAJR_UNIQ',
        title: 'Fajr Prayer',
        category: 'NAMAZ'
      });

      // Attempting duplicate taskKey for same user throws error
      await assert.rejects(async () => {
        await createTask({
          userId: uId,
          taskKey: 'NAMAZ_FAJR_UNIQ',
          title: 'Fajr Duplicate',
          category: 'NAMAZ'
        });
      }, /already exists/i);
    } finally {
      await db.delete(users).where(eq(users.id, uId));
    }
  });

  await t.test('3. TaskService: Retrieval, Update, and Deletion', async () => {
    const uId = cryptoNative.randomUUID();
    await db.insert(users).values({ id: uId, googleId: `g-ts-crud-${uId}`, email: `crud_${uId}@ex.com` });

    try {
      const task = await createTask({
        userId: uId,
        taskKey: 'CRUD_TASK',
        title: 'Original Title',
        category: 'DOCTRINE'
      });

      // Get by ID & Key
      const byId = await getTaskById(uId, task.id);
      const byKey = await getTaskByKey(uId, 'CRUD_TASK');
      assert.equal(byId.title, 'Original Title');
      assert.equal(byKey.id, task.id);

      // Get list
      const userTasks = await getTasksByUser(uId);
      assert.equal(userTasks.length, 1);

      // Update
      const updated = await updateTask(uId, task.id, { title: 'Updated Title', defaultPriority: 2 });
      assert.equal(updated.title, 'Updated Title');
      assert.equal(updated.defaultPriority, 2);

      // Delete
      const delRes = await deleteTask(uId, task.id);
      assert.equal(delRes.success, true);
      assert.equal(await getTaskById(uId, task.id), null);
    } finally {
      await db.delete(users).where(eq(users.id, uId));
    }
  });

  await t.test('4. ScheduleService: Schedule Creation & Default Management', async () => {
    const uId = cryptoNative.randomUUID();
    await db.insert(users).values({ id: uId, googleId: `g-ss-${uId}`, email: `ss_${uId}@ex.com` });

    try {
      // Create Schedule 1 (Default)
      const s1 = await createSchedule({
        userId: uId,
        name: 'Schedule 1',
        isDefault: true
      });
      assert.equal(s1.name, 'Schedule 1');
      assert.equal(s1.isDefault, true);

      // Create Schedule 2 (Default override)
      const s2 = await createSchedule({
        userId: uId,
        name: 'Schedule 2',
        isDefault: true
      });
      assert.equal(s2.isDefault, true);

      // S1 should no longer be default
      const s1Fetched = await getScheduleById(uId, s1.id);
      assert.equal(s1Fetched.isDefault, false);

      // getDefaultSchedule returns S2
      const defSched = await getDefaultSchedule(uId);
      assert.equal(defSched.id, s2.id);
    } finally {
      await db.delete(users).where(eq(users.id, uId));
    }
  });

  await t.test('5. ScheduleService: Schedule Entries & Joined Queries', async () => {
    const uId = cryptoNative.randomUUID();
    await db.insert(users).values({ id: uId, googleId: `g-se-${uId}`, email: `se_${uId}@ex.com` });

    try {
      const task = await createTask({
        userId: uId,
        taskKey: 'SE_TASK',
        title: 'Skincare Routine',
        category: 'SKINCARE'
      });

      const sched = await createSchedule({
        userId: uId,
        name: 'Weekly Routine',
        isDefault: true
      });

      const entry = await addScheduleEntry({
        userId: uId,
        scheduleId: sched.id,
        taskId: task.id,
        timingType: 'FIXED',
        recurrencePattern: 'WEEKLY',
        dayOfWeek: 'MONDAY',
        startMinutes: 340,
        endMinutes: 360
      });

      assert.ok(entry.id);
      assert.equal(entry.timingType, 'FIXED');
      assert.equal(entry.dayOfWeek, 'MONDAY');

      // Joined query test
      const fullSched = await getScheduleWithEntries(uId, sched.id);
      assert.equal(fullSched.entries.length, 1);
      assert.equal(fullSched.entries[0].taskTitle, 'Skincare Routine');
      assert.equal(fullSched.entries[0].taskKey, 'SE_TASK');

      // Invalid enum validation
      await assert.rejects(async () => {
        await addScheduleEntry({
          userId: uId,
          scheduleId: sched.id,
          taskId: task.id,
          timingType: 'INVALID_TYPE',
          recurrencePattern: 'WEEKLY'
        });
      }, /Invalid timingType/i);
    } finally {
      await db.delete(users).where(eq(users.id, uId));
    }
  });

  await t.test('6. TaskScheduleSeeder: Idempotent Seeding from WEEKLY_DOCTRINE', async () => {
    const uId = cryptoNative.randomUUID();
    await db.insert(users).values({ id: uId, googleId: `g-seed-${uId}`, email: `seed_${uId}@ex.com` });

    try {
      // Seed 1st Run
      const seedRes1 = await seedDefaultTaskScheduleForUser(uId);
      assert.equal(seedRes1.seeded, true);
      assert.ok(seedRes1.tasksCreatedCount > 0, 'Must create tasks');
      assert.ok(seedRes1.entriesCreatedCount > 0, 'Must create schedule entries');

      // Verify created schedule & entries
      const defSched = await getDefaultSchedule(uId);
      assert.ok(defSched);
      assert.equal(defSched.name, 'Default Doctrine Schedule');

      const fullSched = await getScheduleWithEntries(uId, defSched.id);
      assert.ok(fullSched.entries.length > 0, 'Entries must exist');

      // Seed 2nd Run (Idempotency Check)
      const seedRes2 = await seedDefaultTaskScheduleForUser(uId);
      assert.equal(seedRes2.seeded, false, 'Seeding must be skipped on 2nd run');
      assert.equal(seedRes2.reason, 'ALREADY_EXISTS');
    } finally {
      await db.delete(users).where(eq(users.id, uId));
    }
  });

  await t.test('7. Multi-Tenant Isolation for Tasks & Schedules', async () => {
    const u1 = cryptoNative.randomUUID();
    const u2 = cryptoNative.randomUUID();
    await db.insert(users).values({ id: u1, googleId: `g-iso1-${u1}`, email: `iso1_${u1}@ex.com` });
    await db.insert(users).values({ id: u2, googleId: `g-iso2-${u2}`, email: `iso2_${u2}@ex.com` });

    try {
      const t1 = await createTask({ userId: u1, taskKey: 'USER1_TASK', title: 'User 1 Task', category: 'DOCTRINE' });
      const s1 = await createSchedule({ userId: u1, name: 'User 1 Sched', isDefault: true });

      // User 2 cannot access User 1 task or schedule
      assert.equal(await getTaskById(u2, t1.id), null);
      assert.equal(await getScheduleById(u2, s1.id), null);

      // User 2 cannot update or delete User 1 task
      await assert.rejects(async () => {
        await updateTask(u2, t1.id, { title: 'Hacked' });
      }, /not found/i);

      await assert.rejects(async () => {
        await deleteTask(u2, t1.id);
      }, /not found/i);
    } finally {
      await db.delete(users).where(eq(users.id, u1));
      await db.delete(users).where(eq(users.id, u2));
    }
  });

  await t.test('8. Real doctrine.db Baseline Preservation', async () => {
    const userCount = (await db.select().from(users)).length;
    const dailyExecCount = (await db.select().from(dailyExecutions)).length;
    const taskExecCount = (await db.select().from(taskExecutions)).length;

    assert.ok(userCount >= 2, 'users count preserved');
    assert.ok(dailyExecCount >= 5, 'daily_executions count preserved');
    assert.ok(taskExecCount >= 131, 'task_executions count preserved');
  });

});
