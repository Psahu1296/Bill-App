import mongoose from "mongoose";
import { DishRequest } from "../models";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toApi(doc: any): Record<string, unknown> | null {
  if (!doc) return null;
  return {
    _id:           String(doc._id),
    customerName:  doc.customerName,
    customerPhone: doc.customerPhone,
    dishName:      doc.dishName,
    description:   doc.description ?? "",
    status:        doc.status,
    adminNote:     doc.adminNote ?? "",
    createdAt:     doc.createdAt,
    updatedAt:     doc.updatedAt,
  };
}

export async function create(data: {
  customerName: string;
  customerPhone: string;
  dishName: string;
  description?: string;
}) {
  const doc = await DishRequest.create({
    customerName:  data.customerName,
    customerPhone: data.customerPhone,
    dishName:      data.dishName,
    description:   data.description ?? "",
  });
  return toApi(doc.toObject())!;
}

export async function findAll(filters: {
  status?: string;
  startDate?: Date;
  endDate?: Date;
} = {}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query: Record<string, any> = {};
  if (filters.status) query.status = filters.status;
  if (filters.startDate || filters.endDate) {
    query.createdAt = {};
    if (filters.startDate) query.createdAt.$gte = filters.startDate;
    if (filters.endDate)   query.createdAt.$lte = filters.endDate;
  }

  const docs = await DishRequest.find(query).sort({ createdAt: -1 }).lean();
  return docs.map(toApi);
}

export async function findById(id: string) {
  if (!mongoose.isValidObjectId(id)) return null;
  const doc = await DishRequest.findById(id).lean();
  return toApi(doc);
}

const ALLOWED_PATCH_KEYS = ["status", "adminNote"] as const;

export async function update(
  id: string,
  patch: { status?: string; adminNote?: string }
) {
  if (!mongoose.isValidObjectId(id)) return null;
  const set: Record<string, unknown> = {};
  for (const key of ALLOWED_PATCH_KEYS) {
    if (key in patch) set[key] = patch[key];
  }
  if (!Object.keys(set).length) return null;
  const doc = await DishRequest.findByIdAndUpdate(
    id,
    { $set: set },
    { new: true }
  ).lean();
  return toApi(doc);
}

export async function remove(id: string) {
  if (!mongoose.isValidObjectId(id)) return null;
  const doc = await DishRequest.findByIdAndDelete(id).lean();
  return toApi(doc);
}
