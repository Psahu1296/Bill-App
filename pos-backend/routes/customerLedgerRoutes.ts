import { Response, NextFunction } from "express";
import { CustomRequest as Request } from "../types";
// routes/customerLedgerRoutes.js
import express from "express";
import { getCustomerLedger, recordCustomerPayment, getAllCustomerLedgers } from "../controllers/customerLedgerController";
import { isVerifiedUser } from "../middlewares/tokenVerification";
const router = express.Router();

const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
    req.user = { role: 'admin' };
    next();
};

router.route("/:phone")
  .get(authMiddleware, getCustomerLedger); // Get ledger by customer phone

router.route("/:phone/pay")
  .post(authMiddleware, recordCustomerPayment); // Record a payment

router.route("/all")
  .post(authMiddleware, getAllCustomerLedgers); // Record a payment



export default router;