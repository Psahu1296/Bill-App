// models/orderModel.js
const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
    customerDetails: {
        name: { type: String, required: true },
        phone: { type: String, required: true},
        guests: { type: Number, required: true },
    },
    orderStatus: { // e.g., "In Progress", "Completed", "Cancelled"
        type: String,
        required: true
    },
    orderDate: {
        type: Date,
        default : Date.now()
    },
    bills: {
        total: { type: Number, required: true },
        tax: { type: Number, required: true },
        totalWithTax: { type: Number, required: true }
    },
    items: [],
    table: { type: mongoose.Schema.Types.ObjectId, ref: "Table" },
    paymentMethod: String, // e.g., "Cash", "Card", "Razorpay", "Pay Later"
    paymentData: { // Stores Razorpay specific data if used
        razorpay_order_id: String,
        razorpay_payment_id: String
    },
    // NEW FIELD: paymentStatus
    paymentStatus: { // e.g., "Pending", "Paid", "Refunded"
        type: String,
        enum: ["Pending", "Paid", "Refunded"], // Define allowed values
        default: "Pending", // Default to pending if not explicitly set
        required: true,
    },
    amountPaid: { // Actual amount paid by the customer for this order
        type: Number,
        default: 0,
        min: 0
    },
    balanceDueOnOrder: { // Remaining amount to be paid for THIS specific order
        type: Number,
        default: 0,
        min: 0
    }
}, { timestamps : true } );

module.exports = mongoose.model("Order", orderSchema);