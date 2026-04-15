import { Router } from "express";
import rateLimit from "express-rate-limit";
import { isVerifiedUser } from "../middlewares/tokenVerification";
import {
  submitDishRequest,
  getDishRequests,
  updateDishRequest,
  deleteDishRequest,
  submitPreOrder,
  getPreOrders,
  getCustomerPreOrders,
  initiateDepositPayment,
  updatePreOrder,
  deletePreOrder,
  getAvailableDishRequests,
} from "../controllers/requestController";

const router = Router();

const payLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many payment requests. Please try again later." },
});

// ── Dish requests ─────────────────────────────────────────────────────────────
router.get("/dish/available", getAvailableDishRequests); // PUBLIC: available dishes

router
  .route("/dish")
  .post(submitDishRequest)                     // PUBLIC: customer submits
  .get(isVerifiedUser, getDishRequests);        // PROTECTED: admin views all

router
  .route("/dish/:id")
  .patch(isVerifiedUser, updateDishRequest)     // PROTECTED: update status / note
  .delete(isVerifiedUser, deleteDishRequest);   // PROTECTED: delete

// ── Pre-orders — static routes BEFORE dynamic /:id ───────────────────────────
// PUBLIC: customer views own bookings
router.get("/preorder/by-phone/:phone", getCustomerPreOrders);

router
  .route("/preorder")
  .post(submitPreOrder)                         // PUBLIC: customer submits
  .get(isVerifiedUser, getPreOrders);           // PROTECTED: admin views all

// PUBLIC (rate-limited): initiate deposit payment
router.post("/preorder/:id/pay-deposit", payLimiter, initiateDepositPayment);

router
  .route("/preorder/:id")
  .patch(isVerifiedUser, updatePreOrder)        // PROTECTED: update status / note
  .delete(isVerifiedUser, deletePreOrder);      // PROTECTED: delete

export default router;
