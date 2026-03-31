import "./scripts/patch-node25";
import express from "express";
import config from "./config/config";
import globalErrorHandler from "./middlewares/globalErrorHandler";
import cookieParser from "cookie-parser";
import cors from "cors";
import path from "path";
import cron from "node-cron";
import rateLimit from "express-rate-limit";
import { calculateAndSaveDailyEarnings } from "./controllers/earningController";

import userRoute from "./routes/userRoute";
import orderRoute from "./routes/orderRoute";
import tableRoute from "./routes/tableRoute";
import paymentRoute from "./routes/paymentRoute";
import dishRoute from "./routes/dishRoute";
import earningRoute from "./routes/earningRoute";
import expenseRoutes from "./routes/expenseRoutes";
import customerLedgerRoutes from "./routes/customerLedgerRoutes";
import consumableRoutes from "./routes/consumableRoutes";
import staffRoutes from "./routes/staffRoutes";
import dataRoutes from "./routes/dataRoutes";
import updateRoutes from "./routes/updateRoutes";
import customerRoute from "./routes/customerRoute";
import phonePeRoute from "./routes/phonePeRoute";
import settingsRoute from "./routes/settingsRoute";
import adminNotifyRoute from "./routes/adminNotifyRoute";

const app = express();

// Trust the Cloudflare tunnel / reverse proxy so express-rate-limit
// can correctly identify client IPs from X-Forwarded-For.
app.set("trust proxy", 1);

cron.schedule(
  "5 0 * * *",
  async () => {
    console.log("Running daily earning calculation job...");
    try {
      await calculateAndSaveDailyEarnings({});
      console.log("Daily earning calculation job completed successfully.");
    } catch (error) {
      console.error("Daily earning calculation job failed:", error);
    }
  },
  {
    timezone: "Asia/Kolkata",
  }
);

// CORS — must be before routes
const allowedOrigins = [config.frontendUrl, config.customerAppUrl].filter(Boolean);
app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (server-to-server, curl, Electron)
    if (!origin) return cb(null, true);
    // Explicitly configured origins (POS frontend, customer app)
    if (allowedOrigins.includes(origin)) return cb(null, true);
    // Any Cloudflare quick-tunnel subdomain (URL changes on every restart)
    if (origin.endsWith(".trycloudflare.com")) return cb(null, true);
    // Named tunnel domain (root + any subdomain)
    if (origin === "https://users.sahu-dhaba-pos.co.in" || origin.endsWith(".sahu-dhaba-pos.co.in")) return cb(null, true);
    if(origin === "http://localhost:8080" || origin === "http://localhost:5173") return cb(null, true); // for local dev with frontend running on 5173/5174
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));

// Webhook routes need raw body for signature verification.
// Register BEFORE express.json() so the body isn't pre-parsed.
app.use(
  "/api/payment/webhook-verification",
  express.raw({ type: "application/json" })
);
app.use(
  "/api/payment/phonepe/callback",
  express.raw({ type: "application/json" })
);

app.use(express.json());
  app.use(cookieParser());

  // Health check endpoint — `app` field is used by the Electron main process
  // to fingerprint our backend when resolving port conflicts on startup.
  app.get("/health", (req, res) => {
    res.json({
      app: "dhaba-pos",
      status: "ok",
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || "1.0.0",
      environment: config.nodeEnv,
      port: config.port,
    });
  });

// Rate limiting
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { success: false, message: "Too many login attempts. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: { success: false, message: "Too many registration attempts. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// API Endpoints
app.use("/api/user/login", loginLimiter);
app.use("/api/user/register", registerLimiter);

app.use("/api/user", userRoute);
app.use("/api/order", orderRoute);
app.use("/api/table", tableRoute);
app.use("/api/payment", paymentRoute);
app.use("/api/dishes", dishRoute);
app.use("/api/earnings", earningRoute);
app.use("/api/expenses", expenseRoutes);
app.use("/api/ledger", customerLedgerRoutes);
app.use("/api/consumables", consumableRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/data", dataRoutes);
app.use("/api/updates", updateRoutes);
app.use("/api/customer", customerRoute);
app.use("/api/payment/phonepe", phonePeRoute);
app.use("/api/settings", settingsRoute);
app.use("/api/admin/notify", adminNotifyRoute);

// Serve frontend static files
// In production FRONTEND_DIST_PATH points to resources/frontend/dist (extraResources).
// In dev it falls back to the relative path from the build output.
const frontendBuildPath = process.env["FRONTEND_DIST_PATH"] ?? path.join(__dirname, "../../pos-frontend/dist");
app.use(express.static(frontendBuildPath));

// Serve index.html for any non-API route (React Router support)
app.get("*", (req, res) => {
  res.sendFile(path.join(frontendBuildPath, "index.html"));
});

// Global Error Handler (must be last)
app.use(globalErrorHandler);

export default app;
