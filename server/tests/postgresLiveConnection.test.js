import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as pgSchema from '../db/schema.pg.js';
import { getDbConfig } from '../db/index.js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local if present
const envLocalPath = path.resolve(__dirname, '../../.env.local');
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
}
dotenv.config();

test('STEP 1B — LIVE POSTGRESQL INSTANCE CONNECTION & INTEGRATION TESTS', async (t) => {
  const dbConfig = getDbConfig(process.env);
  
  if (dbConfig.type !== 'postgres') {
    console.log('[PostgreSQL Integration Skip] POSTGRES_URL environment variable is not configured.');
    return;
  }

  const { Pool } = pg;
  let pool;
  let db;

  await t.test('1. Initialize pg.Pool & Drizzle ORM PostgreSQL Client', async () => {
    pool = new Pool({ connectionString: dbConfig.postgresUrl });
    db = drizzle(pool, { schema: pgSchema });
    assert.ok(pool, 'pg.Pool must be initialized');
    assert.ok(db, 'Drizzle ORM postgres client must be initialized');
  });

  await t.test('2. Verify PostgreSQL Identity & Connectivity', async () => {
    const res = await pool.query('SELECT current_database(), current_schema(), version()');
    assert.equal(res.rows.length, 1);
    const row = res.rows[0];
    assert.ok(row.current_database, 'Database name must be present');
    assert.ok(row.version, 'Server version must be present');
    console.log(`[PostgreSQL DB Identity] Connected to DB: "${row.current_database}", Schema: "${row.current_schema}"`);
  });

  await t.test('3. Verify & Safely Initialize Schema Tables', async () => {
    // Check existing tables count
    const tableCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `);
    const existingTableNames = tableCheck.rows.map(r => r.table_name);

    const migrationFiles = [
      '0000_glossy_butterfly.sql',
      '0001_abandoned_sersi.sql',
      '0002_old_morlocks.sql'
    ];

    const client = await pool.connect();
    try {
      for (const mFile of migrationFiles) {
        const ddlPath = path.resolve(__dirname, '../../drizzle/pg', mFile);
        if (fs.existsSync(ddlPath)) {
          const ddlSql = fs.readFileSync(ddlPath, 'utf8');
          const statements = ddlSql
            .split('--> statement-breakpoint')
            .map(s => s.trim())
            .filter(s => s.length > 0);

          for (const stmt of statements) {
            try {
              await client.query(stmt);
            } catch (e) {
              if (!e.message.includes('already exists')) {
                throw e;
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn('[PostgreSQL DDL Migration Warning]:', err.message);
    } finally {
      client.release();
    }

    // Verify expected Doctrine tables exist in PostgreSQL database
    const expectedTables = [
      'users', 'user_preferences', 'sessions', 'doctrine_versions', 'daily_executions',
      'tasks', 'schedules', 'schedule_entries', 'task_executions', 'daily_adaptations',
      'daily_summaries', 'weekly_reviews', 'progress_photos', 'weekly_summaries',
      'de_learning_sessions', 'resource_stock', 'resource_events', 'task_failure_reasons',
      'financial_transactions', 'financial_goals', 'cart_items', 'purchase_records',
      'financial_decisions', 'financial_preferences', 'life_areas', 'goals',
      'goal_milestones', 'goal_task_mappings', 'task_resource_requirements',
      'domain_events', 'automation_processing_logs'
    ];

    const finalCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `);
    const finalTableNames = new Set(finalCheck.rows.map(r => r.table_name));

    for (const expectedTable of expectedTables) {
      assert.ok(finalTableNames.has(expectedTable), `Table "${expectedTable}" must exist in public schema`);
    }
  });

  await t.test('4. Safe Transactional Write & Read Verification (Drizzle ORM -> pg.Pool)', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const testId = `test-verify-${Date.now()}`;
      const insertRes = await client.query(
        'INSERT INTO users (id, google_id, email, display_name) VALUES ($1, $2, $3, $4) RETURNING id, display_name',
        [testId, `g-${testId}`, `verify_${testId}@test.com`, 'Postgres Verification User']
      );
      assert.equal(insertRes.rows.length, 1);
      assert.equal(insertRes.rows[0].id, testId);

      const readRes = await client.query('SELECT id, display_name FROM users WHERE id = $1', [testId]);
      assert.equal(readRes.rows.length, 1);
      assert.equal(readRes.rows[0].display_name, 'Postgres Verification User');

      // Clean transactional rollback — leave zero persistent test records
      await client.query('ROLLBACK');
      console.log('[PostgreSQL Write/Read Verification] Transactional INSERT -> READ -> ROLLBACK passed cleanly.');
    } finally {
      client.release();
    }
  });

  t.after(async () => {
    if (pool) {
      await pool.end();
    }
  });
});
