/**
 * Customer-facing REST routes — minimal subset after Firestore migration.
 *
 * Removed (now served directly from Firestore by the customer app):
 *   GET  /dishes, POST /order, PATCH /order/:id/add-items,
 *   GET  /order/:id/stream, GET /order/:id,
 *   GET|POST|PATCH /profile, GET /orders/:phone, GET /pos-status
 *
 * Kept:
 *   POST /auth/verify-token — Firebase ID token verification (future use)
 */
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { verifyFirebaseToken } from "../controllers/customerOtpController";

const router = Router();

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many auth requests. Please slow down." },
});

router.post("/auth/verify-token", authLimiter, verifyFirebaseToken);

export default router;
