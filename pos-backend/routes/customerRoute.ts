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
import {
  getCustomerProfile,
  upsertCustomerProfile,
  updateCustomerProfile,
} from "../controllers/customerProfileController";

const router = Router();

const orderLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests. Please slow down." },
});

// ── Menu ──────────────────────────────────────────────────────────────────────
router.get("/dishes", getPublicDishes);

// ── Orders ─────────────────────────────────────────────────────────────────────
router.post("/order", orderLimiter, placeCustomerOrder);
router.patch("/order/:id/add-items", orderLimiter, addItemsToOrder);
router.get("/order/:id", getOrderStatus);
router.get("/order/:id/stream", streamOrderStatus);
router.get("/orders/:phone", getCustomerOrders);

// ── Profile ───────────────────────────────────────────────────────────────────
router.get("/profile/:phone", getCustomerProfile);
router.post("/profile", orderLimiter, upsertCustomerProfile);
router.patch("/profile/:phone", updateCustomerProfile);

// ── Status ────────────────────────────────────────────────────────────────────
// Simple liveness check — if this responds the server is online.
// Also returns whether online ordering is currently enabled.
router.get("/pos-status", (_req, res) => {
  try {
    const { isOnlineOrdersEnabled } = require("../repositories/settingsRepo");
    res.json({ success: true, data: { online: true, isOnline: isOnlineOrdersEnabled() } });
  } catch {
    res.json({ success: true, data: { online: true, isOnline: false } });
  }
});

export default router;
