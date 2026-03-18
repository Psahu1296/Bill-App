import { Response, NextFunction } from "express";
import createHttpError from "http-errors";
import * as expenseRepo from "../repositories/expenseRepo";
import { CustomRequest as Request } from "../types";
import {
  getZonedStartOfDayUtc, getZonedEndOfDayUtc,
  getZonedStartOfMonthUtc, getZonedEndOfMonthUtc,
  getZonedStartOfYearUtc, getZonedEndOfYearUtc,
} from "./earningController";
import { format } from "date-fns/format";

const addExpense = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type, name, amount, description, expenseDate } = req.body;

    if (!type || !name || amount === undefined || amount === null || amount < 0) {
      return next(createHttpError(400, "Missing required expense fields (type, name, amount) or amount is invalid."));
    }

    const expense = expenseRepo.create({
      type, name, amount,
      description,
      expenseDate: expenseDate ? new Date(expenseDate).toISOString() : new Date().toISOString(),
    });
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

    const expenses = expenseRepo.findAll({ startDate, endDate });
    const expensesSummary = expenseRepo.aggregateByType(startDate, endDate)
      .map(r => ({ type: r.type, totalAmount: r.totalAmount }));

    const totalExpenses = expenses.reduce((sum, exp) => sum + ((exp as Record<string,unknown>).amount as number), 0);

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

    const expenses = expenseRepo.findAll(filters);
    const totalExpenses = expenses.reduce((sum, exp) => sum + ((exp as Record<string,unknown>).amount as number), 0);
    res.status(200).json({ success: true, data: expenses, total: totalExpenses });
  } catch (error) {
    next(error);
  }
};

const updateExpense = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    if (!id || isNaN(Number(id))) {
      return next(createHttpError(400, "Invalid Expense ID format!"));
    }

    const { _id, __v, ...updates } = req.body;
    const expense = expenseRepo.update(id, updates);
    if (!expense) return next(createHttpError(404, "Expense not found!"));
    res.status(200).json({ success: true, message: "Expense updated successfully!", data: expense });
  } catch (error) {
    next(error);
  }
};

const deleteExpense = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    if (!id || isNaN(Number(id))) {
      return next(createHttpError(400, "Invalid Expense ID format!"));
    }

    const expense = expenseRepo.remove(id);
    if (!expense) return next(createHttpError(404, "Expense not found!"));
    res.status(200).json({ success: true, message: "Expense deleted successfully!", data: expense });
  } catch (error) {
    next(error);
  }
};

export { addExpense, getExpensesByPeriod, getAllExpenses, updateExpense, deleteExpense };
