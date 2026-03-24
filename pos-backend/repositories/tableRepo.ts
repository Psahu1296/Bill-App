import { getDb } from "../db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToApi(row: any) {
  if (!row) return null;
  const { id, table_no, is_virtual, current_order_id, created_at, updated_at, ...rest } = row;
  return {
    _id: String(id),
    tableNo: table_no,
    isVirtual: Boolean(is_virtual),
    currentOrder: current_order_id != null ? String(current_order_id) : null,
    createdAt: created_at,
    updatedAt: updated_at,
    ...rest,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToApiPopulated(row: any) {
  if (!row) return null;
  const base = rowToApi(row);
  if (row.order_customer_details) {
    try {
      const cd = JSON.parse(row.order_customer_details);
      base!.currentOrder = row.current_order_id
        ? { _id: String(row.current_order_id), customerDetails: cd }
        : null;
    } catch { /* ignore */ }
  }
  return base;
}

export function findByTableNo(tableNo: number) {
  const row = getDb().prepare("SELECT * FROM tables_tb WHERE table_no = ?").get(tableNo);
  return rowToApi(row);
}

export function findById(id: string | number) {
  const row = getDb().prepare("SELECT * FROM tables_tb WHERE id = ?").get(Number(id));
  return rowToApi(row);
}

export function findAll() {
  const rows = getDb().prepare(`
    SELECT t.*,
           o.customer_details AS order_customer_details
    FROM tables_tb t
    LEFT JOIN orders o ON o.id = t.current_order_id
    ORDER BY t.table_no ASC
  `).all();
  return rows.map(rowToApiPopulated);
}

export function create(data: { tableNo: number; seats: number }) {
  const db = getDb();
  const result = db
    .prepare("INSERT INTO tables_tb (table_no, seats) VALUES (@tableNo, @seats)")
    .run(data);
  return findById(result.lastInsertRowid as number)!;
}

export function update(id: string | number, data: { status?: string; currentOrderId?: number | null }) {
  const db = getDb();
  db.prepare(
    `UPDATE tables_tb
     SET status = COALESCE(@status, status),
         current_order_id = @currentOrderId,
         updated_at = datetime('now')
     WHERE id = @id`
  ).run({ id: Number(id), status: data.status ?? null, currentOrderId: data.currentOrderId ?? null });
  return findById(id);
}
