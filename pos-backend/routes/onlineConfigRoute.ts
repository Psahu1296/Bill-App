import { Router } from "express";
import { isVerifiedUser } from "../middlewares/tokenVerification";
import {
  getFlags,
  updateFlags,
  getDeliveryAreas,
  addDeliveryArea,
  deleteDeliveryArea,
  toggleDeliveryArea,
} from "../controllers/onlineConfigController";

const router = Router();

// Config flags
router.get("/flags", getFlags);                          // PUBLIC — customer app reads this
router.put("/flags", isVerifiedUser, updateFlags);       // PROTECTED

// Delivery areas
router.get("/delivery-areas", getDeliveryAreas);                              // PUBLIC
router.post("/delivery-areas", isVerifiedUser, addDeliveryArea);              // PROTECTED
router.delete("/delivery-areas/:id", isVerifiedUser, deleteDeliveryArea);     // PROTECTED
router.patch("/delivery-areas/:id", isVerifiedUser, toggleDeliveryArea);      // PROTECTED

export default router;
