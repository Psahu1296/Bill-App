import mongoose from "mongoose";
import { PreOrder } from "../models";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toApi(doc: any): Record<string, unknown> | null {
  if (!doc) return null;
  return {
    _id:                  String(doc._id),
    customerName:         doc.customerName,
    customerPhone:        doc.customerPhone,
    scheduledFor:         doc.scheduledFor,
    items:                doc.items ?? [],
    guestCount:           doc.guestCount ?? 1,
    orderType:            doc.orderType ?? "dine-in",
    deliveryAddress:      doc.deliveryAddress ?? "",
    specialInstructions:  doc.specialInstructions ?? "",
    status:               doc.status,
    adminNote:            doc.adminNote ?? "",
    estimatedTotal:       doc.estimatedTotal ?? 0,
    estimatedAmount:      doc.estimatedAmount ?? 0,
    depositAmount:        doc.depositAmount ?? 0,
    depositPaid:          doc.depositPaid ?? false,
    depositTransactionId: doc.depositTransactionId ?? "",
    depositPaidAt:        doc.depositPaidAt ?? null,
    createdAt:            doc.createdAt,
    updatedAt:            doc.updatedAt,
  };
}

export async function create(data: {
  customerName: string;
  customerPhone: string;
  scheduledFor: Date;
  items: { name: string; quantity: number }[];
  guestCount?: number;
  orderType?: string;
  deliveryAddress?: string;
  specialInstructions?: string;
  estimatedTotal?: number;
}) {
  const doc = await PreOrder.create({
    customerName:        data.customerName,
    customerPhone:       data.customerPhone,
    scheduledFor:        data.scheduledFor,
    items:               data.items,
    guestCount:          data.guestCount ?? 1,
    orderType:           data.orderType ?? "dine-in",
    deliveryAddress:     data.deliveryAddress ?? "",
    specialInstructions: data.specialInstructions ?? "",
    estimatedTotal:      data.estimatedTotal ?? 0,
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
    query.scheduledFor = {};
    if (filters.startDate) query.scheduledFor.$gte = filters.startDate;
    if (filters.endDate)   query.scheduledFor.$lte = filters.endDate;
  }

  const docs = await PreOrder.find(query).sort({ scheduledFor: 1 }).lean();
  return docs.map(toApi);
}

export async function findByPhone(phone: string) {
  const docs = await PreOrder.find({ customerPhone: phone })
    .sort({ scheduledFor: -1 })
    .lean();
  return docs.map(toApi);
}

export async function findById(id: string) {
  if (!mongoose.isValidObjectId(id)) return null;
  const doc = await PreOrder.findById(id).lean();
  return toApi(doc);
}

const ALLOWED_PATCH_KEYS = [
  "status",
  "adminNote",
  "estimatedAmount",
  "depositPaid",
  "depositTransactionId",
  "depositPaidAt",
  "depositAmount",
] as const;

export async function update(
  id: string,
  patch: {
    status?: string;
    adminNote?: string;
    estimatedAmount?: number;
    depositPaid?: boolean;
    depositTransactionId?: string;
    depositPaidAt?: Date | null;
    depositAmount?: number;
  }
) {
  if (!mongoose.isValidObjectId(id)) return null;
  const set: Record<string, unknown> = {};
  for (const key of ALLOWED_PATCH_KEYS) {
    if (key in patch) set[key] = patch[key as keyof typeof patch];
  }
  if (!Object.keys(set).length) return null;
  const doc = await PreOrder.findByIdAndUpdate(
    id,
    { $set: set },
    { new: true }
  ).lean();
  return toApi(doc);
}

export async function remove(id: string) {
  if (!mongoose.isValidObjectId(id)) return null;
  const doc = await PreOrder.findByIdAndDelete(id).lean();
  return toApi(doc);
}
