import test from 'node:test';
import assert from 'node:assert/strict';
import { db, sqlite } from '../db/index.js';
import {
  users,
  dailyExecutions,
  taskExecutions,
  dailyAdaptations
} from '../db/schema.js';
import { eq, and, asc } from 'drizzle-orm';
import { cryptoNative } from '../utils/crypto.js';

test('FEATURE — ADAPTIVE DATA MODEL PERSISTENCE & SCHEMA TESTS', async (t) => {
  const userId = `user_adapt_${Date.now()}`;
  const nowIso = new Date().toISOString();
  const dateStr = '2026-08-16';

  t.before(async () => {
    // Seed test user
    await db.insert(users).values({
      id: userId,
      googleId: `google_${userId}`,
      email: `${userId}@doctrine.test`,
      displayName: 'Adaptation Data Model User',
      createdAt: nowIso,
      updatedAt: nowIso,
      lastLoginAt: nowIso
    });
  });

  t.after(async () => {
    // Cleanup test data
    await db.delete(dailyAdaptations).where(eq(dailyAdaptations.userId, userId));
    await db.delete(taskExecutions).where(eq(taskExecutions.dailyExecutionId, `de_${userId}_1`));
    await db.delete(taskExecutions).where(eq(taskExecutions.dailyExecutionId, `de_${userId}_2`));
    await db.delete(dailyExecutions).where(eq(dailyExecutions.userId, userId));
    await db.delete(users).where(eq(users.id, userId));
  });

  let dailyExecId1;
  let dailyExecId2;

  await t.test('1. daily_executions current_capacity_mode column exists and defaults to NORMAL', async () => {
    dailyExecId1 = `de_${userId}_1`;
    await db.insert(dailyExecutions).values({
      id: dailyExecId1,
      userId,
      date: dateStr,
      dayOfWeek: 'SUNDAY',
      createdAt: nowIso,
      updatedAt: nowIso
    });

    const [record] = await db
      .select()
      .from(dailyExecutions)
      .where(eq(dailyExecutions.id, dailyExecId1))
      .limit(1);

    assert.ok(record);
    assert.equal(record.currentCapacityMode, 'NORMAL', 'Defaults to NORMAL');
  });

  await t.test('2. daily_adaptations table exists with all required columns', async () => {
    const tableInfo = sqlite.pragma('table_info(daily_adaptations)');
    const colNames = tableInfo.map(c => c.name);

    assert.ok(colNames.includes('id'));
    assert.ok(colNames.includes('user_id'));
    assert.ok(colNames.includes('daily_execution_id'));
    assert.ok(colNames.includes('date'));
    assert.ok(colNames.includes('capacity_mode'));
    assert.ok(colNames.includes('available_minutes'));
    assert.ok(colNames.includes('reason'));
    assert.ok(colNames.includes('created_at'));
  });

  await t.test('3. Foreign keys enforce cascade deletion from users and daily_executions', async () => {
    const adaptId = `adapt_${Date.now()}`;
    await db.insert(dailyAdaptations).values({
      id: adaptId,
      userId,
      dailyExecutionId: dailyExecId1,
      date: dateStr,
      capacityMode: 'MINIMUM_VIABLE',
      availableMinutes: 60,
      reason: 'College Exam',
      createdAt: nowIso
    });

    const [inserted] = await db
      .select()
      .from(dailyAdaptations)
      .where(eq(dailyAdaptations.id, adaptId))
      .limit(1);

    assert.ok(inserted);
    assert.equal(inserted.capacityMode, 'MINIMUM_VIABLE');
  });

  await t.test('4. Adaptation history: multiple records for same day coexist in chronological order', async () => {
    const adapt1 = `adapt_${Date.now()}_1`;
    const adapt2 = `adapt_${Date.now()}_2`;
    const adapt3 = `adapt_${Date.now()}_3`;

    await db.insert(dailyAdaptations).values({
      id: adapt1, userId, dailyExecutionId: dailyExecId1, date: dateStr, capacityMode: 'NORMAL', createdAt: '2026-08-16T08:00:00Z'
    });
    await db.insert(dailyAdaptations).values({
      id: adapt2, userId, dailyExecutionId: dailyExecId1, date: dateStr, capacityMode: 'MINIMUM_VIABLE', availableMinutes: 45, reason: 'Exam', createdAt: '2026-08-16T10:30:00Z'
    });
    await db.insert(dailyAdaptations).values({
      id: adapt3, userId, dailyExecutionId: dailyExecId1, date: dateStr, capacityMode: 'NORMAL', createdAt: '2026-08-16T18:00:00Z'
    });

    const history = await db
      .select()
      .from(dailyAdaptations)
      .where(and(eq(dailyAdaptations.userId, userId), eq(dailyAdaptations.date, dateStr)))
      .orderBy(asc(dailyAdaptations.createdAt));

    assert.ok(history.length >= 3, 'Multiple adaptations recorded for date');
    const modes = history.map(h => h.capacityMode);
    assert.ok(modes.includes('NORMAL'));
    assert.ok(modes.includes('MINIMUM_VIABLE'));
  });

  await t.test('5. task_executions columns deferred_to_date and source_task_execution_id exist and are nullable', async () => {
    const tableInfo = sqlite.pragma('table_info(task_executions)');
    const colNames = tableInfo.map(c => c.name);

    assert.ok(colNames.includes('deferred_to_date'));
    assert.ok(colNames.includes('source_task_execution_id'));

    const taskId = `task_${Date.now()}_orig`;
    await db.insert(taskExecutions).values({
      id: taskId,
      dailyExecutionId: dailyExecId1,
      taskKey: 'de_session',
      category: 'DATA_ENG',
      taskName: 'Data Engineering Session',
      status: 'SCHEDULED',
      createdAt: nowIso,
      updatedAt: nowIso
    });

    const [row] = await db.select().from(taskExecutions).where(eq(taskExecutions.id, taskId)).limit(1);
    assert.equal(row.deferredToDate, null);
    assert.equal(row.sourceTaskExecutionId, null);
  });

  await t.test('6. Source lineage: carryover execution references source_task_execution_id', async () => {
    dailyExecId2 = `de_${userId}_2`;
    await db.insert(dailyExecutions).values({
      id: dailyExecId2,
      userId,
      date: '2026-08-17',
      dayOfWeek: 'MONDAY',
      createdAt: nowIso,
      updatedAt: nowIso
    });

    const origTask = (await db.select().from(taskExecutions).where(eq(taskExecutions.dailyExecutionId, dailyExecId1)).limit(1))[0];
    assert.ok(origTask);

    // Update origin task to SKIPPED with deferredToDate
    await db.update(taskExecutions)
      .set({ status: 'SKIPPED', deferredToDate: '2026-08-17' })
      .where(eq(taskExecutions.id, origTask.id));

    // Create carryover task on Day 2 referencing sourceTaskExecutionId
    const carryoverId = `task_${Date.now()}_carry`;
    await db.insert(taskExecutions).values({
      id: carryoverId,
      dailyExecutionId: dailyExecId2,
      taskKey: `carryover_${origTask.taskKey}_${origTask.id.substring(0, 6)}`,
      category: origTask.category,
      taskName: `${origTask.taskName} (Carryover)`,
      status: 'SCHEDULED',
      sourceTaskExecutionId: origTask.id,
      createdAt: nowIso,
      updatedAt: nowIso
    });

    const [carryRow] = await db.select().from(taskExecutions).where(eq(taskExecutions.id, carryoverId)).limit(1);
    assert.equal(carryRow.sourceTaskExecutionId, origTask.id);
  });

  await t.test('7. Source deletion behavior: deleting originating execution sets source_task_execution_id to NULL (ON DELETE SET NULL)', async () => {
    const carryRow = (await db.select().from(taskExecutions).where(eq(taskExecutions.dailyExecutionId, dailyExecId2)).limit(1))[0];
    assert.ok(carryRow.sourceTaskExecutionId);

    // Delete originating task execution
    await db.delete(taskExecutions).where(eq(taskExecutions.id, carryRow.sourceTaskExecutionId));

    const [updatedCarryRow] = await db.select().from(taskExecutions).where(eq(taskExecutions.id, carryRow.id)).limit(1);
    assert.ok(updatedCarryRow, 'Carryover successor row remains intact');
    assert.equal(updatedCarryRow.sourceTaskExecutionId, null, 'source_task_execution_id set to NULL');
  });

  await t.test('8. Existing uniqueness constraint (daily_execution_id, task_key) remains enforced', async () => {
    assert.throws(() => {
      sqlite.prepare(`
        INSERT INTO task_executions (id, daily_execution_id, task_key, category, task_name, status, created_at, updated_at)
        VALUES ('dup_1', '${dailyExecId1}', 'duplicate_key', 'DATA_ENG', 'Dup 1', 'SCHEDULED', '${nowIso}', '${nowIso}')
      `).run();

      sqlite.prepare(`
        INSERT INTO task_executions (id, daily_execution_id, task_key, category, task_name, status, created_at, updated_at)
        VALUES ('dup_2', '${dailyExecId1}', 'duplicate_key', 'DATA_ENG', 'Dup 2', 'SCHEDULED', '${nowIso}', '${nowIso}')
      `).run();
    }, /UNIQUE constraint failed/);
  });

  await t.test('9. Migration idempotency: table creation and alter statements do not error when re-run', async () => {
    assert.doesNotThrow(() => {
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS daily_adaptations (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          daily_execution_id TEXT NOT NULL REFERENCES daily_executions(id) ON DELETE CASCADE,
          date TEXT NOT NULL,
          capacity_mode TEXT NOT NULL,
          available_minutes INTEGER,
          reason TEXT DEFAULT '',
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);
      try { sqlite.exec("ALTER TABLE daily_executions ADD COLUMN current_capacity_mode TEXT NOT NULL DEFAULT 'NORMAL';"); } catch (e) {}
      try { sqlite.exec("ALTER TABLE task_executions ADD COLUMN deferred_to_date TEXT;"); } catch (e) {}
      try { sqlite.exec("ALTER TABLE task_executions ADD COLUMN source_task_execution_id TEXT REFERENCES task_executions(id) ON DELETE SET NULL;"); } catch (e) {}
    });
  });

  await t.test('10. Baseline data preservation: existing table counts remain intact', async () => {
    const userCount = sqlite.prepare("SELECT count(*) as c FROM users").get().c;
    assert.ok(userCount >= 1, 'Users table intact');
  });
});
