import mongoose from "mongoose";
import { Table } from "../models";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toApi(doc: any, populateOrder = false): Record<string, unknown> | null {
  if (!doc) return null;
  const base: Record<string, unknown> = {
    _id: String(doc._id),
    tableNo: doc.tableNo,
    status: doc.status,
    seats: doc.seats,
    isVirtual: Boolean(doc.isVirtual),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    currentOrder: null,
  };

  const co = doc.currentOrderId;
  if (!co) {
    base.currentOrder = null;
  } else if (populateOrder && co && typeof co === "object" && co.customerDetails) {
    // populated
    base.currentOrder = {
      _id: String(co._id),
      customerDetails: co.customerDetails,
    };
  } else {
    base.currentOrder = String(co._id ?? co);
  }

  return base;
}

export async function findByTableNo(tableNo: number) {
  const doc = await Table.findOne({ tableNo }).lean();
  return toApi(doc);
}

export async function findById(id: string) {
  try {
    if (!mongoose.isValidObjectId(id)) return null;
    const doc = await Table.findById(id).lean();
    return toApi(doc);
  } catch { return null; }
}

export async function findAll() {
  const docs = await Table.find()
    .sort({ tableNo: 1 })
    .populate({ path: "currentOrderId", select: "customerDetails" })
    .lean();
  return docs.map(d => toApi(d, true));
}

export async function create(data: { tableNo: number; seats: number }) {
  const doc = await Table.create(data);
  return toApi(doc.toObject())!;
}

export async function update(id: string, data: { status?: string; currentOrderId?: string | null }) {
  if (!mongoose.isValidObjectId(id)) return null;
  const patch: Record<string, unknown> = {};
  if (data.status !== undefined) patch.status = data.status;
  patch.currentOrderId = data.currentOrderId ?? null;
  const doc = await Table.findByIdAndUpdate(id, { $set: patch }, { new: true }).lean();
  return toApi(doc);
}

export async function remove(id: string) {
  if (!mongoose.isValidObjectId(id)) return null;
  const doc = await Table.findByIdAndDelete(id).lean();
  return toApi(doc);
}
