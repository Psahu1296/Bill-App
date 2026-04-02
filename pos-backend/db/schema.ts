import Database from "better-sqlite3";

export function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL,
      email       TEXT    NOT NULL UNIQUE,
      phone       TEXT    NOT NULL,
      password    TEXT    NOT NULL,
      role        TEXT    NOT NULL,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- 'tables' is a reserved word in SQLite — use tables_tb
    CREATE TABLE IF NOT EXISTS tables_tb (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      table_no          INTEGER NOT NULL UNIQUE,
      status            TEXT    NOT NULL DEFAULT 'Available',
      seats             INTEGER NOT NULL,
      is_virtual        INTEGER NOT NULL DEFAULT 0,
      current_order_id  INTEGER REFERENCES orders(id) ON DELETE SET NULL,
      created_at        TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at        TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS dishes (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      image            TEXT    NOT NULL,
      name             TEXT    NOT NULL UNIQUE,
      number_of_orders INTEGER NOT NULL DEFAULT 0,
      type             TEXT    NOT NULL,
      category         TEXT    NOT NULL,
      variants         TEXT    NOT NULL DEFAULT '[]',   -- JSON array
      description      TEXT    NOT NULL DEFAULT '',
      is_available        INTEGER NOT NULL DEFAULT 1,
      is_frequent         INTEGER NOT NULL DEFAULT 0,
      is_online_available INTEGER NOT NULL DEFAULT 0,
      created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at       TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS orders (
      id                    INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_details      TEXT    NOT NULL DEFAULT '{}',  -- JSON
      order_status          TEXT    NOT NULL,
      order_date            TEXT    NOT NULL DEFAULT (datetime('now')),
      bills                 TEXT    NOT NULL DEFAULT '{}',  -- JSON
      items                 TEXT    NOT NULL DEFAULT '[]',  -- JSON array
      table_id              INTEGER REFERENCES tables_tb(id) ON DELETE SET NULL,
      payment_method        TEXT,
      payment_data          TEXT    DEFAULT '{}',           -- JSON
      payment_status        TEXT    NOT NULL DEFAULT 'Pending',
      amount_paid           REAL    NOT NULL DEFAULT 0,
      balance_due_on_order  REAL    NOT NULL DEFAULT 0,
      order_type            TEXT    NOT NULL DEFAULT 'dine-in',  -- 'dine-in' | 'takeaway' | 'delivery'
      delivery_address      TEXT    NOT NULL DEFAULT '',
      created_at            TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at            TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- Seed the permanent virtual "Takeaway / Parcel" counter (table_no = 0)
    -- is_virtual = 1 means multiple concurrent orders are allowed; status never changes
    -- Inserted after orders is created so the FK reference is satisfied
    INSERT OR IGNORE INTO tables_tb (table_no, seats, is_virtual) VALUES (0, 0, 1);

    CREATE TABLE IF NOT EXISTS payments (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_id  TEXT,
      order_id    TEXT,
      amount      REAL,
      currency    TEXT,
      status      TEXT,
      method      TEXT,
      email       TEXT,
      contact     TEXT,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      type         TEXT    NOT NULL,
      name         TEXT    NOT NULL,
      amount       REAL    NOT NULL,
      description  TEXT    NOT NULL DEFAULT '',
      expense_date TEXT    NOT NULL DEFAULT (datetime('now')),
      created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS daily_earnings (
      id                              INTEGER PRIMARY KEY AUTOINCREMENT,
      date                            TEXT    NOT NULL UNIQUE,
      total_earnings                  REAL    NOT NULL DEFAULT 0,
      percentage_change_from_yesterday REAL   NOT NULL DEFAULT 0,
      created_at                      TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at                      TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS customer_ledger (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_name    TEXT    NOT NULL,
      customer_phone   TEXT    NOT NULL UNIQUE,
      balance_due      REAL    NOT NULL DEFAULT 0,
      last_activity    TEXT    NOT NULL DEFAULT (datetime('now')),
      created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at       TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS customer_ledger_transactions (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      ledger_id        INTEGER NOT NULL REFERENCES customer_ledger(id) ON DELETE CASCADE,
      order_id         INTEGER REFERENCES orders(id) ON DELETE SET NULL,
      transaction_type TEXT    NOT NULL,
      amount           REAL    NOT NULL,
      timestamp        TEXT    NOT NULL DEFAULT (datetime('now')),
      notes            TEXT    NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS consumables (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      type           TEXT    NOT NULL,
      quantity       INTEGER NOT NULL,
      price_per_unit REAL    NOT NULL,
      consumer_type  TEXT    NOT NULL,
      consumer_name  TEXT    NOT NULL,
      order_id       INTEGER REFERENCES orders(id) ON DELETE SET NULL,
      timestamp      TEXT    NOT NULL DEFAULT (datetime('now')),
      created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at     TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_consumables_timestamp ON consumables(timestamp);
    CREATE INDEX IF NOT EXISTS idx_consumables_type_ts   ON consumables(type, timestamp);

    CREATE TABLE IF NOT EXISTS staff (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      name            TEXT    NOT NULL,
      phone           TEXT    NOT NULL,
      role            TEXT    NOT NULL,
      monthly_salary  REAL    NOT NULL DEFAULT 0,
      join_date       TEXT    NOT NULL DEFAULT (date('now')),
      is_active       INTEGER NOT NULL DEFAULT 1,
      created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_staff_is_active ON staff(is_active);
    CREATE INDEX IF NOT EXISTS idx_staff_role      ON staff(role);

    CREATE TABLE IF NOT EXISTS staff_payments (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      staff_id  INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
      amount    REAL    NOT NULL,
      type      TEXT    NOT NULL,
      date      TEXT    NOT NULL DEFAULT (datetime('now')),
      note      TEXT    NOT NULL DEFAULT ''
    );

    -- Generic key-value store for app settings
    CREATE TABLE IF NOT EXISTS store_settings (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Seed default settings (idempotent)
    INSERT OR IGNORE INTO store_settings (key, value) VALUES ('online_orders', 'true');
    INSERT OR IGNORE INTO store_settings (key, value) VALUES ('available_time_start', '09:00');
    INSERT OR IGNORE INTO store_settings (key, value) VALUES ('available_time_end', '22:00');
    INSERT OR IGNORE INTO store_settings (key, value) VALUES ('delivery_enabled', 'true');

    -- Delivery areas for online ordering
    CREATE TABLE IF NOT EXISTS delivery_areas (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT    NOT NULL UNIQUE,
      is_active  INTEGER NOT NULL DEFAULT 1,
      created_at TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);
}
