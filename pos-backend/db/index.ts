import Database from "better-sqlite3";
import path from "path";
import { initSchema } from "./schema";

/** Add columns that didn't exist in older DB files (idempotent). */
function runMigrations(db: Database.Database) {
  const cols = db.prepare("PRAGMA table_info(orders)").all() as { name: string }[];
  const names = new Set(cols.map(c => c.name));
  if (!names.has("order_type")) {
    db.prepare("ALTER TABLE orders ADD COLUMN order_type TEXT NOT NULL DEFAULT 'dine-in'").run();
  }
  if (!names.has("delivery_address")) {
    db.prepare("ALTER TABLE orders ADD COLUMN delivery_address TEXT NOT NULL DEFAULT ''").run();
  }

  // ── Ledger repair migration ──────────────────────────────────────────────────
  // Old logic wrote to the ledger the moment an order was CREATED, then wrote
  // delta entries every time a payment was updated mid-order.  This caused
  // negative and inflated balances.  The new rule: ledger is only written when
  // an order transitions to "Completed" with an outstanding balance.
  //
  // Step 1 — remove `full_payment_due` rows that are linked to orders that are
  // NOT yet completed (these were written by the old "record on creation" logic).
  db.prepare(`
    DELETE FROM customer_ledger_transactions
    WHERE transaction_type = 'full_payment_due'
      AND order_id IS NOT NULL
      AND order_id NOT IN (
        SELECT id FROM orders WHERE order_status = 'Completed'
      )
  `).run();

  // Step 2 — remove `balance_increased` / `balance_decreased` rows that were
  // written by the old per-update delta logic (identified by the notes pattern).
  db.prepare(`
    DELETE FROM customer_ledger_transactions
    WHERE transaction_type IN ('balance_increased', 'balance_decreased')
      AND notes LIKE '% updated. Net change:%'
  `).run();

  // Step 3 — recompute balance_due for every customer from the transactions
  // that survived the cleanup above.  Credits subtract, debits add.
  db.prepare(`
    UPDATE customer_ledger
    SET balance_due = COALESCE((
      SELECT SUM(
        CASE
          WHEN transaction_type IN ('balance_decreased', 'payment_received') THEN -amount
          ELSE amount
        END
      )
      FROM customer_ledger_transactions
      WHERE ledger_id = customer_ledger.id
    ), 0)
  `).run();

  // Step 4 — safety clamp: never let a customer's balance go below zero.
  db.prepare("UPDATE customer_ledger SET balance_due = 0 WHERE balance_due < 0").run();

  // store_settings table was added later — create + seed if missing
  db.prepare(`
    CREATE TABLE IF NOT EXISTS store_settings (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `).run();
  db.prepare("INSERT OR IGNORE INTO store_settings (key, value) VALUES ('online_orders', 'true')").run();

  // is_virtual column — added to support the Takeaway virtual table
  try {
    db.prepare("ALTER TABLE tables_tb ADD COLUMN is_virtual INTEGER NOT NULL DEFAULT 0").run();
  } catch { /* column already exists — safe to ignore */ }

  // is_online_available column — controls per-dish online ordering availability
  try {
    db.prepare("ALTER TABLE dishes ADD COLUMN is_online_available INTEGER NOT NULL DEFAULT 0").run();
  } catch { /* column already exists — safe to ignore */ }

  // Ensure the virtual takeaway table always exists (safe after restore or delete)
  db.prepare("INSERT OR IGNORE INTO tables_tb (table_no, seats, is_virtual) VALUES (0, 0, 1)").run();

  // delivery_areas table — added for online config module
  db.prepare(`
    CREATE TABLE IF NOT EXISTS delivery_areas (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT    NOT NULL UNIQUE,
      is_active  INTEGER NOT NULL DEFAULT 1,
      created_at TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `).run();

  // Seed online config flags (idempotent)
  db.prepare("INSERT OR IGNORE INTO store_settings (key, value) VALUES ('available_time_start', '09:00')").run();
  db.prepare("INSERT OR IGNORE INTO store_settings (key, value) VALUES ('available_time_end', '22:00')").run();
  db.prepare("INSERT OR IGNORE INTO store_settings (key, value) VALUES ('delivery_enabled', 'true')").run();

  // delivery_fee and min_order_amount columns on delivery_areas
  try {
    db.prepare("ALTER TABLE delivery_areas ADD COLUMN delivery_fee REAL NOT NULL DEFAULT 0").run();
  } catch { /* column already exists */ }
  try {
    db.prepare("ALTER TABLE delivery_areas ADD COLUMN min_order_amount REAL NOT NULL DEFAULT 0").run();
  } catch { /* column already exists */ }

  // customer_profiles table — public-facing customer identity store (separate from POS ledger)
  db.prepare(`
    CREATE TABLE IF NOT EXISTS customer_profiles (
      phone           TEXT PRIMARY KEY,
      name            TEXT NOT NULL DEFAULT '',
      preferred_area  TEXT NOT NULL DEFAULT '',
      total_orders    INTEGER NOT NULL DEFAULT 0,
      last_ordered_at TEXT,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `).run();
}

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;

  const dbPath = process.env["DATABASE_PATH"]
    ?? path.join(process.cwd(), "dhaba-pos.db");

  _db = new Database(dbPath);
  _db.pragma("journal_mode = WAL");   // better concurrent read performance
  _db.pragma("foreign_keys = ON");    // enforce referential integrity
  _db.pragma("busy_timeout = 5000");  // wait up to 5s instead of throwing SQLITE_BUSY

  initSchema(_db);
  runMigrations(_db);
  return _db;
}
