import { getDb } from "../db";
import { normalizePhone } from "../utils/normalizePhone";

interface CustomerProfile {
  phone: string;
  name: string;
  preferredArea: string;
  totalOrders: number;
  lastOrderedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

function rowToProfile(row: Record<string, unknown>): CustomerProfile {
  return {
    phone: row["phone"] as string,
    name: row["name"] as string,
    preferredArea: row["preferred_area"] as string,
    totalOrders: row["total_orders"] as number,
    lastOrderedAt: (row["last_ordered_at"] as string) ?? null,
    createdAt: row["created_at"] as string,
    updatedAt: row["updated_at"] as string,
  };
}

export function getProfile(phone: string): CustomerProfile | null {
  const normalized = normalizePhone(phone);
  const row = getDb()
    .prepare("SELECT * FROM customer_profiles WHERE phone = ?")
    .get(normalized) as Record<string, unknown> | undefined;
  return row ? rowToProfile(row) : null;
}

export function upsertProfile(data: {
  phone: string;
  name: string;
  preferred_area?: string;
}): CustomerProfile {
  const db = getDb();
  const normalized = normalizePhone(data.phone);
  db.prepare(`
    INSERT INTO customer_profiles (phone, name, preferred_area, total_orders, last_ordered_at, updated_at)
    VALUES (?, ?, ?, 1, datetime('now'), datetime('now'))
    ON CONFLICT(phone) DO UPDATE SET
      name            = excluded.name,
      preferred_area  = CASE WHEN excluded.preferred_area != '' THEN excluded.preferred_area ELSE preferred_area END,
      total_orders    = total_orders + 1,
      last_ordered_at = datetime('now'),
      updated_at      = datetime('now')
  `).run(normalized, data.name.trim(), (data.preferred_area ?? "").trim());
  return getProfile(normalized)!;
}

export function updateProfile(
  phone: string,
  updates: { name?: string; preferred_area?: string }
): CustomerProfile | null {
  const db = getDb();
  const normalized = normalizePhone(phone);
  const sets: string[] = ["updated_at = datetime('now')"];
  const params: unknown[] = [];

  if (updates.name !== undefined) {
    sets.push("name = ?");
    params.push(updates.name.trim());
  }
  if (updates.preferred_area !== undefined) {
    sets.push("preferred_area = ?");
    params.push(updates.preferred_area.trim());
  }

  if (sets.length === 1) return getProfile(normalized); // nothing to update
  params.push(normalized);
  db.prepare(`UPDATE customer_profiles SET ${sets.join(", ")} WHERE phone = ?`).run(...params);
  return getProfile(normalized);
}
