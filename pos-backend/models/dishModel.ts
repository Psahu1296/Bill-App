// models/dishModel.js
import mongoose from "mongoose";

const dishSchema = new mongoose.Schema(
  {
    image: {
      type: String, // URL to the image
      required: true,
    },
    name: {
      type: String,
      required: true,
      unique: true, // Dish names should ideally be unique
      trim: true,
    },
    numberOfOrders: {
      type: Number,
      default: 0, // Will be incremented/decremented by order logic
    },
    type: {
      type: String,
      enum: ["starter", "main_course", "dessert", "beverage", "bread", "soup", "salad"],
      required: true,
    },
    category: {
      type: String,
      enum: ["veg", "non_veg", "egg"],
      required: true,
    },
    // REMOVED: price field
    // NEW FIELD: variants array
    variants: [
      {
        size: {
          type: String,
          enum: ["Half", "Full", "Regular", "Small", "Large"], // Define common sizes
          required: true,
        },
        price: {
          type: Number,
          required: true,
          min: 0,
        },
        _id: false, // Prevents Mongoose from creating a separate _id for each sub-document in the array
      },
    ],
    description: {
      type: String,
      trim: true,
      default: "",
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
    isFrequent: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

const Dish = mongoose.model("Dish", dishSchema);
export default Dish;