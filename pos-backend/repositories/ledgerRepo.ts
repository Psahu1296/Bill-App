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

export function findAll(filters: { name?: string; phone?: string; status?: string } = {}) {
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

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const rows = getDb()
    .prepare(`SELECT * FROM customer_ledger ${where} ORDER BY last_activity DESC`)
    .all(...params);
  return rows.map(r => withTransactions(ledgerRowToApi(r)));
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

/** Atomic payment received — decrements balance */
export function recordPayment(data: {
  customerPhone: string;
  amountPaid: number;
  orderId?: number | null;
  notes?: string;
}) {
  return upsertWithTransaction({
    customerPhone: data.customerPhone,
    customerName: data.customerPhone, // name doesn't change on payment
    balanceDelta: -data.amountPaid,
    transaction: {
      orderId: data.orderId,
      transactionType: "payment_received",
      amount: data.amountPaid,
      notes: data.notes,
    },
  });
}
