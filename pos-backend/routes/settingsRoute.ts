import { Router } from "express";
import { isVerifiedUser } from "../middlewares/tokenVerification";
import { getOnlineOrdersStatus, setOnlineOrdersStatus, getDishCatalog, saveDishCatalog, patchDishCatalog } from "../controllers/settingsController";

const router = Router();

// Public — customer app checks this to decide whether to show the menu
router.get("/online-orders", getOnlineOrdersStatus);

// Protected — only logged-in POS staff can toggle
router.put("/online-orders", isVerifiedUser, setOnlineOrdersStatus);

// Dish catalog snapshot
router.get("/dish-catalog", isVerifiedUser, getDishCatalog);
router.post("/dish-catalog", isVerifiedUser, saveDishCatalog);
router.patch("/dish-catalog", isVerifiedUser, patchDishCatalog);

export default router;
