import { Response, NextFunction } from "express";
import createHttpError from "http-errors";
import { addDays, format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { Order, Expense, Consumable } from "../models";
import { getZonedStartOfDayUtc, getZonedEndOfDayUtc } from "./earningController";
import { CustomRequest as Request } from "../types";

const TIMEZONE = "Asia/Kolkata";

function formatTimeIst(date: Date): string {
  const zoned = toZonedTime(date, TIMEZONE);
  const hours = zoned.getHours();
  const minutes = zoned.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  const h = hours % 12 || 12;
  const m = String(minutes).padStart(2, "0");
  return `${h}:${m} ${ampm} IST`;
}

function formatHourRangeIst(hour: number): string {
  const h1 = hour % 12 || 12;
  const ampm1 = hour >= 12 ? "PM" : "AM";
  const nextHour = hour + 1;
  const h2 = nextHour % 12 || 12;
  const ampm2 = nextHour >= 12 ? "PM" : "AM";
  return `${h1}:00 ${ampm1} – ${h2}:00 ${ampm2} IST`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildSummaryFromData(dateStr: string, orders: any[], expenses: any[], consumables: any[]) {
  const nonCancelled = orders.filter(o => o.orderStatus !== "Cancelled");
  const cancelledCount = orders.length - nonCancelled.length;

  const revenue = nonCancelled.reduce((sum, o) => sum + (o.amountPaid ?? 0), 0);
  const orderCount = nonCancelled.length;
  const avgOrderValue = orderCount > 0 ? Math.round(revenue / orderCount) : 0;

  // Payment split
  const paymentSplit: Record<string, number> = { cash: 0, upi: 0, card: 0, credit: 0 };
  for (const o of nonCancelled) {
    const method = (o.paymentMethod ?? "").toLowerCase();
    if (method === "cash") paymentSplit.cash++;
    else if (method === "upi") paymentSplit.upi++;
    else if (method === "card") paymentSplit.card++;
    else paymentSplit.credit++;
  }

  // Items aggregation
  const itemQtyMap = new Map<string, number>();
  const itemRevMap = new Map<string, number>();
  for (const o of nonCancelled) {
    for (const item of (o.items ?? [])) {
      const name = item.name ?? "Unknown";
      const qty = item.quantity ?? 0;
      const rev = (item.pricePerQuantity ?? 0) * qty;
      itemQtyMap.set(name, (itemQtyMap.get(name) ?? 0) + qty);
      itemRevMap.set(name, (itemRevMap.get(name) ?? 0) + rev);
    }
  }

  const topItemsByQty = [...itemQtyMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, quantity]) => ({ name, quantity }));

  const topItemsByRevenue = [...itemRevMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, revenue]) => ({ name, revenue: Math.round(revenue) }));

  // Peak hour + first order (in IST)
  const hourCounts = new Array(24).fill(0);
  let firstOrderTime: Date | null = null;
  for (const o of nonCancelled) {
    const d = new Date(o.orderDate);
    const zonedHour = toZonedTime(d, TIMEZONE).getHours();
    hourCounts[zonedHour]++;
    if (!firstOrderTime || d < firstOrderTime) firstOrderTime = d;
  }
  const maxCount = Math.max(...hourCounts);
  const peakHour = maxCount > 0 ? hourCounts.indexOf(maxCount) : -1;
  const peakHourIst = peakHour >= 0 ? formatHourRangeIst(peakHour) : null;
  const firstOrderTimeIst = firstOrderTime ? formatTimeIst(firstOrderTime) : null;

  // Expenses
  const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount ?? 0), 0);
  const expenseByType: Record<string, number> = {};
  for (const e of expenses) {
    const t = (e.type ?? "other").toLowerCase();
    expenseByType[t] = (expenseByType[t] ?? 0) + e.amount;
  }

  // Consumables (customer-facing only: tea, gutka, cigarette)
  const consumableSummary: Record<string, number> = { tea: 0, gutka: 0, cigarette: 0 };
  for (const c of consumables) {
    const t = c.type as string;
    if (t in consumableSummary) consumableSummary[t] += c.quantity ?? 0;
  }

  return {
    date: dateStr,
    revenue: Math.round(revenue),
    order_count: orderCount,
    cancelled_count: cancelledCount,
    payment_split: paymentSplit,
    top_items_by_qty: topItemsByQty,
    top_items_by_revenue: topItemsByRevenue,
    peak_hour_ist: peakHourIst,
    first_order_time_ist: firstOrderTimeIst,
    avg_order_value: avgOrderValue,
    expenses: { total: Math.round(totalExpenses), by_type: expenseByType },
    consumables: consumableSummary,
  };
}

export const getDailySummary = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const date = req.params.date as string;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return next(createHttpError(400, "Invalid date. Use YYYY-MM-DD."));
    }

    const anchor = new Date(date); // parses as UTC midnight — fine for IST anchoring
    const dayStart = getZonedStartOfDayUtc(anchor);
    const dayEnd = getZonedEndOfDayUtc(anchor);

    const [orders, expenses, consumables] = await Promise.all([
      Order.find({ orderDate: { $gte: dayStart, $lte: dayEnd } }).lean(),
      Expense.find({ expenseDate: { $gte: dayStart, $lte: dayEnd } }).lean(),
      Consumable.find({ timestamp: { $gte: dayStart, $lte: dayEnd }, consumerType: "customer" }).lean(),
    ]);

    const summary = buildSummaryFromData(date, orders, expenses, consumables);
    res.status(200).json({ success: true, data: summary });
  } catch (error) {
    next(error);
  }
};

export const getDailySummaryRange = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const from = req.query.from as string | undefined;
    const to   = req.query.to   as string | undefined;
    if (!from || !to) return next(createHttpError(400, "Both from and to query params are required."));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return next(createHttpError(400, "Invalid date format. Use YYYY-MM-DD."));
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);
    const diffDays = Math.round((toDate.getTime() - fromDate.getTime()) / 86400000);
    if (diffDays < 0) return next(createHttpError(400, "from must be before or equal to to."));
    if (diffDays > 90) return next(createHttpError(400, "Range cannot exceed 90 days."));

    const rangeStart = getZonedStartOfDayUtc(fromDate);
    const rangeEnd = getZonedEndOfDayUtc(toDate);

    // 3 queries for the entire range — partition in JS per day
    const [allOrders, allExpenses, allConsumables] = await Promise.all([
      Order.find({ orderDate: { $gte: rangeStart, $lte: rangeEnd } }).lean(),
      Expense.find({ expenseDate: { $gte: rangeStart, $lte: rangeEnd } }).lean(),
      Consumable.find({ timestamp: { $gte: rangeStart, $lte: rangeEnd }, consumerType: "customer" }).lean(),
    ]);

    const summaries = [];
    for (let i = 0; i <= diffDays; i++) {
      const dateStr = format(addDays(fromDate, i), "yyyy-MM-dd");
      const dayStart = getZonedStartOfDayUtc(new Date(dateStr));
      const dayEnd = getZonedEndOfDayUtc(new Date(dateStr));

      const orders = allOrders.filter(o => {
        const d = new Date(o.orderDate as Date);
        return d >= dayStart && d <= dayEnd;
      });
      const expenses = allExpenses.filter(e => {
        const d = new Date(e.expenseDate as Date);
        return d >= dayStart && d <= dayEnd;
      });
      const consumables = allConsumables.filter(c => {
        const d = new Date(c.timestamp as Date);
        return d >= dayStart && d <= dayEnd;
      });

      summaries.push(buildSummaryFromData(dateStr, orders, expenses, consumables));
    }

    res.status(200).json({ success: true, data: summaries });
  } catch (error) {
    next(error);
  }
};
