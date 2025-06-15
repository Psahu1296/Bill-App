const express = require("express");
const { addOrder, getOrders, getOrderById, updateOrder, updateOrderById } = require("../controllers/orderController");
const { isVerifiedUser } = require("../middlewares/tokenVerification");
const router = express.Router();


router.route("/").post(isVerifiedUser, addOrder);
router.route("/").get(isVerifiedUser, getOrders);
router.route("/:id").get(isVerifiedUser, getOrderById);
// router.route("/status/:id").put(isVerifiedUser, updateOrder);
router.route("/:id").put(isVerifiedUser, updateOrderById);

module.exports = router;