import express from "express";
import {
  getCustomerLedger,
  recordCustomerPayment,
  addDebtToLedger,
  getAllCustomerLedgers,
  createLedger,
  updateLedger,
  deleteLedger,
} from "../controllers/customerLedgerController";
import { isVerifiedUser } from "../middlewares/tokenVerification";
const router = express.Router();

// Static routes BEFORE /:phone to avoid being swallowed by the dynamic segment
router.route("/all").get(isVerifiedUser, getAllCustomerLedgers);
router.route("/create").post(isVerifiedUser, createLedger);

router.route("/:phone")
  .get(isVerifiedUser, getCustomerLedger)
  .patch(isVerifiedUser, updateLedger)
  .delete(isVerifiedUser, deleteLedger);

router.route("/:phone/pay").post(isVerifiedUser, recordCustomerPayment);
router.route("/:phone/add-debt").post(isVerifiedUser, addDebtToLedger);

export default router;
