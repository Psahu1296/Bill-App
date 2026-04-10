import app from "./app";
import connectDB from "./config/database";

const startServer = async (port: number = Number(process.env.PORT) || 5001): Promise<void> => {
  connectDB();
  return new Promise((resolve, reject) => {
    const server = app.listen(port, "0.0.0.0", () => {
      console.log(`☑️  POS Server is listening on port ${port}`);
      console.log(`[CONFIG] NODE_ENV=${process.env.NODE_ENV || "development"}`);
      console.log(`[CONFIG] FRONTEND_URL=${process.env.FRONTEND_URL || "(not set)"}`);
      console.log(`[CONFIG] CUSTOMER_APP_URL=${process.env.CUSTOMER_APP_URL || "(not set)"}`);
      console.log(`[CONFIG] PHONEPE_ENV=${process.env.PHONEPE_ENV || "(not set)"}`);
      console.log(`[CONFIG] DATABASE_PATH=${process.env.DATABASE_PATH || "dhaba-pos.db (default)"}`);
      resolve();
    });
    server.on("error", (err) => {
      console.error(`[SERVER] Failed to bind port ${port}:`, err);
      reject(err);
    });
  });
};

// Auto-start when executed directly (e.g. npm start) — not when imported by Electron
if (require.main === module) {
  startServer().catch((err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
  });
}

export default startServer;
