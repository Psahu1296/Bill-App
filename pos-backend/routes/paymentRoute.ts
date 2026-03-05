import express from "express";
const router = express.Router();
import { isVerifiedUser } from "../middlewares/tokenVerification";
import { createOrder, verifyPayment, webHookVerification } from "../controllers/paymentController";

router.route("/create-order").post(isVerifiedUser, createOrder);
router.route("/verify-payment").post(isVerifiedUser, verifyPayment);
// Webhook uses raw body for signature verification — middleware applied per-route in app.ts
router.route("/webhook-verification").post(webHookVerification);

export default router;
