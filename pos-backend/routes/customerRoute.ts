/**
 * Customer-facing REST routes — served from Railway backend.
 * No tunnel or Firestore dependency.
 */
import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  getPublicDishes,
  placeCustomerOrder,
  addItemsToOrder,
  getOrderStatus,
  streamOrderStatus,
  getCustomerOrders,
} from "../controllers/customerController";
import { getAvailableDishRequests } from "../controllers/requestController";
import {
  getCustomerProfile,
  upsertCustomerProfile,
  updateCustomerProfile,
} from "../controllers/customerProfileController";

const router = Router();

// Mutation limiter — order placement / profile writes (20/min)
const orderLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests. Please slow down." },
});

// Read limiter — menu, order status, profile lookups (60/min)
const readLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests. Please slow down." },
});

// SSE limiter — each stream holds a DB poll open for up to 10 min; keep tight (5/min)
const streamLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many streaming connections. Please slow down." },
});

// ── Menu ──────────────────────────────────────────────────────────────────────
router.get("/dishes", readLimiter, getPublicDishes);
router.get("/dish/available", readLimiter, getAvailableDishRequests);

// ── Orders ─────────────────────────────────────────────────────────────────────
router.post("/order", orderLimiter, placeCustomerOrder);
router.patch("/order/:id/add-items", orderLimiter, addItemsToOrder);
router.get("/order/:id", readLimiter, getOrderStatus);
router.get("/order/:id/stream", streamLimiter, streamOrderStatus);
router.get("/orders/:phone", readLimiter, getCustomerOrders);

// ── Profile ───────────────────────────────────────────────────────────────────
router.get("/profile/:phone", readLimiter, getCustomerProfile);
router.post("/profile", orderLimiter, upsertCustomerProfile);
router.patch("/profile/:phone", orderLimiter, updateCustomerProfile);

// ── Status ────────────────────────────────────────────────────────────────────
// Simple liveness check — if this responds the server is online.
// Also returns whether online ordering is currently enabled.
router.get("/pos-status", readLimiter, (_req, res) => {
  try {
    const { isOnlineOrdersEnabled } = require("../repositories/settingsRepo");
    res.json({ success: true, data: { online: true, isOnline: isOnlineOrdersEnabled() } });
  } catch {
    res.json({ success: true, data: { online: true, isOnline: false } });
  }
});

export default router;
