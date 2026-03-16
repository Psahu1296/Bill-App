import express from "express";
import { getCustomerLedger, recordCustomerPayment, addDebtToLedger, getAllCustomerLedgers } from "../controllers/customerLedgerController";
import { isVerifiedUser } from "../middlewares/tokenVerification";
const router = express.Router();

// /all must be registered BEFORE /:phone to avoid being caught by the dynamic route
router.route("/all")
  .get(isVerifiedUser, getAllCustomerLedgers);

router.route("/:phone")
  .get(isVerifiedUser, getCustomerLedger);

router.route("/:phone/pay")
  .post(isVerifiedUser, recordCustomerPayment);

router.route("/:phone/add-debt")
  .post(isVerifiedUser, addDebtToLedger);

export default router;
