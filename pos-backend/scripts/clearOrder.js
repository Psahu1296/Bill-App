// clearOrders.js
require('dotenv').config(); // Load environment variables from .env
const mongoose = require('mongoose');
const Order = require('../models/orderModel'); // Adjust path to your Order model

// Connect to MongoDB
mongoose
  .connect("mongodb://127.0.0.1:27017/posdb", {})
  .then(() => {
    console.log('MongoDB connected for clearing orders!');
    clearOrders(); // Call the function to clear orders once connected
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1); // Exit if connection fails
  });

// Function to clear all orders
const clearOrders = async () => {
  try {
    const result = await Order.deleteMany({}); // Delete all documents in the Order collection
    console.log(`Successfully deleted ${result.deletedCount} orders.`);
    process.exit(); // Exit the script after successful deletion
  } catch (error) {
    console.error('Error clearing orders:', error);
    process.exit(1); // Exit with error code
  }
};