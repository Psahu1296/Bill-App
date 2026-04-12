import express from "express";
import multer from "multer";
import { uploadAndMigrateDb } from "../controllers/migrationController";

const router = express.Router();

// Configure multer to temporarily store the uploaded SQLite file
const upload = multer({ dest: "/tmp/migration-uploads/" });

// POST /api/migration/upload - No auth needed if they're launching from their local authenticated machine, 
// but you might wrap this in 'authenticateToken' if required!
router.post("/upload", upload.single("database"), uploadAndMigrateDb);

export default router;
