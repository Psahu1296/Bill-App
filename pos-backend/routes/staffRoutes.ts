import express from "express";
import {
  getAllStaff,
  addStaff,
  updateStaff,
  deleteStaff,
  toggleActive,
  addPayment,
  deletePayment,
} from "../controllers/staffController";
import { isVerifiedUser } from "../middlewares/tokenVerification";

const router = express.Router();

router.route("/").get(isVerifiedUser, getAllStaff).post(isVerifiedUser, addStaff);

router.route("/:id").put(isVerifiedUser, updateStaff).delete(isVerifiedUser, deleteStaff);

router.route("/:id/toggle-active").patch(isVerifiedUser, toggleActive);

router.route("/:id/payments").post(isVerifiedUser, addPayment);

router.route("/:id/payments/:paymentId").delete(isVerifiedUser, deletePayment);

export default router;
