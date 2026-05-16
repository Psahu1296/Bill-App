import { StockCycle, Dish, Order } from "../models";

type VariantPieceMap = Record<string, number> | null | undefined;

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
  return (dishes as unknown as { name: string }[]).map((d) => d.name);
}

/** Resolve how many plate-equivalent units one order item contributes.
 *  "Full" variant is the reference for 1 plate (its piece count = piecesPerPlate).
 *  Other variants are normalised: pieces / piecesPerPlate → plate fraction.
 */
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
  // "Full" defines 1 plate; divide so every variant returns plate-equivalents
  const piecesPerPlate = variantPieceMap["Full"] ?? 1;
  return (quantity * pieces) / piecesPerPlate;
}

/** Count units consumed for a raw material in completed orders within a date range.
 *  Matches both registered dish names (exact) and custom order items (keyword regex),
 *  so items added via the custom free-text flow are also counted.
 */
async function countUnits(
  dishNames: string[],
  rawMaterial: string,
  variantPieceMap: VariantPieceMap,
  startDate: Date,
  endDate?: Date
): Promise<number> {
  const keyword = rawMaterial.toLowerCase();
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
      const matchesKeyword = item.name.toLowerCase().includes(keyword);
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

/** Close a cycle: record endDate + unitsConsumed from order history */
export async function closeCycle(
  cycleId: string,
  endDate: Date,
  rawMaterial: string,
  startDate: Date,
  variantPieceMap: VariantPieceMap
) {
  const dishNames = await getMatchingDishNames(rawMaterial);
  const unitsConsumed = await countUnits(dishNames, rawMaterial, variantPieceMap, startDate, endDate);
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
    unitsConsumed: { $gt: 0 },
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

/** Units consumed so far in the active cycle (live query) */
export async function activeUnitsConsumed(
  rawMaterial: string,
  startDate: Date,
  variantPieceMap: VariantPieceMap
): Promise<number> {
  const dishNames = await getMatchingDishNames(rawMaterial);
  return countUnits(dishNames, rawMaterial, variantPieceMap, startDate);
}

/** 14-day rolling unit rate for a raw material */
export async function dailyUnitRate(
  rawMaterial: string,
  variantPieceMap: VariantPieceMap
): Promise<number> {
  const since = new Date();
  since.setDate(since.getDate() - 14);
  const dishNames = await getMatchingDishNames(rawMaterial);
  const total = await countUnits(dishNames, rawMaterial, variantPieceMap, since);
  return total / 14;
}
