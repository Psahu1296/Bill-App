const express = require("express");
const connectDB = require("./config/database");
const config = require("./config/config");
const globalErrorHandler = require("./middlewares/globalErrorHandler");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const cron = require("node-cron"); // Import node-cron
const {
  calculateAndSaveDailyEarnings,
} = require("./controllers/earningController"); // Import the function
const app = express();

const PORT = config.port;
connectDB();


cron.schedule(
  "5 0 * * *",
  async () => {
    console.log("Running daily earning calculation job...");
    try {
      await calculateAndSaveDailyEarnings({}); // Pass empty req object for internal call
      console.log("Daily earning calculation job completed successfully.");
    } catch (error) {
      console.error("Daily earning calculation job failed:", error);
    }
  },
  {
    scheduled: true,
    timezone: "Asia/Kolkata", // IMPORTANT: Set cron timezone if your server is not in Asia/Kolkata
  }
);


app.use(express.json());
app.use(cookieParser());

// API Endpoints
// app.get("/", (req,res) => {
//   res.json({message : "Hello from POS Server!"});
// });
app.use("/api/user", require("./routes/userRoute"));
app.use("/api/order", require("./routes/orderRoute"));
app.use("/api/table", require("./routes/tableRoute"));
app.use("/api/payment", require("./routes/paymentRoute"));
app.use("/api/dishes", require("./routes/dishRoute"));
app.use("/api/earnings", require("./routes/earningRoute"));
app.use("/api/expenses", require("./routes/expenseRoutes"));
app.use("/api/ledger", require("./routes/customerLedgerRoutes"));

// Serve frontend static files
const frontendBuildPath = path.join(__dirname, "../pos-frontend/dist"); // or 'build' if CRA
app.use(express.static(frontendBuildPath));

// Serve index.html for any other route (to support React Router)
app.get("*", (req, res) => {
  res.sendFile(path.join(frontendBuildPath, "index.html"));
});

// Global Error Handler (put last)
app.use(globalErrorHandler);

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`☑️  POS Server is listening on port ${PORT}`);
});
