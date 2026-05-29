import express from "express";
import multer from "multer";
import { isVerifiedUser } from "../middlewares/tokenVerification";
import { addDish, getDishes, getOnlineDishes, updateDish, deleteDish, getFrequentDishes, bulkAddDishes, seedDishes, getTopRevenueDishes, voiceParseDishes } from "../controllers/dishController";
const router = express.Router();
const audioUpload = multer({ dest: "/tmp/voice-uploads/" });

// static routes must be before /:id to avoid being swallowed by the dynamic segment
router.route("/frequent").get(isVerifiedUser, getFrequentDishes);
router.route("/voice-parse").post(isVerifiedUser, audioUpload.single("audio"), voiceParseDishes);
router.route("/top-revenue").get(isVerifiedUser, getTopRevenueDishes);
router.route("/bulk").post(isVerifiedUser, bulkAddDishes);
router.route("/seed").post(isVerifiedUser, seedDishes);
router.route("/public").get(getOnlineDishes);  // no auth — customer-facing

router.route("/").post(isVerifiedUser, addDish);
router.route("/").get(isVerifiedUser, getDishes);
router.route("/:id").put(isVerifiedUser, updateDish);
router.route("/:id").delete(isVerifiedUser, deleteDish);

export default router;
