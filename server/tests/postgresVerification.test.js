import test from 'node:test';
import assert from 'node:assert/strict';
import * as pgSchema from '../db/schema.pg.js';
import { getDbConfig } from '../db/index.js';
import { DrizzleSessionStore } from '../db/sessionStore.js';
import { getTableColumns, getTableName } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('STEP 1 — POSTGRESQL FOUNDATION & RUNTIME DDL VERIFICATION TESTS', async (t) => {
  await t.test('1. Verify All PostgreSQL Schema Tables Are Defined & Named Correctly', async () => {
    const tableKeys = [
      'users', 'userPreferences', 'sessions', 'doctrineVersions', 'dailyExecutions',
      'tasks', 'schedules', 'scheduleEntries', 'taskExecutions', 'dailyAdaptations',
      'dailySummaries', 'weeklyReviews', 'progressPhotos', 'weeklySummaries',
      'deLearningSessions', 'resourceStock', 'resourceEvents', 'taskFailureReasons',
      'financialTransactions', 'financialGoals', 'cartItems', 'purchaseRecords',
      'financialDecisions', 'financialPreferences', 'lifeAreas', 'goals',
      'goalMilestones', 'goalTaskMappings', 'taskResourceRequirements',
      'domainEvents', 'automationProcessingLogs'
    ];

    assert.equal(Object.keys(pgSchema).length >= 31, true, 'Must export at least 31 table objects');

    for (const key of tableKeys) {
      assert.ok(pgSchema[key], `Table object ${key} must exist in schema.pg.js`);
      const tableName = getTableName(pgSchema[key]);
      assert.ok(tableName && tableName.length > 0, `Table ${key} must have a valid DB table name`);
    }
  });

  await t.test('2. Verify Generated Migration DDL SQL Statements Match PostgreSQL Schema', async () => {
    const ddlPath = path.resolve(__dirname, '../../drizzle/pg/0000_glossy_butterfly.sql');
    assert.ok(fs.existsSync(ddlPath), 'PostgreSQL SQL DDL migration file must exist');

    const ddlSql = fs.readFileSync(ddlPath, 'utf8');
    const tableMatches = ddlSql.match(/CREATE TABLE/g) || [];
    assert.equal(tableMatches.length, 28, 'Generated SQL migration must contain exactly 28 CREATE TABLE statements');

    // Verify key PostgreSQL column types present in DDL
    assert.ok(ddlSql.includes('timestamp with time zone'), 'DDL must use PostgreSQL timestamp with time zone');
    assert.ok(ddlSql.includes('double precision'), 'DDL must use PostgreSQL double precision for REAL values');
    assert.ok(ddlSql.includes('boolean'), 'DDL must use PostgreSQL native boolean columns');
    assert.ok(ddlSql.includes('bigint'), 'DDL must use PostgreSQL bigint for integer Paise');
    assert.ok(ddlSql.includes('varchar(255)'), 'DDL must use PostgreSQL varchar for UUID primary keys');
  });

  await t.test('3. Verify PostgreSQL Database Driver Connection Dispatcher', async () => {
    const mockPgEnv = {
      POSTGRES_URL: 'postgres://postgres:secret@localhost:5432/doctrine_db',
      NODE_ENV: 'development'
    };
    const config = getDbConfig(mockPgEnv);
    assert.equal(config.type, 'postgres');
    assert.equal(config.postgresUrl, 'postgres://postgres:secret@localhost:5432/doctrine_db');
  });

  await t.test('4. Verify Session Store Compatibility with PostgreSQL Sessions Table', async () => {
    const sessionCols = getTableColumns(pgSchema.sessions);
    assert.ok(sessionCols.id, 'PostgreSQL sessions table must have id column');
    assert.ok(sessionCols.userId, 'PostgreSQL sessions table must have userId column');
    assert.ok(sessionCols.sess, 'PostgreSQL sessions table must have sess column');
    assert.ok(sessionCols.expiresAt, 'PostgreSQL sessions table must have expiresAt column');
  });
});
