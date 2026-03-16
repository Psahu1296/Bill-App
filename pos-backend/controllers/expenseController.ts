import { Response, NextFunction } from "express";
// controllers/expenseController.js
import createHttpError from "http-errors";
import Expense from "../models/expenseModel";
import mongoose from "mongoose";
import { CustomRequest as Request, IQueryOptions } from "../types";
import { getZonedStartOfDayUtc, getZonedEndOfDayUtc, getZonedEndOfMonthUtc, getZonedStartOfMonthUtc, getZonedStartOfYearUtc, getZonedEndOfYearUtc } from "./earningController";
import { format } from "date-fns/format";



// @desc    Add a new expense
// @route   POST /api/expenses
// @access  Private (Admin)
const addExpense = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type, name, amount, description, expenseDate } = req.body;

    if (!type || !name || amount === undefined || amount === null || amount < 0) {
      const error = createHttpError(400, "Missing required expense fields (type, name, amount) or amount is invalid.");
      return next(error);
    }

    const expense = new Expense({
      type,
      name,
      amount,
      description,
      expenseDate: expenseDate ? new Date(expenseDate) : Date.now(), // Allow specifying date
    });

    await expense.save();
    res.status(201).json({ success: true, message: "Expense added successfully!", data: expense });
  } catch (error) {
    next(error);
  }
};

// @desc    Get expenses for a specific period (daily, monthly, yearly)
// @route   GET /api/expenses/:periodType
// @access  Private (Admin)
const getExpensesByPeriod = async (req: Request, res: Response, next: NextFunction) => {
    const { periodType } = req.params; // 'day', 'month', 'year'
    const dateQuery = (req.query).date ? new Date((req.query).date as string) : new Date(); // Date to query for (defaults to today)

    let startDate, endDate;
    let groupByFormat; // For aggregation formatting

    try {
        switch (periodType) {
            case 'day':
                startDate = getZonedStartOfDayUtc(dateQuery);
                endDate = getZonedEndOfDayUtc(dateQuery);
                groupByFormat = "%yyyy-%MM-%dd";
                break;
            case 'month':
                startDate = getZonedStartOfMonthUtc(dateQuery);
                endDate = getZonedEndOfMonthUtc(dateQuery);
                groupByFormat = "%yyyy-%MM";
                break;
            case 'year':
                startDate = getZonedStartOfYearUtc(dateQuery);
                endDate = getZonedEndOfYearUtc(dateQuery);
                groupByFormat = "%yyyy";
                break;
            default:
                const error = createHttpError(400, "Invalid periodType. Use 'day', 'month', or 'year'.");
                return next(error);
        }

        const expenses = await Expense.find({
            expenseDate: { $gte: startDate, $lte: endDate }
        }).sort({ expenseDate: 1 }); // Sort by date

        // Optionally, group by type for a summary
        const expensesSummary = await Expense.aggregate([
            {
                $match: {
                    expenseDate: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: "$type",
                    totalAmount: { $sum: "$amount" }
                }
            },
            {
                $project: {
                    _id: 0,
                    type: "$_id",
                    totalAmount: 1
                }
            }
        ]);

        const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);

        res.status(200).json({
            success: true,
            data: {
                period: format(startDate, groupByFormat.replace(/%/g, '')), // e.g., '2025-06-08'
                totalExpenses,
                details: expenses, // All expenses for the period
                summaryByType: expensesSummary, // Total by expense type
            }
        });

    } catch (error) {
        next(error);
    }
};

// @desc    Get all expenses (with optional filters)
// @route   GET /api/expenses
// @access  Private (Admin)
const getAllExpenses = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { startDate, endDate, type } = req.query; // Filters
        let query: IQueryOptions = {};

        if (startDate) {
            // Fix: Ensure startDate is treated as the beginning of the day
            const startOfDay = getZonedStartOfDayUtc(new Date(startDate as string));
            query.expenseDate = { ...(query.expenseDate || {}), $gte: startOfDay };
        }
        if (endDate) {
            // Fix: Ensure endDate is treated as the end of the day
            const endOfDay = getZonedEndOfDayUtc(new Date(endDate as string));
            query.expenseDate = { ...(query.expenseDate || {}), $lte: endOfDay };
        }
        if (type) {
            query.type = type as string;
        }

        const expenses = await Expense.find(query).sort({ expenseDate: -1 });
        const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);

        res.status(200).json({ success: true, data: expenses, total: totalExpenses });
    } catch (error) {
        next(error);
    }
};

// @desc    Update an expense by ID
// @route   PUT /api/expenses/:id
// @access  Private (Admin)
const updateExpense = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { _id, __v, ...updates } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id as string)) {
      const error = createHttpError(400, "Invalid Expense ID format!");
      return next(error);
    }

    const expense = await Expense.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!expense) {
      const error = createHttpError(404, "Expense not found!");
      return next(error);
    }

    res.status(200).json({ success: true, message: "Expense updated successfully!", data: expense });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete an expense by ID
// @route   DELETE /api/expenses/:id
// @access  Private (Admin)
const deleteExpense = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id as string)) { // More robust check for ObjectId
      const error = createHttpError(400, "Invalid Expense ID format!");
      return next(error);
    }

    const expense = await Expense.findByIdAndDelete(id);

    if (!expense) {
      const error = createHttpError(404, "Expense not found!");
      return next(error);
    }

    res.status(200).json({ success: true, message: "Expense deleted successfully!", data: expense });
  } catch (error) {
    next(error);
  }
};

export { 
  addExpense,
  getExpensesByPeriod,
  getAllExpenses,
  updateExpense,
  deleteExpense,
 };