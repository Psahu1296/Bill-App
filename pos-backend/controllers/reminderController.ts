import { Request, Response } from "express";
import { startOfDay, endOfDay, subDays } from "date-fns";
import { Expense, Staff, CustomerLedger } from "../models";
import { notifEmitter, ReminderItem } from "../utils/notificationEmitter";

/**
 * Computes which reminders are active right now.
 * Checks today AND yesterday — so an owner who forgot to log yesterday still sees it.
 */
export async function computeReminders(): Promise<ReminderItem[]> {
  const reminders: ReminderItem[] = [];
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const yesterday = subDays(today, 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  // ── 1. Expense reminder ────────────────────────────────────────────────────
  const [todayExpense, yesterdayExpense] = await Promise.all([
    Expense.countDocuments({
      expenseDate: { $gte: startOfDay(today), $lte: endOfDay(today) },
    }),
    Expense.countDocuments({
      expenseDate: { $gte: startOfDay(yesterday), $lte: endOfDay(yesterday) },
    }),
  ]);

  if (todayExpense === 0) {
    reminders.push({
      type: "expense_reminder",
      message: "No expenses logged for today",
      date: todayStr,
    });
  }
  if (yesterdayExpense === 0) {
    reminders.push({
      type: "expense_reminder",
      message: "No expenses logged for yesterday",
      date: yesterdayStr,
    });
  }

  // ── 2. Labor payment reminder ──────────────────────────────────────────────
  const activeStaffCount = await Staff.countDocuments({ isActive: true });

  if (activeStaffCount > 0) {
    const staffWithTodayPayment = await Staff.countDocuments({
      isActive: true,
      "payments.date": { $gte: startOfDay(today), $lte: endOfDay(today) },
    });
    const staffWithYesterdayPayment = await Staff.countDocuments({
      isActive: true,
      "payments.date": { $gte: startOfDay(yesterday), $lte: endOfDay(yesterday) },
    });

    if (staffWithTodayPayment === 0) {
      reminders.push({
        type: "labor_reminder",
        message: `No staff payment logged for today (${activeStaffCount} active staff)`,
        date: todayStr,
      });
    }
    if (staffWithYesterdayPayment === 0) {
      reminders.push({
        type: "labor_reminder",
        message: `No staff payment logged for yesterday (${activeStaffCount} active staff)`,
        date: yesterdayStr,
      });
    }
  }

  // ── 3. Pending customer credit reminder ────────────────────────────────────
  const creditAgg = await CustomerLedger.aggregate([
    { $match: { balanceDue: { $gt: 0 } } },
    { $group: { _id: null, count: { $sum: 1 }, totalAmount: { $sum: "$balanceDue" } } },
  ]);

  if (creditAgg.length > 0 && creditAgg[0].count > 0) {
    reminders.push({
      type: "credit_reminder",
      message: `${creditAgg[0].count} customer(s) have pending credit`,
      date: todayStr,
      count: creditAgg[0].count,
      totalAmount: Math.round(creditAgg[0].totalAmount),
    });
  }

  return reminders;
}

// ── GET /api/reminders/check ─────────────────────────────────────────────────
export async function checkReminders(req: Request, res: Response) {
  try {
    const reminders = await computeReminders();
    res.json({ success: true, reminders });
  } catch (err) {
    console.error("[Reminders] checkReminders failed:", err);
    res.status(500).json({ success: false, message: "Failed to fetch reminders" });
  }
}

// ── Called by cron jobs to push reminders over SSE ───────────────────────────
export async function sendScheduledReminders() {
  try {
    const reminders = await computeReminders();
    if (reminders.length === 0) return;
    notifEmitter.emit("admin", { type: "reminders", reminders });
    console.log(`[Reminders] Pushed ${reminders.length} reminder(s) via SSE`);
  } catch (err) {
    console.error("[Reminders] sendScheduledReminders failed:", err);
  }
}
