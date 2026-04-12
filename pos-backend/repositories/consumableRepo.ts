import mongoose from "mongoose";
import { Consumable } from "../models";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toApi(doc: any, populateOrder = false): Record<string, unknown> | null {
  if (!doc) return null;
  const result: Record<string, unknown> = {
    _id: String(doc._id),
    type: doc.type,
    quantity: doc.quantity,
    pricePerUnit: doc.pricePerUnit,
    consumerType: doc.consumerType,
    consumerName: doc.consumerName,
    timestamp: doc.timestamp,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };

  const o = doc.orderId;
  if (populateOrder && o && typeof o === "object" && o.customerDetails) {
    result.orderId = {
      _id: String(o._id),
      customerDetails: o.customerDetails,
      orderDate: o.orderDate,
    };
  } else {
    result.orderId = o != null ? String(o._id ?? o) : null;
  }

  return result;
}

export async function create(data: {
  type: string; quantity: number; pricePerUnit: number;
  consumerType: string; consumerName: string;
  orderId?: string | null; timestamp?: string;
}) {
  const doc = await Consumable.create({
    ...data,
    orderId: data.orderId ?? null,
    timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
  });
  return toApi(doc.toObject())!;
}

export async function bulkCreate(entries: Parameters<typeof create>[0][]) {
  if (!entries.length) return;
  await Consumable.insertMany(
    entries.map(e => ({
      ...e,
      orderId: e.orderId ?? null,
      timestamp: e.timestamp ? new Date(e.timestamp) : new Date(),
    }))
  );
}

export async function findAll(filters: {
  type?: string; consumerType?: string;
  startDate?: Date; endDate?: Date;
} = {}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query: Record<string, any> = {};
  if (filters.type) query.type = filters.type;
  if (filters.consumerType) query.consumerType = filters.consumerType;
  if (filters.startDate || filters.endDate) {
    query.timestamp = {};
    if (filters.startDate) query.timestamp.$gte = filters.startDate;
    if (filters.endDate) query.timestamp.$lte = filters.endDate;
  }

  const docs = await Consumable.find(query)
    .sort({ timestamp: -1 })
    .populate({ path: "orderId", select: "customerDetails orderDate" })
    .lean();
  return docs.map(d => toApi(d, true));
}

export async function dailySummary(startDate: Date, endDate: Date) {
  return Consumable.aggregate([
    { $match: { timestamp: { $gte: startDate, $lte: endDate } } },
    {
      $group: {
        _id: { type: "$type", consumerType: "$consumerType" },
        totalQty:     { $sum: "$quantity" },
        totalRevenue: { $sum: { $multiply: ["$quantity", "$pricePerUnit"] } },
      },
    },
    {
      $project: {
        _id: 0,
        type:         "$_id.type",
        consumerType: "$_id.consumerType",
        totalQty:     1,
        totalRevenue: 1,
      },
    },
  ]) as Promise<{ type: string; consumerType: string; totalQty: number; totalRevenue: number }[]>;
}

export async function update(id: string, updates: Record<string, unknown>) {
  if (!mongoose.isValidObjectId(id)) return null;
  const allowed = ["type", "quantity", "pricePerUnit", "consumerType", "consumerName", "orderId", "timestamp"];
  const patch: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in updates) patch[key] = updates[key];
  }
  if (!Object.keys(patch).length) return null;
  const doc = await Consumable.findByIdAndUpdate(id, { $set: patch }, { new: true }).lean();
  return toApi(doc);
}

export async function remove(id: string) {
  if (!mongoose.isValidObjectId(id)) return null;
  const doc = await Consumable.findByIdAndDelete(id).lean();
  return toApi(doc);
}

export async function removeByOrderId(orderId: string) {
  if (!mongoose.isValidObjectId(orderId)) return;
  await Consumable.deleteMany({ orderId });
}
