import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  initiatePayment,
  handleCallback,
  checkPaymentStatus,
} from "../controllers/phonePeController";

const router = Router();

const payLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,  // 1 hour
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many payment requests. Please try again later." },
});

const statusLimiter = rateLimit({
  windowMs: 60 * 1000,        // 1 minute
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests, please slow down." },
});

// No isVerifiedUser — all three are public (customer-initiated or PhonePe server-to-server)
router.post("/initiate", payLimiter, initiatePayment);
router.post("/callback", handleCallback);              // raw body already set in app.ts
router.get("/status/:txnId", statusLimiter, checkPaymentStatus);

export default router;
