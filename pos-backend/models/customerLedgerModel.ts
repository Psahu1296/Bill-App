import { Request, Response, NextFunction } from "express";
// models/customerLedgerModel.js
import mongoose from "mongoose";

const customerLedgerSchema = new mongoose.Schema(
  {
    customerName: {
      type: String,
      required: true,
      trim: true,
    },
    customerPhone: { // Essential for identifying a customer uniquely
      type: String,
      required: true,
      unique: true, // A customer is identified by phone number
    },
    balanceDue: { // Positive if customer owes, negative if restaurant owes (rare)
      type: Number,
      default: 0,
      min: 0, // Assuming balance will not go negative (customer doesn't overpay)
    },
    lastActivity: { // To track when the last transaction occurred
        type: Date,
        default: Date.now,
    },
    // You might want an array of transactions for audit trail
    transactions: [
      {
        orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
        transactionType: { type: String, enum: ["partial_payment", "full_payment_due", "payment_received", "adjustment"] },
        amount: { type: Number, required: true }, // The amount of this specific transaction
        // if partial_payment: amount is what they paid
        // if full_payment_due: amount is the total bill
        // if payment_received: amount is what they paid towards balance
        timestamp: { type: Date, default: Date.now },
        notes: String,
      }
    ]
  },
  {
    timestamps: true,
  }
);

const CustomerLedger = mongoose.model("CustomerLedger", customerLedgerSchema);

export default CustomerLedger;