// models/dailyEarningModel.js
import mongoose from "mongoose";

const dailyEarningSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
      unique: true, // Ensures only one record per day
      index: true, // For faster queries
    },
    totalEarnings: {
      type: Number,
      required: true,
      default: 0,
    },
    // Optional: store the calculated percentage change directly
    percentageChangeFromYesterday: {
      type: Number,
      default: 0, // 0 if no previous day or same earnings
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
  }
);

const DailyEarning = mongoose.model("DailyEarning", dailyEarningSchema);

export default DailyEarning;