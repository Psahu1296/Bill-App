import { CustomerProfile } from "../models";
import { normalizePhone } from "../utils/normalizePhone";

interface CustomerProfileData {
  phone: string;
  name: string;
  preferredArea: string;
  totalOrders: number;
  lastOrderedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toApi(doc: any): CustomerProfileData | null {
  if (!doc) return null;
  return {
    phone: doc.phone,
    name: doc.name,
    preferredArea: doc.preferredArea ?? "",
    totalOrders: doc.totalOrders ?? 0,
    lastOrderedAt: doc.lastOrderedAt ?? null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export async function getProfile(phone: string): Promise<CustomerProfileData | null> {
  const normalized = normalizePhone(phone);
  const doc = await CustomerProfile.findOne({ phone: normalized }).lean();
  return toApi(doc);
}

export async function upsertProfile(data: {
  phone: string;
  name: string;
  preferred_area?: string;
}): Promise<CustomerProfileData> {
  const normalized = normalizePhone(data.phone);
  const doc = await CustomerProfile.findOneAndUpdate(
    { phone: normalized },
    {
      $set: {
        name: data.name.trim(),
        ...(data.preferred_area?.trim()
          ? { preferredArea: data.preferred_area.trim() }
          : {}),
        lastOrderedAt: new Date(),
      },
      $inc: { totalOrders: 1 },
      $setOnInsert: { phone: normalized },
    },
    { upsert: true, new: true }
  ).lean();
  return toApi(doc)!;
}

export async function updateProfile(
  phone: string,
  updates: { name?: string; preferred_area?: string }
): Promise<CustomerProfileData | null> {
  const normalized = normalizePhone(phone);
  const patch: Record<string, unknown> = {};
  if (updates.name !== undefined) patch.name = updates.name.trim();
  if (updates.preferred_area !== undefined) patch.preferredArea = updates.preferred_area.trim();
  if (!Object.keys(patch).length) return getProfile(normalized);
  const doc = await CustomerProfile.findOneAndUpdate(
    { phone: normalized },
    { $set: patch },
    { new: true }
  ).lean();
  return toApi(doc);
}

export async function searchProfiles(query: string): Promise<CustomerProfileData[]> {
  const filter = query ? { name: { $regex: query, $options: "i" } } : {};
  const docs = await CustomerProfile.find(filter)
    .sort({ lastOrderedAt: -1, totalOrders: -1 })
    .limit(20)
    .lean();
  return (docs.map(toApi).filter(Boolean) as CustomerProfileData[]);
}

// Called on POS dine-in order completion — ensures the customer appears in
// profiles for future auto-suggest without double-counting app-side totalOrders.
export async function recordPosOrderVisit(phone: string, name: string): Promise<void> {
  const normalized = normalizePhone(phone);
  await CustomerProfile.findOneAndUpdate(
    { phone: normalized },
    {
      $set: { name: name.trim(), lastOrderedAt: new Date() },
      $setOnInsert: { phone: normalized, preferredArea: "", totalOrders: 0 },
    },
    { upsert: true }
  );
}
