// routes/expenseRoutes.js
import express from "express";
import { addExpense, getExpensesByPeriod, getAllExpenses, updateExpense, deleteExpense } from "../controllers/expenseController";
import { isVerifiedUser } from "../middlewares/tokenVerification"; // Your authentication middleware
const router = express.Router();

// Routes for period-wise summary must be before /:id to avoid being caught by the dynamic segment
router.route("/summary/:periodType")
  .get(isVerifiedUser, getExpensesByPeriod);

router.route("/")
  .post(isVerifiedUser, addExpense)
  .get(isVerifiedUser, getAllExpenses);

router.route("/:id")
  .put(isVerifiedUser, updateExpense)
  .delete(isVerifiedUser, deleteExpense);

export default router;