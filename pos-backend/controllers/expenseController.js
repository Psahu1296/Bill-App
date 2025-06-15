// controllers/expenseController.js
const createHttpError = require("http-errors");
const Expense = require("../models/expenseModel");
const { default: mongoose } = require("mongoose");
const { getZonedStartOfDayUtc, getZonedEndOfDayUtc, getZonedEndOfMonthUtc, getZonedStartOfMonthUtc, getZonedStartOfYearUtc, getZonedEndOfYearUtc } = require("./earningController");
const { format } = require("date-fns/format");



// @desc    Add a new expense
// @route   POST /api/expenses
// @access  Private (Admin)
const addExpense = async (req, res, next) => {
  try {
    console.log("APi hit ==>>")
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
const getExpensesByPeriod = async (req, res, next) => {
    const { periodType } = req.params; // 'day', 'month', 'year'
    const dateQuery = req.query.date ? new Date(req.query.date) : new Date(); // Date to query for (defaults to today)

    let startDate, endDate;
    let groupByFormat; // For aggregation formatting

    try {
        switch (periodType) {
            case 'day':
                startDate = getZonedStartOfDayUtc(dateQuery);
                endDate = getZonedEndOfDayUtc(dateQuery);
                groupByFormat = "%Y-%m-%d";
                break;
            case 'month':
                startDate = getZonedStartOfMonthUtc(dateQuery);
                endDate = getZonedEndOfMonthUtc(dateQuery);
                groupByFormat = "%Y-%m";
                break;
            case 'year':
                startDate = getZonedStartOfYearUtc(dateQuery);
                endDate = getZonedEndOfYearUtc(dateQuery);
                groupByFormat = "%Y";
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
const getAllExpenses = async (req, res, next) => {
    try {
        const { startDate, endDate, type } = req.query; // Filters
        let query = {};

        if (startDate) {
            query.expenseDate = { ...query.expenseDate, $gte: new Date(startDate) };
        }
        if (endDate) {
            query.expenseDate = { ...query.expenseDate, $lte: new Date(endDate) };
        }
        if (type) {
            query.type = type;
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
const updateExpense = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
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
const deleteExpense = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.isValidObjectId(id)) { // More robust check for ObjectId
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

module.exports = {
  addExpense,
  getExpensesByPeriod,
  getAllExpenses,
  updateExpense,
  deleteExpense,
};