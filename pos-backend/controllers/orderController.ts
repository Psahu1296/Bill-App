import { Response, NextFunction } from "express";
import createHttpError from "http-errors";
import Order from "../models/orderModel";
import DailyEarning from "../models/dailyEarningModel";
import Table from "../models/tableModel";
import mongoose from "mongoose";
import { getZonedStartOfDayUtc } from "./earningController";
import { CustomRequest as Request, IQueryOptions } from "../types";
import CustomerLedger from "../models/customerLedgerModel";

const addOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { _id, amountPaid = 0, ...orderData } = req.body;

    const tableId = orderData.table;
    if (!mongoose.Types.ObjectId.isValid(tableId)) {
        const error = createHttpError(400, "Invalid Table ID in order data!");
        return next(error);
    }
    const table = await Table.findById(tableId);
    if (!table) {
        const error = createHttpError(404, "Table not found for order!");
        return next(error);
    }

    const totalBill = orderData.bills?.totalWithTax;
    const balanceDueOnOrder = totalBill - amountPaid;

    if (_id) {
        if (!mongoose.Types.ObjectId.isValid(_id)) {
            const error = createHttpError(400, "Invalid Order ID format in body for update!");
            return next(error);
        }
        const updatedOrder = await Order.findByIdAndUpdate(
            _id,
            {
                $set: {
                    ...orderData,
                    amountPaid: amountPaid,
                    balanceDueOnOrder: balanceDueOnOrder > 0 ? balanceDueOnOrder : 0,
                }
            },
            { new: true, runValidators: true }
        );
        if (!updatedOrder) {
            const error = createHttpError(404, "Order not found for update!");
            return next(error);
        }
        return res.status(200).json({ success: true, message: "Order updated!", data: updatedOrder });
    }

    // Create a new order
    const newOrder = new Order({
        ...orderData,
        amountPaid: amountPaid,
        balanceDueOnOrder: balanceDueOnOrder > 0 ? balanceDueOnOrder : 0,
    });
    await newOrder.save();

    await Table.findByIdAndUpdate(
        tableId,
        { $set: { status: 'Booked', currentOrderId: newOrder._id } },
        { new: true, runValidators: true }
    );

    // Ledger: only record if there is an outstanding balance
    const customerPhone = newOrder.customerDetails?.phone;
    const customerName = newOrder.customerDetails?.name;
    const amountOwing = newOrder.balanceDueOnOrder;

    if (amountOwing > 0) {
        await CustomerLedger.findOneAndUpdate(
            { customerPhone: customerPhone },
            {
                $inc: { balanceDue: amountOwing },
                $set: { customerName: customerName, lastActivity: new Date() },
                $push: {
                    transactions: {
                        orderId: newOrder._id,
                        transactionType: "full_payment_due",
                        amount: totalBill,
                        notes: `Bill for Order #${newOrder._id.toString().slice(-6)}`,
                    }
                }
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
    }

    // Earnings: only count amountPaid at creation (not the full bill, which isn't fully paid yet).
    // The remaining balance will be counted when paymentStatus is updated to "Paid".
    if (amountPaid > 0) {
        const dateForEarningUpdate = getZonedStartOfDayUtc(newOrder.orderDate);
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
            console.error("Error updating daily earnings during new order creation:", earningUpdateError);
        }
    }

    res.status(201).json({ success: true, message: "Order created!", data: newOrder });
  } catch (error) {
    next(error);
  }
};

const getOrderById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id as string)) {
      const error = createHttpError(400, "Invalid id!");
      return next(error);
    }

    const order = await Order.findById(id);
    if (!order) {
      const error = createHttpError(404, "Order not found!");
      return next(error);
    }

    res.status(200).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};

const getOrders = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate, tableId, customerPhone, orderStatus, paymentStatus } = req.query;

    let query: IQueryOptions = {};

    if (startDate) {
      const start = new Date(startDate as string);
      start.setUTCHours(0, 0, 0, 0);
      query.orderDate = { ...query.orderDate, $gte: start };
    }
    if (endDate) {
      const end = new Date(endDate as string);
      end.setUTCHours(23, 59, 59, 999);
      query.orderDate = { ...query.orderDate, $lte: end };
    }
    if (tableId && mongoose.Types.ObjectId.isValid(tableId as string)) {
        query.table = tableId as string;
    }
    if (customerPhone) {
        query["customerDetails.phone"] = customerPhone as string;
    }
    if (orderStatus) {
        query.orderStatus = orderStatus as string;
    }
    if (paymentStatus) {
        query.paymentStatus = paymentStatus as string;
    }

    const orders = await Order.find(query).populate("table").sort({ orderDate: -1 });
    res.status(200).json({ success: true, data: orders });
  } catch (error) {
    next(error);
  }
};

const updateOrderById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const requestBodyUpdates = { ...req.body };

    // Strip _id and id from the body to prevent accidental overwrites
    delete requestBodyUpdates._id;
    delete requestBodyUpdates.id;

    if (!mongoose.Types.ObjectId.isValid(id as string)) {
      const error = createHttpError(400, "Invalid Order ID format!");
      return next(error);
    }

    const currentOrder = await Order.findById(id);
    if (!currentOrder) {
      const error = createHttpError(404, "Order not found!");
      return next(error);
    }

    const orderTotalWithTax = (currentOrder.bills?.totalWithTax || 0);
    const orderCreationDate = currentOrder.orderDate;
    const oldPaymentStatus = currentOrder.paymentStatus;
    const oldAmountPaid = currentOrder.amountPaid;

    // Build Mongoose update payload
    const updatePayloadForMongoose = { ...requestBodyUpdates };

    if (requestBodyUpdates.amountPaid !== undefined) {
        const newAmountPaid = requestBodyUpdates.amountPaid;
        updatePayloadForMongoose.amountPaid = newAmountPaid;
        updatePayloadForMongoose.balanceDueOnOrder = Math.max(0, orderTotalWithTax - newAmountPaid);
    }

    // --- Determine Earning Change ---
    // Fix: when changing to Paid, only count the portion NOT already counted at order creation.
    let amountChangeForEarnings = 0;
    const dateForEarningUpdate = getZonedStartOfDayUtc(orderCreationDate);

    if (requestBodyUpdates.paymentStatus === 'Paid' && oldPaymentStatus !== 'Paid') {
        // Only add what hasn't been counted yet (full bill minus already-paid amount at creation)
        amountChangeForEarnings = orderTotalWithTax - oldAmountPaid;
    } else if (
        (requestBodyUpdates.paymentStatus === 'Refunded' || requestBodyUpdates.paymentStatus === 'Pending') &&
        oldPaymentStatus === 'Paid'
    ) {
        // Reverse the full bill amount that was counted when status changed to Paid
        amountChangeForEarnings = -(orderTotalWithTax - oldAmountPaid);
    }

    const updatedOrder = await Order.findByIdAndUpdate(
      id,
      { $set: updatePayloadForMongoose },
      { new: true, runValidators: true }
    );

    if (!updatedOrder) {
      const error = createHttpError(404, "Order not found after attempted update!");
      return next(error);
    }

    // --- Ledger Update ---
    const oldBalanceDueOnThisOrder = Math.max(0, orderTotalWithTax - oldAmountPaid);
    const newBalanceDueOnThisOrder = updatedOrder.balanceDueOnOrder;
    const netBalanceChangeForCustomer = newBalanceDueOnThisOrder - oldBalanceDueOnThisOrder;

    if (netBalanceChangeForCustomer !== 0) {
        const customerPhone = updatedOrder.customerDetails?.phone;
        const customerName = updatedOrder.customerDetails?.name;
        try {
            await CustomerLedger.findOneAndUpdate(
                { customerPhone: customerPhone },
                {
                    $inc: { balanceDue: netBalanceChangeForCustomer },
                    $set: { lastActivity: new Date() },
                    $push: {
                        transactions: {
                            orderId: updatedOrder._id,
                            transactionType: netBalanceChangeForCustomer > 0 ? "balance_increased" : "balance_decreased",
                            amount: Math.abs(netBalanceChangeForCustomer),
                            notes: `Order #${updatedOrder._id.toString().slice(-6)} updated. Net change: ${netBalanceChangeForCustomer.toFixed(2)}`,
                            timestamp: new Date()
                        }
                    }
                },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );
        } catch (ledgerError) {
            console.error("Error updating ledger during order update (orderId:", id, "):", ledgerError);
        }
    }

    // --- Daily Earning Update ---
    if (amountChangeForEarnings !== 0) {
      try {
        await DailyEarning.findOneAndUpdate(
          { date: dateForEarningUpdate },
          {
            $inc: { totalEarnings: amountChangeForEarnings },
            $setOnInsert: { date: dateForEarningUpdate, percentageChangeFromYesterday: 0 }
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      } catch (earningUpdateError) {
        console.error("Error updating daily earnings:", earningUpdateError);
      }
    }

    // --- Automated Table Status Update ---
    if (updatedOrder.table) {
        const targetTable = await Table.findById(updatedOrder.table);

        if (targetTable && targetTable.currentOrder && targetTable.currentOrder.equals(currentOrder._id)) {
            const isOrderFullySettled = updatedOrder.orderStatus === "Completed" && updatedOrder.paymentStatus === "Paid";
            const isOrderCancelled = updatedOrder.orderStatus === "Cancelled";

            if ((isOrderFullySettled || isOrderCancelled) && targetTable.status !== "Available") {
                await Table.findByIdAndUpdate(
                    updatedOrder.table,
                    { status: "Available", currentOrder: null },
                    { new: true }
                );
            }
        }
    }

    res.status(200).json({ success: true, message: "Order updated successfully!", data: updatedOrder });
  } catch (error) {
    next(error);
  }
};

export { addOrder, getOrderById, getOrders, updateOrderById };
