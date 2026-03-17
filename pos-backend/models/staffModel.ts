import mongoose from "mongoose";

const staffPaymentSchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true, min: 0 },
    type: {
      type: String,
      enum: ["daily", "monthly", "advance", "bonus", "deduction"],
      required: true,
    },
    date: { type: Date, default: Date.now },
    note: { type: String, trim: true, default: "" },
  }
);

const staffSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    role: {
      type: String,
      enum: ["cook", "supplier", "owner", "manager", "delivery", "other"],
      required: true,
    },
    monthlySalary: { type: Number, default: 0, min: 0 },
    joinDate: {
      type: String,
      default: () => new Date().toISOString().split("T")[0],
    },
    isActive: { type: Boolean, default: true },
    payments: [staffPaymentSchema],
  },
  { timestamps: true }
);

staffSchema.index({ isActive: 1 });
staffSchema.index({ role: 1 });

const Staff = mongoose.model("Staff", staffSchema);
export default Staff;
