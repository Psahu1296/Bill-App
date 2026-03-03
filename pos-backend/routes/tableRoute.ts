import express from "express";
import { addTable, getTables, updateTable } from "../controllers/tableController";
const router = express.Router();
import { isVerifiedUser } from "../middlewares/tokenVerification";
 
router.route("/").post(isVerifiedUser , addTable);
router.route("/").get(isVerifiedUser , getTables);
router.route("/:id").put(isVerifiedUser , updateTable);

export default router;