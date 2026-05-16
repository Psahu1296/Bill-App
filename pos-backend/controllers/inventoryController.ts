import { Response, NextFunction } from "express";
import mongoose from "mongoose";
import createHttpError from "http-errors";
import { CustomRequest as Request } from "../types";
import * as stockCycleRepo from "../repositories/stockCycleRepo";

/** kg/plate avg from all closed non-early-restock cycles */
function computeConsumptionRate(
  cycles: { quantityKg: number; platesConsumed: number }[]
): number | null {
  const valid = cycles.filter((c) => c.platesConsumed > 0);
  if (!valid.length) return null;
  const rates = valid.map((c) => c.quantityKg / c.platesConsumed);
  return rates.reduce((a, b) => a + b, 0) / rates.length;
}

const getInventoryDashboard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { ExpensePreset } = await import("../models");
    const rawMaterialPresets = await ExpensePreset.find({
      category: "Raw Material",
      isActive: true,
    })
      .select("name")
      .lean() as { name: string }[];

    const results = await Promise.all(
      rawMaterialPresets.map(async ({ name: rawMaterial }) => {
        const [activeCycle, closedCycles, dailyRate] = await Promise.all([
          stockCycleRepo.findActiveCycle(rawMaterial),
          stockCycleRepo.findClosedCycles(rawMaterial),
          stockCycleRepo.dailyPlateRate(rawMaterial),
        ]);

        const consumptionRate = computeConsumptionRate(
          closedCycles as { quantityKg: number; platesConsumed: number }[]
        );

        let activePlates: number | null = null;
        let daysRemaining: number | null = null;
        let restockFor7Days: number | null = null;
        let restockFor14Days: number | null = null;

        if (activeCycle) {
          const cycle = activeCycle as { startDate: Date; quantityKg: number; _id: unknown };
          activePlates = await stockCycleRepo.activePlatesConsumed(
            rawMaterial,
            new Date(cycle.startDate)
          );

          if (consumptionRate && dailyRate > 0) {
            const totalPlatesInStock = cycle.quantityKg / consumptionRate;
            const remainingPlates = totalPlatesInStock - activePlates;
            daysRemaining = remainingPlates / dailyRate;
          } else if (dailyRate > 0) {
            // no consumption rate yet — use raw daily rate for a rough estimate
            // treat 1 plate = 1 unit as a stand-in (will refine once first cycle closes)
            daysRemaining = null;
          }
        }

        if (consumptionRate && dailyRate > 0) {
          restockFor7Days = parseFloat((dailyRate * 7 * consumptionRate).toFixed(2));
          restockFor14Days = parseFloat((dailyRate * 14 * consumptionRate).toFixed(2));
        }

        return {
          rawMaterial,
          activeCycle: activeCycle ?? null,
          activePlatesConsumed: activePlates,
          closedCyclesCount: closedCycles.length,
          consumptionRate: consumptionRate !== null ? parseFloat(consumptionRate.toFixed(4)) : null,
          dailyPlateRate: parseFloat(dailyRate.toFixed(2)),
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
    const { rawMaterial } = req.params;
    if (!rawMaterial) return next(createHttpError(400, "rawMaterial param required"));
    const cycles = await stockCycleRepo.findAllCycles(rawMaterial);
    res.status(200).json({ success: true, data: cycles });
  } catch (error) {
    next(error);
  }
};

const updateCycle = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
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
