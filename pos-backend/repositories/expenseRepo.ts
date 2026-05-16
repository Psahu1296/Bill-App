import mongoose from "mongoose";
import { Expense } from "../models";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toApi(doc: any) {
  if (!doc) return null;
  return {
    _id: String(doc._id),
    type: doc.type,
    name: doc.name,
    amount: doc.amount,
    quantity: doc.quantity ?? null,
    unit: doc.unit ?? "",
    description: doc.description ?? "",
    expenseDate: doc.expenseDate,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export async function create(data: {
  type: string; name: string; amount: number;
  quantity?: number | null; unit?: string;
  description?: string; expenseDate?: string;
}) {
  const doc = await Expense.create({
    type: data.type,
    name: data.name,
    amount: data.amount,
    quantity: data.quantity ?? null,
    unit: data.unit ?? "",
    description: data.description ?? "",
    expenseDate: data.expenseDate ? new Date(data.expenseDate) : new Date(),
  });
  return toApi(doc.toObject())!;
}

export async function findAll(filters: { startDate?: Date; endDate?: Date; type?: string } = {}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query: Record<string, any> = {};
  if (filters.type) query.type = filters.type;
  if (filters.startDate || filters.endDate) {
    query.expenseDate = {};
    if (filters.startDate) query.expenseDate.$gte = filters.startDate;
    if (filters.endDate) query.expenseDate.$lte = filters.endDate;
  }
  const docs = await Expense.find(query).sort({ expenseDate: -1 }).lean();
  return docs.map(toApi);
}

export async function aggregateByType(startDate: Date, endDate: Date) {
  return Expense.aggregate([
    { $match: { expenseDate: { $gte: startDate, $lte: endDate } } },
    { $group: { _id: "$type", totalAmount: { $sum: "$amount" } } },
    { $project: { _id: 0, type: "$_id", totalAmount: 1 } },
  ]) as Promise<{ type: string; totalAmount: number }[]>;
}

export async function update(id: string, updates: Record<string, unknown>) {
  if (!mongoose.isValidObjectId(id)) return null;
  const allowed = ["type", "name", "amount", "quantity", "unit", "description", "expenseDate"];
  const patch: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in updates) {
      patch[key] = key === "expenseDate" && updates[key]
        ? new Date(updates[key] as string)
        : updates[key];
    }
  }
  if (!Object.keys(patch).length) return null;
  const doc = await Expense.findByIdAndUpdate(id, { $set: patch }, { new: true }).lean();
  return toApi(doc);
}

export async function remove(id: string) {
  if (!mongoose.isValidObjectId(id)) return null;
  const doc = await Expense.findByIdAndDelete(id).lean();
  return toApi(doc);
}
