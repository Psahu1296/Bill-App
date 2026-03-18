import { Response, NextFunction } from "express";
import createHttpError from "http-errors";
import * as consumableRepo from "../repositories/consumableRepo";
import * as earningRepo from "../repositories/earningRepo";
import { CustomRequest as Request } from "../types";
import { getZonedStartOfDayUtc, getZonedEndOfDayUtc } from "./earningController";

const UNIT_PRICES: Record<string, number> = { tea: 15, gutka: 25, cigarette: 20 };

const addConsumable = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type, quantity, pricePerUnit, consumerType, consumerName, orderId, timestamp } = req.body;

    if (!type || !quantity || !consumerType || !consumerName) {
      return next(createHttpError(400, "Missing required fields: type, quantity, consumerType, consumerName."));
    }

    const resolvedPrice = pricePerUnit ?? UNIT_PRICES[type] ?? 0;
    const resolvedTimestamp = timestamp ? new Date(timestamp).toISOString() : new Date().toISOString();

    const entry = consumableRepo.create({
      type, quantity, consumerType, consumerName,
      pricePerUnit: resolvedPrice,
      orderId: orderId != null && !isNaN(Number(orderId)) ? Number(orderId) : null,
      timestamp: resolvedTimestamp,
    });

    // Customer sales count as revenue
    if (consumerType === "customer") {
      try {
        const dateIso = getZonedStartOfDayUtc(new Date(resolvedTimestamp)).toISOString();
        earningRepo.incrementEarnings(dateIso, quantity * resolvedPrice);
      } catch (e) { console.error("Earnings error on addConsumable:", e); }
    }

    res.status(201).json({ success: true, message: "Consumable entry added.", data: entry });
  } catch (error) {
    next(error);
  }
};

const getAllConsumables = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type, consumerType, startDate, endDate, date } = req.query as Record<string, string>;

    const filters: Parameters<typeof consumableRepo.findAll>[0] = {};
    if (type)         filters.type         = type;
    if (consumerType) filters.consumerType = consumerType;

    if (date) {
      const d = new Date(date);
      filters.startDate = getZonedStartOfDayUtc(d);
      filters.endDate   = getZonedEndOfDayUtc(d);
    } else {
      if (startDate) filters.startDate = getZonedStartOfDayUtc(new Date(startDate));
      if (endDate)   filters.endDate   = getZonedEndOfDayUtc(new Date(endDate));
    }

    res.status(200).json({ success: true, data: consumableRepo.findAll(filters) });
  } catch (error) {
    next(error);
  }
};

const getDailySummary = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dateQuery = req.query.date ? new Date(req.query.date as string) : new Date();
    const startDate = getZonedStartOfDayUtc(dateQuery);
    const endDate   = getZonedEndOfDayUtc(dateQuery);

    const raw = consumableRepo.dailySummary(startDate, endDate);

    const types = ["tea", "gutka", "cigarette"] as const;
    type SummaryEntry = { totalSold: number; totalRevenue: number; staffConsumed: number; ownerConsumed: number; wastedValue: number };
    const summary: Record<string, SummaryEntry> = {};
    for (const t of types) {
      summary[t] = { totalSold: 0, totalRevenue: 0, staffConsumed: 0, ownerConsumed: 0, wastedValue: 0 };
    }

    for (const row of raw) {
      if (!summary[row.type]) continue;
      if (row.consumerType === "customer") {
        summary[row.type].totalSold    += row.totalQty;
        summary[row.type].totalRevenue += row.totalRevenue;
      } else if (row.consumerType === "staff") {
        summary[row.type].staffConsumed += row.totalQty;
        summary[row.type].wastedValue   += row.totalQty * (UNIT_PRICES[row.type] ?? 0);
      } else if (row.consumerType === "owner") {
        summary[row.type].ownerConsumed += row.totalQty;
        summary[row.type].wastedValue   += row.totalQty * (UNIT_PRICES[row.type] ?? 0);
      }
    }

    res.status(200).json({ success: true, data: { date: dateQuery.toISOString().split("T")[0], summary } });
  } catch (error) {
    next(error);
  }
};

const updateConsumable = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    if (!id || isNaN(Number(id))) {
      return next(createHttpError(400, "Invalid Consumable ID format."));
    }
    const { _id, __v, ...updates } = req.body;
    const entry = consumableRepo.update(id, updates);
    if (!entry) return next(createHttpError(404, "Consumable entry not found."));
    res.status(200).json({ success: true, message: "Entry updated.", data: entry });
  } catch (error) {
    next(error);
  }
};

const deleteConsumable = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    if (!id || isNaN(Number(id))) {
      return next(createHttpError(400, "Invalid Consumable ID format."));
    }
    const entry = consumableRepo.remove(id) as Record<string, unknown> | null;
    if (!entry) return next(createHttpError(404, "Consumable entry not found."));

    // Reverse the revenue if it was a customer sale
    if (entry.consumerType === "customer") {
      try {
        const dateIso = getZonedStartOfDayUtc(new Date(entry.timestamp as string)).toISOString();
        earningRepo.incrementEarnings(dateIso, -((entry.quantity as number) * (entry.pricePerUnit as number)));
      } catch (e) { console.error("Earnings error on deleteConsumable:", e); }
    }

    res.status(200).json({ success: true, message: "Entry deleted.", data: entry });
  } catch (error) {
    next(error);
  }
};

export { addConsumable, getAllConsumables, getDailySummary, updateConsumable, deleteConsumable };
