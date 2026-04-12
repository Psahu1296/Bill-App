import mongoose from "mongoose";
import { Staff } from "../models";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toApi(doc: any) {
  if (!doc) return null;
  return {
    _id: String(doc._id),
    name: doc.name,
    phone: doc.phone,
    role: doc.role,
    monthlySalary: doc.monthlySalary,
    joinDate: doc.joinDate,
    isActive: Boolean(doc.isActive),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    payments: (doc.payments ?? []).map((p: any) => ({
      _id: String(p._id),
      amount: p.amount,
      type: p.type,
      note: p.note ?? p.type,
      date: p.date,
    })).sort((a: Record<string, unknown>, b: Record<string, unknown>) =>
      new Date(b.date as string).getTime() - new Date(a.date as string).getTime()
    ),
  };
}

export async function findById(id: string) {
  try {
    if (!mongoose.isValidObjectId(id)) return null;
    const doc = await Staff.findById(id).lean();
    return toApi(doc);
  } catch { return null; }
}

export async function findAll(filters: { role?: string; isActive?: boolean } = {}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query: Record<string, any> = {};
  if (filters.role !== undefined) query.role = filters.role;
  if (filters.isActive !== undefined) query.isActive = filters.isActive;
  const docs = await Staff.find(query).sort({ createdAt: -1 }).lean();
  return docs.map(toApi);
}

export async function create(data: {
  name: string; phone: string; role: string;
  monthlySalary?: number; joinDate?: string;
}) {
  const doc = await Staff.create({
    name: data.name,
    phone: data.phone,
    role: data.role,
    monthlySalary: data.monthlySalary ?? 0,
    joinDate: data.joinDate ? new Date(data.joinDate) : new Date(),
    isActive: true,
    payments: [],
  });
  return toApi(doc.toObject())!;
}

export async function update(id: string, updates: Record<string, unknown>) {
  if (!mongoose.isValidObjectId(id)) return null;
  const allowed = ["name", "phone", "role", "monthlySalary", "joinDate", "isActive"];
  const patch: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in updates) {
      patch[key] = key === "joinDate" && updates[key]
        ? new Date(updates[key] as string)
        : updates[key];
    }
  }
  if (!Object.keys(patch).length) return findById(id);
  const doc = await Staff.findByIdAndUpdate(id, { $set: patch }, { new: true }).lean();
  return toApi(doc);
}

export async function remove(id: string) {
  if (!mongoose.isValidObjectId(id)) return null;
  const doc = await Staff.findByIdAndDelete(id).lean();
  return toApi(doc);
}

export async function toggleActive(id: string) {
  if (!mongoose.isValidObjectId(id)) return null;
  const current = await Staff.findById(id).select("isActive").lean() as Record<string, unknown> | null;
  if (!current) return null;
  const doc = await Staff.findByIdAndUpdate(
    id,
    { $set: { isActive: !current.isActive } },
    { new: true }
  ).lean();
  return toApi(doc);
}

export async function addPayment(staffId: string, data: {
  amount: number; type: string; note?: string; date?: string;
}) {
  if (!mongoose.isValidObjectId(staffId)) return null;
  const payment = {
    amount: data.amount,
    type: data.type,
    note: data.note ?? data.type,
    date: data.date ? new Date(data.date) : new Date(),
  };
  const doc = await Staff.findByIdAndUpdate(
    staffId,
    { $push: { payments: payment } },
    { new: true }
  ).lean();
  return toApi(doc);
}

export async function deletePayment(staffId: string, paymentId: string) {
  if (!mongoose.isValidObjectId(staffId) || !mongoose.isValidObjectId(paymentId)) return null;
  const doc = await Staff.findByIdAndUpdate(
    staffId,
    { $pull: { payments: { _id: new mongoose.Types.ObjectId(paymentId) } } },
    { new: true }
  ).lean();
  return toApi(doc);
}
