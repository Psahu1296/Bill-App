import { Router } from "express";
import { isVerifiedUser } from "../middlewares/tokenVerification";
import { checkReminders } from "../controllers/reminderController";

const router = Router();

router.get("/check", isVerifiedUser, checkReminders);

export default router;
