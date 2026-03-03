import express from "express";
import { isVerifiedUser } from "../middlewares/tokenVerification";
import { addDish, getDishes, updateDish, deleteDish, getFrequentDishes } from "../controllers/dishController";
const router = express.Router();


router.route("/").post(isVerifiedUser, addDish);
router.route("/").get(isVerifiedUser, getDishes);
router.route("/:id").put(isVerifiedUser, updateDish);
router.route("/:id").delete(isVerifiedUser, deleteDish);
router.route("/frequent").get(getFrequentDishes);

export default router;