import express from "express";
import { addOrder, getOrders, getOrderById, updateOrderById } from "../controllers/orderController";
import { isVerifiedUser } from "../middlewares/tokenVerification";
const router = express.Router();


router.route("/").post(isVerifiedUser, addOrder);
router.route("/").get(isVerifiedUser, getOrders);
router.route("/:id").get(isVerifiedUser, getOrderById);
// router.route("/status/:id").put(isVerifiedUser, updateOrder);
router.route("/:id").put(isVerifiedUser, updateOrderById);

export default router;