import { getDb } from "../db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function staffRowToApi(row: any) {
  if (!row) return null;
  const { id, monthly_salary, join_date, is_active, created_at, updated_at, ...rest } = row;
  return {
    _id: String(id),
    monthlySalary: monthly_salary,
    joinDate: join_date,
    isActive: Boolean(is_active),
    createdAt: created_at,
    updatedAt: updated_at,
    payments: [] as object[],
    ...rest,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function paymentRowToApi(row: any) {
  if (!row) return null;
  const { id, staff_id, ...rest } = row;
  return { _id: String(id), ...rest };
}

function withPayments(staff: ReturnType<typeof staffRowToApi>) {
  if (!staff) return null;
  const payments = getDb()
    .prepare("SELECT * FROM staff_payments WHERE staff_id = ? ORDER BY date DESC")
    .all(Number(staff._id))
    .map(paymentRowToApi);
  return { ...staff, payments };
}

export function findById(id: string | number) {
  const row = getDb().prepare("SELECT * FROM staff WHERE id = ?").get(Number(id));
  return withPayments(staffRowToApi(row));
}

export function findAll(filters: { role?: string; isActive?: boolean } = {}) {
  const conditions: string[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params: any[] = [];
  if (filters.role !== undefined)     { conditions.push("role = ?");      params.push(filters.role); }
  if (filters.isActive !== undefined) { conditions.push("is_active = ?"); params.push(filters.isActive ? 1 : 0); }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  return getDb()
    .prepare(`SELECT * FROM staff ${where} ORDER BY created_at DESC`)
    .all(...params)
    .map(r => withPayments(staffRowToApi(r)));
}

export function create(data: {
  name: string; phone: string; role: string;
  monthlySalary?: number; joinDate?: string;
}) {
  const db = getDb();
  const result = db.prepare(
    `INSERT INTO staff (name, phone, role, monthly_salary, join_date, is_active)
     VALUES (@name, @phone, @role, @monthlySalary, @joinDate, 1)`
  ).run({
    name: data.name,
    phone: data.phone,
    role: data.role,
    monthlySalary: data.monthlySalary ?? 0,
    joinDate: data.joinDate ?? new Date().toISOString().split("T")[0],
  });
  return findById(result.lastInsertRowid as number)!;
}

export function update(id: string | number, updates: Record<string, unknown>) {
  const db = getDb();
  const colMap: Record<string, string> = {
    name: "name", phone: "phone", role: "role",
    monthlySalary: "monthly_salary", joinDate: "join_date", isActive: "is_active",
  };
  const sets: string[] = [];
  const params: Record<string, unknown> = { id: Number(id) };
  for (const [js, col] of Object.entries(colMap)) {
    if (js in updates) {
      sets.push(`${col} = @${js}`);
      params[js] = js === "isActive" ? (updates[js] ? 1 : 0) : updates[js];
    }
  }
  if (!sets.length) return findById(id);
  sets.push("updated_at = datetime('now')");
  db.prepare(`UPDATE staff SET ${sets.join(", ")} WHERE id = @id`).run(params);
  return findById(id);
}

export function remove(id: string | number) {
  const staff = findById(id);
  getDb().prepare("DELETE FROM staff WHERE id = ?").run(Number(id));
  return staff;
}

export function toggleActive(id: string | number) {
  const db = getDb();
  db.prepare(`
    UPDATE staff SET is_active = CASE WHEN is_active = 1 THEN 0 ELSE 1 END,
    updated_at = datetime('now') WHERE id = ?
  `).run(Number(id));
  return findById(id);
}

export function addPayment(staffId: string | number, data: {
  amount: number; type: string; note?: string; date?: string;
}) {
  const db = getDb();
  db.prepare(
    "INSERT INTO staff_payments (staff_id, amount, type, note, date) VALUES (@staffId, @amount, @type, @note, @date)"
  ).run({
    staffId: Number(staffId),
    amount: data.amount,
    type: data.type,
    note: data.note ?? data.type,
    date: data.date ?? new Date().toISOString(),
  });
  return findById(staffId)!;
}

export function deletePayment(staffId: string | number, paymentId: string | number) {
  const db = getDb();
  const payment = db.prepare("SELECT * FROM staff_payments WHERE id = ? AND staff_id = ?")
    .get(Number(paymentId), Number(staffId));
  if (!payment) return null;
  db.prepare("DELETE FROM staff_payments WHERE id = ?").run(Number(paymentId));
  return findById(staffId)!;
}
