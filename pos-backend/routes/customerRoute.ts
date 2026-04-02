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

const dishLimiter = rateLimit({
  windowMs: 60 * 1000,        // 1 minute
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests, please slow down." },
});

const orderCreateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,   // 1 hour
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many orders placed. Please try again later." },
});

const orderReadLimiter = rateLimit({
  windowMs: 60 * 1000,        // 1 minute
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests, please slow down." },
});

const profileLimiter = rateLimit({
  windowMs: 60 * 1000,        // 1 minute
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests, please slow down." },
});

// No isVerifiedUser — these are public customer-facing endpoints
router.get("/dishes", dishLimiter, getPublicDishes);
router.post("/order", orderCreateLimiter, placeCustomerOrder);
router.patch("/order/:id/add-items", orderCreateLimiter, addItemsToOrder);
router.get("/order/:id/stream", orderReadLimiter, streamOrderStatus);   // must be before /:id
router.get("/order/:id", orderReadLimiter, getOrderStatus);

// Customer profile (public — phone is the identity, no password)
router.get("/profile/:phone", profileLimiter, getCustomerProfile);
router.post("/profile", profileLimiter, upsertCustomerProfile);
router.patch("/profile/:phone", profileLimiter, updateCustomerProfile);

// Customer order history (public — keyed by phone)
router.get("/orders/:phone", orderReadLimiter, getCustomerOrders);

export default router;
