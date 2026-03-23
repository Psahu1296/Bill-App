import { Router } from "express";
import { isVerifiedUser } from "../middlewares/tokenVerification";
import { getOnlineOrdersStatus, setOnlineOrdersStatus } from "../controllers/settingsController";

const router = Router();

// Public — customer app checks this to decide whether to show the menu
router.get("/online-orders", getOnlineOrdersStatus);

// Protected — only logged-in POS staff can toggle
router.put("/online-orders", isVerifiedUser, setOnlineOrdersStatus);

export default router;
