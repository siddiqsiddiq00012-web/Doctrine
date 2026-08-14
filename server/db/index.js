import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure .env is loaded
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const tursoUrl = process.env.TURSO_DATABASE_URL || (process.env.DATABASE_URL && (process.env.DATABASE_URL.startsWith('libsql://') || process.env.DATABASE_URL.startsWith('https://')) ? process.env.DATABASE_URL : null);
const isVercel = Boolean(process.env.VERCEL || process.env.VERCEL_ENV);
const isValidTursoUrl = tursoUrl && !tursoUrl.includes('....') && !tursoUrl.includes('placeholder') && !tursoUrl.includes('undefined');

let db;
let sqlite = null;

function initSqliteSchema(sqliteDb) {
  if (!sqliteDb) return;
  try {
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
      CREATE TABLE IF NOT EXISTS user_preferences (
        user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        custom_display_name TEXT,
        bio TEXT DEFAULT '',
        custom_avatar_url TEXT,
        theme TEXT NOT NULL DEFAULT 'light',
        time_format TEXT NOT NULL DEFAULT '12h',
        week_start TEXT NOT NULL DEFAULT 'MONDAY',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS doctrine_versions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        version_number INTEGER NOT NULL DEFAULT 1,
        title TEXT NOT NULL DEFAULT 'Doctrine v1',
        payload TEXT NOT NULL,
        active_from TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS daily_executions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        date TEXT NOT NULL,
        doctrine_version_id TEXT REFERENCES doctrine_versions(id) ON DELETE SET NULL,
        day_of_week TEXT,
        water_liters REAL NOT NULL DEFAULT 0,
        tahajjud INTEGER NOT NULL DEFAULT 0,
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS task_executions (
        id TEXT PRIMARY KEY,
        daily_execution_id TEXT NOT NULL REFERENCES daily_executions(id) ON DELETE CASCADE,
        task_key TEXT NOT NULL,
        category TEXT NOT NULL,
        task_name TEXT,
        status TEXT NOT NULL DEFAULT 'SCHEDULED',
        completed_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS daily_summaries (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        date TEXT NOT NULL,
        summary TEXT NOT NULL,
        completion_percentage REAL NOT NULL DEFAULT 0,
        completed_count INTEGER NOT NULL DEFAULT 0,
        total_tasks_count INTEGER NOT NULL DEFAULT 0,
        provider TEXT NOT NULL DEFAULT 'gemini',
        model TEXT NOT NULL DEFAULT 'gemini-2.5-flash',
        generated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS weekly_reviews (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        week_start_date TEXT NOT NULL,
        week_end_date TEXT NOT NULL,
        body_weight_kg REAL,
        flexed_bicep_cm REAL,
        chest_cm REAL,
        thigh_cm REAL,
        morning_height_cm REAL,
        workout_performance TEXT DEFAULT 'STRONGER',
        complexion TEXT DEFAULT 'BRIGHTER',
        active_breakouts INTEGER DEFAULT 0,
        hair_shedding TEXT DEFAULT 'LESS',
        new_baby_hairs INTEGER DEFAULT 1,
        sleep_quality TEXT DEFAULT 'BETTER',
        digestion TEXT DEFAULT 'BETTER',
        energy_levels TEXT DEFAULT 'HIGHER',
        protocol_compliance_pct REAL DEFAULT 100,
        verdict TEXT DEFAULT 'ON_TRACK',
        refinement_notes TEXT DEFAULT '',
        finances_saved REAL DEFAULT 0,
        finances_spent REAL DEFAULT 0,
        finances_what_on TEXT DEFAULT '',
        finances_why TEXT DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS progress_photos (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        weekly_review_id TEXT NOT NULL REFERENCES weekly_reviews(id) ON DELETE CASCADE,
        week_start_date TEXT NOT NULL,
        category TEXT NOT NULL,
        photo_url TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS weekly_summaries (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        weekly_review_id TEXT NOT NULL REFERENCES weekly_reviews(id) ON DELETE CASCADE,
        week_start_date TEXT NOT NULL,
        summary TEXT NOT NULL,
        completion_percentage REAL NOT NULL DEFAULT 0,
        provider TEXT NOT NULL DEFAULT 'gemini',
        model TEXT NOT NULL DEFAULT 'gemini-2.5-flash',
        generated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS de_learning_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        date TEXT NOT NULL,
        module_name TEXT NOT NULL,
        topic_name TEXT NOT NULL,
        subtopic_name TEXT NOT NULL,
        planned_minutes INTEGER NOT NULL DEFAULT 60,
        actual_minutes INTEGER NOT NULL DEFAULT 0,
        learning_resource TEXT NOT NULL DEFAULT '',
        what_i_learned TEXT NOT NULL,
        confidence_rating INTEGER NOT NULL DEFAULT 3,
        status TEXT NOT NULL DEFAULT 'COMPLETED',
        active_recall_text TEXT DEFAULT '',
        code_evidence TEXT DEFAULT '',
        ai_evaluation_text TEXT DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS resource_stock (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        resource_id TEXT NOT NULL,
        current_qty REAL NOT NULL,
        in_cart INTEGER NOT NULL DEFAULT 0,
        last_purchased TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS resource_events (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        resource_id TEXT NOT NULL,
        resource_name TEXT NOT NULL,
        event_type TEXT NOT NULL,
        amount REAL NOT NULL,
        unit TEXT NOT NULL,
        date TEXT NOT NULL,
        notes TEXT DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS task_failure_reasons (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        task_execution_id TEXT REFERENCES task_executions(id) ON DELETE CASCADE,
        date TEXT NOT NULL,
        task_key TEXT NOT NULL,
        task_name TEXT,
        category TEXT,
        reason TEXT NOT NULL,
        user_note TEXT DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } catch (e) {
    console.warn('[SQLite Init Schema Warning]', e.message);
  }
}

if (isValidTursoUrl) {
  try {
    const { createClient } = await import('@libsql/client');
    const { drizzle } = await import('drizzle-orm/libsql');
    const client = createClient({
      url: tursoUrl,
      authToken: process.env.TURSO_AUTH_TOKEN
    });
    db = drizzle(client, { schema });
  } catch (err) {
    console.warn('[Turso Warning] Failed to initialize Turso client, falling back to SQLite:', err.message);
    const defaultDbPath = isVercel ? '/tmp/doctrine.db' : 'doctrine.db';
    sqlite = new Database(defaultDbPath);
    sqlite.pragma('foreign_keys = ON');
    initSqliteSchema(sqlite);
    db = drizzle(sqlite, { schema });
  }
} else {
  const isVercel = Boolean(process.env.VERCEL || process.env.VERCEL_ENV);
  const dbPath = isVercel
    ? '/tmp/doctrine.db'
    : (process.env.DATABASE_URL && !process.env.DATABASE_URL.startsWith('libsql') && !process.env.DATABASE_URL.startsWith('http') ? process.env.DATABASE_URL : 'doctrine.db');
  sqlite = new Database(dbPath);
  sqlite.pragma('foreign_keys = ON');
  initSqliteSchema(sqlite);
  db = drizzle(sqlite, { schema });
}

export { db, sqlite };
