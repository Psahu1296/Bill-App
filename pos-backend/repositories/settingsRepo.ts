import { getDb } from "../db";

export function getSetting(key: string): string | null {
  const row = getDb()
    .prepare("SELECT value FROM store_settings WHERE key = ?")
    .get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  getDb()
    .prepare(`
      INSERT INTO store_settings (key, value, updated_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `)
    .run(key, value);
}

export function isOnlineOrdersEnabled(): boolean {
  return getSetting("online_orders") !== "false";
}
