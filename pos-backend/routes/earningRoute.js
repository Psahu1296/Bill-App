// routes/earningRoutes.js
const express = require("express");
const { getDailyEarnings, getPeriodEarnings, calculateAndSaveDailyEarnings, getDashboardEarningsSummary } = require("../controllers/earningController");
const { isVerifiedUser } = require("../middlewares/tokenVerification"); // Your authentication/authorization middleware
const router = express.Router();

// const authMiddleware = (req, res, next) => {
//     req.user = { role: 'admin' }; // Example: assuming admin role for earnings
//     next();
// };

// @route   GET /api/earnings/daywise (retrieves stored daily earnings)
router.get("/daywise", getDailyEarnings);

// @route   GET /api/earnings/weekwise (e.g., /api/earnings/weekwise?numPeriods=4)
// @route   GET /api/earnings/monthwise (e.g., /api/earnings/monthwise?numPeriods=12)
// @route   GET /api/earnings/yearwise (e.g., /api/earnings/yearwise?numPeriods=5)
router.get("/dashboard", getDashboardEarningsSummary);
router.get("/:periodType", getPeriodEarnings);

// NEW ROUTE: To manually trigger daily earning calculation and saving
// This is typically for testing or if you want to use it as a cron endpoint.
// In production, you'd likely run this directly as a Node.js script via a cron job.
router.post("/calculate-daily", calculateAndSaveDailyEarnings);


module.exports = router;