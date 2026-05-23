import mongoose from "mongoose";
import { Order } from "../models";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toApi(doc: any, populate = false): Record<string, unknown> | null {
  if (!doc) return null;

  const bills = doc.bills ?? {};
  // Backfill totalWithTax for orders saved by older builds
  if (bills.totalWithTax == null && bills.total != null) bills.totalWithTax = bills.total;

  const result: Record<string, unknown> = {
    _id: String(doc._id),
    customerDetails: doc.customerDetails ?? {},
    orderStatus: doc.orderStatus,
    orderDate: doc.orderDate,
    bills,
    items: doc.items ?? [],
    paymentMethod: doc.paymentMethod ?? null,
    paymentData: doc.paymentData ?? {},
    paymentStatus: doc.paymentStatus,
    amountPaid: doc.amountPaid,
    balanceDueOnOrder: doc.balanceDueOnOrder,
    orderType: doc.orderType ?? "dine-in",
    deliveryAddress: doc.deliveryAddress ?? "",
    idempotencyKey: doc.idempotencyKey ?? null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };

  const t = doc.table;
  if (!t) {
    result.table = null;
  } else if (populate && t && typeof t === "object" && t.tableNo !== undefined) {
    result.table = {
      _id: String(t._id),
      tableNo: t.tableNo,
      status: t.status,
      seats: t.seats,
      currentOrder: t.currentOrderId != null ? String(t.currentOrderId) : null,
    };
  } else {
    result.table = String(t._id ?? t);
  }

  return result;
}

export interface OrderFilters {
  startDate?: string;
  endDate?: string;
  tableId?: string;
  customerPhone?: string;
  orderStatus?: string;
  paymentStatus?: string;
  excludeStatus?: string;
  search?: string;
}

export async function findById(id: string, populate = false) {
  try {
    if (!mongoose.isValidObjectId(id)) return null;
    let q = Order.findById(id);
    if (populate) q = q.populate({ path: "table", select: "tableNo status seats currentOrderId" });
    const doc = await q.lean();
    return toApi(doc, populate);
  } catch { return null; }
}

export async function findAll(filters: OrderFilters = {}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query: Record<string, any> = {};

  if (filters.startDate || filters.endDate) {
    query.orderDate = {};
    if (filters.startDate) query.orderDate.$gte = new Date(filters.startDate);
    if (filters.endDate) {
      const end = new Date(filters.endDate);
      // Only apply UTC end-of-day fallback for bare date strings (no time component).
      // ISO strings with a time component (e.g. from ?date= IST-aware computation) are used as-is.
      if (!filters.endDate.includes("T")) end.setUTCHours(23, 59, 59, 999);
      query.orderDate.$lte = end;
    }
  }
  if (filters.tableId && mongoose.isValidObjectId(filters.tableId)) {
    query.table = filters.tableId;
  }
  if (filters.customerPhone) {
    query["customerDetails.phone"] = filters.customerPhone;
  }
  if (filters.search) {
    const s = filters.search.trim();
    const orClauses: Record<string, unknown>[] = [
      { "customerDetails.name": { $regex: s, $options: "i" } },
      { "customerDetails.phone": { $regex: s, $options: "i" } },
    ];
    if (/^[0-9a-fA-F]{24}$/.test(s)) {
      orClauses.push({ _id: new mongoose.Types.ObjectId(s) });
    }
    query.$or = orClauses;
  } else {
    if (filters.orderStatus) query.orderStatus = filters.orderStatus;
    if (filters.paymentStatus) query.paymentStatus = filters.paymentStatus;
    if (filters.excludeStatus) query.orderStatus = { $ne: filters.excludeStatus };
  }

  const docs = await Order.find(query)
    .sort({ orderDate: -1 })
    .populate({ path: "table", select: "tableNo status seats currentOrderId" })
    .lean();
  return docs.map(d => toApi(d, true));
}

export async function create(data: {
  customerDetails: object;
  orderStatus: string;
  orderDate?: string | Date;
  bills: object;
  items?: object[];
  tableId?: string | null;
  paymentMethod?: string;
  paymentData?: object;
  paymentStatus?: string;
  amountPaid?: number;
  balanceDueOnOrder?: number;
  orderType?: string;
  deliveryAddress?: string;
  idempotencyKey?: string;
}) {
  // Idempotency check
  if (data.idempotencyKey) {
    const existing = await Order.findOne({ idempotencyKey: data.idempotencyKey })
      .populate({ path: "table", select: "tableNo status seats currentOrderId" })
      .lean();
    if (existing) return toApi(existing, true)!;
  }

  const doc = await Order.create({
    customerDetails: data.customerDetails,
    orderStatus: data.orderStatus,
    orderDate: data.orderDate ? new Date(data.orderDate as string) : new Date(),
    bills: data.bills,
    items: data.items ?? [],
    table: data.tableId ?? null,
    paymentMethod: data.paymentMethod ?? null,
    paymentData: data.paymentData ?? {},
    paymentStatus: data.paymentStatus ?? "Pending",
    amountPaid: data.amountPaid ?? 0,
    balanceDueOnOrder: data.balanceDueOnOrder ?? 0,
    orderType: data.orderType ?? "dine-in",
    deliveryAddress: data.deliveryAddress ?? "",
    idempotencyKey: data.idempotencyKey ?? null,
  });

  return findById(String(doc._id), true)!;
}

export async function appendItems(id: string, newItems: object[], updatedBills: object) {
  const order = await findById(id, false);
  if (!order) return null;

  const existing = (order.items as Array<Record<string, unknown>>) ?? [];
  const maxBatch = existing.reduce((max, item) => Math.max(max, Number(item.batch) || 1), 1);
  const nextBatch = maxBatch + 1;

  const normalised = existing.map(item => ({ ...item, batch: item.batch ?? 1 }));
  const withBatch  = newItems.map(item => ({ ...(item as object), batch: nextBatch }));

  const existingBills = (order.bills as Record<string, number>) ?? {};
  const newBills = updatedBills as Record<string, number>;
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
export async function update(id: string, updates: Record<string, any>) {
  if (!mongoose.isValidObjectId(id)) return null;
  const patch: Record<string, unknown> = {};
  const allowed: Record<string, string> = {
    customerDetails: "customerDetails",
    orderStatus: "orderStatus",
    orderDate: "orderDate",
    bills: "bills",
    items: "items",
    tableId: "table",
    paymentMethod: "paymentMethod",
    paymentData: "paymentData",
    paymentStatus: "paymentStatus",
    amountPaid: "amountPaid",
    balanceDueOnOrder: "balanceDueOnOrder",
    orderType: "orderType",
    deliveryAddress: "deliveryAddress",
  };
  for (const [js, mongo] of Object.entries(allowed)) {
    if (js in updates) {
      patch[mongo] = js === "orderDate" && updates[js]
        ? new Date(updates[js] as string)
        : updates[js];
    }
  }
  if (!Object.keys(patch).length) return findById(id, true);
  const doc = await Order.findByIdAndUpdate(id, { $set: patch }, { new: true })
    .populate({ path: "table", select: "tableNo status seats currentOrderId" })
    .lean();
  return toApi(doc, true);
}

export async function remove(id: string): Promise<boolean> {
  if (!mongoose.isValidObjectId(id)) return false;
  const result = await Order.findByIdAndDelete(id);
  return result !== null;
}
