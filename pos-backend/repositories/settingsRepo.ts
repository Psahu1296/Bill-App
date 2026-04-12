import { StoreSetting } from "../models";

export async function getSetting(key: string): Promise<string | null> {
  const doc = await StoreSetting.findOne({ key }).lean();
  return doc ? (doc as Record<string, unknown>).value as string : null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await StoreSetting.findOneAndUpdate(
    { key },
    { $set: { value } },
    { upsert: true, new: true }
  );
}

export async function isOnlineOrdersEnabled(): Promise<boolean> {
  const val = await getSetting("online_orders");
  return val !== "false";
}
