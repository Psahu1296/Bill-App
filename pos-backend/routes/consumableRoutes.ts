import express from "express";
import {
  addConsumable,
  addConsumableBatch,
  getAllConsumables,
  getDailySummary,
  updateConsumable,
  deleteConsumable,
} from "../controllers/consumableController";
import { isVerifiedUser } from "../middlewares/tokenVerification";

const router = express.Router();

// Summary route MUST be declared before /:id to avoid being swallowed by the dynamic segment
router.route("/summary/day").get(isVerifiedUser, getDailySummary);

router
  .route("/")
  .get(isVerifiedUser, getAllConsumables)
  .post(isVerifiedUser, addConsumable);

router.route("/batch").post(isVerifiedUser, addConsumableBatch);

router
  .route("/:id")
  .put(isVerifiedUser, updateConsumable)
  .delete(isVerifiedUser, deleteConsumable);

export default router;
