// models/expenseModel.js
const mongoose = require("mongoose");

const expenseSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["food_raw_material", "labor_salary", "utility_bill", "rent", "marketing", "maintenance", "other"],
      required: true,
    },
    name: { // Name of the item (e.g., "Potatoes", "John Doe Salary", "Electricity Bill")
      type: String,
      required: true,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    description: { // Optional detailed description
      type: String,
      trim: true,
    },
    expenseDate: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
  }
);

const Expense = mongoose.model("Expense", expenseSchema);

module.exports = Expense;