import { Router } from "express";
import { isVerifiedUser } from "../middlewares/tokenVerification";
import { streamAdminNotifications } from "../controllers/adminNotifyController";

const router = Router();

// Auth-protected SSE stream — POS admin only
router.get("/stream", isVerifiedUser, streamAdminNotifications);

export default router;
