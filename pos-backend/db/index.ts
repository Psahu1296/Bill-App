import Database from "better-sqlite3";
import path from "path";
import { initSchema } from "./schema";

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
  return _db;
}
