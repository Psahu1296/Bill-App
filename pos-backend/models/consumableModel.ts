import mongoose from "mongoose";

const consumableSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["tea", "gutka", "cigarette"],
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    pricePerUnit: {
      type: Number,
      required: true,
      min: 0,
    },
    consumerType: {
      type: String,
      enum: ["customer", "staff", "owner"],
      required: true,
    },
    consumerName: {
      type: String,
      required: true,
      trim: true,
    },
    // Optional: links entry to an existing Order document when consumerType === 'customer'
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },
    // Explicit timestamp so the FE can display it as entry time (separate from createdAt)
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true } // adds createdAt / updatedAt
);

// Index for fast daily queries
consumableSchema.index({ timestamp: -1 });
consumableSchema.index({ type: 1, timestamp: -1 });

const Consumable = mongoose.model("Consumable", consumableSchema);

export default Consumable;
