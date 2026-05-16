import express from "express";
import { getInventoryDashboard, getCycleHistory, updateCycle } from "../controllers/inventoryController";
import { isVerifiedUser } from "../middlewares/tokenVerification";

const router = express.Router();

router.get("/", isVerifiedUser, getInventoryDashboard);
router.get("/cycles/:rawMaterial", isVerifiedUser, getCycleHistory);
router.patch("/cycles/:id", isVerifiedUser, updateCycle);

export default router;
