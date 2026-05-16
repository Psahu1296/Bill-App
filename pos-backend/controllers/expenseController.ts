import { Response, NextFunction } from "express";
import mongoose from "mongoose";
import createHttpError from "http-errors";
import * as expenseRepo from "../repositories/expenseRepo";
import * as presetRepo from "../repositories/expensePresetRepo";
import * as stockCycleRepo from "../repositories/stockCycleRepo";
import { CustomRequest as Request } from "../types";
import {
  getZonedStartOfDayUtc, getZonedEndOfDayUtc,
  getZonedStartOfMonthUtc, getZonedEndOfMonthUtc,
  getZonedStartOfYearUtc, getZonedEndOfYearUtc,
} from "./earningController";
import { format } from "date-fns/format";

const addExpense = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type, name, amount, quantity, unit, description, expenseDate, presetId, isEarlyRestock } = req.body;

    if (!type || !name || amount === undefined || amount === null || amount < 0) {
      return next(createHttpError(400, "Missing required expense fields (type, name, amount) or amount is invalid."));
    }

    const purchaseDate = expenseDate ? new Date(expenseDate) : new Date();

    const expense = await expenseRepo.create({
      type, name, amount,
      quantity, unit,
      description,
      expenseDate: purchaseDate.toISOString(),
    });

    // Update preset price history in background — non-blocking, non-critical
    if (presetId && mongoose.isValidObjectId(presetId)) {
      presetRepo.updatePriceHistory(presetId, amount).catch(() => {});
    }

    // Stock cycle lifecycle — only for raw material purchases with a quantity in kg
    if (type === "food_raw_material" && quantity && quantity > 0) {
      (async () => {
        try {
          const expenseId = String((expense as Record<string, unknown>)._id);
          // Fetch variantPieceMap for this raw material from its preset
          const preset = await presetRepo.findByName(name).catch(() => null);
          const variantPieceMap = (preset as Record<string, unknown> | null)?.variantPieceMap as Record<string, number> | null ?? null;

          const activeCycle = await stockCycleRepo.findActiveCycle(name);
          if (activeCycle) {
            const cycle = activeCycle as unknown as { _id: { toString(): string }; startDate: Date };
            await stockCycleRepo.closeCycle(
              cycle._id.toString(),
              purchaseDate,
              name,
              new Date(cycle.startDate),
              variantPieceMap
            );
          }
          await stockCycleRepo.create({
            expenseId,
            rawMaterial: name,
            quantityKg: quantity,
            startDate: purchaseDate,
            isEarlyRestock: Boolean(isEarlyRestock),
          });
        } catch (err) {
          console.error("[StockCycle] Failed to update cycle:", err);
        }
      })();
    }

    res.status(201).json({ success: true, message: "Expense added successfully!", data: expense });
  } catch (error) {
    next(error);
  }
};

const getExpensesByPeriod = async (req: Request, res: Response, next: NextFunction) => {
  const { periodType } = req.params;
  const dateQuery = req.query.date ? new Date(req.query.date as string) : new Date();

  let startDate: Date, endDate: Date, groupByFormat: string;

  try {
    switch (periodType) {
      case "day":
        startDate = getZonedStartOfDayUtc(dateQuery);
        endDate = getZonedEndOfDayUtc(dateQuery);
        groupByFormat = "yyyy-MM-dd";
        break;
      case "month":
        startDate = getZonedStartOfMonthUtc(dateQuery);
        endDate = getZonedEndOfMonthUtc(dateQuery);
        groupByFormat = "yyyy-MM";
        break;
      case "year":
        startDate = getZonedStartOfYearUtc(dateQuery);
        endDate = getZonedEndOfYearUtc(dateQuery);
        groupByFormat = "yyyy";
        break;
      default:
        return next(createHttpError(400, "Invalid periodType. Use 'day', 'month', or 'year'."));
    }

    const [expenses, expensesSummary] = await Promise.all([
      expenseRepo.findAll({ startDate, endDate }),
      expenseRepo.aggregateByType(startDate, endDate),
    ]);

    const totalExpenses = expenses.reduce((sum, exp) => sum + ((exp as Record<string, unknown>).amount as number), 0);

    res.status(200).json({
      success: true,
      data: {
        period: format(startDate, groupByFormat),
        totalExpenses,
        details: expenses,
        summaryByType: expensesSummary,
      },
    });
  } catch (error) {
    next(error);
  }
};

const getAllExpenses = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate, type } = req.query;

    const filters: { startDate?: Date; endDate?: Date; type?: string } = {};
    if (startDate) filters.startDate = getZonedStartOfDayUtc(new Date(startDate as string));
    if (endDate)   filters.endDate   = getZonedEndOfDayUtc(new Date(endDate as string));
    if (type)      filters.type      = type as string;

    const expenses = await expenseRepo.findAll(filters);
    const totalExpenses = expenses.reduce((sum, exp) => sum + ((exp as Record<string, unknown>).amount as number), 0);
    res.status(200).json({ success: true, data: expenses, total: totalExpenses });
  } catch (error) {
    next(error);
  }
};

const updateExpense = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    if (!id || !mongoose.isValidObjectId(id)) {
      return next(createHttpError(400, "Invalid Expense ID format!"));
    }

    const { _id, __v, ...updates } = req.body;
    const expense = await expenseRepo.update(id, updates);
    if (!expense) return next(createHttpError(404, "Expense not found!"));
    res.status(200).json({ success: true, message: "Expense updated successfully!", data: expense });
  } catch (error) {
    next(error);
  }
};

const deleteExpense = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    if (!id || !mongoose.isValidObjectId(id)) {
      return next(createHttpError(400, "Invalid Expense ID format!"));
    }

    const expense = await expenseRepo.remove(id);
    if (!expense) return next(createHttpError(404, "Expense not found!"));
    res.status(200).json({ success: true, message: "Expense deleted successfully!", data: expense });
  } catch (error) {
    next(error);
  }
};

export { addExpense, getExpensesByPeriod, getAllExpenses, updateExpense, deleteExpense };
