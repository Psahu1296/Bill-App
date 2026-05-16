import { Response, NextFunction } from "express";
import mongoose from "mongoose";
import createHttpError from "http-errors";
import { CustomRequest as Request } from "../types";
import { ExpensePreset, Dish } from "../models";
import * as stockCycleRepo from "../repositories/stockCycleRepo";

type VariantPieceMap = Record<string, number> | null | undefined;
type TrackingMode = "order-linked" | "time-linked";

function computeConsumptionRate(
  cycles: { quantityKg: number; unitsConsumed: number }[]
): number | null {
  const valid = cycles.filter((c) => c.unitsConsumed > 0);
  if (!valid.length) return null;
  const rates = valid.map((c) => c.quantityKg / c.unitsConsumed);
  return rates.reduce((a, b) => a + b, 0) / rates.length;
}

/** Average days lasted per cycle (time-linked items) */
function computeAvgDaysLasted(
  cycles: { daysLasted?: number | null }[]
): number | null {
  const valid = cycles.filter((c) => c.daysLasted && c.daysLasted > 0) as { daysLasted: number }[];
  if (!valid.length) return null;
  return valid.reduce((sum, c) => sum + c.daysLasted, 0) / valid.length;
}

const getInventoryDashboard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawMaterialPresets = await ExpensePreset.find({
      category: "Raw Material",
      isActive: true,
    })
      .select("_id name variantPieceMap trackingMode stockUnit consumptionUnit stockToConsumptionFactor aliases")
      .lean() as unknown as {
        _id: { toString(): string };
        name: string;
        variantPieceMap: VariantPieceMap;
        trackingMode: TrackingMode;
        stockUnit: string;
        consumptionUnit: string;
        stockToConsumptionFactor: number;
        aliases: string[];
      }[];

    const results = await Promise.all(
      rawMaterialPresets.map(async ({
        _id: presetDoc,
        name: rawMaterial,
        variantPieceMap,
        trackingMode = "order-linked",
        stockUnit = "kg",
        consumptionUnit = "plates",
        stockToConsumptionFactor = 1,
        aliases = [],
      }) => {
        const [activeCycle, closedCycles, dailyRate] = await Promise.all([
          stockCycleRepo.findActiveCycle(rawMaterial),
          stockCycleRepo.findClosedCycles(rawMaterial),
          stockCycleRepo.dailyUnitRate(rawMaterial, variantPieceMap, trackingMode, aliases),
        ]);

        let consumptionRate: number | null = null;
        let avgDaysLasted: number | null = null;
        let activeUnits: number | null = null;
        let daysRemaining: number | null = null;

        if (trackingMode === "time-linked") {
          avgDaysLasted = computeAvgDaysLasted(
            closedCycles as unknown as { daysLasted?: number | null }[]
          );
          if (activeCycle && avgDaysLasted) {
            const cycle = activeCycle as unknown as { startDate: Date };
            const daysUsed = (Date.now() - new Date(cycle.startDate).getTime()) / (1000 * 60 * 60 * 24);
            daysRemaining = avgDaysLasted - daysUsed;
          }
        } else {
          consumptionRate = computeConsumptionRate(
            closedCycles as unknown as { quantityKg: number; unitsConsumed: number }[]
          );

          if (activeCycle) {
            const cycle = activeCycle as unknown as { startDate: Date; quantityKg: number };
            activeUnits = await stockCycleRepo.activeUnitsConsumed(
              rawMaterial,
              new Date(cycle.startDate),
              variantPieceMap,
              aliases
            );

            if (consumptionRate && dailyRate > 0) {
              const totalUnitsInStock = cycle.quantityKg / consumptionRate;
              const remainingUnits = totalUnitsInStock - activeUnits;
              daysRemaining = remainingUnits / dailyRate;
            }
          }
        }

        let restockFor7Days: number | null = null;
        let restockFor14Days: number | null = null;

        if (trackingMode === "order-linked" && consumptionRate && dailyRate > 0) {
          restockFor7Days = parseFloat((dailyRate * 7 * consumptionRate).toFixed(2));
          restockFor14Days = parseFloat((dailyRate * 14 * consumptionRate).toFixed(2));
        }

        return {
          presetId: presetDoc.toString(),
          rawMaterial,
          variantPieceMap: variantPieceMap ?? null,
          trackingMode,
          stockUnit,
          consumptionUnit,
          stockToConsumptionFactor,
          aliases,
          activeCycle: activeCycle ?? null,
          activeUnitsConsumed: activeUnits,
          closedCyclesCount: (closedCycles as unknown[]).length,
          consumptionRate: consumptionRate !== null ? parseFloat(consumptionRate.toFixed(4)) : null,
          avgDaysLasted: avgDaysLasted !== null ? parseFloat(avgDaysLasted.toFixed(1)) : null,
          dailyUnitRate: parseFloat(dailyRate.toFixed(2)),
          prediction: {
            daysRemaining: daysRemaining !== null ? parseFloat(daysRemaining.toFixed(1)) : null,
            restockFor7Days,
            restockFor14Days,
          },
        };
      })
    );

    res.status(200).json({ success: true, data: results });
  } catch (error) {
    next(error);
  }
};

/** Returns distinct variantSize values from dishes tagged to this raw material */
const getVariantsForMaterial = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawMaterial = req.params.rawMaterial as string;
    if (!rawMaterial) return next(createHttpError(400, "rawMaterial param required"));

    const dishes = await Dish.find({
      $or: [
        { rawMaterial },
        { name: { $regex: rawMaterial.toLowerCase(), $options: "i" } },
      ],
    })
      .select("variants")
      .lean() as unknown as { variants?: { size: string }[] }[];

    const variantSizes = new Set<string>();
    for (const dish of dishes) {
      if (dish.variants) {
        for (const v of dish.variants) {
          if (v.size) variantSizes.add(v.size);
        }
      }
    }

    res.status(200).json({ success: true, data: Array.from(variantSizes) });
  } catch (error) {
    next(error);
  }
};

const getCycleHistory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawMaterial = req.params.rawMaterial as string;
    if (!rawMaterial) return next(createHttpError(400, "rawMaterial param required"));
    const cycles = await stockCycleRepo.findAllCycles(rawMaterial);
    res.status(200).json({ success: true, data: cycles });
  } catch (error) {
    next(error);
  }
};

const updateCycle = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    if (!id || !mongoose.isValidObjectId(id)) {
      return next(createHttpError(400, "Invalid cycle ID"));
    }
    const { isEarlyRestock } = req.body;
    const cycle = await stockCycleRepo.patchCycle(id, { isEarlyRestock });
    if (!cycle) return next(createHttpError(404, "Cycle not found"));
    res.status(200).json({ success: true, data: cycle });
  } catch (error) {
    next(error);
  }
};

export { getInventoryDashboard, getCycleHistory, updateCycle, getVariantsForMaterial };
