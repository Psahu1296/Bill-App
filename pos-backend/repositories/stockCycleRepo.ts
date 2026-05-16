import { StockCycle, Dish, Order } from "../models";

type VariantPieceMap = Record<string, number> | null | undefined;
type TrackingMode = "order-linked" | "time-linked";

/** Dish names that map to a raw material (explicit tag first, name-match fallback, aliases) */
async function getMatchingDishNames(rawMaterial: string, aliases: string[] = []): Promise<string[]> {
  const keywords = [rawMaterial.toLowerCase(), ...aliases.map((a) => a.toLowerCase())];
  const regexClauses = keywords.map((k) => ({ name: { $regex: k, $options: "i" } }));

  const dishes = await Dish.find({
    $or: [{ rawMaterial }, ...regexClauses],
  })
    .select("name")
    .lean();
  return (dishes as unknown as { name: string }[]).map((d) => d.name);
}

/** Resolve how many plate-equivalent units one order item contributes. */
function resolveUnits(
  variantSize: string | undefined,
  quantity: number,
  variantPieceMap: VariantPieceMap
): number {
  if (!variantPieceMap) return quantity;
  const pieces =
    (variantSize ? variantPieceMap[variantSize] : undefined) ??
    variantPieceMap["_default"] ??
    1;
  const piecesPerPlate = variantPieceMap["Full"] ?? 1;
  return (quantity * pieces) / piecesPerPlate;
}

async function countUnits(
  dishNames: string[],
  rawMaterial: string,
  aliases: string[],
  variantPieceMap: VariantPieceMap,
  startDate: Date,
  endDate?: Date
): Promise<number> {
  const keywords = [rawMaterial.toLowerCase(), ...aliases.map((a) => a.toLowerCase())];
  const match: Record<string, unknown> = {
    orderStatus: "Completed",
    createdAt: { $gte: startDate, ...(endDate ? { $lte: endDate } : {}) },
  };
  const orders = await Order.find(match)
    .select("items")
    .lean() as unknown as { items: { name: string; quantity?: number; variantSize?: string }[] }[];

  let total = 0;
  for (const order of orders) {
    for (const item of order.items) {
      const matchesDish = dishNames.includes(item.name);
      const matchesKeyword = keywords.some((k) => item.name.toLowerCase().includes(k));
      if (matchesDish || matchesKeyword) {
        total += resolveUnits(item.variantSize, item.quantity ?? 1, variantPieceMap);
      }
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

/** Close a cycle. For time-linked items, records daysLasted; for order-linked, counts consumed units. */
export async function closeCycle(
  cycleId: string,
  endDate: Date,
  rawMaterial: string,
  startDate: Date,
  variantPieceMap: VariantPieceMap,
  trackingMode: TrackingMode = "order-linked",
  aliases: string[] = []
) {
  if (trackingMode === "time-linked") {
    const daysLasted = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    return StockCycle.findByIdAndUpdate(
      cycleId,
      { cycleStatus: "closed", endDate, daysLasted: parseFloat(daysLasted.toFixed(2)), unitsConsumed: 0 },
      { new: true }
    ).lean();
  }

  const dishNames = await getMatchingDishNames(rawMaterial, aliases);
  const unitsConsumed = await countUnits(dishNames, rawMaterial, aliases, variantPieceMap, startDate, endDate);
  return StockCycle.findByIdAndUpdate(
    cycleId,
    { cycleStatus: "closed", endDate, unitsConsumed },
    { new: true }
  ).lean();
}

export async function findClosedCycles(rawMaterial: string) {
  return StockCycle.find({
    rawMaterial,
    cycleStatus: "closed",
    isEarlyRestock: false,
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

/** Units consumed so far in the active cycle (live query, order-linked only) */
export async function activeUnitsConsumed(
  rawMaterial: string,
  startDate: Date,
  variantPieceMap: VariantPieceMap,
  aliases: string[] = []
): Promise<number> {
  const dishNames = await getMatchingDishNames(rawMaterial, aliases);
  return countUnits(dishNames, rawMaterial, aliases, variantPieceMap, startDate);
}

/** 14-day rolling unit rate.
 *  order-linked: plates sold per day from orders.
 *  time-linked:  1 / avg daysLasted across closed non-early cycles (units per day = 1 unit per N days).
 */
export async function dailyUnitRate(
  rawMaterial: string,
  variantPieceMap: VariantPieceMap,
  trackingMode: TrackingMode = "order-linked",
  aliases: string[] = []
): Promise<number> {
  if (trackingMode === "time-linked") {
    const closed = await StockCycle.find({
      rawMaterial,
      cycleStatus: "closed",
      isEarlyRestock: false,
      daysLasted: { $gt: 0 },
    })
      .sort({ endDate: -1 })
      .limit(5)
      .lean() as unknown as { daysLasted: number }[];

    if (!closed.length) return 0;
    const avg = closed.reduce((sum, c) => sum + c.daysLasted, 0) / closed.length;
    return avg > 0 ? 1 / avg : 0;
  }

  const since = new Date();
  since.setDate(since.getDate() - 14);
  const dishNames = await getMatchingDishNames(rawMaterial, aliases);
  const total = await countUnits(dishNames, rawMaterial, aliases, variantPieceMap, since);
  return total / 14;
}
