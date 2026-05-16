import { Response, NextFunction } from "express";
import mongoose from "mongoose";
import createHttpError from "http-errors";
import { CustomRequest as Request } from "../types";
import { ExpensePreset } from "../models";
import * as stockCycleRepo from "../repositories/stockCycleRepo";

type VariantPieceMap = Record<string, number> | null | undefined;

/** kg/unit avg from all closed non-early-restock cycles */
function computeConsumptionRate(
  cycles: { quantityKg: number; unitsConsumed: number }[]
): number | null {
  const valid = cycles.filter((c) => c.unitsConsumed > 0);
  if (!valid.length) return null;
  const rates = valid.map((c) => c.quantityKg / c.unitsConsumed);
  return rates.reduce((a, b) => a + b, 0) / rates.length;
}

const getInventoryDashboard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawMaterialPresets = await ExpensePreset.find({
      category: "Raw Material",
      isActive: true,
    })
      .select("_id name variantPieceMap")
      .lean() as unknown as { _id: { toString(): string }; name: string; variantPieceMap: VariantPieceMap }[];

    const results = await Promise.all(
      rawMaterialPresets.map(async ({ _id: presetDoc, name: rawMaterial, variantPieceMap }) => {
        const [activeCycle, closedCycles, dailyRate] = await Promise.all([
          stockCycleRepo.findActiveCycle(rawMaterial),
          stockCycleRepo.findClosedCycles(rawMaterial),
          stockCycleRepo.dailyUnitRate(rawMaterial, variantPieceMap),
        ]);

        const consumptionRate = computeConsumptionRate(
          closedCycles as unknown as { quantityKg: number; unitsConsumed: number }[]
        );

        let activeUnits: number | null = null;
        let daysRemaining: number | null = null;
        let restockFor7Days: number | null = null;
        let restockFor14Days: number | null = null;

        if (activeCycle) {
          const cycle = activeCycle as unknown as { startDate: Date; quantityKg: number };
          activeUnits = await stockCycleRepo.activeUnitsConsumed(
            rawMaterial,
            new Date(cycle.startDate),
            variantPieceMap
          );

          if (consumptionRate && dailyRate > 0) {
            const totalUnitsInStock = cycle.quantityKg / consumptionRate;
            const remainingUnits = totalUnitsInStock - activeUnits;
            daysRemaining = remainingUnits / dailyRate;
          }
        }

        if (consumptionRate && dailyRate > 0) {
          restockFor7Days = parseFloat((dailyRate * 7 * consumptionRate).toFixed(2));
          restockFor14Days = parseFloat((dailyRate * 14 * consumptionRate).toFixed(2));
        }

        return {
          presetId: presetDoc.toString(),
          rawMaterial,
          variantPieceMap: variantPieceMap ?? null,
          activeCycle: activeCycle ?? null,
          activeUnitsConsumed: activeUnits,
          closedCyclesCount: closedCycles.length,
          consumptionRate: consumptionRate !== null ? parseFloat(consumptionRate.toFixed(4)) : null,
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

export { getInventoryDashboard, getCycleHistory, updateCycle };
