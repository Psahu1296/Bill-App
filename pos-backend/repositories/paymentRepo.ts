import { Payment } from "../models";

export async function create(data: {
  paymentId?: string;
  orderId?: string;
  amount?: number;
  currency?: string;
  status?: string;
  method?: string;
  email?: string;
  contact?: string;
  createdAt?: Date;
}) {
  // Idempotency: INSERT OR IGNORE equivalent — return existing if paymentId already recorded
  if (data.paymentId) {
    const existing = await Payment.findOne({ paymentId: data.paymentId }).lean();
    if (existing) {
      return toApi(existing);
    }
  }

  try {
    const doc = await Payment.create({
      paymentId: data.paymentId ?? null,
      orderId: data.orderId ?? null,
      amount: data.amount ?? null,
      currency: data.currency ?? null,
      status: data.status ?? null,
      method: data.method ?? null,
      email: data.email ?? null,
      contact: data.contact ?? null,
      createdAt: data.createdAt ?? new Date(),
    });
    return toApi(doc.toObject())!;
  } catch (err: unknown) {
    // Duplicate key — return existing
    if ((err as Record<string, unknown>).code === 11000 && data.paymentId) {
      const existing = await Payment.findOne({ paymentId: data.paymentId }).lean();
      return toApi(existing);
    }
    throw err;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toApi(doc: any) {
  if (!doc) return null;
  return {
    _id: String(doc._id),
    paymentId: doc.paymentId,
    orderId: doc.orderId,
    amount: doc.amount,
    currency: doc.currency,
    status: doc.status,
    method: doc.method,
    email: doc.email,
    contact: doc.contact,
    createdAt: doc.createdAt,
  };
}
