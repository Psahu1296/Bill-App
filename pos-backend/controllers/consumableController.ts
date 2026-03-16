import { Response, NextFunction } from "express";
import createHttpError from "http-errors";
import mongoose from "mongoose";
import Consumable from "../models/consumableModel";
import { CustomRequest as Request } from "../types";
import {
  getZonedStartOfDayUtc,
  getZonedEndOfDayUtc,
} from "./earningController";

// ── Unit prices (source of truth, matches frontend CONSUMABLE_CONFIG) ──
const UNIT_PRICES: Record<string, number> = {
  tea: 15,
  gutka: 25,
  cigarette: 20,
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Add a new consumable entry
// @route   POST /api/consumables
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const addConsumable = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { type, quantity, pricePerUnit, consumerType, consumerName, orderId, timestamp } =
      req.body;

    if (!type || !quantity || !consumerType || !consumerName) {
      return next(
        createHttpError(
          400,
          "Missing required fields: type, quantity, consumerType, consumerName."
        )
      );
    }

    const entry = new Consumable({
      type,
      quantity,
      pricePerUnit: pricePerUnit ?? UNIT_PRICES[type] ?? 0,
      consumerType,
      consumerName,
      orderId: orderId && mongoose.Types.ObjectId.isValid(orderId) ? orderId : null,
      timestamp: timestamp ? new Date(timestamp) : new Date(),
    });

    await entry.save();
    res
      .status(201)
      .json({ success: true, message: "Consumable entry added.", data: entry });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get all consumable entries (with optional filters)
// @route   GET /api/consumables
//          ?type=tea|gutka|cigarette
//          &consumerType=customer|staff|owner
//          &startDate=ISO&endDate=ISO
//          &date=ISO  (shorthand for "a specific day")
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const getAllConsumables = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { type, consumerType, startDate, endDate, date } = req.query as Record<
      string,
      string
    >;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query: Record<string, any> = {};

    if (type) query.type = type;
    if (consumerType) query.consumerType = consumerType;

    // Date filtering: 'date' shorthand overrides startDate/endDate
    if (date) {
      const d = new Date(date);
      query.timestamp = {
        $gte: getZonedStartOfDayUtc(d),
        $lte: getZonedEndOfDayUtc(d),
      };
    } else {
      if (startDate || endDate) {
        query.timestamp = {};
        if (startDate)
          query.timestamp.$gte = getZonedStartOfDayUtc(new Date(startDate));
        if (endDate)
          query.timestamp.$lte = getZonedEndOfDayUtc(new Date(endDate));
      }
    }

    const entries = await Consumable.find(query)
      .sort({ timestamp: -1 })
      .populate("orderId", "customerDetails orderDate");

    res.status(200).json({ success: true, data: entries });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get daily summary of consumable entries (aggregated per type)
// @route   GET /api/consumables/summary/day?date=ISO
// @access  Private
// Returns per-type stats: totalSold, totalRevenue, staffConsumed, ownerConsumed, wastedValue
// ─────────────────────────────────────────────────────────────────────────────
const getDailySummary = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dateQuery = req.query.date
      ? new Date(req.query.date as string)
      : new Date();

    const startDate = getZonedStartOfDayUtc(dateQuery);
    const endDate = getZonedEndOfDayUtc(dateQuery);

    const pipeline = [
      {
        $match: {
          timestamp: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: { type: "$type", consumerType: "$consumerType" },
          totalQty: { $sum: "$quantity" },
          totalRevenue: {
            $sum: {
              $multiply: ["$quantity", "$pricePerUnit"],
            },
          },
        },
      },
    ];

    const raw = await Consumable.aggregate(pipeline);

    // Shape into a map: { tea: { totalSold, totalRevenue, staffConsumed, ownerConsumed, wastedValue }, ... }
    const types = ["tea", "gutka", "cigarette"] as const;
    type SummaryType = {
      totalSold: number;
      totalRevenue: number;
      staffConsumed: number;
      ownerConsumed: number;
      wastedValue: number;
    };

    const summary: Record<string, SummaryType> = {};
    for (const t of types) {
      summary[t] = {
        totalSold: 0,
        totalRevenue: 0,
        staffConsumed: 0,
        ownerConsumed: 0,
        wastedValue: 0,
      };
    }

    for (const row of raw) {
      const { type, consumerType } = row._id as {
        type: string;
        consumerType: string;
      };
      if (!summary[type]) continue;

      if (consumerType === "customer") {
        summary[type].totalSold += row.totalQty;
        summary[type].totalRevenue += row.totalRevenue;
      } else if (consumerType === "staff") {
        summary[type].staffConsumed += row.totalQty;
        summary[type].wastedValue +=
          row.totalQty * (UNIT_PRICES[type] ?? 0);
      } else if (consumerType === "owner") {
        summary[type].ownerConsumed += row.totalQty;
        summary[type].wastedValue +=
          row.totalQty * (UNIT_PRICES[type] ?? 0);
      }
    }

    res.status(200).json({
      success: true,
      data: {
        date: dateQuery.toISOString().split("T")[0],
        summary,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Update a consumable entry
// @route   PUT /api/consumables/:id
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const updateConsumable = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id as string)) {
      return next(createHttpError(400, "Invalid Consumable ID format."));
    }

    const { _id, __v, ...updates } = req.body;

    const entry = await Consumable.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!entry) {
      return next(createHttpError(404, "Consumable entry not found."));
    }

    res
      .status(200)
      .json({ success: true, message: "Entry updated.", data: entry });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Delete a consumable entry
// @route   DELETE /api/consumables/:id
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const deleteConsumable = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id as string)) {
      return next(createHttpError(400, "Invalid Consumable ID format."));
    }

    const entry = await Consumable.findByIdAndDelete(id);
    if (!entry) {
      return next(createHttpError(404, "Consumable entry not found."));
    }

    res
      .status(200)
      .json({ success: true, message: "Entry deleted.", data: entry });
  } catch (error) {
    next(error);
  }
};

export {
  addConsumable,
  getAllConsumables,
  getDailySummary,
  updateConsumable,
  deleteConsumable,
};
