import { Response, NextFunction } from "express";
import { CustomRequest as Request } from "../types";
// routes/expenseRoutes.js
import express from "express";
import { addExpense, getExpensesByPeriod, getAllExpenses, updateExpense, deleteExpense } from "../controllers/expenseController";
import { isVerifiedUser } from "../middlewares/tokenVerification"; // Your authentication middleware
const router = express.Router();

const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
    // In a real app, this should check for roles (e.g., admin, manager)
    req.user = { role: 'admin' };
    next();
};

router.route("/")
  .post(authMiddleware, addExpense) // Add a new expense
  .get(authMiddleware, getAllExpenses); // Get all expenses with optional filters

router.route("/:id")
  .put(authMiddleware, updateExpense) // Update expense by ID
  .delete(authMiddleware, deleteExpense); // Delete expense by ID

// Routes for period-wise summary (e.g., /api/expenses/day, /api/expenses/month)
router.route("/summary/:periodType")
  .get(authMiddleware, getExpensesByPeriod);

export default router;