import { getDb } from "../db";
import * as SettingsRepo from "./settingsRepo";

// ── Delivery Areas ────────────────────────────────────────────────────────────

function rowToArea(row: Record<string, unknown>) {
  return {
    _id: String(row["id"]),
    name: row["name"] as string,
    isActive: row["is_active"] !== 0,
    deliveryFee: Number(row["delivery_fee"] ?? 0),
    minOrderAmount: Number(row["min_order_amount"] ?? 0),
    createdAt: row["created_at"] as string,
    updatedAt: row["updated_at"] as string,
  };
}

export function getAllAreas() {
  const rows = getDb()
    .prepare("SELECT * FROM delivery_areas ORDER BY name ASC")
    .all() as Record<string, unknown>[];
  return rows.map(rowToArea);
}

export function getActiveAreas() {
  const rows = getDb()
    .prepare("SELECT * FROM delivery_areas WHERE is_active = 1 ORDER BY name ASC")
    .all() as Record<string, unknown>[];
  return rows.map(rowToArea);
}

export function addArea(name: string, deliveryFee = 0, minOrderAmount = 0) {
  const db = getDb();
  const result = db
    .prepare("INSERT INTO delivery_areas (name, delivery_fee, min_order_amount) VALUES (?, ?, ?)")
    .run(name.trim(), deliveryFee, minOrderAmount);
  const row = db
    .prepare("SELECT * FROM delivery_areas WHERE id = ?")
    .get(result.lastInsertRowid) as Record<string, unknown>;
  return rowToArea(row);
}

export function updateArea(id: string | number, updates: { deliveryFee?: number; minOrderAmount?: number }) {
  const db = getDb();
  const sets: string[] = ["updated_at = datetime('now')"];
  const values: unknown[] = [];
  if (updates.deliveryFee !== undefined) { sets.push("delivery_fee = ?"); values.push(updates.deliveryFee); }
  if (updates.minOrderAmount !== undefined) { sets.push("min_order_amount = ?"); values.push(updates.minOrderAmount); }
  if (sets.length === 1) return null; // nothing to update
  values.push(Number(id));
  db.prepare(`UPDATE delivery_areas SET ${sets.join(", ")} WHERE id = ?`).run(...values);
  const row = db.prepare("SELECT * FROM delivery_areas WHERE id = ?").get(Number(id)) as Record<string, unknown> | undefined;
  return row ? rowToArea(row) : null;
}

export function deleteArea(id: string | number) {
  const changes = getDb()
    .prepare("DELETE FROM delivery_areas WHERE id = ?")
    .run(Number(id)).changes;
  return changes > 0;
}

export function toggleArea(id: string | number, isActive: boolean) {
  const db = getDb();
  db.prepare(
    "UPDATE delivery_areas SET is_active = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(isActive ? 1 : 0, Number(id));
  const row = db
    .prepare("SELECT * FROM delivery_areas WHERE id = ?")
    .get(Number(id)) as Record<string, unknown> | undefined;
  return row ? rowToArea(row) : null;
}

// ── Config Flags ──────────────────────────────────────────────────────────────

export interface OnlineConfigFlags {
  isOnline: boolean;
  deliveryEnabled: boolean;
  availableTimeStart: string;
  availableTimeEnd: string;
}

export function getFlags(): OnlineConfigFlags {
  return {
    isOnline: SettingsRepo.isOnlineOrdersEnabled(),
    deliveryEnabled: SettingsRepo.getSetting("delivery_enabled") !== "false",
    availableTimeStart: SettingsRepo.getSetting("available_time_start") ?? "09:00",
    availableTimeEnd: SettingsRepo.getSetting("available_time_end") ?? "22:00",
  };
}

export function setFlags(updates: Partial<OnlineConfigFlags>): OnlineConfigFlags {
  if (updates.isOnline !== undefined) {
    SettingsRepo.setSetting("online_orders", String(updates.isOnline));
  }
  if (updates.deliveryEnabled !== undefined) {
    SettingsRepo.setSetting("delivery_enabled", String(updates.deliveryEnabled));
  }
  if (updates.availableTimeStart !== undefined) {
    SettingsRepo.setSetting("available_time_start", updates.availableTimeStart);
  }
  if (updates.availableTimeEnd !== undefined) {
    SettingsRepo.setSetting("available_time_end", updates.availableTimeEnd);
  }
  return getFlags();
}
