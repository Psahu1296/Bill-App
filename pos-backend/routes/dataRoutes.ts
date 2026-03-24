import { Router } from "express";
import { isVerifiedUser } from "../middlewares/tokenVerification";
import { getStats, exportData, importData, deletePreview, deleteData, resetDb, recalcEarnings } from "../controllers/dataController";

const router = Router();

router.use(isVerifiedUser);

router.get("/stats", getStats);
router.get("/export", exportData);
router.post("/import", importData);
router.get("/delete-preview", deletePreview);
router.delete("/delete", deleteData);
router.post("/reset", resetDb);
router.post("/recalc-earnings", recalcEarnings);

export default router;
