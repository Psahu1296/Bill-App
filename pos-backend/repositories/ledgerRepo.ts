import { getDb } from "../db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ledgerRowToApi(row: any) {
  if (!row) return null;
  const { id, customer_name, customer_phone, balance_due, last_activity, created_at, updated_at } = row;
  return {
    _id: String(id),
    customerName: customer_name,
    customerPhone: customer_phone,
    balanceDue: balance_due,
    lastActivity: last_activity,
    createdAt: created_at,
    updatedAt: updated_at,
    transactions: [] as object[],
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function txRowToApi(row: any) {
  if (!row) return null;
  const { id, ledger_id, order_id, transaction_type, ...rest } = row;
  return {
    _id: String(id),
    orderId: order_id != null ? String(order_id) : null,
    transactionType: transaction_type,
    ...rest,
  };
}

function withTransactions(ledger: ReturnType<typeof ledgerRowToApi>) {
  if (!ledger) return null;
  const txs = getDb()
    .prepare("SELECT * FROM customer_ledger_transactions WHERE ledger_id = ? ORDER BY timestamp DESC")
    .all(Number(ledger._id))
    .map(txRowToApi);
  return { ...ledger, transactions: txs };
}

export function findByPhone(phone: string) {
  const row = getDb().prepare("SELECT * FROM customer_ledger WHERE customer_phone = ?").get(phone);
  return withTransactions(ledgerRowToApi(row));
}

export function findAll(filters: {
  name?: string;
  phone?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
} = {}) {
  const db = getDb();
  const conditions: string[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params: any[] = [];

  if (filters.name) {
    conditions.push("customer_name LIKE ?");
    params.push(`%${filters.name}%`);
  }
  if (filters.phone) {
    conditions.push("customer_phone = ?");
    params.push(filters.phone);
  }
  if (filters.status === 'unpaid') {
    conditions.push("balance_due > 0");
  } else if (filters.status === 'paid') {
    conditions.push("balance_due = 0");
  }
  // Restrict to customers who have at least one transaction in the date range
  if (filters.startDate || filters.endDate) {
    const dateConds: string[] = [];
    if (filters.startDate) { dateConds.push("timestamp >= ?"); params.push(filters.startDate); }
    if (filters.endDate)   { dateConds.push("timestamp <= ?"); params.push(filters.endDate); }
    conditions.push(
      `id IN (SELECT ledger_id FROM customer_ledger_transactions WHERE ${dateConds.join(" AND ")})`
    );
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const rows = db
    .prepare(`SELECT * FROM customer_ledger ${where} ORDER BY last_activity DESC`)
    .all(...params);

  return rows.map(r => {
    const ledger = ledgerRowToApi(r);
    if (!ledger) return ledger;
    // Always return full transaction history so running balance is correct on the frontend
    return withTransactions(ledger);
  });
}

/** Creates or updates ledger balance atomically, then records a transaction */
export function upsertWithTransaction(data: {
  customerPhone: string;
  customerName: string;
  balanceDelta: number;
  transaction: {
    orderId?: number | null;
    transactionType: string;
    amount: number;
    notes?: string;
    timestamp?: string;
  };
}) {
  const db = getDb();

  const upsertLedger = db.transaction(() => {
    // Upsert the ledger row
    db.prepare(`
      INSERT INTO customer_ledger (customer_phone, customer_name, balance_due, last_activity)
      VALUES (@phone, @name, @delta, datetime('now'))
      ON CONFLICT(customer_phone) DO UPDATE SET
        balance_due = balance_due + excluded.balance_due,
        customer_name = excluded.customer_name,
        last_activity = datetime('now'),
        updated_at = datetime('now')
    `).run({ phone: data.customerPhone, name: data.customerName, delta: data.balanceDelta });

    const ledger = db.prepare("SELECT * FROM customer_ledger WHERE customer_phone = ?")
      .get(data.customerPhone) as { id: number };

    db.prepare(`
      INSERT INTO customer_ledger_transactions
        (ledger_id, order_id, transaction_type, amount, timestamp, notes)
      VALUES (@ledgerId, @orderId, @transactionType, @amount, @timestamp, @notes)
    `).run({
      ledgerId: ledger.id,
      orderId: data.transaction.orderId ?? null,
      transactionType: data.transaction.transactionType,
      amount: data.transaction.amount,
      timestamp: data.transaction.timestamp ?? new Date().toISOString(),
      notes: data.transaction.notes ?? '',
    });
  });

  upsertLedger();
  return findByPhone(data.customerPhone)!;
}

/** Create a brand-new customer entry with zero balance (no transaction row) */
export function createCustomer(data: { phone: string; name: string }) {
  getDb().prepare(`
    INSERT INTO customer_ledger (customer_phone, customer_name, balance_due, last_activity)
    VALUES (?, ?, 0, datetime('now'))
  `).run(data.phone, data.name);
  return findByPhone(data.phone)!;
}

/** Update customer name and/or phone number */
export function updateCustomer(
  phone: string,
  data: { name?: string; newPhone?: string }
): ReturnType<typeof findByPhone> {
  const db = getDb();
  if (data.name) {
    db.prepare(
      "UPDATE customer_ledger SET customer_name = ?, updated_at = datetime('now') WHERE customer_phone = ?"
    ).run(data.name, phone);
  }
  if (data.newPhone && data.newPhone !== phone) {
    db.prepare(
      "UPDATE customer_ledger SET customer_phone = ?, updated_at = datetime('now') WHERE customer_phone = ?"
    ).run(data.newPhone, phone);
    return findByPhone(data.newPhone);
  }
  return findByPhone(data.name ? phone : phone);
}

/** Delete a customer ledger row and all its transactions (CASCADE) */
export function deleteByPhone(phone: string): boolean {
  const result = getDb()
    .prepare("DELETE FROM customer_ledger WHERE customer_phone = ?")
    .run(phone);
  return result.changes > 0;
}

/**
 * Returns the original `full_payment_due` transaction for an order (if one exists).
 * Used to know exactly how much to reverse when an order is deleted.
 */
export function getFullPaymentDueForOrder(orderId: number): { amount: number } | null {
  const row = getDb()
    .prepare(
      "SELECT amount FROM customer_ledger_transactions WHERE order_id = ? AND transaction_type = 'full_payment_due' LIMIT 1"
    )
    .get(orderId) as { amount: number } | undefined;
  return row ?? null;
}

/** Atomic payment received — decrements balance */
export function recordPayment(data: {
  customerPhone: string;
  amountPaid: number;
  orderId?: number | null;
  notes?: string;
}) {
  // Preserve the customer's real name — never overwrite it with the phone number
  const existing = getDb()
    .prepare("SELECT customer_name FROM customer_ledger WHERE customer_phone = ?")
    .get(data.customerPhone) as { customer_name: string } | undefined;

  return upsertWithTransaction({
    customerPhone: data.customerPhone,
    customerName: existing?.customer_name ?? data.customerPhone,
    balanceDelta: -data.amountPaid,
    transaction: {
      orderId: data.orderId,
      transactionType: "payment_received",
      amount: data.amountPaid,
      notes: data.notes,
    },
  });
}
