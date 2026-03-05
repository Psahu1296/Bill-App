import app from "./app";
import connectDB from "./config/database";

const startServer = async (port: number = Number(process.env.PORT) || 5000): Promise<void> => {
  await connectDB();
  return new Promise((resolve, reject) => {
    const server = app.listen(port, "0.0.0.0", () => {
      console.log(`☑️  POS Server is listening on port ${port}`);
      resolve();
    });
    server.on("error", reject);
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
