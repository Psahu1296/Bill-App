import { getDb } from "../db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToApi(row: any, populateTable = false) {
  if (!row) return null;
  const {
    id, customer_details, order_date, bills, items, table_id,
    payment_data, amount_paid, balance_due_on_order,
    order_status, payment_method, payment_status,
    order_type, delivery_address,
    created_at, updated_at,
    // populated join fields:
    table_no, table_status, table_seats, table_current_order_id,
    ...rest
  } = row;

  const result: Record<string, unknown> = {
    _id: String(id),
    customerDetails: customer_details ? JSON.parse(customer_details) : {},
    orderStatus: order_status,
    orderDate: order_date,
    bills: (() => {
      const b = bills ? JSON.parse(bills) : {};
      // Backfill totalWithTax for orders saved by older customer app builds
      if (b && b.totalWithTax == null && b.total != null) b.totalWithTax = b.total;
      return b;
    })(),
    items: items ? JSON.parse(items) : [],
    paymentMethod: payment_method,
    paymentData: payment_data ? JSON.parse(payment_data) : {},
    paymentStatus: payment_status,
    amountPaid: amount_paid,
    balanceDueOnOrder: balance_due_on_order,
    orderType: order_type ?? 'dine-in',
    deliveryAddress: delivery_address ?? '',
    createdAt: created_at,
    updatedAt: updated_at,
    ...rest,
  };

  if (populateTable && table_id != null) {
    result.table = {
      _id: String(table_id),
      tableNo: table_no,
      status: table_status,
      seats: table_seats,
      currentOrder: table_current_order_id != null ? String(table_current_order_id) : null,
    };
  } else {
    result.table = table_id != null ? String(table_id) : null;
  }

  return result;
}

const POPULATE_JOIN = `
  LEFT JOIN tables_tb t ON t.id = o.table_id
`;
const POPULATE_COLS = `, t.table_no, t.status AS table_status, t.seats AS table_seats, t.current_order_id AS table_current_order_id`;

export function findById(id: string | number, populate = false) {
  const sql = populate
    ? `SELECT o.*${POPULATE_COLS} FROM orders o ${POPULATE_JOIN} WHERE o.id = ?`
    : `SELECT * FROM orders o WHERE o.id = ?`;
  const row = getDb().prepare(sql).get(Number(id));
  return rowToApi(row as Record<string, unknown>, populate);
}

export interface OrderFilters {
  startDate?: string;
  endDate?: string;
  tableId?: string | number;
  customerPhone?: string;
  orderStatus?: string;
  paymentStatus?: string;
}

export function findAll(filters: OrderFilters = {}) {
  const conditions: string[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params: any[] = [];

  if (filters.startDate) {
    conditions.push("o.order_date >= ?");
    params.push(new Date(filters.startDate).toISOString());
  }
  if (filters.endDate) {
    conditions.push("o.order_date <= ?");
    const end = new Date(filters.endDate);
    end.setUTCHours(23, 59, 59, 999);
    params.push(end.toISOString());
  }
  if (filters.tableId) {
    conditions.push("o.table_id = ?");
    params.push(Number(filters.tableId));
  }
  if (filters.customerPhone) {
    // customer_details is JSON — use json_extract for filtering
    conditions.push("json_extract(o.customer_details, '$.phone') = ?");
    params.push(filters.customerPhone);
  }
  if (filters.orderStatus) {
    conditions.push("o.order_status = ?");
    params.push(filters.orderStatus);
  }
  if (filters.paymentStatus) {
    conditions.push("o.payment_status = ?");
    params.push(filters.paymentStatus);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const sql = `SELECT o.*${POPULATE_COLS} FROM orders o ${POPULATE_JOIN} ${where} ORDER BY o.order_date DESC`;
  const rows = getDb().prepare(sql).all(...params);
  return rows.map(r => rowToApi(r as Record<string, unknown>, true));
}

export function create(data: {
  customerDetails: object;
  orderStatus: string;
  orderDate?: string;
  bills: object;
  items: object[];
  tableId?: number | null;
  paymentMethod?: string;
  paymentData?: object;
  paymentStatus?: string;
  amountPaid?: number;
  balanceDueOnOrder?: number;
  orderType?: string;
  deliveryAddress?: string;
}) {
  const db = getDb();
  const result = db.prepare(
    `INSERT INTO orders (
      customer_details, order_status, order_date, bills, items,
      table_id, payment_method, payment_data, payment_status,
      amount_paid, balance_due_on_order, order_type, delivery_address
    ) VALUES (
      @customerDetails, @orderStatus, @orderDate, @bills, @items,
      @tableId, @paymentMethod, @paymentData, @paymentStatus,
      @amountPaid, @balanceDueOnOrder, @orderType, @deliveryAddress
    )`
  ).run({
    customerDetails: JSON.stringify(data.customerDetails),
    orderStatus: data.orderStatus,
    orderDate: data.orderDate ?? new Date().toISOString(),
    bills: JSON.stringify(data.bills),
    items: JSON.stringify(data.items),
    tableId: data.tableId ?? null,
    paymentMethod: data.paymentMethod ?? null,
    paymentData: JSON.stringify(data.paymentData ?? {}),
    paymentStatus: data.paymentStatus ?? 'Pending',
    amountPaid: data.amountPaid ?? 0,
    balanceDueOnOrder: data.balanceDueOnOrder ?? 0,
    orderType: data.orderType ?? 'dine-in',
    deliveryAddress: data.deliveryAddress ?? '',
  });
  return findById(result.lastInsertRowid as number, true)!;
}

/**
 * Appends new items to an existing order as the next batch (round).
 * Existing items without a batch field are normalised to batch 1.
 */
export function appendItems(id: string | number, newItems: object[], updatedBills: object) {
  const order = findById(id, false);
  if (!order) return null;

  const existing = (order.items as Array<Record<string, unknown>>);
  const maxBatch = existing.reduce((max, item) => Math.max(max, Number(item.batch) || 1), 1);
  const nextBatch = maxBatch + 1;

  const normalised = existing.map((item) => ({ ...item, batch: item.batch ?? 1 }));
  const withBatch  = newItems.map((item) => ({ ...(item as object), batch: nextBatch }));

  // Accumulate bills: add new round's amounts on top of the existing totals
  const existingBills = ((order.bills as Record<string, number>) ?? {});
  const newBills = (updatedBills as Record<string, number>);
  const cumulativeBills: Record<string, unknown> = { ...existingBills };
  for (const key of ["total", "totalWithTax", "subtotal", "tax"] as const) {
    if (newBills[key] != null) {
      cumulativeBills[key] = (Number(existingBills[key]) || 0) + Number(newBills[key]);
    }
  }

  const newTotal = Number(cumulativeBills.totalWithTax ?? cumulativeBills.total) || 0;
  const newBalanceDue = Math.max(0, newTotal - (Number(order.amountPaid) || 0));

  return update(id, {
    items: [...normalised, ...withBatch],
    bills: cumulativeBills,
    balanceDueOnOrder: newBalanceDue,
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function update(id: string | number, updates: Record<string, any>) {
  const db = getDb();
  const colMap: Record<string, string> = {
    customerDetails: "customer_details",
    orderStatus: "order_status",
    orderDate: "order_date",
    bills: "bills",
    items: "items",
    tableId: "table_id",
    paymentMethod: "payment_method",
    paymentData: "payment_data",
    paymentStatus: "payment_status",
    amountPaid: "amount_paid",
    balanceDueOnOrder: "balance_due_on_order",
    orderType: "order_type",
    deliveryAddress: "delivery_address",
  };
  const jsonCols = new Set(["customer_details", "bills", "items", "payment_data"]);

  const sets: string[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params: Record<string, any> = { id: Number(id) };

  for (const [jsKey, col] of Object.entries(colMap)) {
    if (jsKey in updates) {
      sets.push(`${col} = @${jsKey}`);
      params[jsKey] = jsonCols.has(col) ? JSON.stringify(updates[jsKey]) : updates[jsKey];
    }
  }

  if (sets.length === 0) return findById(id, true);
  sets.push("updated_at = datetime('now')");
  db.prepare(`UPDATE orders SET ${sets.join(", ")} WHERE id = @id`).run(params);
  return findById(id, true);
}

export function remove(id: string | number): boolean {
  const db = getDb();
  const result = db.prepare("DELETE FROM orders WHERE id = ?").run(Number(id));
  return result.changes > 0;
}
