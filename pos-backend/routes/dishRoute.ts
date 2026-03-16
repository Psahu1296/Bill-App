import express from "express";
import { isVerifiedUser } from "../middlewares/tokenVerification";
import { addDish, getDishes, updateDish, deleteDish, getFrequentDishes, bulkAddDishes } from "../controllers/dishController";
const router = express.Router();

// /frequent must be before /:id to avoid being swallowed by the dynamic segment
router.route("/frequent").get(isVerifiedUser, getFrequentDishes);
router.route("/bulk").post(isVerifiedUser, bulkAddDishes);

router.route("/").post(isVerifiedUser, addDish);
router.route("/").get(isVerifiedUser, getDishes);
router.route("/:id").put(isVerifiedUser, updateDish);
router.route("/:id").delete(isVerifiedUser, deleteDish);

export default router;
