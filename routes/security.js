import express from "express";
import * as securityController from "../controllers/securityController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

// All routes require authentication
router.use(protect);

// Security dashboard and statistics
router.get("/dashboard", securityController.getSecurityDashboard);

// Individual security scan operations
router.get("/:scanId", securityController.getSecurityScanById);
router.delete("/:scanId", securityController.deleteSecurityScan);

export default router;
