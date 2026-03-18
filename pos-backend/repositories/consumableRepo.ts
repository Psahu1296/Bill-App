import { getDb } from "../db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToApi(row: any, populateOrder = false) {
  if (!row) return null;
  const { id, price_per_unit, consumer_type, consumer_name, order_id, created_at, updated_at, ...rest } = row;
  const result: Record<string, unknown> = {
    _id: String(id),
    pricePerUnit: price_per_unit,
    consumerType: consumer_type,
    consumerName: consumer_name,
    orderId: order_id != null ? String(order_id) : null,
    createdAt: created_at,
    updatedAt: updated_at,
    ...rest,
  };

  if (populateOrder && row.order_customer_details) {
    try {
      result.orderId = {
        _id: String(order_id),
        customerDetails: JSON.parse(row.order_customer_details),
        orderDate: row.order_date,
      };
    } catch { /* ignore */ }
  }

  return result;
}

export function create(data: {
  type: string; quantity: number; pricePerUnit: number;
  consumerType: string; consumerName: string;
  orderId?: number | null; timestamp?: string;
}) {
  const db = getDb();
  const result = db.prepare(
    `INSERT INTO consumables (type, quantity, price_per_unit, consumer_type, consumer_name, order_id, timestamp)
     VALUES (@type, @quantity, @pricePerUnit, @consumerType, @consumerName, @orderId, @timestamp)`
  ).run({
    type: data.type,
    quantity: data.quantity,
    pricePerUnit: data.pricePerUnit,
    consumerType: data.consumerType,
    consumerName: data.consumerName,
    orderId: data.orderId ?? null,
    timestamp: data.timestamp ?? new Date().toISOString(),
  });
  return rowToApi(db.prepare("SELECT * FROM consumables WHERE id = ?").get(result.lastInsertRowid));
}

export function bulkCreate(entries: Parameters<typeof create>[0][]) {
  const db = getDb();
  const stmt = db.prepare(
    `INSERT INTO consumables (type, quantity, price_per_unit, consumer_type, consumer_name, order_id, timestamp)
     VALUES (@type, @quantity, @pricePerUnit, @consumerType, @consumerName, @orderId, @timestamp)`
  );
  const insertAll = db.transaction((list: typeof entries) => {
    for (const e of list) stmt.run({ ...e, orderId: e.orderId ?? null, timestamp: e.timestamp ?? new Date().toISOString(), pricePerUnit: e.pricePerUnit });
  });
  insertAll(entries);
}

export function findAll(filters: {
  type?: string; consumerType?: string;
  startDate?: Date; endDate?: Date;
} = {}) {
  const conditions: string[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params: any[] = [];

  if (filters.type)         { conditions.push("c.type = ?");          params.push(filters.type); }
  if (filters.consumerType) { conditions.push("c.consumer_type = ?"); params.push(filters.consumerType); }
  if (filters.startDate)    { conditions.push("c.timestamp >= ?");    params.push(filters.startDate.toISOString()); }
  if (filters.endDate)      { conditions.push("c.timestamp <= ?");    params.push(filters.endDate.toISOString()); }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const rows = getDb().prepare(`
    SELECT c.*,
           o.customer_details AS order_customer_details,
           o.order_date       AS order_date
    FROM consumables c
    LEFT JOIN orders o ON o.id = c.order_id
    ${where}
    ORDER BY c.timestamp DESC
  `).all(...params);
  return rows.map(r => rowToApi(r, true));
}

export function dailySummary(startDate: Date, endDate: Date) {
  return getDb().prepare(`
    SELECT type,
           consumer_type                          AS consumerType,
           SUM(quantity)                          AS totalQty,
           SUM(quantity * price_per_unit)         AS totalRevenue
    FROM consumables
    WHERE timestamp >= ? AND timestamp <= ?
    GROUP BY type, consumer_type
  `).all(startDate.toISOString(), endDate.toISOString()) as {
    type: string; consumerType: string; totalQty: number; totalRevenue: number;
  }[];
}

export function update(id: string | number, updates: Record<string, unknown>) {
  const db = getDb();
  const colMap: Record<string, string> = {
    type: "type", quantity: "quantity", pricePerUnit: "price_per_unit",
    consumerType: "consumer_type", consumerName: "consumer_name",
    orderId: "order_id", timestamp: "timestamp",
  };
  const sets: string[] = [];
  const params: Record<string, unknown> = { id: Number(id) };
  for (const [js, col] of Object.entries(colMap)) {
    if (js in updates) { sets.push(`${col} = @${js}`); params[js] = updates[js]; }
  }
  if (!sets.length) return null;
  sets.push("updated_at = datetime('now')");
  db.prepare(`UPDATE consumables SET ${sets.join(", ")} WHERE id = @id`).run(params);
  return rowToApi(db.prepare("SELECT * FROM consumables WHERE id = ?").get(Number(id)));
}

export function remove(id: string | number) {
  const db = getDb();
  const row = db.prepare("SELECT * FROM consumables WHERE id = ?").get(Number(id));
  db.prepare("DELETE FROM consumables WHERE id = ?").run(Number(id));
  return rowToApi(row);
}

export function removeByOrderId(orderId: string | number) {
  getDb().prepare("DELETE FROM consumables WHERE order_id = ?").run(Number(orderId));
}
