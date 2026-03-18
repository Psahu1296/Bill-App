import { Router } from "express";
import { isVerifiedUser } from "../middlewares/tokenVerification";
import { getStats, exportData, deleteData } from "../controllers/dataController";

const router = Router();

router.use(isVerifiedUser);

router.get("/stats", getStats);
router.get("/export", exportData);
router.delete("/delete", deleteData);

export default router;
