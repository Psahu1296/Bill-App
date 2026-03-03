require("dotenv").config();

const config = Object.freeze({
    port: process.env.PORT || 5000,
    databaseURI: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/posdb",
    nodeEnv : process.env.NODE_ENV || "development",
    accessTokenSecret: process.env.JWT_SECRET || "54c4b44b34e16b36063328ff665c4306679ef0d5c2e73537283bfb70a76b8793f22873e6dbc3dee96486c1121eb1c705c3fa2090f09c52858ea9c53b42710e7d",
    razorpayKeyId: process.env.RAZORPAY_KEY_ID,
    razorpaySecretKey: process.env.RAZORPAY_KEY_SECRET,
    razorpyWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET
});

export default config;
