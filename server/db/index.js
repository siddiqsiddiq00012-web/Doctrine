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

export function getDbConfig(env = process.env) {
  const isVercel = Boolean(env.VERCEL || env.VERCEL_ENV);
  const isProduction = isVercel || env.NODE_ENV === 'production';
  const tursoUrl = env.TURSO_DATABASE_URL || (env.DATABASE_URL && (env.DATABASE_URL.startsWith('libsql://') || env.DATABASE_URL.startsWith('https://')) ? env.DATABASE_URL : null);
  const authToken = env.TURSO_AUTH_TOKEN;

  const isValidTursoUrl = Boolean(tursoUrl && !tursoUrl.includes('....') && !tursoUrl.includes('placeholder') && !tursoUrl.includes('undefined'));
  const isValidAuthToken = Boolean(authToken && authToken.trim().length > 0 && !authToken.includes('placeholder') && !authToken.includes('undefined'));

  if (isProduction) {
    if (!isValidTursoUrl) {
      throw new Error('[FATAL PRODUCTION DB ERROR] Missing or invalid TURSO_DATABASE_URL environment variable. Ephemeral SQLite fallback is strictly prohibited in production.');
    }
    if (!isValidAuthToken) {
      throw new Error('[FATAL PRODUCTION DB ERROR] Missing or invalid TURSO_AUTH_TOKEN environment variable. Ephemeral SQLite fallback is strictly prohibited in production.');
    }
    return { type: 'turso', tursoUrl, authToken, isProduction };
  }

  if (isValidTursoUrl && isValidAuthToken) {
    return { type: 'turso', tursoUrl, authToken, isProduction };
  }

  const dbPath = env.DATABASE_URL && !env.DATABASE_URL.startsWith('libsql') && !env.DATABASE_URL.startsWith('http')
    ? env.DATABASE_URL
    : 'doctrine.db';

  return { type: 'sqlite', dbPath, isProduction };
}

export function getSessionSecret(env = process.env) {
  const isVercel = Boolean(env.VERCEL || env.VERCEL_ENV);
  const isProduction = isVercel || env.NODE_ENV === 'production';
  const devFallback = 'doctrine_dev_session_secret_change_in_production_12345';
  const secret = env.SESSION_SECRET;

  const isValidSecret = Boolean(secret && secret.trim().length > 0 && secret !== devFallback && !secret.includes('placeholder'));

  if (isProduction) {
    if (!isValidSecret) {
      throw new Error('[FATAL PRODUCTION AUTH ERROR] Missing or invalid SESSION_SECRET environment variable. Production environments must define a secure, non-default SESSION_SECRET.');
    }
    return secret;
  }

  return (secret && secret.trim().length > 0) ? secret : devFallback;
}

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
        user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
        sess TEXT,
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
      CREATE TABLE IF NOT EXISTS financial_transactions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        amount_paise INTEGER NOT NULL,
        date TEXT NOT NULL,
        type TEXT NOT NULL,
        category TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        source TEXT NOT NULL DEFAULT 'MANUAL',
        financial_goal_id TEXT REFERENCES financial_goals(id) ON DELETE SET NULL,
        cart_item_id TEXT REFERENCES cart_items(id) ON DELETE SET NULL,
        purchase_record_id TEXT REFERENCES purchase_records(id) ON DELETE SET NULL,
        resource_id TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS financial_goals (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        target_price_paise INTEGER NOT NULL,
        priority INTEGER NOT NULL DEFAULT 1,
        urgency TEXT NOT NULL DEFAULT 'MEDIUM',
        deadline_date TEXT,
        desired_purchase_date TEXT,
        allocated_amount_paise INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'PLANNED',
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS cart_items (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        item_name TEXT NOT NULL,
        resource_id TEXT,
        quantity REAL NOT NULL DEFAULT 1,
        estimated_price_paise INTEGER NOT NULL,
        target_purchase_date TEXT,
        financial_goal_id TEXT REFERENCES financial_goals(id) ON DELETE SET NULL,
        priority INTEGER NOT NULL DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'PENDING',
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS purchase_records (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        cart_item_id TEXT REFERENCES cart_items(id) ON DELETE SET NULL,
        financial_transaction_id TEXT REFERENCES financial_transactions(id) ON DELETE SET NULL,
        resource_id TEXT,
        item_name TEXT NOT NULL,
        quantity REAL NOT NULL,
        actual_price_paise INTEGER NOT NULL,
        purchase_date TEXT NOT NULL,
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS financial_decisions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        recommendation_type TEXT NOT NULL,
        payload TEXT NOT NULL,
        date TEXT NOT NULL,
        user_decision TEXT NOT NULL DEFAULT 'PENDING',
        cart_item_id TEXT REFERENCES cart_items(id) ON DELETE SET NULL,
        financial_goal_id TEXT REFERENCES financial_goals(id) ON DELETE SET NULL,
        purchase_record_id TEXT REFERENCES purchase_records(id) ON DELETE SET NULL,
        outcome TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS financial_preferences (
        user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        daily_workday_income_paise INTEGER NOT NULL DEFAULT 22000,
        transport_daily_cost_paise INTEGER NOT NULL DEFAULT 5000,
        transport_reserve_day TEXT NOT NULL DEFAULT 'THURSDAY',
        transport_reserve_amount_paise INTEGER NOT NULL DEFAULT 10000,
        workdays_json TEXT NOT NULL DEFAULT '["MONDAY","TUESDAY","WEDNESDAY","THURSDAY"]',
        weekly_budget_limit_paise INTEGER NOT NULL DEFAULT 0,
        auto_approve_threshold_paise INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    try { sqliteDb.exec('ALTER TABLE sessions ADD COLUMN sess TEXT;'); } catch (e) {}

    // Data-preserving migration helper for Task 1 REAL -> Task 2/3/4 INTEGER paise columns
    const migrateMoneyCol = (table, oldCol, newCol, defaultVal = 0) => {
      const tableCheck = sqliteDb.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table);
      if (!tableCheck) return;

      let cols = [];
      try {
        cols = sqliteDb.pragma(`table_info(${table})`);
      } catch (e) {
        console.error(`[SQLite Migration Error] Failed inspecting table info for ${table}:`, e.message);
        throw e;
      }

      const hasOld = cols.some(c => c.name === oldCol);
      const hasNew = cols.some(c => c.name === newCol);

      if (!hasNew) {
        try {
          sqliteDb.exec(`ALTER TABLE ${table} ADD COLUMN ${newCol} INTEGER NOT NULL DEFAULT ${defaultVal};`);
        } catch (e) {
          console.error(`[SQLite Migration Error] Failed adding column ${newCol} to table ${table}:`, e.message);
          throw e;
        }
      }

      if (hasOld) {
        try {
          // Deterministic conversion from old REAL Rupees to integer Paise (multiplied by 100 with rounding)
          sqliteDb.exec(`
            UPDATE ${table}
            SET ${newCol} = CAST(ROUND((${oldCol} + 0.0000001) * 100) AS INTEGER)
            WHERE (${newCol} IS NULL OR ${newCol} = 0) AND ${oldCol} IS NOT NULL AND ${oldCol} > 0;
          `);
          sqliteDb.exec(`ALTER TABLE ${table} DROP COLUMN ${oldCol};`);
        } catch (e) {
          console.error(`[SQLite Migration Error] Failed converting data or dropping old column ${oldCol} from ${table}:`, e.message);
          throw e;
        }
      }
    };

    migrateMoneyCol('financial_transactions', 'amount', 'amount_paise');
    migrateMoneyCol('financial_goals', 'target_price', 'target_price_paise');
    migrateMoneyCol('financial_goals', 'allocated_amount', 'allocated_amount_paise');
    migrateMoneyCol('cart_items', 'estimated_price', 'estimated_price_paise');
    migrateMoneyCol('purchase_records', 'actual_price', 'actual_price_paise');
    migrateMoneyCol('financial_preferences', 'daily_workday_income', 'daily_workday_income_paise', 22000);
    migrateMoneyCol('financial_preferences', 'transport_daily_cost', 'transport_daily_cost_paise', 5000);
    migrateMoneyCol('financial_preferences', 'transport_reserve_amount', 'transport_reserve_amount_paise', 10000);
    migrateMoneyCol('financial_preferences', 'weekly_budget_limit', 'weekly_budget_limit_paise', 0);
    migrateMoneyCol('financial_preferences', 'auto_approve_threshold', 'auto_approve_threshold_paise', 0);

    // Migration for transaction linkage FK columns
    const addLinkageCol = (table, colDef) => {
      const tableCheck = sqliteDb.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table);
      if (!tableCheck) return;
      const colName = colDef.trim().split(' ')[0];
      const cols = sqliteDb.pragma(`table_info(${table})`);
      const exists = cols.some(c => c.name === colName);
      if (!exists) {
        try {
          sqliteDb.exec(`ALTER TABLE ${table} ADD COLUMN ${colDef};`);
        } catch (e) {
          console.error(`[SQLite Migration Error] Failed adding linkage column ${colName} to ${table}:`, e.message);
          throw e;
        }
      }
    };

    addLinkageCol('financial_transactions', 'financial_goal_id TEXT REFERENCES financial_goals(id) ON DELETE SET NULL');
    addLinkageCol('financial_transactions', 'cart_item_id TEXT REFERENCES cart_items(id) ON DELETE SET NULL');
    addLinkageCol('financial_transactions', 'purchase_record_id TEXT REFERENCES purchase_records(id) ON DELETE SET NULL');
    addLinkageCol('financial_transactions', 'resource_id TEXT');
    addLinkageCol('purchase_records', 'financial_transaction_id TEXT REFERENCES financial_transactions(id) ON DELETE SET NULL');
  } catch (e) {
    console.error('[SQLite Init Schema Error]', e.message);
    throw e;
  }
}

const config = getDbConfig(process.env);

if (config.type === 'turso') {
  try {
    const { createClient } = await import('@libsql/client');
    const { drizzle } = await import('drizzle-orm/libsql');
    const client = createClient({
      url: config.tursoUrl,
      authToken: config.authToken
    });
    db = drizzle(client, { schema });
  } catch (err) {
    if (config.isProduction) {
      throw new Error(`[FATAL PRODUCTION DB ERROR] Failed to initialize Turso database client: ${err.message}`);
    }
    console.warn('[Turso Warning] Failed to initialize Turso client, falling back to local SQLite:', err.message);
    const defaultDbPath = 'doctrine.db';
    sqlite = new Database(defaultDbPath);
    sqlite.pragma('foreign_keys = ON');
    initSqliteSchema(sqlite);
    db = drizzle(sqlite, { schema });
  }
} else {
  sqlite = new Database(config.dbPath);
  sqlite.pragma('foreign_keys = ON');
  initSqliteSchema(sqlite);
  db = drizzle(sqlite, { schema });
}

export { db, sqlite };
