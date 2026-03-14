import dotenv from "dotenv";
dotenv.config();

// Use fallback secret in development if not provided
if (!process.env.JWT_SECRET) {
    if (process.env.NODE_ENV === "development") {
        process.env.JWT_SECRET = "fallback-dev-secret-for-development-only";
        console.warn("⚠️  Using fallback JWT_SECRET in development mode. Set JWT_SECRET in production.");
    } else {
        throw new Error("FATAL: JWT_SECRET environment variable is not set.");
    }
}

const config = Object.freeze({
    port: process.env.PORT || 5001,
    databaseURI: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/posdb",
    nodeEnv: process.env.NODE_ENV || "development",
    accessTokenSecret: process.env.JWT_SECRET,
    razorpayKeyId: process.env.RAZORPAY_KEY_ID,
    razorpaySecretKey: process.env.RAZORPAY_KEY_SECRET,
    razorpyWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
    frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
});

export default config;
