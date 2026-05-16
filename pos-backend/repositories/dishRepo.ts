import mongoose from "mongoose";
import { Dish } from "../models";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toApi(doc: any) {
  if (!doc) return null;
  return {
    _id: String(doc._id),
    image: doc.image ?? "",
    name: doc.name,
    type: doc.type,
    category: doc.category,
    variants: doc.variants,
    description: doc.description ?? "",
    descriptionHi: doc.descriptionHi ?? "",
    isAvailable: Boolean(doc.isAvailable),
    isFrequent: Boolean(doc.isFrequent),
    isOnlineAvailable: Boolean(doc.isOnlineAvailable),
    numberOfOrders: doc.numberOfOrders ?? 0,
    excludeFromPopular: Boolean(doc.excludeFromPopular),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export async function findById(id: string) {
  try {
    if (!mongoose.isValidObjectId(id)) return null;
    const doc = await Dish.findById(id).lean();
    return toApi(doc);
  } catch { return null; }
}

export async function findByName(name: string) {
  const doc = await Dish.findOne({ name }).lean();
  return toApi(doc);
}

export async function findAll() {
  const docs = await Dish.find().sort({ name: 1 }).lean();
  return docs.map(toApi);
}

export async function findOnlineAvailable() {
  const docs = await Dish.find({ isOnlineAvailable: true, isAvailable: true }).sort({ name: 1 }).lean();
  return docs.map(toApi);
}

export async function findFrequent(minOrders = 1, limit = 10) {
  const docs = await Dish.find({ excludeFromPopular: { $ne: true }, numberOfOrders: { $gte: minOrders } })
    .sort({ numberOfOrders: -1 })
    .limit(limit)
    .lean();
  return docs.map(toApi);
}

export async function create(data: {
  image?: string; name: string; type: string; category: string;
  variants: object[]; description?: string; descriptionHi?: string;
  isAvailable?: boolean; isFrequent?: boolean; isOnlineAvailable?: boolean; excludeFromPopular?: boolean;
}) {
  const doc = await Dish.create({
    ...data,
    image: data.image ?? "",
    description: data.description ?? "",
    descriptionHi: data.descriptionHi ?? "",
    isAvailable: data.isAvailable !== false,
    isFrequent: Boolean(data.isFrequent),
    isOnlineAvailable: Boolean(data.isOnlineAvailable),
  });
  return toApi(doc.toObject())!;
}

export async function bulkCreate(dishes: Parameters<typeof create>[0][]) {
  const docs = await Dish.insertMany(
    dishes.map(d => ({
      ...d,
      image: d.image ?? "",
      description: d.description ?? "",
      descriptionHi: (d as { descriptionHi?: string }).descriptionHi ?? "",
      isAvailable: d.isAvailable !== false,
      isFrequent: Boolean(d.isFrequent),
      isOnlineAvailable: Boolean((d as { isOnlineAvailable?: boolean }).isOnlineAvailable),
    })),
    { ordered: false } // continue past duplicates
  );
  return docs.map(d => toApi(d.toObject())!);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function update(id: string, updates: Record<string, any>) {
  if (!mongoose.isValidObjectId(id)) return null;
  const patch: Record<string, unknown> = {};
  const allowed = ["image", "name", "type", "category", "variants", "description", "descriptionHi",
                   "isAvailable", "isFrequent", "isOnlineAvailable", "numberOfOrders", "excludeFromPopular"];
  for (const key of allowed) {
    if (key in updates) patch[key] = updates[key];
  }
  if (!Object.keys(patch).length) return findById(id);
  const doc = await Dish.findByIdAndUpdate(id, { $set: patch }, { new: true }).lean();
  return toApi(doc);
}

export async function remove(id: string) {
  if (!mongoose.isValidObjectId(id)) return null;
  const doc = await Dish.findByIdAndDelete(id).lean();
  return toApi(doc);
}

export async function incrementOrderCounts(items: { id: string; quantity: number }[]) {
  await Promise.all(
    items
      .filter(item => mongoose.isValidObjectId(item.id))
      .map(item =>
        Dish.findByIdAndUpdate(item.id, { $inc: { numberOfOrders: item.quantity } })
      )
  );
}
