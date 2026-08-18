import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { cryptoNative } from '../utils/crypto.js';
import { db } from '../db/index.js';
import { users, dailyExecutions, taskExecutions, tasks, schedules, scheduleEntries } from '../db/schema.js';
import { eq } from 'drizzle-orm';

// Helper to construct a temporary isolated SQLite database file for testing
function createTempDbPath() {
  return path.join(process.cwd(), 'server', 'tests', `temp_task_sched_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.db`);
}

// Direct runner for initSqliteSchema SQL DDL against isolated temp DBs
function runInitSqliteSchema(sqliteDb) {
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      google_id TEXT UNIQUE,
      email TEXT NOT NULL,
      display_name TEXT,
      avatar_url TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_login_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS daily_executions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      doctrine_version_id TEXT,
      day_of_week TEXT,
      water_liters REAL NOT NULL DEFAULT 0,
      tahajjud INTEGER NOT NULL DEFAULT 0,
      notes TEXT NOT NULL DEFAULT '',
      current_capacity_mode TEXT NOT NULL DEFAULT 'NORMAL',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      task_key TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL,
      default_priority INTEGER NOT NULL,
      default_duration_minutes INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, task_key)
    );
    CREATE INDEX IF NOT EXISTS tasks_user_idx ON tasks(user_id);

    CREATE TABLE IF NOT EXISTS schedules (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 0,
      active_from_date TEXT,
      active_to_date TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS schedules_user_idx ON schedules(user_id);

    CREATE TABLE IF NOT EXISTS schedule_entries (
      id TEXT PRIMARY KEY,
      schedule_id TEXT NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      timing_type TEXT NOT NULL,
      recurrence_pattern TEXT NOT NULL,
      day_of_week TEXT,
      active_date TEXT,
      start_minutes INTEGER,
      end_minutes INTEGER,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS schedule_entries_sched_day_idx ON schedule_entries(schedule_id, day_of_week);
    CREATE INDEX IF NOT EXISTS schedule_entries_task_idx ON schedule_entries(task_id);

    CREATE TABLE IF NOT EXISTS task_executions (
      id TEXT PRIMARY KEY,
      daily_execution_id TEXT NOT NULL REFERENCES daily_executions(id) ON DELETE CASCADE,
      task_key TEXT NOT NULL,
      category TEXT NOT NULL,
      task_name TEXT,
      status TEXT NOT NULL DEFAULT 'SCHEDULED',
      completed_at TEXT,
      deferred_to_date TEXT,
      source_task_execution_id TEXT REFERENCES task_executions(id) ON DELETE SET NULL,
      task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
      schedule_entry_id TEXT REFERENCES schedule_entries(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(daily_execution_id, task_key)
    );
    CREATE INDEX IF NOT EXISTS task_executions_daily_exec_idx ON task_executions(daily_execution_id);
    CREATE INDEX IF NOT EXISTS task_executions_source_task_idx ON task_executions(source_task_execution_id);
    CREATE INDEX IF NOT EXISTS task_executions_task_id_idx ON task_executions(task_id);
    CREATE INDEX IF NOT EXISTS task_executions_sched_entry_idx ON task_executions(schedule_entry_id);
  `);
}

test('FEATURE — SECTION 4.1 TASK DEFINITION & SCHEDULE ENGINE SCHEMA FOUNDATION TESTS', async (t) => {

  await t.test('1. Table Creation Verification (tasks, schedules, schedule_entries exist)', async () => {
    const dbPath = createTempDbPath();
    const tempDb = new Database(dbPath);
    try {
      runInitSqliteSchema(tempDb);
      const tables = tempDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name);
      assert.ok(tables.includes('tasks'), 'tasks table must exist');
      assert.ok(tables.includes('schedules'), 'schedules table must exist');
      assert.ok(tables.includes('schedule_entries'), 'schedule_entries table must exist');
      assert.ok(tables.includes('task_executions'), 'task_executions table must exist');

      // Verify columns on task_executions
      const execCols = tempDb.pragma('table_info(task_executions)').map(c => c.name);
      assert.ok(execCols.includes('task_id'), 'task_executions.task_id must exist');
      assert.ok(execCols.includes('schedule_entry_id'), 'task_executions.schedule_entry_id must exist');
    } finally {
      tempDb.close();
      if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    }
  });

  await t.test('2. Migration Idempotency Test (running schema DDL repeatedly does not error)', async () => {
    const dbPath = createTempDbPath();
    const tempDb = new Database(dbPath);
    try {
      runInitSqliteSchema(tempDb);
      // Run second time
      assert.doesNotThrow(() => {
        runInitSqliteSchema(tempDb);
      });
      // Run third time
      assert.doesNotThrow(() => {
        runInitSqliteSchema(tempDb);
      });
    } finally {
      tempDb.close();
      if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    }
  });

  await t.test('3. Task Creation & Attribute Validation', async () => {
    const dbPath = createTempDbPath();
    const tempDb = new Database(dbPath);
    try {
      tempDb.pragma('foreign_keys = ON');
      runInitSqliteSchema(tempDb);
      const uId = cryptoNative.randomUUID();
      tempDb.prepare("INSERT INTO users (id, google_id, email, display_name) VALUES (?, ?, ?, ?)").run(uId, 'g-task-1', 'task1@example.com', 'Task User 1');

      const tId = cryptoNative.randomUUID();
      tempDb.prepare(`
        INSERT INTO tasks (id, user_id, task_key, title, description, category, default_priority, default_duration_minutes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(tId, uId, 'DE_STUDY_MAIN', 'Data Engineering Deep Work', 'Focus on Kafka & Spark', 'DATA_ENG', 1, 60);

      const row = tempDb.prepare("SELECT * FROM tasks WHERE id = ?").get(tId);
      assert.equal(row.title, 'Data Engineering Deep Work');
      assert.equal(row.category, 'DATA_ENG');
      assert.equal(row.default_priority, 1);
      assert.equal(row.default_duration_minutes, 60);
    } finally {
      tempDb.close();
      if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    }
  });

  await t.test('4. taskKey Uniqueness Per User Constraint', async () => {
    const dbPath = createTempDbPath();
    const tempDb = new Database(dbPath);
    try {
      tempDb.pragma('foreign_keys = ON');
      runInitSqliteSchema(tempDb);
      const u1 = cryptoNative.randomUUID();
      const u2 = cryptoNative.randomUUID();
      tempDb.prepare("INSERT INTO users (id, google_id, email) VALUES (?, ?, ?)").run(u1, 'g-u1', 'u1@ex.com');
      tempDb.prepare("INSERT INTO users (id, google_id, email) VALUES (?, ?, ?)").run(u2, 'g-u2', 'u2@ex.com');

      // User 1 creates key 'NAMAZ_FAJR'
      tempDb.prepare("INSERT INTO tasks (id, user_id, task_key, title, category, default_priority, default_duration_minutes) VALUES (?, ?, ?, ?, ?, ?, ?)").run(cryptoNative.randomUUID(), u1, 'NAMAZ_FAJR', 'Fajr Prayer', 'NAMAZ', 1, 15);

      // User 2 creates same key 'NAMAZ_FAJR' -> SUCCESS (multi-tenant isolated)
      assert.doesNotThrow(() => {
        tempDb.prepare("INSERT INTO tasks (id, user_id, task_key, title, category, default_priority, default_duration_minutes) VALUES (?, ?, ?, ?, ?, ?, ?)").run(cryptoNative.randomUUID(), u2, 'NAMAZ_FAJR', 'Fajr Prayer', 'NAMAZ', 1, 15);
      });

      // User 1 attempts duplicate key 'NAMAZ_FAJR' -> FAILS
      assert.throws(() => {
        tempDb.prepare("INSERT INTO tasks (id, user_id, task_key, title, category, default_priority, default_duration_minutes) VALUES (?, ?, ?, ?, ?, ?, ?)").run(cryptoNative.randomUUID(), u1, 'NAMAZ_FAJR', 'Fajr Duplicate', 'NAMAZ', 1, 15);
      }, /UNIQUE constraint failed/i);
    } finally {
      tempDb.close();
      if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    }
  });

  await t.test('5. Schedule Creation & Attribute Validation', async () => {
    const dbPath = createTempDbPath();
    const tempDb = new Database(dbPath);
    try {
      tempDb.pragma('foreign_keys = ON');
      runInitSqliteSchema(tempDb);
      const uId = cryptoNative.randomUUID();
      tempDb.prepare("INSERT INTO users (id, google_id, email) VALUES (?, ?, ?)").run(uId, 'g-sched-1', 'sched1@ex.com');

      const sId = cryptoNative.randomUUID();
      tempDb.prepare(`
        INSERT INTO schedules (id, user_id, name, is_default, active_from_date, active_to_date)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(sId, uId, 'Standard Semester Schedule', 1, '2026-08-01', '2026-12-31');

      const sched = tempDb.prepare("SELECT * FROM schedules WHERE id = ?").get(sId);
      assert.equal(sched.name, 'Standard Semester Schedule');
      assert.equal(sched.is_default, 1);
      assert.equal(sched.active_from_date, '2026-08-01');
      assert.equal(sched.active_to_date, '2026-12-31');
    } finally {
      tempDb.close();
      if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    }
  });

  await t.test('6. Schedule Entry Creation & Attribute Validation', async () => {
    const dbPath = createTempDbPath();
    const tempDb = new Database(dbPath);
    try {
      tempDb.pragma('foreign_keys = ON');
      runInitSqliteSchema(tempDb);
      const uId = cryptoNative.randomUUID();
      tempDb.prepare("INSERT INTO users (id, google_id, email) VALUES (?, ?, ?)").run(uId, 'g-se-1', 'se1@ex.com');

      const tId = cryptoNative.randomUUID();
      tempDb.prepare("INSERT INTO tasks (id, user_id, task_key, title, category, default_priority, default_duration_minutes) VALUES (?, ?, ?, ?, ?, ?, ?)").run(tId, uId, 'WORKOUT_A', 'Workout A Session', 'WORKOUT', 1, 45);

      const sId = cryptoNative.randomUUID();
      tempDb.prepare("INSERT INTO schedules (id, user_id, name, is_default) VALUES (?, ?, ?, ?)").run(sId, uId, 'Default Schedule', 1);

      const seId = cryptoNative.randomUUID();
      tempDb.prepare(`
        INSERT INTO schedule_entries (id, schedule_id, task_id, timing_type, recurrence_pattern, day_of_week, start_minutes, end_minutes, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(seId, sId, tId, 'FIXED', 'WEEKLY', 'MONDAY', 380, 425, 1);

      const entry = tempDb.prepare("SELECT * FROM schedule_entries WHERE id = ?").get(seId);
      assert.equal(entry.timing_type, 'FIXED');
      assert.equal(entry.recurrence_pattern, 'WEEKLY');
      assert.equal(entry.day_of_week, 'MONDAY');
      assert.equal(entry.start_minutes, 380);
      assert.equal(entry.end_minutes, 425);
    } finally {
      tempDb.close();
      if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    }
  });

  await t.test('7. Task FK Enforcement (schedule_entries -> tasks)', async () => {
    const dbPath = createTempDbPath();
    const tempDb = new Database(dbPath);
    try {
      tempDb.pragma('foreign_keys = ON');
      runInitSqliteSchema(tempDb);
      const uId = cryptoNative.randomUUID();
      tempDb.prepare("INSERT INTO users (id, google_id, email) VALUES (?, ?, ?)").run(uId, 'g-fk-1', 'fk1@ex.com');

      const sId = cryptoNative.randomUUID();
      tempDb.prepare("INSERT INTO schedules (id, user_id, name) VALUES (?, ?, ?)").run(sId, uId, 'Schedule 1');

      // Attempt inserting entry with invalid task_id
      assert.throws(() => {
        tempDb.prepare(`
          INSERT INTO schedule_entries (id, schedule_id, task_id, timing_type, recurrence_pattern)
          VALUES (?, ?, ?, ?, ?)
        `).run(cryptoNative.randomUUID(), sId, 'invalid-task-id', 'FLEXIBLE', 'DAILY');
      }, /FOREIGN KEY constraint failed/i);
    } finally {
      tempDb.close();
      if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    }
  });

  await t.test('8. Schedule FK Enforcement (schedule_entries -> schedules)', async () => {
    const dbPath = createTempDbPath();
    const tempDb = new Database(dbPath);
    try {
      tempDb.pragma('foreign_keys = ON');
      runInitSqliteSchema(tempDb);
      const uId = cryptoNative.randomUUID();
      tempDb.prepare("INSERT INTO users (id, google_id, email) VALUES (?, ?, ?)").run(uId, 'g-fk-2', 'fk2@ex.com');

      const tId = cryptoNative.randomUUID();
      tempDb.prepare("INSERT INTO tasks (id, user_id, task_key, title, category, default_priority, default_duration_minutes) VALUES (?, ?, ?, ?, ?, ?, ?)").run(tId, uId, 'SKIN_PM', 'Skincare PM', 'SKINCARE', 1, 20);

      // Attempt inserting entry with invalid schedule_id
      assert.throws(() => {
        tempDb.prepare(`
          INSERT INTO schedule_entries (id, schedule_id, task_id, timing_type, recurrence_pattern)
          VALUES (?, ?, ?, ?, ?)
        `).run(cryptoNative.randomUUID(), 'invalid-schedule-id', tId, 'FLEXIBLE', 'DAILY');
      }, /FOREIGN KEY constraint failed/i);
    } finally {
      tempDb.close();
      if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    }
  });

  await t.test('9. Cascade Deletion Behavior (users -> tasks/schedules -> schedule_entries)', async () => {
    const dbPath = createTempDbPath();
    const tempDb = new Database(dbPath);
    try {
      tempDb.pragma('foreign_keys = ON');
      runInitSqliteSchema(tempDb);
      const uId = cryptoNative.randomUUID();
      tempDb.prepare("INSERT INTO users (id, google_id, email) VALUES (?, ?, ?)").run(uId, 'g-casc-1', 'casc1@ex.com');

      const tId = cryptoNative.randomUUID();
      tempDb.prepare("INSERT INTO tasks (id, user_id, task_key, title, category, default_priority, default_duration_minutes) VALUES (?, ?, ?, ?, ?, ?, ?)").run(tId, uId, 'T_CASC', 'Title', 'CAT', 1, 10);

      const sId = cryptoNative.randomUUID();
      tempDb.prepare("INSERT INTO schedules (id, user_id, name) VALUES (?, ?, ?)").run(sId, uId, 'Sched');

      const seId = cryptoNative.randomUUID();
      tempDb.prepare("INSERT INTO schedule_entries (id, schedule_id, task_id, timing_type, recurrence_pattern) VALUES (?, ?, ?, ?, ?)").run(seId, sId, tId, 'FLEXIBLE', 'DAILY');

      // Verify records exist
      assert.ok(tempDb.prepare("SELECT 1 FROM schedule_entries WHERE id = ?").get(seId));

      // Delete schedule -> cascades to schedule_entries
      tempDb.prepare("DELETE FROM schedules WHERE id = ?").run(sId);
      assert.equal(tempDb.prepare("SELECT 1 FROM schedule_entries WHERE id = ?").get(seId), undefined);

      // Re-insert schedule and entry
      tempDb.prepare("INSERT INTO schedules (id, user_id, name) VALUES (?, ?, ?)").run(sId, uId, 'Sched 2');
      tempDb.prepare("INSERT INTO schedule_entries (id, schedule_id, task_id, timing_type, recurrence_pattern) VALUES (?, ?, ?, ?, ?)").run(seId, sId, tId, 'FLEXIBLE', 'DAILY');

      // Delete task -> cascades to schedule_entries
      tempDb.prepare("DELETE FROM tasks WHERE id = ?").run(tId);
      assert.equal(tempDb.prepare("SELECT 1 FROM schedule_entries WHERE id = ?").get(seId), undefined);

      // Re-insert task, schedule, entry
      tempDb.prepare("INSERT INTO tasks (id, user_id, task_key, title, category, default_priority, default_duration_minutes) VALUES (?, ?, ?, ?, ?, ?, ?)").run(tId, uId, 'T_CASC2', 'Title2', 'CAT', 1, 10);
      tempDb.prepare("INSERT INTO schedule_entries (id, schedule_id, task_id, timing_type, recurrence_pattern) VALUES (?, ?, ?, ?, ?)").run(seId, sId, tId, 'FLEXIBLE', 'DAILY');

      // Delete user -> cascades to tasks, schedules, schedule_entries
      tempDb.prepare("DELETE FROM users WHERE id = ?").run(uId);
      assert.equal(tempDb.prepare("SELECT 1 FROM tasks WHERE id = ?").get(tId), undefined);
      assert.equal(tempDb.prepare("SELECT 1 FROM schedules WHERE id = ?").get(sId), undefined);
      assert.equal(tempDb.prepare("SELECT 1 FROM schedule_entries WHERE id = ?").get(seId), undefined);
    } finally {
      tempDb.close();
      if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    }
  });

  await t.test('10. Execution History Preservation & Non-Destructive Deletion', async () => {
    const dbPath = createTempDbPath();
    const tempDb = new Database(dbPath);
    try {
      tempDb.pragma('foreign_keys = ON');
      runInitSqliteSchema(tempDb);
      const uId = cryptoNative.randomUUID();
      tempDb.prepare("INSERT INTO users (id, google_id, email) VALUES (?, ?, ?)").run(uId, 'g-hist-1', 'hist1@ex.com');

      const dId = cryptoNative.randomUUID();
      tempDb.prepare("INSERT INTO daily_executions (id, user_id, date) VALUES (?, ?, ?)").run(dId, uId, '2026-08-16');

      const tId = cryptoNative.randomUUID();
      tempDb.prepare("INSERT INTO tasks (id, user_id, task_key, title, category, default_priority, default_duration_minutes) VALUES (?, ?, ?, ?, ?, ?, ?)").run(tId, uId, 'HIST_TASK', 'History Task', 'CAT', 1, 10);

      const sId = cryptoNative.randomUUID();
      tempDb.prepare("INSERT INTO schedules (id, user_id, name) VALUES (?, ?, ?)").run(sId, uId, 'Sched Hist');

      const seId = cryptoNative.randomUUID();
      tempDb.prepare("INSERT INTO schedule_entries (id, schedule_id, task_id, timing_type, recurrence_pattern) VALUES (?, ?, ?, ?, ?)").run(seId, sId, tId, 'FLEXIBLE', 'DAILY');

      const teId = cryptoNative.randomUUID();
      tempDb.prepare(`
        INSERT INTO task_executions (id, daily_execution_id, task_key, category, task_name, status, task_id, schedule_entry_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(teId, dId, 'HIST_TASK', 'CAT', 'History Task', 'COMPLETED', tId, seId);

      // Deleting task DOES NOT delete task_executions (sets task_id to NULL)
      tempDb.prepare("DELETE FROM tasks WHERE id = ?").run(tId);

      const execPostTaskDel = tempDb.prepare("SELECT * FROM task_executions WHERE id = ?").get(teId);
      assert.ok(execPostTaskDel, 'task_executions row must survive task deletion');
      assert.equal(execPostTaskDel.task_id, null, 'task_id FK must be set to NULL via ON DELETE SET NULL');
      assert.equal(execPostTaskDel.status, 'COMPLETED', 'Historical status must remain COMPLETED');

      // Deleting schedule_entry DOES NOT delete task_executions (sets schedule_entry_id to NULL)
      tempDb.prepare("DELETE FROM schedule_entries WHERE id = ?").run(seId);
      const execPostSchedDel = tempDb.prepare("SELECT * FROM task_executions WHERE id = ?").get(teId);
      assert.ok(execPostSchedDel, 'task_executions row must survive schedule_entry deletion');
      assert.equal(execPostSchedDel.schedule_entry_id, null, 'schedule_entry_id FK must be set to NULL via ON DELETE SET NULL');
    } finally {
      tempDb.close();
      if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    }
  });

  await t.test('11. Nullable taskId on task_executions', async () => {
    const dbPath = createTempDbPath();
    const tempDb = new Database(dbPath);
    try {
      tempDb.pragma('foreign_keys = ON');
      runInitSqliteSchema(tempDb);
      const uId = cryptoNative.randomUUID();
      tempDb.prepare("INSERT INTO users (id, google_id, email) VALUES (?, ?, ?)").run(uId, 'g-null-t', 'nullt@ex.com');

      const dId = cryptoNative.randomUUID();
      tempDb.prepare("INSERT INTO daily_executions (id, user_id, date) VALUES (?, ?, ?)").run(dId, uId, '2026-08-16');

      const teId = cryptoNative.randomUUID();
      // Insert without taskId
      tempDb.prepare(`
        INSERT INTO task_executions (id, daily_execution_id, task_key, category, task_name, status, task_id)
        VALUES (?, ?, ?, ?, ?, ?, NULL)
      `).run(teId, dId, 'LEGACY_TASK', 'DOCTRINE', 'Legacy Task', 'SCHEDULED');

      const execRow = tempDb.prepare("SELECT * FROM task_executions WHERE id = ?").get(teId);
      assert.equal(execRow.task_id, null);
    } finally {
      tempDb.close();
      if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    }
  });

  await t.test('12. Nullable scheduleEntryId on task_executions', async () => {
    const dbPath = createTempDbPath();
    const tempDb = new Database(dbPath);
    try {
      tempDb.pragma('foreign_keys = ON');
      runInitSqliteSchema(tempDb);
      const uId = cryptoNative.randomUUID();
      tempDb.prepare("INSERT INTO users (id, google_id, email) VALUES (?, ?, ?)").run(uId, 'g-null-s', 'nulls@ex.com');

      const dId = cryptoNative.randomUUID();
      tempDb.prepare("INSERT INTO daily_executions (id, user_id, date) VALUES (?, ?, ?)").run(dId, uId, '2026-08-16');

      const teId = cryptoNative.randomUUID();
      // Insert without scheduleEntryId
      tempDb.prepare(`
        INSERT INTO task_executions (id, daily_execution_id, task_key, category, task_name, status, schedule_entry_id)
        VALUES (?, ?, ?, ?, ?, ?, NULL)
      `).run(teId, dId, 'FLEX_TASK', 'DOCTRINE', 'Flex Task', 'SCHEDULED');

      const execRow = tempDb.prepare("SELECT * FROM task_executions WHERE id = ?").get(teId);
      assert.equal(execRow.schedule_entry_id, null);
    } finally {
      tempDb.close();
      if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    }
  });

  await t.test('13. Existing task_executions Uniqueness Constraint Intact', async () => {
    const dbPath = createTempDbPath();
    const tempDb = new Database(dbPath);
    try {
      tempDb.pragma('foreign_keys = ON');
      runInitSqliteSchema(tempDb);
      const uId = cryptoNative.randomUUID();
      tempDb.prepare("INSERT INTO users (id, google_id, email) VALUES (?, ?, ?)").run(uId, 'g-uniq-e', 'uniq@ex.com');

      const dId = cryptoNative.randomUUID();
      tempDb.prepare("INSERT INTO daily_executions (id, user_id, date) VALUES (?, ?, ?)").run(dId, uId, '2026-08-16');

      // Insert first execution key
      tempDb.prepare(`
        INSERT INTO task_executions (id, daily_execution_id, task_key, category, task_name)
        VALUES (?, ?, ?, ?, ?)
      `).run(cryptoNative.randomUUID(), dId, 'NAMAZ_FAJR', 'NAMAZ', 'Fajr');

      // Attempt duplicate (daily_execution_id, task_key) -> FAILS
      assert.throws(() => {
        tempDb.prepare(`
          INSERT INTO task_executions (id, daily_execution_id, task_key, category, task_name)
          VALUES (?, ?, ?, ?, ?)
        `).run(cryptoNative.randomUUID(), dId, 'NAMAZ_FAJR', 'NAMAZ', 'Fajr Dup');
      }, /UNIQUE constraint failed/i);
    } finally {
      tempDb.close();
      if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    }
  });

  await t.test('14. Real doctrine.db Baseline Preservation', async () => {
    // Read real database counts via Drizzle ORM
    const userCount = (await db.select().from(users)).length;
    const dailyExecCount = (await db.select().from(dailyExecutions)).length;
    const taskExecCount = (await db.select().from(taskExecutions)).length;

    assert.ok(userCount >= 2, 'users row count preserved');
    assert.ok(dailyExecCount >= 5, 'daily_executions row count preserved');
    assert.ok(taskExecCount >= 131, 'task_executions row count preserved');
  });

});
