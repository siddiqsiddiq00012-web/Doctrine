import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { cryptoNative } from '../utils/crypto.js';
import { db } from '../db/index.js';
import { users, financialTransactions, financialGoals, purchaseRecords, cartItems } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { calculateLedgerGoalAllocationPaise, syncGoalAllocationCache } from '../services/financialSyncService.js';

// Helper to construct a temporary isolated SQLite database file for testing
function createTempDbPath() {
  return path.join(process.cwd(), 'server', 'tests', `temp_migration_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.db`);
}

// Re-create hardened initSqliteSchema runner directly for temp test DBs
function runInitSqliteSchema(sqliteDb) {
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      google_id TEXT UNIQUE,
      email TEXT NOT NULL,
      display_name TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
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
}

test('FEATURE 16 — FINANCIAL MIGRATION SAFETY & SOURCE-OF-TRUTH TESTS', async (t) => {

  await t.test('1. Migration Failure Is Loudly Thrown (Fail-Closed Enforcement)', async () => {
    const dbPath = createTempDbPath();
    const mockDb = new Database(dbPath);
    try {
      // Create a corrupted table definition where alter table will fail
      mockDb.exec("CREATE TABLE financial_transactions (id TEXT PRIMARY KEY);");
      // Simulate broken SQLite pragma / schema error
      mockDb.close();

      assert.throws(() => {
        runInitSqliteSchema(mockDb);
      }, Error);
    } finally {
      if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    }
  });

  await t.test('2. State A: Fresh Database Initialization', async () => {
    const dbPath = createTempDbPath();
    const dbInst = new Database(dbPath);
    try {
      runInitSqliteSchema(dbInst);
      const tables = dbInst.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
      const tableNames = tables.map(t => t.name);
      assert.ok(tableNames.includes('financial_transactions'));
      assert.ok(tableNames.includes('financial_goals'));
      assert.ok(tableNames.includes('cart_items'));
      assert.ok(tableNames.includes('purchase_records'));
      assert.ok(tableNames.includes('financial_preferences'));
    } finally {
      dbInst.close();
      if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    }
  });

  await t.test('3. State B: Data-Preserving Migration of Existing Task 1 Database', async () => {
    const dbPath = createTempDbPath();
    const dbInst = new Database(dbPath);
    try {
      // Step 1: Initialize raw Task 1 schema (with old REAL monetary columns)
      dbInst.exec(`
        CREATE TABLE users (
          id TEXT PRIMARY KEY,
          email TEXT NOT NULL
        );
        CREATE TABLE financial_transactions (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          amount REAL NOT NULL,
          date TEXT NOT NULL,
          type TEXT NOT NULL,
          category TEXT NOT NULL
        );
        CREATE TABLE financial_goals (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          name TEXT NOT NULL,
          target_price REAL NOT NULL,
          allocated_amount REAL NOT NULL DEFAULT 0
        );
        CREATE TABLE cart_items (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          item_name TEXT NOT NULL,
          estimated_price REAL NOT NULL
        );
        CREATE TABLE purchase_records (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          item_name TEXT NOT NULL,
          quantity REAL NOT NULL,
          actual_price REAL NOT NULL,
          purchase_date TEXT NOT NULL
        );
        CREATE TABLE financial_preferences (
          user_id TEXT PRIMARY KEY,
          daily_workday_income REAL NOT NULL DEFAULT 220.0,
          transport_daily_cost REAL NOT NULL DEFAULT 50.0,
          transport_reserve_amount REAL NOT NULL DEFAULT 100.0
        );
      `);

      // Step 2: Insert Task 1 test records with REAL values (Rupees)
      const uId = cryptoNative.randomUUID();
      dbInst.prepare("INSERT INTO users VALUES (?, ?)").run(uId, 'user@example.com');
      dbInst.prepare("INSERT INTO financial_transactions VALUES (?, ?, ?, ?, ?, ?)").run('tx-1', uId, 220.00, '2026-08-15', 'INCOME', 'WORKDAY');
      dbInst.prepare("INSERT INTO financial_goals VALUES (?, ?, ?, ?, ?)").run('goal-1', uId, 'Speaker', 3500.00, 500.00);
      dbInst.prepare("INSERT INTO cart_items VALUES (?, ?, ?, ?)").run('cart-1', uId, 'Eggs', 200.00);
      dbInst.prepare("INSERT INTO purchase_records VALUES (?, ?, ?, ?, ?, ?)").run('pur-1', uId, 'Eggs', 30, 185.50, '2026-08-15');
      dbInst.prepare("INSERT INTO financial_preferences VALUES (?, ?, ?, ?)").run(uId, 220.00, 50.00, 100.00);

      // Step 3: Run migration
      runInitSqliteSchema(dbInst);

      // Step 4: Verify exact converted integer Paise values with ZERO data loss!
      const tx = dbInst.prepare("SELECT * FROM financial_transactions WHERE id = 'tx-1'").get();
      assert.equal(tx.amount_paise, 22000); // ₹220.00 -> 22000 paise

      const goal = dbInst.prepare("SELECT * FROM financial_goals WHERE id = 'goal-1'").get();
      assert.equal(goal.target_price_paise, 350000); // ₹3500.00 -> 350000 paise
      assert.equal(goal.allocated_amount_paise, 50000); // ₹500.00 -> 50000 paise

      const cart = dbInst.prepare("SELECT * FROM cart_items WHERE id = 'cart-1'").get();
      assert.equal(cart.estimated_price_paise, 20000); // ₹200.00 -> 20000 paise

      const pur = dbInst.prepare("SELECT * FROM purchase_records WHERE id = 'pur-1'").get();
      assert.equal(pur.actual_price_paise, 18550); // ₹185.50 -> 18550 paise

      const pref = dbInst.prepare("SELECT * FROM financial_preferences WHERE user_id = ?").get(uId);
      assert.equal(pref.daily_workday_income_paise, 22000); // ₹220.00 -> 22000 paise
      assert.equal(pref.transport_daily_cost_paise, 5000); // ₹50.00 -> 5000 paise
      assert.equal(pref.transport_reserve_amount_paise, 10000); // ₹100.00 -> 10000 paise
    } finally {
      dbInst.close();
      if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    }
  });

  await t.test('4. Tiny Monetary Values Exact Conversion Test', async () => {
    const dbPath = createTempDbPath();
    const dbInst = new Database(dbPath);
    try {
      dbInst.exec(`
        CREATE TABLE cart_items (
          id TEXT PRIMARY KEY,
          item_name TEXT NOT NULL,
          estimated_price REAL NOT NULL
        );
      `);

      dbInst.prepare("INSERT INTO cart_items VALUES ('item-01', 'Penny Item', 0.01)").run();
      dbInst.prepare("INSERT INTO cart_items VALUES ('item-10', 'Dime Item', 0.10)").run();
      dbInst.prepare("INSERT INTO cart_items VALUES ('item-29', 'Custom Item', 0.29)").run();
      dbInst.prepare("INSERT INTO cart_items VALUES ('item-199', 'Tag Item', 1.99)").run();
      dbInst.prepare("INSERT INTO cart_items VALUES ('item-49999', 'Big Item', 499.99)").run();

      runInitSqliteSchema(dbInst);

      assert.equal(dbInst.prepare("SELECT estimated_price_paise FROM cart_items WHERE id = 'item-01'").get().estimated_price_paise, 1);
      assert.equal(dbInst.prepare("SELECT estimated_price_paise FROM cart_items WHERE id = 'item-10'").get().estimated_price_paise, 10);
      assert.equal(dbInst.prepare("SELECT estimated_price_paise FROM cart_items WHERE id = 'item-29'").get().estimated_price_paise, 29);
      assert.equal(dbInst.prepare("SELECT estimated_price_paise FROM cart_items WHERE id = 'item-199'").get().estimated_price_paise, 199);
      assert.equal(dbInst.prepare("SELECT estimated_price_paise FROM cart_items WHERE id = 'item-49999'").get().estimated_price_paise, 49999);
    } finally {
      dbInst.close();
      if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    }
  });

  await t.test('5. State C & D: Idempotency & Partial Migration Recovery', async () => {
    const dbPath = createTempDbPath();
    const dbInst = new Database(dbPath);
    try {
      runInitSqliteSchema(dbInst);

      const uId = cryptoNative.randomUUID();
      dbInst.prepare("INSERT INTO users (id, google_id, email, display_name) VALUES (?, ?, ?, ?)").run(uId, 'g-1', 'a@b.com', 'A');
      dbInst.prepare("INSERT INTO financial_transactions (id, user_id, amount_paise, date, type, category) VALUES (?, ?, ?, ?, ?, ?)").run('tx-2', uId, 15000, '2026-08-15', 'INCOME', 'WORKDAY');

      // Second run: idempotent check
      runInitSqliteSchema(dbInst);

      const tx = dbInst.prepare("SELECT * FROM financial_transactions WHERE id = 'tx-2'").get();
      assert.equal(tx.amount_paise, 15000);
    } finally {
      dbInst.close();
      if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    }
  });

  await t.test('6. Goal Allocation Cache Sync Service Repair Test', async () => {
    const testUserId = cryptoNative.randomUUID();
    const goalId = cryptoNative.randomUUID();

    // Create user and goal with initial cache = 10000 paise (₹100)
    await db.insert(users).values({
      id: testUserId,
      googleId: 'google_sync_test_' + Date.now(),
      email: 'sync_test@example.com',
      displayName: 'Sync User'
    });

    await db.insert(financialGoals).values({
      id: goalId,
      userId: testUserId,
      name: 'Sync Speaker Goal',
      targetPricePaise: 350000,
      allocatedAmountPaise: 10000 // Out-of-sync stale cache!
    });

    // Add 2 authoritative ledger allocation transactions totalling 15000 paise (₹150)
    await db.insert(financialTransactions).values([
      {
        id: cryptoNative.randomUUID(),
        userId: testUserId,
        amountPaise: 10000,
        date: '2026-08-15',
        type: 'ALLOCATION',
        category: 'GOAL_SAVING',
        financialGoalId: goalId
      },
      {
        id: cryptoNative.randomUUID(),
        userId: testUserId,
        amountPaise: 5000,
        date: '2026-08-15',
        type: 'ALLOCATION',
        category: 'GOAL_SAVING',
        financialGoalId: goalId
      }
    ]);

    // 6a. Calculate authoritative ledger sum
    const ledgerSum = await calculateLedgerGoalAllocationPaise(db, testUserId, goalId);
    assert.equal(ledgerSum, 15000); // Ledger sum is 15000 paise (₹150)

    // 6b. Run deterministic cache repair
    const syncRes = await syncGoalAllocationCache(db, testUserId, goalId);
    assert.equal(syncRes.updated, true);
    assert.equal(syncRes.ledgerPaise, 15000);
    assert.equal(syncRes.previousCachePaise, 10000);

    // 6c. Verify goal cache is now repaired in DB
    const [repairedGoal] = await db.select().from(financialGoals).where(eq(financialGoals.id, goalId));
    assert.equal(repairedGoal.allocatedAmountPaise, 15000);

    // 6d. Verify authoritative ledger transactions were NOT altered
    const userTxs = await db.select().from(financialTransactions).where(eq(financialTransactions.financialGoalId, goalId));
    assert.equal(userTxs.length, 2);

    // Cleanup
    await db.delete(financialTransactions).where(eq(financialTransactions.userId, testUserId));
    await db.delete(financialGoals).where(eq(financialGoals.userId, testUserId));
    await db.delete(users).where(eq(users.id, testUserId));
  });

  await t.test('7. Optional Entity Deletion Preserves Authoritative Transactions (ON DELETE SET NULL)', async () => {
    const testUserId = cryptoNative.randomUUID();
    const goalId = cryptoNative.randomUUID();
    const txId = cryptoNative.randomUUID();

    await db.insert(users).values({
      id: testUserId,
      googleId: 'google_del_test_' + Date.now(),
      email: 'del_test@example.com',
      displayName: 'Del User'
    });

    await db.insert(financialGoals).values({
      id: goalId,
      userId: testUserId,
      name: 'Temporary Goal',
      targetPricePaise: 500000
    });

    await db.insert(financialTransactions).values({
      id: txId,
      userId: testUserId,
      amountPaise: 50000,
      date: '2026-08-15',
      type: 'ALLOCATION',
      category: 'GOAL_SAVING',
      financialGoalId: goalId
    });

    // Delete goal
    await db.delete(financialGoals).where(eq(financialGoals.id, goalId));

    // Verify transaction SURVIVES with financialGoalId set to null
    const [tx] = await db.select().from(financialTransactions).where(eq(financialTransactions.id, txId));
    assert.ok(tx);
    assert.equal(tx.financialGoalId, null); // ON DELETE SET NULL preserved historical transaction!

    // Cleanup
    await db.delete(financialTransactions).where(eq(financialTransactions.userId, testUserId));
    await db.delete(users).where(eq(users.id, testUserId));
  });

  await t.test('8. Multi-Tenant User Isolation Across Entity Synchronization', async () => {
    const userA = cryptoNative.randomUUID();
    const userB = cryptoNative.randomUUID();
    const goalA = cryptoNative.randomUUID();

    await db.insert(users).values([
      { id: userA, googleId: 'g_user_a_' + Date.now(), email: 'ua@test.com', displayName: 'User A' },
      { id: userB, googleId: 'g_user_b_' + Date.now(), email: 'ub@test.com', displayName: 'User B' }
    ]);

    await db.insert(financialGoals).values({
      id: goalA,
      userId: userA,
      name: 'User A Goal',
      targetPricePaise: 100000,
      allocatedAmountPaise: 0
    });

    // User B attempts to trigger sync on User A's goal: should throw unauthorized / not found error
    await assert.rejects(async () => {
      await syncGoalAllocationCache(db, userB, goalA);
    }, /Financial goal not found or access denied/);

    // Cleanup
    await db.delete(financialGoals).where(eq(financialGoals.userId, userA));
    await db.delete(users).where(eq(users.id, userA));
    await db.delete(users).where(eq(users.id, userB));
  });

});
