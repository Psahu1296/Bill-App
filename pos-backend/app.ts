import "./scripts/patch-node25";
import express from "express";
import connectDB from "./config/database";
import config from "./config/config";
import globalErrorHandler from "./middlewares/globalErrorHandler";
import cookieParser from "cookie-parser";
import cors from "cors";
import fs from "fs";
import path from "path";
import cron from "node-cron"; // Import node-cron
import {
  calculateAndSaveDailyEarnings,
} from "./controllers/earningController"; // Import the function

import userRoute from "./routes/userRoute";
import orderRoute from "./routes/orderRoute";
import tableRoute from "./routes/tableRoute";
import paymentRoute from "./routes/paymentRoute";
import dishRoute from "./routes/dishRoute";
import earningRoute from "./routes/earningRoute";
import expenseRoutes from "./routes/expenseRoutes";
import customerLedgerRoutes from "./routes/customerLedgerRoutes";

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
    timezone: "Asia/Kolkata", // IMPORTANT: Set cron timezone if your server is not in Asia/Kolkata
  }
);


app.use(express.json());
app.use(cookieParser());

// API Endpoints
// app.get("/", (req,res) => {
//   res.json({message : "Hello from POS Server!"});
// });
app.use("/api/user", userRoute);
app.use("/api/order", orderRoute);
app.use("/api/table", tableRoute);
app.use("/api/payment", paymentRoute);
app.use("/api/dishes", dishRoute);
app.use("/api/earnings", earningRoute);
app.use("/api/expenses", expenseRoutes);
app.use("/api/ledger", customerLedgerRoutes);

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
app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`☑️  POS Server is listening on port ${PORT}`);
});
