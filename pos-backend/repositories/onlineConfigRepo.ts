import { DeliveryArea } from "../models";
import * as SettingsRepo from "./settingsRepo";

// ── Delivery Areas ────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToArea(doc: any) {
  return {
    _id: String(doc._id),
    name: doc.name as string,
    isActive: Boolean(doc.isActive),
    deliveryFee: Number(doc.deliveryFee ?? 0),
    minOrderAmount: Number(doc.minOrderAmount ?? 0),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export async function getAllAreas() {
  const docs = await DeliveryArea.find().sort({ name: 1 }).lean();
  return docs.map(rowToArea);
}

export async function getActiveAreas() {
  const docs = await DeliveryArea.find({ isActive: true }).sort({ name: 1 }).lean();
  return docs.map(rowToArea);
}

export async function addArea(name: string, deliveryFee = 0, minOrderAmount = 0) {
  const doc = await DeliveryArea.create({ name: name.trim(), deliveryFee, minOrderAmount });
  return rowToArea(doc.toJSON());
}

export async function updateArea(id: string, updates: { deliveryFee?: number; minOrderAmount?: number }) {
  const patch: Record<string, unknown> = {};
  if (updates.deliveryFee !== undefined) patch.deliveryFee = updates.deliveryFee;
  if (updates.minOrderAmount !== undefined) patch.minOrderAmount = updates.minOrderAmount;
  if (!Object.keys(patch).length) return null;
  const doc = await DeliveryArea.findByIdAndUpdate(id, { $set: patch }, { new: true }).lean();
  return doc ? rowToArea(doc) : null;
}

export async function deleteArea(id: string): Promise<boolean> {
  const result = await DeliveryArea.findByIdAndDelete(id);
  return result !== null;
}

export async function toggleArea(id: string, isActive: boolean) {
  const doc = await DeliveryArea.findByIdAndUpdate(id, { $set: { isActive } }, { new: true }).lean();
  return doc ? rowToArea(doc) : null;
}

// ── Config Flags ──────────────────────────────────────────────────────────────

export interface OnlineConfigFlags {
  isOnline: boolean;
  deliveryEnabled: boolean;
  availableTimeStart: string;
  availableTimeEnd: string;
}

export async function getFlags(): Promise<OnlineConfigFlags> {
  const [isOnline, deliveryEnabled, availableTimeStart, availableTimeEnd] = await Promise.all([
    SettingsRepo.isOnlineOrdersEnabled(),
    SettingsRepo.getSetting("delivery_enabled").then(v => v !== "false"),
    SettingsRepo.getSetting("available_time_start").then(v => v ?? "09:00"),
    SettingsRepo.getSetting("available_time_end").then(v => v ?? "22:00"),
  ]);
  return { isOnline, deliveryEnabled, availableTimeStart, availableTimeEnd };
}

export async function setFlags(updates: Partial<OnlineConfigFlags>): Promise<OnlineConfigFlags> {
  const tasks: Promise<unknown>[] = [];
  if (updates.isOnline !== undefined)
    tasks.push(SettingsRepo.setSetting("online_orders", String(updates.isOnline)));
  if (updates.deliveryEnabled !== undefined)
    tasks.push(SettingsRepo.setSetting("delivery_enabled", String(updates.deliveryEnabled)));
  if (updates.availableTimeStart !== undefined)
    tasks.push(SettingsRepo.setSetting("available_time_start", updates.availableTimeStart));
  if (updates.availableTimeEnd !== undefined)
    tasks.push(SettingsRepo.setSetting("available_time_end", updates.availableTimeEnd));
  await Promise.all(tasks);
  return getFlags();
}
