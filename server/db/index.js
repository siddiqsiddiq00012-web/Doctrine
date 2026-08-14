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
    db = drizzle(sqlite, { schema });
  }
} else {
  const isVercel = Boolean(process.env.VERCEL || process.env.VERCEL_ENV);
  const dbPath = isVercel
    ? '/tmp/doctrine.db'
    : (process.env.DATABASE_URL && !process.env.DATABASE_URL.startsWith('libsql') && !process.env.DATABASE_URL.startsWith('http') ? process.env.DATABASE_URL : 'doctrine.db');
  sqlite = new Database(dbPath);
  sqlite.pragma('foreign_keys = ON');
  db = drizzle(sqlite, { schema });
}

export { db, sqlite };
