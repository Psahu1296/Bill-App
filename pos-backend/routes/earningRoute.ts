// routes/earningRoutes.js
import express from "express";
import { getDailyEarnings, getPeriodEarnings, calculateAndSaveDailyEarnings, getDashboardEarningsSummary } from "../controllers/earningController";
import { isVerifiedUser } from "../middlewares/tokenVerification";
const router = express.Router();

router.get("/daywise", isVerifiedUser, getDailyEarnings);
router.get("/dashboard", isVerifiedUser, getDashboardEarningsSummary);
router.get("/:periodType", isVerifiedUser, getPeriodEarnings);
router.post("/calculate-daily", isVerifiedUser, calculateAndSaveDailyEarnings as any);


export default router;