import { getDb } from "../db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToApi(row: any) {
  if (!row) return null;
  const { id, expense_date, created_at, updated_at, ...rest } = row;
  return {
    _id: String(id),
    expenseDate: expense_date,
    createdAt: created_at,
    updatedAt: updated_at,
    ...rest,
  };
}

export function create(data: {
  type: string; name: string; amount: number;
  description?: string; expenseDate?: string;
}) {
  const db = getDb();
  const result = db.prepare(
    `INSERT INTO expenses (type, name, amount, description, expense_date)
     VALUES (@type, @name, @amount, @description, @expenseDate)`
  ).run({
    type: data.type,
    name: data.name,
    amount: data.amount,
    description: data.description ?? '',
    expenseDate: data.expenseDate ?? new Date().toISOString(),
  });
  return rowToApi(db.prepare("SELECT * FROM expenses WHERE id = ?").get(result.lastInsertRowid));
}

export function findAll(filters: { startDate?: Date; endDate?: Date; type?: string } = {}) {
  const conditions: string[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params: any[] = [];

  if (filters.startDate) { conditions.push("expense_date >= ?"); params.push(filters.startDate.toISOString()); }
  if (filters.endDate)   { conditions.push("expense_date <= ?"); params.push(filters.endDate.toISOString()); }
  if (filters.type)      { conditions.push("type = ?"); params.push(filters.type); }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  return getDb().prepare(`SELECT * FROM expenses ${where} ORDER BY expense_date DESC`).all(...params).map(rowToApi);
}

export function aggregateByType(startDate: Date, endDate: Date) {
  return getDb().prepare(`
    SELECT type, SUM(amount) AS totalAmount
    FROM expenses
    WHERE expense_date >= ? AND expense_date <= ?
    GROUP BY type
  `).all(startDate.toISOString(), endDate.toISOString())
    .map((r: any) => ({ type: r.type, totalAmount: r.totalAmount }));
}

export function update(id: string | number, updates: Record<string, unknown>) {
  const db = getDb();
  const colMap: Record<string, string> = {
    type: "type", name: "name", amount: "amount",
    description: "description", expenseDate: "expense_date",
  };
  const sets: string[] = [];
  const params: Record<string, unknown> = { id: Number(id) };

  for (const [js, col] of Object.entries(colMap)) {
    if (js in updates) { sets.push(`${col} = @${js}`); params[js] = updates[js]; }
  }
  if (!sets.length) return findAll();
  sets.push("updated_at = datetime('now')");
  db.prepare(`UPDATE expenses SET ${sets.join(", ")} WHERE id = @id`).run(params);
  return rowToApi(db.prepare("SELECT * FROM expenses WHERE id = ?").get(Number(id)));
}

export function remove(id: string | number) {
  const db = getDb();
  const row = db.prepare("SELECT * FROM expenses WHERE id = ?").get(Number(id));
  db.prepare("DELETE FROM expenses WHERE id = ?").run(Number(id));
  return rowToApi(row);
}
