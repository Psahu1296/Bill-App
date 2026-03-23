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

  // store_settings table was added later — create + seed if missing
  db.prepare(`
    CREATE TABLE IF NOT EXISTS store_settings (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `).run();
  db.prepare("INSERT OR IGNORE INTO store_settings (key, value) VALUES ('online_orders', 'true')").run();
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
