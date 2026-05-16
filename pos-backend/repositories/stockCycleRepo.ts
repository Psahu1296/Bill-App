import { StockCycle, Dish, Order } from "../models";

/** Dish names that map to a raw material (explicit tag first, name-match fallback) */
async function getMatchingDishNames(rawMaterial: string): Promise<string[]> {
  const keyword = rawMaterial.toLowerCase();
  const dishes = await Dish.find({
    $or: [
      { rawMaterial },
      { name: { $regex: keyword, $options: "i" } },
    ],
  })
    .select("name")
    .lean();
  return (dishes as { name: string }[]).map((d) => d.name);
}

/** Count plates of a raw material sold in completed orders within a date range */
async function countPlates(
  dishNames: string[],
  startDate: Date,
  endDate?: Date
): Promise<number> {
  if (!dishNames.length) return 0;
  const match: Record<string, unknown> = {
    orderStatus: "Completed",
    createdAt: { $gte: startDate, ...(endDate ? { $lte: endDate } : {}) },
  };
  const orders = await Order.find(match).select("items").lean() as { items: { name: string; quantity?: number }[] }[];
  let total = 0;
  for (const order of orders) {
    for (const item of order.items) {
      if (dishNames.includes(item.name)) total += item.quantity ?? 1;
    }
  }
  return total;
}

export async function create(data: {
  expenseId: string;
  rawMaterial: string;
  quantityKg: number;
  startDate: Date;
  isEarlyRestock: boolean;
}) {
  const cycle = await StockCycle.create(data);
  return cycle.toJSON();
}

export async function findActiveCycle(rawMaterial: string) {
  return StockCycle.findOne({ rawMaterial, cycleStatus: "active" }).lean();
}

/** Close a cycle: record endDate + platesConsumed from order history */
export async function closeCycle(
  cycleId: string,
  endDate: Date,
  rawMaterial: string,
  startDate: Date
) {
  const dishNames = await getMatchingDishNames(rawMaterial);
  const platesConsumed = await countPlates(dishNames, startDate, endDate);
  return StockCycle.findByIdAndUpdate(
    cycleId,
    { cycleStatus: "closed", endDate, platesConsumed },
    { new: true }
  ).lean();
}

export async function findClosedCycles(rawMaterial: string) {
  return StockCycle.find({
    rawMaterial,
    cycleStatus: "closed",
    isEarlyRestock: false,
    platesConsumed: { $gt: 0 },
  })
    .sort({ endDate: -1 })
    .lean();
}

export async function findAllCycles(rawMaterial: string) {
  return StockCycle.find({ rawMaterial }).sort({ startDate: -1 }).lean();
}

export async function patchCycle(id: string, updates: Partial<{ isEarlyRestock: boolean }>) {
  return StockCycle.findByIdAndUpdate(id, updates, { new: true }).lean();
}

/** Plates consumed so far in the active cycle (live query, not stored) */
export async function activePlatesConsumed(rawMaterial: string, startDate: Date): Promise<number> {
  const dishNames = await getMatchingDishNames(rawMaterial);
  return countPlates(dishNames, startDate);
}

/** 14-day rolling plate count for a raw material */
export async function dailyPlateRate(rawMaterial: string): Promise<number> {
  const since = new Date();
  since.setDate(since.getDate() - 14);
  const dishNames = await getMatchingDishNames(rawMaterial);
  const total = await countPlates(dishNames, since);
  return total / 14;
}
