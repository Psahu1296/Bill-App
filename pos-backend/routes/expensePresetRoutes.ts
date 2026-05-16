import express from "express";
import { getPresets, createPreset, updatePreset, deletePreset, recordPresetPrice } from "../controllers/expensePresetController";
import { isVerifiedUser } from "../middlewares/tokenVerification";

const router = express.Router();

router.route("/").get(isVerifiedUser, getPresets).post(isVerifiedUser, createPreset);
router.route("/:id").put(isVerifiedUser, updatePreset).delete(isVerifiedUser, deletePreset);
router.route("/:id/price").patch(isVerifiedUser, recordPresetPrice);

export default router;
