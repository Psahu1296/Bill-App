import { Response, NextFunction } from "express";
import createHttpError from "http-errors";
import Order from "../models/orderModel";
import DailyEarning from "../models/dailyEarningModel";
import Table from "../models/tableModel";
import mongoose from "mongoose";
import { calculateAndSaveDailyEarnings } from "./earningController"; // Adjust path if needed
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
        res.status(200).json({ success: true, message: "Order updated!", data: updatedOrder });
    } else { // Create a new order
        const newOrder = new Order({
            ...orderData,
            amountPaid: amountPaid,
            balanceDueOnOrder: balanceDueOnOrder > 0 ? balanceDueOnOrder : 0,
        });
        await newOrder.save();

        // --- Table Status Update (UPDATED) ---
        // Mark the table as 'Booked' and link the order ID to it
        await Table.findByIdAndUpdate(
            tableId,
            {
                $set: { status: 'Booked', currentOrderId: newOrder._id }, // <--- UPDATED STATUS
            },
            { new: true, runValidators: true }
        );
        console.log(`[Table Status] Table ${table.tableNo} updated to Booked for Order ${newOrder._id}.`);

        // --- Ledger Update Logic for New Order ---
        const customerPhone = newOrder.customerDetails?.phone;
        const customerName = newOrder.customerDetails?.name;
        const amountOwing = newOrder.balanceDueOnOrder;

        if (amountOwing > 0) {
            const customerLedger = await CustomerLedger.findOneAndUpdate(
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
            console.log(`[Ledger Update] Customer ${customerName} (${customerPhone}) now owes: ${customerLedger.balanceDue}`);
        }

        // --- Daily Earning Update Logic for New Order ---
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
                console.log(`[Earning Update] Daily earning for ${dateForEarningUpdate?.toISOString().split('T')[0]} incremented by ${amountPaid}.`);
            } catch (earningUpdateError) {
                console.error("Error updating daily earnings during new order creation:", earningUpdateError);
            }
        }

        res.status(201).json({ success: true, message: "Order created!", data: newOrder });
    }
  } catch (error) {
    next(error);
  }
};

const getOrderById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id as string)) {
      const error = createHttpError(404, "Invalid id!");
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
    // Destructure all possible query parameters that can be used as filters
    const { startDate, endDate, tableId, customerPhone, orderStatus, paymentStatus } = req.query;

    let query: IQueryOptions = {}; // Initialize an empty query object

    // Add date range filtering
    if (startDate) {
      // Assuming startDate is in YYYY-MM-DD format from frontend
      const start = new Date(startDate as string);
      // Set time to start of day in UTC to match Mongoose Date storage
      start.setUTCHours(0, 0, 0, 0);
      query.orderDate = { ...query.orderDate, $gte: start };
    }
    if (endDate) {
      // Assuming endDate is in YYYY-MM-DD format from frontend
      const end = new Date(endDate as string);
      // Set time to end of day in UTC for accurate range
      end.setUTCHours(23, 59, 59, 999);
      query.orderDate = { ...query.orderDate, $lte: end };
    }

    // Add other filters if they are present in req.query
    if (tableId && mongoose.Types.ObjectId.isValid(tableId as string)) {
        query.table = tableId as string;
    }
    if (customerPhone) {
        // Query nested field: customerDetails.phone
        query["customerDetails.phone"] = customerPhone as string;
    }
    if (orderStatus) {
        // orderStatus can be a single string or an array of strings (e.g., 'all' or ['In Progress', 'Ready'])
        query.orderStatus = orderStatus as string;
    }
    if (paymentStatus) {
        // paymentStatus can be a single string or an array of strings
        query.paymentStatus = paymentStatus as string;
    }

    // Find orders based on the constructed query, populate table details, and sort by latest first
    const orders = await Order.find(query).populate("table").sort({ orderDate: -1 });

    // IMPORTANT: Return a consistent JSON structure { success: true, data: [...] }
    // Your frontend expects 'resData.data' to be the array of orders.
    res.status(200).json({ success: true, data: orders });
  } catch (error) {
    next(error);
  }
};

const updateOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orderStatus, paymentStatus } = req.body;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id as string)) {
      const error = createHttpError(400, "Invalid Order ID format!");
      return next(error);
    }

    const currentOrder = await Order.findById(id);
    if (!currentOrder) {
      const error = createHttpError(404, "Order not found!");
      return next(error);
    }

    const updates = {};
    if (orderStatus !== undefined) {
      (updates as any).orderStatus = orderStatus;
    }

    let shouldUpdateDailyEarningsImmediately = false;
    let amountChange = 0; // This will be the amount to add or subtract from earnings
    let dateForEarningUpdate = null; // The start of the day for the earning record

    if (paymentStatus !== undefined) {
      if (!["Pending", "Paid", "Refunded"].includes(paymentStatus)) {
        const error = createHttpError(400, "Invalid paymentStatus value!");
        return next(error);
      }

      // Scenario 1: Payment status changes TO 'Paid' from anything else
      if (paymentStatus === 'Paid' && currentOrder.paymentStatus !== 'Paid') {
        shouldUpdateDailyEarningsImmediately = true;
        amountChange = (currentOrder.bills?.totalWithTax || 0); // Add the order's total
        dateForEarningUpdate = getZonedStartOfDayUtc(currentOrder.orderDate); // Earning attributed to order's date
        console.log(`[Earning Update] Order ${req.params.id}: Changing to PAID. Incrementing ${amountChange} for ${dateForEarningUpdate?.toISOString()}`);
      }
      // Scenario 2: Payment status changes FROM 'Paid' to 'Refunded'
      else if (paymentStatus === 'Refunded' && currentOrder.paymentStatus === 'Paid') {
        shouldUpdateDailyEarningsImmediately = true;
        amountChange = -(currentOrder.bills?.totalWithTax || 0); // Subtract the order's total
        dateForEarningUpdate = getZonedStartOfDayUtc(currentOrder.orderDate);
        console.log(`[Earning Update] Order ${req.params.id}: Changing to REFUNDED from PAID. Decrementing ${Math.abs(amountChange)} for ${dateForEarningUpdate?.toISOString()}`);
      }
      // Scenario 3: Payment status changes FROM 'Paid' to 'Pending' (if allowed)
      else if (paymentStatus === 'Pending' && currentOrder.paymentStatus === 'Paid') {
          shouldUpdateDailyEarningsImmediately = true;
          amountChange = -(currentOrder.bills?.totalWithTax || 0); // Subtract the amount
          dateForEarningUpdate = getZonedStartOfDayUtc(currentOrder.orderDate);
          console.log(`[Earning Update] Order ${req.params.id}: Changing to PENDING from PAID. Decrementing ${Math.abs(amountChange)} for ${dateForEarningUpdate?.toISOString()}`);
      }
      // If status is "Paid" and remains "Paid", no direct earning change needed via this path.
      // The aggregate calculation handles it.

      (updates as any).paymentStatus = paymentStatus;
    }

    // Perform the actual update on the order document
    const updatedOrder = await Order.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    // After successfully updating the order, perform the direct DailyEarning update
    if (shouldUpdateDailyEarningsImmediately) {
      try {
        const dailyEarningRecord = await DailyEarning.findOneAndUpdate(
          { date: dateForEarningUpdate },
          {
            $inc: { totalEarnings: amountChange }, // Atomically increment/decrement
            $setOnInsert: { // Set these fields if a new document is inserted
                date: dateForEarningUpdate,
                percentageChangeFromYesterday: 0 // Default for new records
            }
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        console.log(`[Earning Update Success] Daily earning record for ${dateForEarningUpdate?.toISOString().split('T')[0]} adjusted. New total: ${dailyEarningRecord.totalEarnings}`);

      } catch (earningUpdateError) {
        console.error("Error directly updating daily earnings:", earningUpdateError);
        // Log the error but do not prevent the order update response
      }
    }

    res
      .status(200)
      .json({ success: true, message: "Order updated", data: updatedOrder });
  } catch (error) {
    next(error);
  }
};


const updateOrderById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // --- DEBUG LOG 1: What is received in req.body? ---
    console.log(`[DEBUG_UPDATE_ORDER] Received request for Order ID: ${req.params.id}`);
    console.log("[DEBUG_UPDATE_ORDER] req.body:", JSON.stringify(req.body, null, 2));

    const requestBodyUpdates = req.body;

    if (requestBodyUpdates._id) {
      delete requestBodyUpdates._id;
    }

    if (!mongoose.Types.ObjectId.isValid(id as string)) {
      const error = createHttpError(400, "Invalid Order ID format!");
      return next(error);
    }

    const currentOrder = await Order.findById(id);
    if (!currentOrder) {
      const error = createHttpError(404, "Order not found!");
      return next(error);
    }
    // --- DEBUG LOG 2: What was the order state BEFORE update? ---
    console.log("[DEBUG_UPDATE_ORDER] Current Order State (BEFORE update):", JSON.stringify(currentOrder, null, 2));

    const orderTotalWithTax = (currentOrder.bills?.totalWithTax || 0);
    const orderCreationDate = currentOrder.orderDate;
    const oldPaymentStatus = currentOrder.paymentStatus;
    const oldOrderStatus = currentOrder.orderStatus;
    const oldAmountPaid = currentOrder.amountPaid;
    const tableId = currentOrder.table;


    // --- Build the Mongoose update object ---
    const updatePayloadForMongoose = { ...requestBodyUpdates };

    if (requestBodyUpdates.amountPaid !== undefined) {
        const newAmountPaid = requestBodyUpdates.amountPaid;
        updatePayloadForMongoose.amountPaid = newAmountPaid;
        updatePayloadForMongoose.balanceDueOnOrder = (orderTotalWithTax || 0) - newAmountPaid > 0 ? (orderTotalWithTax || 0) - newAmountPaid : 0;
    }

    // --- DEBUG LOG 3: What payload is Mongoose receiving? ---
    console.log("[DEBUG_UPDATE_ORDER] Mongoose $set payload:", JSON.stringify(updatePayloadForMongoose, null, 2));


    // --- Determine Earning Change for DailyEarning ---
    let amountChangeForEarnings = 0;
    const dateForEarningUpdate = getZonedStartOfDayUtc(orderCreationDate);

    // This logic relies on `requestBodyUpdates.paymentStatus`
    if (requestBodyUpdates.paymentStatus === 'Paid' && oldPaymentStatus !== 'Paid') {
        amountChangeForEarnings += (orderTotalWithTax || 0);
        console.log(`[DEBUG_UPDATE_ORDER] Earning: Status changed to PAID. Incrementing ${amountChangeForEarnings}`);
    }
    else if ((requestBodyUpdates.paymentStatus === 'Refunded' || requestBodyUpdates.paymentStatus === 'Pending') && oldPaymentStatus === 'Paid') {
        amountChangeForEarnings -= (orderTotalWithTax || 0);
        console.log(`[DEBUG_UPDATE_ORDER] Earning: Status changed to ${requestBodyUpdates.paymentStatus} from PAID. Decrementing ${Math.abs(amountChangeForEarnings)}`);
    }


    // Perform the actual update on the order document
    const updatedOrder = await Order.findByIdAndUpdate(
      id,
      { $set: updatePayloadForMongoose }, // Passing the full merged payload here
      { new: true, runValidators: true } // runValidators is crucial for enums
    );

    if (!updatedOrder) {
      const error = createHttpError(404, "Order not found after attempted update!");
      return next(error);
    }
    // --- DEBUG LOG 4: What order state is returned AFTER Mongoose update? ---
    console.log("[DEBUG_UPDATE_ORDER] Updated Order State (AFTER Mongoose update):", JSON.stringify(updatedOrder, null, 2));


    // --- LEDGER UPDATE LOGIC ---
    const oldBalanceDueOnThisOrder = (orderTotalWithTax || 0) - oldAmountPaid;
    const newBalanceDueOnThisOrder = updatedOrder.balanceDueOnOrder; // This is directly from the updatedOrder object

    const netBalanceChangeForCustomer = newBalanceDueOnThisOrder - oldBalanceDueOnThisOrder;

    if (netBalanceChangeForCustomer !== 0) {
        const customerPhone = updatedOrder.customerDetails?.phone;
        const customerName = updatedOrder.customerDetails?.name;
        try {
            const customerLedger = await CustomerLedger.findOneAndUpdate(
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
            console.log(`[DEBUG_UPDATE_ORDER] Ledger Update: Customer ${customerName} (${customerPhone}) balance adjusted by ${netBalanceChangeForCustomer.toFixed(2)}. New total owes: ${customerLedger.balanceDue.toFixed(2)}`);
        } catch (ledgerError) {
            console.error("Error updating ledger during order update (orderId:", id, "):", ledgerError);
        }
    }


    // --- Daily Earning Update Logic (direct increment/decrement) ---
    if (amountChangeForEarnings !== 0) {
      try {
        const dailyEarningRecord = await DailyEarning.findOneAndUpdate(
          { date: dateForEarningUpdate },
          {
            $inc: { totalEarnings: amountChangeForEarnings },
            $setOnInsert: {
                date: dateForEarningUpdate,
                percentageChangeFromYesterday: 0
            }
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        console.log(`[DEBUG_UPDATE_ORDER] Daily Earning Success: Record for ${dateForEarningUpdate?.toISOString().split('T')[0]} adjusted by ${amountChangeForEarnings}. New total: ${dailyEarningRecord.totalEarnings}`);

      } catch (earningUpdateError) {
        console.error("Error directly updating daily earnings:", earningUpdateError);
      }
    }

    // --- AUTOMATED TABLE STATUS UPDATE LOGIC ---
    if (updatedOrder.table) {
        const tableId = updatedOrder.table;
        const targetTable = await Table.findById(tableId);

        if (targetTable && targetTable.currentOrder && targetTable.currentOrder.equals(currentOrder._id)) {
            let newTableStatus = null;

            const isOrderFullySettled = updatedOrder.orderStatus === "Completed" && updatedOrder.paymentStatus === "Paid";
            const isOrderCancelled = updatedOrder.orderStatus === "Cancelled";

            if (isOrderFullySettled && targetTable.status !== "Available") {
                newTableStatus = "Available";
            } else if (isOrderCancelled && targetTable.status !== "Available") {
                newTableStatus = "Available";
            }

            if (newTableStatus) {
                await Table.findByIdAndUpdate(
                    tableId,
                    { status: newTableStatus, currentOrder: null },
                    { new: true }
                );
                console.log(`[DEBUG_UPDATE_ORDER] Table ${targetTable.tableNo} updated to status: ${newTableStatus} (Order ${req.params.id} ${newTableStatus === 'Available' ? 'settled' : 'cancelled'}).`);
            }
        }
    }

    res.status(200).json({ success: true, message: "Order updated successfully!", data: updatedOrder });
  } catch (error) {
    console.error(`[DEBUG_UPDATE_ORDER] Caught error for Order ID ${req.params.id}:`, error); // Catch all errors
    next(error);
  }
};

export {  addOrder, getOrderById, getOrders, updateOrder, updateOrderById  };
