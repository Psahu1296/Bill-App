import { getDb } from "../db";

export function create(data: {
  paymentId?: string;
  orderId?: string;
  amount?: number;
  currency?: string;
  status?: string;
  method?: string;
  email?: string;
  contact?: string;
  createdAt?: Date;
}) {
  const db = getDb();
  const result = db.prepare(
    `INSERT INTO payments (payment_id, order_id, amount, currency, status, method, email, contact, created_at)
     VALUES (@paymentId, @orderId, @amount, @currency, @status, @method, @email, @contact, @createdAt)`
  ).run({
    paymentId: data.paymentId ?? null,
    orderId: data.orderId ?? null,
    amount: data.amount ?? null,
    currency: data.currency ?? null,
    status: data.status ?? null,
    method: data.method ?? null,
    email: data.email ?? null,
    contact: data.contact ?? null,
    createdAt: data.createdAt ? data.createdAt.toISOString() : new Date().toISOString(),
  });

  const row = db.prepare("SELECT * FROM payments WHERE id = ?").get(result.lastInsertRowid) as Record<string, unknown>;
  return {
    _id: String(row.id),
    paymentId: row.payment_id,
    orderId: row.order_id,
    amount: row.amount,
    currency: row.currency,
    status: row.status,
    method: row.method,
    email: row.email,
    contact: row.contact,
    createdAt: row.created_at,
  };
}
