import mongoose from "mongoose";
import { CustomerLedger } from "../models";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ledgerToApi(doc: any) {
  if (!doc) return null;
  return {
    _id: String(doc._id),
    customerName: doc.customerName,
    customerPhone: doc.customerPhone,
    balanceDue: doc.balanceDue,
    lastActivity: doc.lastActivity,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    transactions: (doc.transactions ?? []).map((tx: any) => ({
      _id: String(tx._id),
      orderId: tx.orderId != null ? String(tx.orderId) : null,
      transactionType: tx.transactionType,
      amount: tx.amount,
      timestamp: tx.timestamp,
      notes: tx.notes ?? "",
    })).sort((a: Record<string, unknown>, b: Record<string, unknown>) =>
      new Date(b.timestamp as string).getTime() - new Date(a.timestamp as string).getTime()
    ),
  };
}

export async function findByPhone(phone: string) {
  const doc = await CustomerLedger.findOne({ customerPhone: phone }).lean();
  return ledgerToApi(doc);
}

export async function findAll(filters: {
  name?: string; phone?: string; status?: string;
  startDate?: string; endDate?: string;
} = {}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query: Record<string, any> = {};
  if (filters.name) query.customerName = { $regex: filters.name, $options: "i" };
  if (filters.phone) query.customerPhone = filters.phone;
  if (filters.status === "unpaid") query.balanceDue = { $gt: 0 };
  else if (filters.status === "paid") query.balanceDue = { $lte: 0 };
  if (filters.startDate || filters.endDate) {
    const txMatch: Record<string, unknown> = {};
    if (filters.startDate) txMatch.$gte = new Date(filters.startDate);
    if (filters.endDate)   txMatch.$lte = new Date(filters.endDate);
    query["transactions.timestamp"] = txMatch;
  }

  const docs = await CustomerLedger.find(query).sort({ lastActivity: -1 }).lean();
  return docs.map(ledgerToApi);
}

export async function upsertWithTransaction(data: {
  customerPhone: string;
  customerName: string;
  balanceDelta: number;
  transaction: {
    orderId?: string | null;
    transactionType: string;
    amount: number;
    notes?: string;
    timestamp?: string;
  };
}) {
  const tx = {
    orderId: data.transaction.orderId
      ? new mongoose.Types.ObjectId(data.transaction.orderId)
      : null,
    transactionType: data.transaction.transactionType,
    amount: data.transaction.amount,
    timestamp: data.transaction.timestamp ? new Date(data.transaction.timestamp) : new Date(),
    notes: data.transaction.notes ?? "",
  };

  await CustomerLedger.findOneAndUpdate(
    { customerPhone: data.customerPhone },
    {
      $set:  { customerName: data.customerName, lastActivity: new Date() },
      $inc:  { balanceDue: data.balanceDelta },
      $push: { transactions: tx },
    },
    { upsert: true, new: true }
  );

  return findByPhone(data.customerPhone)!;
}

export async function createCustomer(data: { phone: string; name: string }) {
  await CustomerLedger.create({
    customerPhone: data.phone,
    customerName: data.name,
    balanceDue: 0,
    lastActivity: new Date(),
    transactions: [],
  });
  return findByPhone(data.phone)!;
}

export async function updateCustomer(phone: string, data: { name?: string; newPhone?: string }) {
  const patch: Record<string, unknown> = {};
  if (data.name) patch.customerName = data.name;
  if (data.newPhone && data.newPhone !== phone) patch.customerPhone = data.newPhone;
  if (Object.keys(patch).length) {
    await CustomerLedger.findOneAndUpdate({ customerPhone: phone }, { $set: patch });
  }
  return findByPhone(data.newPhone ?? phone);
}

export async function deleteByPhone(phone: string): Promise<boolean> {
  const result = await CustomerLedger.findOneAndDelete({ customerPhone: phone });
  return result !== null;
}

// Transaction types that ADD to the customer's balance (they owe more)
const BALANCE_INCREASE_TYPES = new Set(["full_payment_due", "balance_increased", "opening_balance"]);

/**
 * Finds all transactions linked to orderId in the given phone's ledger,
 * computes the net balance contribution, and writes a single corrective
 * transaction to bring the net to zero. Used before re-attributing an order.
 */
export async function reverseOrderTransactions(orderId: string, phone: string, name: string) {
  const doc = await CustomerLedger.findOne({ customerPhone: phone }).lean() as Record<string, unknown> | null;
  if (!doc) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const txs = ((doc.transactions as any[]) ?? []).filter((t: any) =>
    t.orderId && String(t.orderId) === orderId
  );
  if (txs.length === 0) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const net = txs.reduce((sum: number, tx: any) => {
    return sum + (BALANCE_INCREASE_TYPES.has(tx.transactionType) ? tx.amount : -tx.amount);
  }, 0);

  if (Math.abs(net) < 0.01) return; // already balanced

  await upsertWithTransaction({
    customerPhone: phone,
    customerName: name,
    balanceDelta: -net,
    transaction: {
      orderId,
      transactionType: net > 0 ? "balance_decreased" : "balance_increased",
      amount: Math.abs(net),
      notes: `Order #${orderId.slice(-6)} — reversed (reassigned to another customer)`,
    },
  });
}

export async function mergeLedgers(sourcePhone: string, targetPhone: string) {
  const source = await CustomerLedger.findOne({ customerPhone: sourcePhone }).lean() as Record<string, unknown> | null;
  if (!source) throw new Error(`Source ledger (${sourcePhone}) not found`);

  // Append all source transactions to target and add its balanceDue
  await CustomerLedger.findOneAndUpdate(
    { customerPhone: targetPhone },
    {
      $inc:  { balanceDue: source.balanceDue as number },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      $push: { transactions: { $each: source.transactions as any[] } },
      $set:  { lastActivity: new Date() },
    }
  );

  await CustomerLedger.findOneAndDelete({ customerPhone: sourcePhone });
  return findByPhone(targetPhone);
}

export async function getFullPaymentDueForOrder(orderId: string): Promise<{ amount: number } | null> {
  if (!mongoose.isValidObjectId(orderId)) return null;
  const doc = await CustomerLedger.findOne({
    "transactions.orderId": new mongoose.Types.ObjectId(orderId),
    "transactions.transactionType": "full_payment_due",
  }).lean();
  if (!doc) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tx = (doc as any).transactions.find(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (t: any) => String(t.orderId) === orderId && t.transactionType === "full_payment_due"
  );
  return tx ? { amount: tx.amount } : null;
}

export async function recordPayment(data: {
  customerPhone: string;
  amountPaid: number;
  orderId?: string | null;
  notes?: string;
}) {
  const existing = await CustomerLedger.findOne(
    { customerPhone: data.customerPhone },
    { customerName: 1 }
  ).lean() as Record<string, unknown> | null;

  return upsertWithTransaction({
    customerPhone: data.customerPhone,
    customerName: (existing?.customerName as string) ?? data.customerPhone,
    balanceDelta: -data.amountPaid,
    transaction: {
      orderId: data.orderId,
      transactionType: "payment_received",
      amount: data.amountPaid,
      notes: data.notes,
    },
  });
}
