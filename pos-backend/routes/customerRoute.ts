import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  getPublicDishes,
  placeCustomerOrder,
  addItemsToOrder,
  getOrderStatus,
  streamOrderStatus,
} from "../controllers/customerController";

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

// No isVerifiedUser — these are public customer-facing endpoints
router.get("/dishes", dishLimiter, getPublicDishes);
router.post("/order", orderCreateLimiter, placeCustomerOrder);
router.patch("/order/:id/add-items", orderCreateLimiter, addItemsToOrder);
router.get("/order/:id/stream", orderReadLimiter, streamOrderStatus);   // must be before /:id
router.get("/order/:id", orderReadLimiter, getOrderStatus);

export default router;
