import { Router } from "express";
import { isVerifiedUser } from "../middlewares/tokenVerification";
import { searchCustomerProfiles } from "../controllers/customerProfileController";

const router = Router();

router.get("/search", isVerifiedUser, searchCustomerProfiles);

export default router;
