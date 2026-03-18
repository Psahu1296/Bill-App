import { addDays, addWeeks, addMonths, addYears } from "date-fns";
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

export const calculateAndSaveDailyEarnings = async (req: any, res: any = null, next: any = null) => {
  try {
    const targetDate = req.body?.date ? new Date(req.body.date) : subDays(new Date(), 1);
    const startOfTargetDay = getZonedStartOfDayUtc(targetDate);
    const endOfTargetDay   = getZonedEndOfDayUtc(targetDate);
    const formattedDate    = format(targetDate, "yyyy-MM-dd");

    const currentDayEarnings = earningRepo.sumPaidOrdersInRange(
      startOfTargetDay.toISOString(), endOfTargetDay.toISOString()
    );

    const previousDayRecord = earningRepo.findByDate(
      getZonedStartOfDayUtc(subDays(targetDate, 1)).toISOString()
    );
    const previousDayEarnings = previousDayRecord ? (previousDayRecord as Record<string,unknown>).totalEarnings as number : 0;

    const percentageChange = calculatePercentageChange(currentDayEarnings, previousDayEarnings);
    const record = earningRepo.upsert(startOfTargetDay.toISOString(), currentDayEarnings, percentageChange);

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

export const getDailyEarnings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const today     = new Date();
    const todayIso  = getZonedStartOfDayUtc(today).toISOString();
    const yesterIso = getZonedStartOfDayUtc(subDays(today, 1)).toISOString();

    const todayRecord = earningRepo.findByDate(todayIso) as Record<string,unknown> | null;
    const yesterRecord = earningRepo.findByDate(yesterIso) as Record<string,unknown> | null;

    const todayEarning     = todayRecord  ? todayRecord.totalEarnings  as number : 0;
    const yesterdayEarning = yesterRecord ? yesterRecord.totalEarnings as number : 0;
    const percentageChange = todayRecord
      ? todayRecord.percentageChangeFromYesterday as number
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
    const records  = earningRepo.findInRange(startDate.toISOString(), endIso) as Record<string,unknown>[];

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

export const getDashboardEarningsSummary = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const today = new Date();

    const sum = (start: Date, end: Date) =>
      earningRepo.sumInRange(start.toISOString(), end.toISOString());

    const currentDayTotal    = (earningRepo.findByDate(getZonedStartOfDayUtc(today).toISOString()) as Record<string,unknown> | null)?.totalEarnings as number ?? 0;
    const previousDayTotal   = (earningRepo.findByDate(getZonedStartOfDayUtc(subDays(today, 1)).toISOString()) as Record<string,unknown> | null)?.totalEarnings as number ?? 0;

    const currentWeekTotal   = sum(getZonedStartOfWeekUtc(today),         getZonedEndOfWeekUtc(today));
    const previousWeekTotal  = sum(getZonedStartOfWeekUtc(subWeeks(today, 1)),  getZonedEndOfWeekUtc(subWeeks(today, 1)));
    const currentMonthTotal  = sum(getZonedStartOfMonthUtc(today),        getZonedEndOfMonthUtc(today));
    const previousMonthTotal = sum(getZonedStartOfMonthUtc(subMonths(today, 1)), getZonedEndOfMonthUtc(subMonths(today, 1)));
    const currentYearTotal   = sum(getZonedStartOfYearUtc(today),         getZonedEndOfYearUtc(today));
    const previousYearTotal  = sum(getZonedStartOfYearUtc(subYears(today, 1)),  getZonedEndOfYearUtc(subYears(today, 1)));

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
