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
        display_name TEXT NOT NULL,
        avatar_url TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_login_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        expires_at INTEGER NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS user_preferences (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
        custom_display_name TEXT,
        bio TEXT,
        custom_avatar_url TEXT,
        theme TEXT NOT NULL DEFAULT 'light',
        reduced_motion TEXT NOT NULL DEFAULT 'standard',
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS doctrine_versions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        version_number INTEGER NOT NULL,
        title TEXT NOT NULL,
        payload TEXT NOT NULL,
        active_from TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS daily_executions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        execution_date TEXT NOT NULL,
        time_blocks_json TEXT NOT NULL,
        namaz_json TEXT NOT NULL,
        anchors_json TEXT NOT NULL,
        prep_tomorrow_json TEXT NOT NULL,
        compliance_score REAL NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS task_executions (
        id TEXT PRIMARY KEY,
        execution_id TEXT NOT NULL REFERENCES daily_executions(id),
        user_id TEXT NOT NULL REFERENCES users(id),
        execution_date TEXT NOT NULL,
        task_key TEXT NOT NULL,
        task_name TEXT NOT NULL,
        category TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'SCHEDULED',
        completed_at TEXT,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS daily_summaries (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        summary_date TEXT NOT NULL,
        summary_text TEXT NOT NULL,
        model_used TEXT NOT NULL,
        created_at TEXT NOT NULL
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
