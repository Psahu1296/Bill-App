const express = require("express");
const { isVerifiedUser } = require("../middlewares/tokenVerification");
const { addDish, getDishes, updateDish, deleteDish, getFrequentDishes } = require("../controllers/dishController");
const router = express.Router();


router.route("/").post(isVerifiedUser, addDish);
router.route("/").get(isVerifiedUser, getDishes);
router.route("/:id").put(isVerifiedUser, updateDish);
router.route("/:id").delete(isVerifiedUser, deleteDish);
router.route("/frequent").get(getFrequentDishes);

module.exports = router;