import { DailyEarning, Order } from "../models";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toApi(doc: any) {
  if (!doc) return null;
  return {
    _id: String(doc._id),
    date: doc.date,
    totalEarnings: doc.totalEarnings,
    percentageChangeFromYesterday: doc.percentageChangeFromYesterday,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export async function findByDate(dateIso: string) {
  const doc = await DailyEarning.findOne({ date: new Date(dateIso) }).lean();
  return toApi(doc);
}

export async function findInRange(startIso: string, endIso: string) {
  const docs = await DailyEarning.find({
    date: { $gte: new Date(startIso), $lte: new Date(endIso) },
  }).sort({ date: 1 }).lean();
  return docs.map(toApi);
}

export async function sumInRange(startIso: string, endIso: string): Promise<number> {
  const result = await DailyEarning.aggregate([
    { $match: { date: { $gte: new Date(startIso), $lte: new Date(endIso) } } },
    { $group: { _id: null, total: { $sum: "$totalEarnings" } } },
  ]);
  return result[0]?.total ?? 0;
}

export async function upsert(dateIso: string, totalEarnings: number, percentageChange: number) {
  const doc = await DailyEarning.findOneAndUpdate(
    { date: new Date(dateIso) },
    { $set: { totalEarnings, percentageChangeFromYesterday: percentageChange } },
    { upsert: true, new: true }
  ).lean();
  return toApi(doc)!;
}

export async function incrementEarnings(dateIso: string, delta: number) {
  const doc = await DailyEarning.findOneAndUpdate(
    { date: new Date(dateIso) },
    { $inc: { totalEarnings: delta } },
    { upsert: true, new: true }
  ).lean();
  return toApi(doc)!;
}

export async function sumPaidOrdersInRange(startIso: string, endIso: string): Promise<number> {
  const result = await Order.aggregate([
    {
      $match: {
        paymentStatus: "Paid",
        orderDate: { $gte: new Date(startIso), $lte: new Date(endIso) },
      },
    },
    { $group: { _id: null, total: { $sum: "$bills.totalWithTax" } } },
  ]);
  return result[0]?.total ?? 0;
}
