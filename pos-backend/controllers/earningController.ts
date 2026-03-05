import { addDays, addWeeks, addMonths, addYears } from "date-fns";
import { Request, Response, NextFunction } from "express";
// controllers/earningController.js
import createHttpError from "http-errors";
import Order from "../models/orderModel"; // Import Order model
import DailyEarning from "../models/dailyEarningModel"; // NEW: Import DailyEarning model
import mongoose from "mongoose";
import {
  startOfDay,
  endOfDay,
  subDays,
  startOfWeek,
  endOfWeek,
  subWeeks,
  startOfMonth,
  endOfMonth,
  subMonths,
  startOfYear,
  endOfYear,
  subYears,
  format,
} from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz"; // For handling timezones

// --- Helper Functions for Date Ranges ---
// Using 'Asia/Kolkata' timezone for date calculations. Adjust as per your server/business needs.
const TIMEZONE = "Asia/Kolkata";

// Helper to get start/end of day/week/month/year in UTC based on a specific timezone's start/end
const getZonedStartOfDayUtc = (date: any) =>
  fromZonedTime(startOfDay(toZonedTime(date, TIMEZONE)), TIMEZONE);
const getZonedEndOfDayUtc = (date: any) =>
  fromZonedTime(endOfDay(toZonedTime(date, TIMEZONE)), TIMEZONE);
const getZonedStartOfWeekUtc = (date: any) =>
  fromZonedTime(
    startOfWeek(toZonedTime(date, TIMEZONE), { weekStartsOn: 1 }),
    TIMEZONE
  ); // Monday start
const getZonedEndOfWeekUtc = (date: any) =>
  fromZonedTime(
    endOfWeek(toZonedTime(date, TIMEZONE), { weekStartsOn: 1 }),
    TIMEZONE
  );
const getZonedStartOfMonthUtc = (date: any) =>
  fromZonedTime(startOfMonth(toZonedTime(date, TIMEZONE)), TIMEZONE);
const getZonedEndOfMonthUtc = (date: any) =>
  fromZonedTime(endOfMonth(toZonedTime(date, TIMEZONE)), TIMEZONE);
const getZonedStartOfYearUtc = (date: any) =>
  fromZonedTime(startOfYear(toZonedTime(date, TIMEZONE)), TIMEZONE);
const getZonedEndOfYearUtc = (date: any) =>
  fromZonedTime(endOfYear(toZonedTime(date, TIMEZONE)), TIMEZONE);

// --- Helper Function for Percentage Change ---
const calculatePercentageChange = (current: number, previous: number) => {
  if (previous === 0 && current === 0) return 0;
  if (previous === 0) return 100; // Infinite growth from zero
  return parseFloat((((current - previous) / previous) * 100).toString()).toFixed(2); // Return as string with 2 decimal places
};

// --- Core Aggregation Pipeline Stage ---
const paidOrdersMatchStage = {
  $match: {
    paymentStatus: "Paid",
  },
};

// --- Earning Controller Methods ---

// @desc    (INTERNAL/SCHEDULED) Calculates and saves/updates daily earnings for a given date
// @param   targetDate: Date object for which to calculate earnings (e.g., yesterday for a midnight job)
// @access  Internal/Private - Not typically exposed as a GET route for client.
const calculateAndSaveDailyEarnings = async (req: any, res: any = null, next: any = null) => {
  try {
    const targetDate =
      req.body && req.body.date
        ? new Date(req.body.date)
        : subDays(new Date(), 1); // Default to yesterday
    const startOfTargetDay = getZonedStartOfDayUtc(targetDate);
    const endOfTargetDay = getZonedEndOfDayUtc(targetDate);
    const formattedTargetDate = format(targetDate, "yyyy-MM-dd");

    // 1. Calculate today's (target day's) earnings from Orders
    const [todayOrderEarning] = await Order.aggregate([
      paidOrdersMatchStage,
      {
        $match: {
          orderDate: {
            $gte: startOfTargetDay,
            $lte: endOfTargetDay,
          },
        },
      },
      {
        $group: {
          _id: null, // Group all matching orders into one document
          totalEarnings: { $sum: "$bills.totalWithTax" },
        },
      },
      { $project: { _id: 0, totalEarnings: 1 } },
    ]);

    const currentDayEarnings = todayOrderEarning
      ? todayOrderEarning.totalEarnings
      : 0;

    // 2. Get yesterday's (previous day's) earnings from the DailyEarning collection
    const startOfPreviousDay = getZonedStartOfDayUtc(subDays(targetDate, 1));
    const previousDayEarningRecord = await DailyEarning.findOne({
      date: startOfPreviousDay,
    });
    const previousDayEarnings = previousDayEarningRecord
      ? previousDayEarningRecord.totalEarnings
      : 0;

    // 3. Calculate percentage change
    const percentageChange = calculatePercentageChange(
      currentDayEarnings,
      previousDayEarnings
    );

    // 4. Save/Update the DailyEarning record
    const dailyEarningRecord = await DailyEarning.findOneAndUpdate(
      { date: startOfTargetDay }, // Query by the start of the day
      {
        totalEarnings: currentDayEarnings,
        percentageChangeFromYesterday: percentageChange,
        date: startOfTargetDay, // Ensure date is explicitly set on insert/update
      },
      { upsert: true, new: true, setDefaultsOnInsert: true } // Upsert: insert if not found, update if found
    );

    console.log(
      `[Earning Calculation] Saved daily earnings for ${formattedTargetDate}: ${currentDayEarnings} (Change: ${percentageChange}%)`
    );

    // If called via HTTP route, send response
    if (res) {
      res.status(200).json({
        success: true,
        message: `Daily earnings calculated and saved for ${formattedTargetDate}`,
        data: dailyEarningRecord,
      });
    }
    return dailyEarningRecord; // Return for internal use (e.g., scheduled job)
  } catch (error) {
    console.error("[Earning Calculation Error]:", error);
    if (next) {
      next(error);
    } else if (res) {
      res
        .status(500)
        .json({
          success: false,
          message: "Failed to calculate and save daily earnings.",
        });
    }
    throw error; // Re-throw for scheduler to catch
  }
};

// @desc    Get day-wise earnings (from stored records)
// @route   GET /api/earnings/daywise
// @access  Private (e.g., Admin)
const getDailyEarnings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const today = new Date();
    const startOfToday = getZonedStartOfDayUtc(today);
    const startOfYesterday = getZonedStartOfDayUtc(subDays(today, 1));

    const todayEarningRecord = await DailyEarning.findOne({
      date: startOfToday,
    });
    const yesterdayEarningRecord = await DailyEarning.findOne({
      date: startOfYesterday,
    });

    const todayEarning = todayEarningRecord
      ? todayEarningRecord.totalEarnings
      : 0;
    const yesterdayEarning = yesterdayEarningRecord
      ? yesterdayEarningRecord.totalEarnings
      : 0;
    const percentageChange = todayEarningRecord
      ? todayEarningRecord.percentageChangeFromYesterday
      : calculatePercentageChange(todayEarning, yesterdayEarning);

    res.status(200).json({
      success: true,
      data: {
        todayEarning,
        yesterdayEarning,
        percentageChange: parseFloat(percentageChange as string), // Ensure it's a number for frontend
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get earnings for a specific period (from stored records)
// @param   periodType: 'day', 'week', 'month', 'year'
// @param   numPeriods: number of periods to go back
// @route   GET /api/earnings/:periodType
// @access  Private (e.g., Admin)
const getPeriodEarnings = async (req: Request, res: Response, next: NextFunction) => {
  const { periodType } = req.params;
  const numPeriods =
    parseInt(req.query.numPeriods as string) ||
    (periodType === "day"
      ? 7
      : periodType === "week"
      ? 4
      : periodType === "month"
      ? 12
      : 5); // Default periods

  try {
    const today = new Date();
    let startDate;
    let groupByFormat;
    let addPeriodFunction; // Function to iterate through periods

    switch (periodType) {
      case "day":
        startDate = getZonedStartOfDayUtc(subDays(today, numPeriods - 1));
        groupByFormat = "%Y-%m-%d";
        addPeriodFunction = (date: any, i: number) =>
          getZonedStartOfDayUtc(addDays(date, i));
        break;
      case "week":
        startDate = getZonedStartOfWeekUtc(subWeeks(today, numPeriods - 1));
        groupByFormat = "%Y-%W"; // ISO week number
        addPeriodFunction = (date: any, i: number) =>
          getZonedStartOfWeekUtc(addWeeks(date, i));
        break;
      case "month":
        startDate = getZonedStartOfMonthUtc(subMonths(today, numPeriods - 1));
        groupByFormat = "%Y-%m";
        addPeriodFunction = (date: any, i: number) =>
          getZonedStartOfMonthUtc(addMonths(date, i));
        break;
      case "year":
        startDate = getZonedStartOfYearUtc(subYears(today, numPeriods - 1));
        groupByFormat = "%Y";
        addPeriodFunction = (date: any, i: number) =>
          getZonedStartOfYearUtc(addYears(date, i));
        break;
      default:
        const error = createHttpError(
          400,
          "Invalid periodType. Use 'day', 'week', 'month', or 'year'."
        );
        return next(error);
    }

    // Make sure addDays, addWeeks, addMonths, addYears are imported
    

    // Fetch records from DailyEarning collection within the date range
    const earningsRecords = await DailyEarning.find({
      date: { $gte: startDate, $lte: getZonedStartOfDayUtc(today) }, // Fetch up to today's start
    }).sort({ date: 1 }); // Sort by date ascending

    // Format data to include periods with zero earnings if no record exists
    const formattedEarnings = [];
    for (let i = 0; i < numPeriods; i++) {
      const periodDate = addPeriodFunction(startDate, i);
      let periodKey;
      // Use format(periodDate, ...) for the display key, but match stored date for lookup
      if (periodType === "day") periodKey = format(periodDate, "yyyy-MM-dd");
      else if (periodType === "week") periodKey = format(periodDate, "yyyy-II");
      else if (periodType === "month")
        periodKey = format(periodDate, "yyyy-MM");
      else if (periodType === "year") periodKey = format(periodDate, "yyyy");

      const foundRecord = earningsRecords.find(
        (record) =>
          // Compare the stored Date object (which is start of day UTC)
          record.date.getTime() === getZonedStartOfDayUtc(periodDate).getTime()
      );

      formattedEarnings.push({
        period: periodKey,
        earnings: foundRecord ? foundRecord.totalEarnings : 0,
      });
    }

    res.status(200).json({ success: true, data: formattedEarnings });
  } catch (error) {
    next(error);
  }
};

const getDashboardEarningsSummary = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const today = new Date();

        // --- Daily Earnings ---
        const startOfToday = getZonedStartOfDayUtc(today);
        const startOfYesterday = getZonedStartOfDayUtc(subDays(today, 1));

        const todayEarningRecord = await DailyEarning.findOne({ date: startOfToday });
        const yesterdayEarningRecord = await DailyEarning.findOne({ date: startOfYesterday });

        const currentDayTotal = todayEarningRecord ? todayEarningRecord.totalEarnings : 0;
        const previousDayTotal = yesterdayEarningRecord ? yesterdayEarningRecord.totalEarnings : 0;
        const dailyPercentageChange = calculatePercentageChange(currentDayTotal, previousDayTotal);


        // --- Weekly Earnings (Current Week vs. Previous Week) ---
        const startOfCurrentWeek = getZonedStartOfWeekUtc(today);
        const endOfCurrentWeek = getZonedEndOfWeekUtc(today);
        const startOfPreviousWeek = getZonedStartOfWeekUtc(subWeeks(today, 1));
        const endOfPreviousWeek = getZonedEndOfWeekUtc(subWeeks(today, 1));

        const currentWeekEarnings = await DailyEarning.aggregate([
            { $match: { date: { $gte: startOfCurrentWeek, $lte: endOfCurrentWeek } } },
            { $group: { _id: null, total: { $sum: "$totalEarnings" } } }
        ]);
        const previousWeekEarnings = await DailyEarning.aggregate([
            { $match: { date: { $gte: startOfPreviousWeek, $lte: endOfPreviousWeek } } },
            { $group: { _id: null, total: { $sum: "$totalEarnings" } } }
        ]);

        const currentWeekTotal = currentWeekEarnings.length > 0 ? currentWeekEarnings[0].total : 0;
        const previousWeekTotal = previousWeekEarnings.length > 0 ? previousWeekEarnings[0].total : 0;
        const weeklyPercentageChange = calculatePercentageChange(currentWeekTotal, previousWeekTotal);


        // --- Monthly Earnings (Current Month vs. Previous Month) ---
        const startOfCurrentMonth = getZonedStartOfMonthUtc(today);
        const endOfCurrentMonth = getZonedEndOfMonthUtc(today);
        const startOfPreviousMonth = getZonedStartOfMonthUtc(subMonths(today, 1));
        const endOfPreviousMonth = getZonedEndOfMonthUtc(subMonths(today, 1));

        const currentMonthEarnings = await DailyEarning.aggregate([
            { $match: { date: { $gte: startOfCurrentMonth, $lte: endOfCurrentMonth } } },
            { $group: { _id: null, total: { $sum: "$totalEarnings" } } }
        ]);
        const previousMonthEarnings = await DailyEarning.aggregate([
            { $match: { date: { $gte: startOfPreviousMonth, $lte: endOfPreviousMonth } } },
            { $group: { _id: null, total: { $sum: "$totalEarnings" } } }
        ]);

        const currentMonthTotal = currentMonthEarnings.length > 0 ? currentMonthEarnings[0].total : 0;
        const previousMonthTotal = previousMonthEarnings.length > 0 ? previousMonthEarnings[0].total : 0;
        const monthlyPercentageChange = calculatePercentageChange(currentMonthTotal, previousMonthTotal);


        // --- Yearly Earnings (Current Year vs. Previous Year) ---
        const startOfCurrentYear = getZonedStartOfYearUtc(today);
        const endOfCurrentYear = getZonedEndOfYearUtc(today);
        const startOfPreviousYear = getZonedStartOfYearUtc(subYears(today, 1));
        const endOfPreviousYear = getZonedEndOfYearUtc(subYears(today, 1));

        const currentYearEarnings = await DailyEarning.aggregate([
            { $match: { date: { $gte: startOfCurrentYear, $lte: endOfCurrentYear } } },
            { $group: { _id: null, total: { $sum: "$totalEarnings" } } }
        ]);
        const previousYearEarnings = await DailyEarning.aggregate([
            { $match: { date: { $gte: startOfPreviousYear, $lte: endOfPreviousYear } } },
            { $group: { _id: null, total: { $sum: "$totalEarnings" } } }
        ]);

        const currentYearTotal = currentYearEarnings.length > 0 ? currentYearEarnings[0].total : 0;
        const previousYearTotal = previousYearEarnings.length > 0 ? previousYearEarnings[0].total : 0;
        const yearlyPercentageChange = calculatePercentageChange(currentYearTotal, previousYearTotal);

        res.status(200).json({
            success: true,
            data: {
                daily: {
                    total: currentDayTotal,
                    percentageChange: parseFloat(dailyPercentageChange as string)
                },
                weekly: {
                    total: currentWeekTotal,
                    percentageChange: parseFloat(weeklyPercentageChange as string)
                },
                monthly: {
                    total: currentMonthTotal,
                    percentageChange: parseFloat(monthlyPercentageChange as string)
                },
                yearly: {
                    total: currentYearTotal,
                    percentageChange: parseFloat(yearlyPercentageChange as string)
                }
            }
        });

    } catch (error) {
        next(error);
    }
};

export { 
  getDailyEarnings,
  getPeriodEarnings,
  calculateAndSaveDailyEarnings,
  getZonedStartOfDayUtc,
  getZonedEndOfDayUtc,
  getZonedEndOfWeekUtc,
  getZonedEndOfYearUtc,
  getZonedEndOfMonthUtc,
  getZonedStartOfWeekUtc,
  getZonedStartOfYearUtc,
  getZonedStartOfMonthUtc,
  getDashboardEarningsSummary
 };
