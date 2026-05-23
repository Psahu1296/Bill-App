import express from "express";
import { getDailySummary, getDailySummaryRange } from "../controllers/dailySummaryController";
import { isVerifiedUser } from "../middlewares/tokenVerification";

const router = express.Router();

// /range must be before /:date to avoid the param capturing the literal "range"
router.get("/range", isVerifiedUser, getDailySummaryRange);
router.get("/:date", isVerifiedUser, getDailySummary);

export default router;
