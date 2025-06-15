// routes/customerLedgerRoutes.js
const express = require("express");
const { getCustomerLedger, recordCustomerPayment, getAllCustomerLedgers } = require("../controllers/customerLedgerController");
const { isVerifiedUser } = require("../middlewares/tokenVerification");
const router = express.Router();

const authMiddleware = (req, res, next) => {
    req.user = { role: 'admin' };
    next();
};

router.route("/:phone")
  .get(authMiddleware, getCustomerLedger); // Get ledger by customer phone

router.route("/:phone/pay")
  .post(authMiddleware, recordCustomerPayment); // Record a payment

router.route("/all")
  .post(authMiddleware, getAllCustomerLedgers); // Record a payment



module.exports = router;