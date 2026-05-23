import { addDays, addWeeks, addMonths, addYears, getDaysInMonth } from "date-fns";
import { Request, Response, NextFunction } from "express";
import createHttpError from "http-errors";
import * as earningRepo from "../repositories/earningRepo";
import {
  startOfDay, endOfDay, subDays,
  startOfWeek, endOfWeek, subWeeks,
  startOfMonth, endOfMonth, subMonths,
  startOfYear, endOfYear, subYears,
  format,
} from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import { Order, Expense } from "../models";

const TIMEZONE = "Asia/Kolkata";

export const getZonedStartOfDayUtc   = (date: Date) => fromZonedTime(startOfDay(toZonedTime(date, TIMEZONE)), TIMEZONE);
export const getZonedEndOfDayUtc     = (date: Date) => fromZonedTime(endOfDay(toZonedTime(date, TIMEZONE)), TIMEZONE);
export const getZonedStartOfWeekUtc  = (date: Date) => fromZonedTime(startOfWeek(toZonedTime(date, TIMEZONE), { weekStartsOn: 1 }), TIMEZONE);
export const getZonedEndOfWeekUtc    = (date: Date) => fromZonedTime(endOfWeek(toZonedTime(date, TIMEZONE), { weekStartsOn: 1 }), TIMEZONE);
export const getZonedStartOfMonthUtc = (date: Date) => fromZonedTime(startOfMonth(toZonedTime(date, TIMEZONE)), TIMEZONE);
export const getZonedEndOfMonthUtc   = (date: Date) => fromZonedTime(endOfMonth(toZonedTime(date, TIMEZONE)), TIMEZONE);
export const getZonedStartOfYearUtc  = (date: Date) => fromZonedTime(startOfYear(toZonedTime(date, TIMEZONE)), TIMEZONE);
export const getZonedEndOfYearUtc    = (date: Date) => fromZonedTime(endOfYear(toZonedTime(date, TIMEZONE)), TIMEZONE);

const calculatePercentageChange = (current: number, previous: number): number => {
  if (previous === 0 && current === 0) return 0;
  if (previous === 0) return 100;
  return parseFloat((((current - previous) / previous) * 100).toFixed(2));
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const calculateAndSaveDailyEarnings = async (req: any, res: any = null, next: any = null) => {
  try {
    const targetDate = req.body?.date ? new Date(req.body.date) : subDays(new Date(), 1);
    const startOfTargetDay = getZonedStartOfDayUtc(targetDate);
    const endOfTargetDay   = getZonedEndOfDayUtc(targetDate);
    const formattedDate    = format(targetDate, "yyyy-MM-dd");

    const currentDayEarnings = await earningRepo.sumPaidOrdersInRange(
      startOfTargetDay.toISOString(), endOfTargetDay.toISOString()
    );

    const previousDayRecord = await earningRepo.findByDate(
      getZonedStartOfDayUtc(subDays(targetDate, 1)).toISOString()
    );
    const previousDayEarnings = previousDayRecord ? (previousDayRecord as Record<string, unknown>).totalEarnings as number : 0;

    const percentageChange = calculatePercentageChange(currentDayEarnings, previousDayEarnings);
    const record = await earningRepo.upsert(startOfTargetDay.toISOString(), currentDayEarnings, percentageChange);

    console.log(`[Earning Calculation] Saved for ${formattedDate}: ${currentDayEarnings} (Change: ${percentageChange}%)`);

    if (res) {
      res.status(200).json({ success: true, message: `Daily earnings calculated for ${formattedDate}`, data: record });
    }
    return record;
  } catch (error) {
    console.error("[Earning Calculation Error]:", error);
    if (next) next(error);
    else if (res) res.status(500).json({ success: false, message: "Failed to calculate daily earnings." });
    throw error;
  }
};

export const getDailyEarnings = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const today     = new Date();
    const todayIso  = getZonedStartOfDayUtc(today).toISOString();
    const yesterIso = getZonedStartOfDayUtc(subDays(today, 1)).toISOString();

    const [todayRecord, yesterRecord] = await Promise.all([
      earningRepo.findByDate(todayIso),
      earningRepo.findByDate(yesterIso),
    ]);

    const todayEarning     = todayRecord  ? (todayRecord  as Record<string, unknown>).totalEarnings  as number : 0;
    const yesterdayEarning = yesterRecord ? (yesterRecord as Record<string, unknown>).totalEarnings as number : 0;
    const percentageChange = todayRecord
      ? (todayRecord as Record<string, unknown>).percentageChangeFromYesterday as number
      : calculatePercentageChange(todayEarning, yesterdayEarning);

    res.status(200).json({ success: true, data: { todayEarning, yesterdayEarning, percentageChange } });
  } catch (error) {
    next(error);
  }
};

export const getPeriodEarnings = async (req: Request, res: Response, next: NextFunction) => {
  const { periodType } = req.params;
  const numPeriods = parseInt(req.query.numPeriods as string) ||
    (periodType === "day" ? 7 : periodType === "week" ? 4 : periodType === "month" ? 12 : 5);

  try {
    const today = new Date();
    let startDate: Date;
    let groupByFormat: string;
    let addPeriodFn: (date: Date, i: number) => Date;

    switch (periodType) {
      case "day":
        startDate = getZonedStartOfDayUtc(subDays(today, numPeriods - 1));
        groupByFormat = "yyyy-MM-dd";
        addPeriodFn = (d, i) => getZonedStartOfDayUtc(addDays(d, i));
        break;
      case "week":
        startDate = getZonedStartOfWeekUtc(subWeeks(today, numPeriods - 1));
        groupByFormat = "yyyy-II";
        addPeriodFn = (d, i) => getZonedStartOfWeekUtc(addWeeks(d, i));
        break;
      case "month":
        startDate = getZonedStartOfMonthUtc(subMonths(today, numPeriods - 1));
        groupByFormat = "yyyy-MM";
        addPeriodFn = (d, i) => getZonedStartOfMonthUtc(addMonths(d, i));
        break;
      case "year":
        startDate = getZonedStartOfYearUtc(subYears(today, numPeriods - 1));
        groupByFormat = "yyyy";
        addPeriodFn = (d, i) => getZonedStartOfYearUtc(addYears(d, i));
        break;
      default:
        return next(createHttpError(400, "Invalid periodType. Use 'day', 'week', 'month', or 'year'."));
    }

    const endIso   = getZonedStartOfDayUtc(today).toISOString();
    const records  = await earningRepo.findInRange(startDate.toISOString(), endIso) as Record<string, unknown>[];

    const formattedEarnings = [];
    for (let i = 0; i < numPeriods; i++) {
      const periodDate = addPeriodFn(startDate, i);
      const periodKey  = format(periodDate, groupByFormat);
      const found = records.find(r => {
        const rDate = new Date(r.date as string);
        return rDate.getTime() === getZonedStartOfDayUtc(periodDate).getTime();
      });
      formattedEarnings.push({ period: periodKey, earnings: found ? found.totalEarnings as number : 0 });
    }

    res.status(200).json({ success: true, data: formattedEarnings });
  } catch (error) {
    next(error);
  }
};

export const getDashboardEarningsSummary = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const today = new Date();

    const sum = (start: Date, end: Date) =>
      earningRepo.sumInRange(start.toISOString(), end.toISOString());

    const [
      todayRecord, previousDayRecord,
      currentWeekTotal, previousWeekTotal,
      currentMonthTotal, previousMonthTotal,
      currentYearTotal, previousYearTotal,
    ] = await Promise.all([
      earningRepo.findByDate(getZonedStartOfDayUtc(today).toISOString()),
      earningRepo.findByDate(getZonedStartOfDayUtc(subDays(today, 1)).toISOString()),
      sum(getZonedStartOfWeekUtc(today),          getZonedEndOfWeekUtc(today)),
      sum(getZonedStartOfWeekUtc(subWeeks(today, 1)),  getZonedEndOfWeekUtc(subWeeks(today, 1))),
      sum(getZonedStartOfMonthUtc(today),         getZonedEndOfMonthUtc(today)),
      sum(getZonedStartOfMonthUtc(subMonths(today, 1)), getZonedEndOfMonthUtc(subMonths(today, 1))),
      sum(getZonedStartOfYearUtc(today),          getZonedEndOfYearUtc(today)),
      sum(getZonedStartOfYearUtc(subYears(today, 1)),  getZonedEndOfYearUtc(subYears(today, 1))),
    ]);

    const currentDayTotal  = (todayRecord  as Record<string, unknown> | null)?.totalEarnings  as number ?? 0;
    const previousDayTotal = (previousDayRecord as Record<string, unknown> | null)?.totalEarnings as number ?? 0;

    res.status(200).json({
      success: true,
      data: {
        daily:   { total: currentDayTotal,   percentageChange: calculatePercentageChange(currentDayTotal,   previousDayTotal)   },
        weekly:  { total: currentWeekTotal,  percentageChange: calculatePercentageChange(currentWeekTotal,  previousWeekTotal)  },
        monthly: { total: currentMonthTotal, percentageChange: calculatePercentageChange(currentMonthTotal, previousMonthTotal) },
        yearly:  { total: currentYearTotal,  percentageChange: calculatePercentageChange(currentYearTotal,  previousYearTotal)  },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getEarningsRange = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { from, to } = req.query as { from?: string; to?: string };
    if (!from || !to) return next(createHttpError(400, "Both from and to query params are required."));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return next(createHttpError(400, "Invalid date format. Use YYYY-MM-DD."));
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);
    const diffDays = Math.round((toDate.getTime() - fromDate.getTime()) / 86400000);
    if (diffDays < 0) return next(createHttpError(400, "from must be before or equal to to."));

    const startIso = getZonedStartOfDayUtc(fromDate).toISOString();
    const endIso   = getZonedStartOfDayUtc(toDate).toISOString();

    const records = await earningRepo.findInRange(startIso, endIso) as Record<string, unknown>[];

    // Build lookup: IST date string → revenue
    const revenueMap = new Map<string, number>();
    for (const r of records) {
      const dateKey = format(toZonedTime(new Date(r.date as string), TIMEZONE), "yyyy-MM-dd");
      revenueMap.set(dateKey, r.totalEarnings as number);
    }

    // Zero-fill every date in the range
    const result: { date: string; revenue: number }[] = [];
    for (let i = 0; i <= diffDays; i++) {
      const dateStr = format(addDays(fromDate, i), "yyyy-MM-dd");
      result.push({ date: dateStr, revenue: revenueMap.get(dateStr) ?? 0 });
    }

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const getChartData = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const period = (req.query.period as string) || "day";
    const now = new Date();
    const zonedNow = toZonedTime(now, TIMEZONE);

    type Bucket = { start: Date; end: Date };
    let labels: string[];
    let buckets: Bucket[];

    const zonedToUtc = (d: Date) => fromZonedTime(d, TIMEZONE);

    switch (period) {
      case "day": {
        const dayStart = startOfDay(zonedNow);
        labels = Array.from({ length: 24 }, (_, i) => {
          const h = i % 12 || 12;
          return `${h}${i < 12 ? "am" : "pm"}`;
        });
        buckets = Array.from({ length: 24 }, (_, i) => ({
          start: zonedToUtc(new Date(dayStart.getFullYear(), dayStart.getMonth(), dayStart.getDate(), i, 0, 0, 0)),
          end:   zonedToUtc(new Date(dayStart.getFullYear(), dayStart.getMonth(), dayStart.getDate(), i, 59, 59, 999)),
        }));
        break;
      }
      case "week": {
        const weekStart = startOfWeek(zonedNow, { weekStartsOn: 1 });
        labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
        buckets = Array.from({ length: 7 }, (_, i) => {
          const day = addDays(weekStart, i);
          return { start: zonedToUtc(startOfDay(day)), end: zonedToUtc(endOfDay(day)) };
        });
        break;
      }
      case "month": {
        const monthStart = startOfMonth(zonedNow);
        const days = getDaysInMonth(zonedNow);
        labels = Array.from({ length: days }, (_, i) => String(i + 1));
        buckets = Array.from({ length: days }, (_, i) => {
          const day = addDays(monthStart, i);
          return { start: zonedToUtc(startOfDay(day)), end: zonedToUtc(endOfDay(day)) };
        });
        break;
      }
      case "year": {
        const yearStart = startOfYear(zonedNow);
        labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        buckets = Array.from({ length: 12 }, (_, i) => {
          const month = addMonths(yearStart, i);
          return { start: zonedToUtc(startOfMonth(month)), end: zonedToUtc(endOfMonth(month)) };
        });
        break;
      }
      default:
        return next(createHttpError(400, "Invalid period. Use day, week, month, or year."));
    }

    const rangeStart = buckets[0].start;
    const rangeEnd   = buckets[buckets.length - 1].end;

    const [incomeRaw, expenseRaw, orderRaw] = await Promise.all([
      Order.find(
        { paymentStatus: "Paid", orderDate: { $gte: rangeStart, $lte: rangeEnd } },
        { orderDate: 1, "bills.totalWithTax": 1 }
      ).lean(),
      Expense.find(
        { expenseDate: { $gte: rangeStart, $lte: rangeEnd } },
        { expenseDate: 1, amount: 1 }
      ).lean(),
      Order.find(
        { orderDate: { $gte: rangeStart, $lte: rangeEnd }, orderStatus: { $ne: "Cancelled" } },
        { orderDate: 1 }
      ).lean(),
    ]);

    const bucket = <T extends { date: Date }>(rows: T[], getDate: (r: T) => Date) =>
      buckets.map(({ start, end }) =>
        rows.filter(r => { const d = getDate(r); return d >= start && d <= end; })
      );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const incomeBuckets  = bucket(incomeRaw  as any[], r => new Date((r as any).orderDate));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const expenseBuckets = bucket(expenseRaw as any[], r => new Date((r as any).expenseDate));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const orderBuckets   = bucket(orderRaw   as any[], r => new Date((r as any).orderDate));

    res.status(200).json({
      success: true,
      data: {
        labels,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        income:   incomeBuckets.map(b  => Math.round(b.reduce((s, r) => s + ((r as any).bills?.totalWithTax ?? 0), 0))),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expenses: expenseBuckets.map(b => Math.round(b.reduce((s, r) => s + ((r as any).amount ?? 0), 0))),
        orders:   orderBuckets.map(b   => b.length),
      },
    });
  } catch (error) {
    next(error);
  }
};
