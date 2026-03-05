import { Response, NextFunction } from "express";
import { CustomRequest as Request, IQueryOptions } from "../types";
import createHttpError from "http-errors";
import CustomerLedger from "../models/customerLedgerModel";
import mongoose from "mongoose";
import DailyEarning from "../models/dailyEarningModel";
import { getZonedStartOfDayUtc } from "./earningController";

const getCustomerLedger = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phone } = req.params;
    if (!phone) {
        const error = createHttpError(400, "Phone number is required.");
        return next(error);
    }
    const ledger = await CustomerLedger.findOne({ customerPhone: phone });

    if (!ledger) {
      const error = createHttpError(404, "Customer not found in ledger!");
      return next(error);
    }

    res.status(200).json({ success: true, data: ledger });
  } catch (error) {
    next(error);
  }
};

const recordCustomerPayment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phone } = req.params;
    const { amountPaid, orderId, notes } = req.body;

    if (!phone || amountPaid === undefined || amountPaid <= 0) {
      const error = createHttpError(400, "Phone and valid amountPaid are required.");
      return next(error);
    }
    if (orderId && !mongoose.Types.ObjectId.isValid(orderId)) {
        const error = createHttpError(400, "Invalid Order ID format.");
        return next(error);
    }

    const customerLedger = await CustomerLedger.findOneAndUpdate(
      { customerPhone: phone },
      {
        $inc: { balanceDue: -amountPaid },
        $set: { lastActivity: new Date() },
        $push: {
          transactions: {
            orderId: orderId || null,
            transactionType: "payment_received",
            amount: amountPaid,
            timestamp: new Date(),
            notes: notes || `Payment received for Order #${orderId ? orderId.toString().slice(-6) : 'N/A'}`,
          },
        },
      },
      { new: true, runValidators: true }
    );

    if (!customerLedger) {
      const error = createHttpError(404, "Customer not found in ledger to record payment!");
      return next(error);
    }

    const dateForEarningUpdate = getZonedStartOfDayUtc(new Date());
    try {
        await DailyEarning.findOneAndUpdate(
            { date: dateForEarningUpdate },
            {
                $inc: { totalEarnings: amountPaid },
                $setOnInsert: { date: dateForEarningUpdate, percentageChangeFromYesterday: 0 }
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
    } catch (earningUpdateError) {
        console.error("Error updating daily earnings during manual customer payment:", earningUpdateError);
    }

    res.status(200).json({ success: true, message: "Payment recorded successfully!", data: customerLedger });
  } catch (error) {
    next(error);
  }
};

const getAllCustomerLedgers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, phone, status } = req.query;

    let query: IQueryOptions = {};

    if (name) {
      const escapedName = (name as string).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.customerName = { $regex: escapedName, $options: "i" };
    }
    if (phone) {
      query.customerPhone = phone as string;
    }
    if (status === 'unpaid') {
      query.balanceDue = { $gt: 0 };
    } else if (status === 'paid') {
        query.balanceDue = 0;
    }

    const ledgers = await CustomerLedger.find(query).sort({ lastActivity: -1 });
    res.status(200).json({ success: true, data: ledgers });
  } catch (error) {
    next(error);
  }
};

export { getCustomerLedger, recordCustomerPayment, getAllCustomerLedgers };
