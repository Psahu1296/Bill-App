// controllers/customerLedgerController.js
const createHttpError = require("http-errors");
const CustomerLedger = require("../models/customerLedgerModel");
const { default: mongoose } = require("mongoose");
const DailyEarning = require("../models/dailyEarningModel"); // For earning updates on manual payments
const { getZonedStartOfDayUtc } = require("./earningController"); // For earning updates on manual payments

// @desc    Get a customer's ledger by phone number
// @route   GET /api/ledger/:phone
// @access  Private (Admin/Staff)
const getCustomerLedger = async (req, res, next) => {
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

// @desc    Record a payment against a customer's outstanding balance
// @route   POST /api/ledger/:phone/pay
// @access  Private (Admin/Staff)
const recordCustomerPayment = async (req, res, next) => {
  try {
    const { phone } = req.params;
    const { amountPaid, orderId, notes } = req.body; // amountPaid is the payment towards balance

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
        $inc: { balanceDue: -amountPaid }, // Subtract payment from balance
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

    // --- Update Daily Earning for this manual payment ---
    // If the payment is received manually, it contributes to daily earnings
    const dateForEarningUpdate = getZonedStartOfDayUtc(new Date()); // Earning attributed to today's date
    try {
        await DailyEarning.findOneAndUpdate(
            { date: dateForEarningUpdate },
            {
                $inc: { totalEarnings: amountPaid },
                $setOnInsert: { date: dateForEarningUpdate, percentageChangeFromYesterday: 0 }
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        console.log(`[Earning Update] Daily earning for ${dateForEarningUpdate.toISOString().split('T')[0]} incremented by ${amountPaid} due to manual customer payment.`);
    } catch (earningUpdateError) {
        console.error("Error updating daily earnings during manual customer payment:", earningUpdateError);
    }


    res.status(200).json({ success: true, message: "Payment recorded successfully!", data: customerLedger });
  } catch (error) {
    next(error);
  }
};

const getAllCustomerLedgers = async (req, res, next) => {
  try {
    const { name, phone, hasBalanceDue } = req.query; // Filters

    let query = {};
    if (name) {
      query.customerName = { $regex: name, $options: 'i' }; // Case-insensitive search
    }
    if (phone) {
      query.customerPhone = { $regex: phone, $options: 'i' }; // Case-insensitive search
    }
    if (hasBalanceDue === 'true') { // Filter for only those with outstanding balance
      query.balanceDue = { $gt: 0 };
    } else if (hasBalanceDue === 'false') { // Or only those with zero balance
        query.balanceDue = 0;
    }

    const ledgers = await CustomerLedger.find(query).sort({ lastActivity: -1 }); // Sort by latest activity

    res.status(200).json({ success: true, data: ledgers });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCustomerLedger,
  recordCustomerPayment,
  getAllCustomerLedgers
};