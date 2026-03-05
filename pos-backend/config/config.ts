import dotenv from "dotenv";
dotenv.config();

if (!process.env.JWT_SECRET) {
    throw new Error("FATAL: JWT_SECRET environment variable is not set.");
}

const config = Object.freeze({
    port: process.env.PORT || 5000,
    databaseURI: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/posdb",
    nodeEnv: process.env.NODE_ENV || "development",
    accessTokenSecret: process.env.JWT_SECRET,
    razorpayKeyId: process.env.RAZORPAY_KEY_ID,
    razorpaySecretKey: process.env.RAZORPAY_KEY_SECRET,
    razorpyWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
    frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
});

export default config;
