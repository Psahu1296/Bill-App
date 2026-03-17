"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// models/dishModel.js
var mongoose_1 = require("mongoose");
var dishSchema = new mongoose_1.default.Schema({
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
        enum: ["starter", "main_course", "dessert", "beverage", "bread", "soup", "salad", "tobacco"],
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
}, {
    timestamps: true,
});
var Dish = mongoose_1.default.model("Dish", dishSchema);
exports.default = Dish;
