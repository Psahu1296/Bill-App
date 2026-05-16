import express from "express";
import { getPresets, createPreset, updatePreset, deletePreset, recordPresetPrice, updatePresetPieceMap } from "../controllers/expensePresetController";
import { isVerifiedUser } from "../middlewares/tokenVerification";

const router = express.Router();

router.route("/").get(isVerifiedUser, getPresets).post(isVerifiedUser, createPreset);
router.route("/:id").put(isVerifiedUser, updatePreset).delete(isVerifiedUser, deletePreset);
router.route("/:id/price").patch(isVerifiedUser, recordPresetPrice);
router.route("/:id/piece-map").patch(isVerifiedUser, updatePresetPieceMap);

export default router;
