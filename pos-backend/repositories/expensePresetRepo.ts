import mongoose from "mongoose";
import { ExpensePreset } from "../models";

const DEFAULT_PRESETS = [
  { name: "Fish",       category: "Raw Material", type: "food_raw_material", order: 1 },
  { name: "Chicken",    category: "Raw Material", type: "food_raw_material", order: 2 },
  { name: "Egg",        category: "Raw Material", type: "food_raw_material", order: 3 },
  { name: "Rice",       category: "Raw Material", type: "food_raw_material", order: 4 },
  { name: "Vegetables", category: "Raw Material", type: "food_raw_material", order: 5 },
  { name: "Aata",       category: "Raw Material", type: "food_raw_material", order: 6 },
  { name: "Gutka & Cigg", category: "Other",    type: "other",              order: 7 },
  { name: "Staff Payment", category: "Staff",   type: "labor_salary", isStaffLinked: true, order: 8 },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toApi(doc: any) {
  if (!doc) return null;
  return {
    _id:           String(doc._id),
    name:          doc.name,
    category:      doc.category,
    type:          doc.type,
    lastPrice:     doc.lastPrice ?? 0,
    priceHistory:  (doc.priceHistory ?? []) as { amount: number; date: string }[],
    isStaffLinked: doc.isStaffLinked ?? false,
    order:         doc.order ?? 0,
    isActive:      doc.isActive ?? true,
    createdAt:     doc.createdAt,
    updatedAt:     doc.updatedAt,
  };
}

export async function seedDefaults() {
  const count = await ExpensePreset.countDocuments();
  if (count > 0) return;
  await ExpensePreset.insertMany(DEFAULT_PRESETS);
  console.log("[ExpensePreset] Seeded default presets.");
}

export async function findAll() {
  const docs = await ExpensePreset.find({ isActive: true }).sort({ order: 1, name: 1 }).lean();
  return docs.map(toApi);
}

export async function create(data: {
  name: string; category: string; type: string;
  lastPrice?: number; isStaffLinked?: boolean;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const maxDoc = await ExpensePreset.findOne().sort({ order: -1 }).lean() as any;
  const nextOrder = maxDoc ? maxDoc.order + 1 : 1;
  const doc = await ExpensePreset.create({ ...data, order: nextOrder });
  return toApi(doc.toObject())!;
}

export async function update(id: string, updates: Record<string, unknown>) {
  if (!mongoose.isValidObjectId(id)) return null;
  const allowed = ["name", "category", "type", "lastPrice", "isStaffLinked", "order", "isActive"];
  const patch: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in updates) patch[key] = updates[key];
  }
  if (!Object.keys(patch).length) return null;
  const doc = await ExpensePreset.findByIdAndUpdate(id, { $set: patch }, { new: true }).lean();
  return toApi(doc);
}

export async function remove(id: string) {
  if (!mongoose.isValidObjectId(id)) return null;
  // Soft-delete so price history is preserved
  const doc = await ExpensePreset.findByIdAndUpdate(id, { $set: { isActive: false } }, { new: true }).lean();
  return toApi(doc);
}

export async function updatePriceHistory(id: string, amount: number) {
  if (!mongoose.isValidObjectId(id)) return null;
  const doc = await ExpensePreset.findByIdAndUpdate(
    id,
    {
      $set:  { lastPrice: amount },
      $push: { priceHistory: { $each: [{ amount, date: new Date() }], $slice: -10 } },
    },
    { new: true }
  ).lean();
  return toApi(doc);
}
